import { createMiddleware } from "hono/factory";
import { jwt } from "hono/jwt";
import { config } from "../config.js";
import type { AppEnv, JwtPayload } from "../types.js";

const verifyJwt = jwt({ secret: config.jwtSecret, alg: "HS256" });

export const requireJwt = createMiddleware<AppEnv>(async (c, next) => {
  if (!config.authRequired) return next();
  return verifyJwt(c, next);
});

export function requireScope(scope: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (!config.authRequired) return next();

    const payload = c.get("jwtPayload") as JwtPayload;
    const metadata = payload.app_metadata ?? {};
    const scopes = [
      ...(payload.scopes ?? []),
      ...(metadata.scopes ?? []),
      ...(payload.scope ?? "").split(/\s+/),
      ...(metadata.scope ?? "").split(/\s+/),
    ].filter(Boolean);

    if (!scopes.includes(scope) && !scopes.includes("forest.admin")) {
      return c.json({ error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." } }, 403);
    }
    await next();
  });
}
