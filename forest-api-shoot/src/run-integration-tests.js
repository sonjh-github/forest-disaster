import { loadConfig } from "./config.js";
import { integrationTests, findIntegrationTest } from "./integration-tests/catalog.js";
import { ServerApi } from "./server-api.js";

const config = loadConfig();
const api = new ServerApi({ apiBaseUrl: config.apiBaseUrl, dryRun: config.dryRun, timeoutMs: config.requestTimeoutMs });
const requestedId = process.argv[2];
const requestedMode = process.argv[3] ?? "result";
const targets = requestedId ? [findIntegrationTest(requestedId)].filter(Boolean) : integrationTests.filter((test) => test.modes.includes(requestedMode));

if (!targets.length) {
  console.error(requestedId ? `테스트를 찾을 수 없습니다: ${requestedId}` : `실행 가능한 ${requestedMode} 테스트가 없습니다.`);
  process.exitCode = 1;
} else {
  const settled = await Promise.allSettled(targets.map(async (test) => {
    const result = await api.testIntegration(test.id, requestedMode, test.createEnvelope(requestedMode));
    return { id: test.id, durationMs: result.durationMs ?? 0 };
  }));
  let failed = 0;
  settled.forEach((item, index) => {
    const label = targets[index].id;
    if (item.status === "fulfilled") console.log(`PASS  ${label}  ${item.value.durationMs}ms`);
    else { failed += 1; console.error(`FAIL  ${label}  ${item.reason?.message ?? "Unknown error"}`); }
  });
  console.log(`TOTAL ${settled.length} / PASS ${settled.length - failed} / FAIL ${failed} / TIMEOUT ${config.requestTimeoutMs}ms`);
  if (failed) process.exitCode = 1;
}
