import { createClient } from "@supabase/supabase-js";
import { serverLogger } from "./logger.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env.`);
  return value;
}

function numberValue(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  host: process.env.HOST?.trim() || "0.0.0.0",
  port: numberValue("PORT", 8000),
  corsOrigin: process.env.CORS_ORIGIN?.trim() || "*",
  authRequired: process.env.AUTH_REQUIRED === "true",
  jwtSecret: process.env.JWT_SECRET?.trim() || "local-demo-secret-change-me",
  healthSchema: process.env.SUPABASE_HEALTH_SCHEMA?.trim() || "core",
  healthTable: process.env.SUPABASE_HEALTH_TABLE?.trim() || "disaster_event",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "forest-api",
};

const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
const supabaseSecretKey = required("SUPABASE_SECRET_KEY");

const loggedFetch: typeof fetch = async (input, init) => {
  const startedAt = Date.now();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const pathname = new URL(url).pathname;
  const method = init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method);
  try {
    const response = await fetch(input, init);
    serverLogger.info("supabase", "db.request.complete", {
      method,
      path: pathname,
      status: response.status,
      success: response.ok,
      durationMs: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    serverLogger.error("supabase", "db.request.failed", {
      method,
      path: pathname,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : "Unknown error",
    });
    throw error;
  }
};

if (supabaseSecretKey.startsWith("sb_publishable_") || supabaseSecretKey.startsWith("eyJ")) {
  throw new Error("SUPABASE_SECRET_KEY must be a server-only secret key.");
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { "X-Client-Info": "forest-back-demo/hono" },
    fetch: loggedFetch,
  },
});
