import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { ServerApi } from "./server-api.js";
import { logger } from "./logger.js";
import { findIntegrationTest, integrationTests } from "./integration-tests/catalog.js";
import { applyTestMode } from "./integration-tests/payload-modes.js";

const config = loadConfig();
const db = new ServerApi({ apiBaseUrl: config.apiBaseUrl, dryRun: config.dryRun, logger, timeoutMs: config.requestTimeoutMs });
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function staticFile(response, pathname) {
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^(index\.html|app\.css|app\.js)$/.test(name)) return false;
  const data = await readFile(join(publicDir, name));
  response.writeHead(200, { "Content-Type": contentTypes[extname(name)], "Cache-Control": "no-cache" });
  response.end(data);
  return true;
}

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 64 * 1024) throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }); }
}

async function pulseAllFieldDevices() {
  if (config.dryRun) return { ok: true, dryRun: true, targets: { assets: 0, personnel: 0 } };
  try {
    const response = await fetch(`${config.fieldSimulatorUrl}/v1/pulse-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.controlKey ? { "x-simulator-key": config.controlKey } : {}),
      },
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
    return { ok: true, ...payload.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function authorize(request) {
  if (!config.requireControlKey) return;
  const supplied = request.headers["x-simulator-key"];
  if (supplied !== config.controlKey) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
}

const server = http.createServer(async (request, response) => {
  const startedAt = Date.now();
  const pathname = new URL(request.url, `http://${request.headers.host ?? "localhost"}`).pathname;
  const origin = pathname.startsWith("/v1/") ? "http:api" : pathname === "/health" ? "http:health" : "http:ui";
  response.once("finish", () => logger.info(origin, "request.complete", {
    method: request.method,
    path: pathname,
    status: response.statusCode,
    durationMs: Date.now() - startedAt,
    clientOrigin: request.headers.origin,
  }));
  try {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (request.method === "GET" && await staticFile(response, url.pathname)) return;
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { status: "ok", dryRun: config.dryRun, requiresControlKey: config.requireControlKey });
    }
    authorize(request);
    if (request.method === "GET" && url.pathname === "/v1/integration-tests") {
      return json(response, 200, { data: integrationTests.map(({ createEnvelope, ...test }) => test), timeoutMs: config.requestTimeoutMs });
    }
    if (request.method === "POST" && url.pathname === "/v1/integration-tests/run-all") {
      const input = await body(request);
      const mode = input.mode ?? "result";
      const targets = integrationTests.filter((test) => test.modes.includes(mode));
      const settled = await Promise.allSettled(targets.map(async (test) => {
        const envelope = applyTestMode(test.createEnvelope(mode), {
          variationMode: input.variationMode,
          condition: input.condition,
          cycle: input.cycle,
        });
        const result = await db.testIntegration(test.id, mode, envelope);
        return { id: test.id, name: test.name, ok: true, ...result };
      }));
      const results = settled.map((item, index) => item.status === "fulfilled"
        ? item.value
        : { id: targets[index].id, name: targets[index].name, ok: false, error: item.reason?.message ?? "Unknown error" });
      const fleetPulse = mode === "result" ? await pulseAllFieldDevices() : null;
      return json(response, 200, { data: results, summary: { total: results.length, passed: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }, fleetPulse, timeoutMs: config.requestTimeoutMs });
    }
    if (request.method === "POST" && url.pathname === "/v1/integration-tests/run-selected") {
      const input = await body(request);
      const mode = input.mode ?? "result";
      const requestedIds = Array.isArray(input.ids) ? [...new Set(input.ids)] : [];
      if (!requestedIds.length) return json(response, 400, { error: { code: "NO_TEST_SELECTED", message: "실행할 기능을 하나 이상 선택해 주세요." } });
      const missingIds = requestedIds.filter((id) => !findIntegrationTest(id));
      if (missingIds.length) return json(response, 400, { error: { code: "TEST_NOT_FOUND", message: `연동 테스트를 찾을 수 없습니다: ${missingIds.join(", ")}` } });
      const targets = requestedIds.map((id) => findIntegrationTest(id));
      const unsupported = targets.filter((test) => !test.modes.includes(mode));
      if (unsupported.length) return json(response, 400, { error: { code: "MODE_NOT_SUPPORTED", message: `${mode} 미지원 기능: ${unsupported.map((test) => test.id).join(", ")}` } });
      const settled = await Promise.allSettled(targets.map(async (test) => {
        const envelope = applyTestMode(test.createEnvelope(mode), {
          variationMode: input.variationMode,
          condition: input.condition,
          cycle: input.cycle,
        });
        const result = await db.testIntegration(test.id, mode, envelope);
        return { id: test.id, name: test.name, domain: test.domain, ok: true, ...result };
      }));
      const results = settled.map((item, index) => item.status === "fulfilled"
        ? item.value
        : { id: targets[index].id, name: targets[index].name, domain: targets[index].domain, ok: false, error: item.reason?.message ?? "Unknown error" });
      return json(response, 200, { data: results, summary: { total: results.length, passed: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }, timeoutMs: config.requestTimeoutMs });
    }
    const integrationMatch = url.pathname.match(/^\/v1\/integration-tests\/(.+)$/);
    if (request.method === "POST" && integrationMatch) {
      const test = findIntegrationTest(decodeURIComponent(integrationMatch[1]));
      if (!test) return json(response, 404, { error: { code: "TEST_NOT_FOUND", message: "연동 테스트를 찾을 수 없습니다." } });
      const input = await body(request);
      const mode = input.mode ?? (test.modes.includes("result") ? "result" : "invoke");
      return json(response, 200, { data: await db.testIntegration(test.id, mode, test.createEnvelope(mode)), timeoutMs: config.requestTimeoutMs });
    }
    return json(response, 404, { error: { code: "NOT_FOUND", message: "Route not found" } });
  } catch (error) {
    logger.error(origin, "request.failed", { method: request.method, path: pathname, message: error.message });
    return json(response, error.statusCode ?? 500, { error: { code: error.statusCode ? "REQUEST_ERROR" : "INTERNAL_ERROR", message: error.message } });
  }
});

server.listen(config.port, config.host, () => {
  logger.info("server", "started", { url: `http://${config.host}:${config.port}`, mode: config.dryRun ? "dry-run" : "integration-test" });
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { server.close(() => process.exit(0)); });
}
