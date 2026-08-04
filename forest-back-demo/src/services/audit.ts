import type { Context } from "hono";
import { supabase } from "../config.js";
import type { AppEnv, JwtPayload } from "../types.js";
import { toDatabase } from "./database.js";

type AuditEntry = {
  eventId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  requestId?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  result?: "SUCCEEDED" | "FAILED" | "DENIED";
  errorDetail?: string | null;
};

export async function writeAuditLog(c: Context<AppEnv>, entry: AuditEntry) {
  const payload = c.get("jwtPayload") as JwtPayload | undefined;
  const actorId = payload?.sub ?? (process.env.AUTH_REQUIRED === "true" ? null : "local-demo");
  const actorOrgCode = payload?.app_metadata?.orgCode ?? null;
  const candidateRequestId = entry.requestId ?? c.req.header("Idempotency-Key") ?? null;
  const requestId = candidateRequestId && /^[0-9a-f-]{36}$/i.test(candidateRequestId)
    ? candidateRequestId
    : null;
  const { error } = await supabase.schema("core").from("audit_log").insert(toDatabase({
    eventId: entry.eventId ?? null,
    actorId,
    actorOrgCode,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    requestId,
    beforeValue: entry.beforeValue,
    afterValue: entry.afterValue,
    sourceSystem: "forest-back-demo",
    result: entry.result ?? "SUCCEEDED",
    errorDetail: entry.errorDetail ?? null,
  }));
  if (error) throw error;
}
