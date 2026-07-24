import type { JwtVariables } from "hono/jwt";

export type AppEnv = {
  Variables: JwtVariables;
};

export type JwtPayload = {
  sub?: string;
  scope?: string;
  scopes?: string[];
  app_metadata?: {
    scope?: string;
    scopes?: string[];
  };
};

export type ResourceDefinition = {
  schema: "core" | "wildfire" | "landslide";
  table: string;
  id: string;
  orderBy: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    traceId: string;
  };
};
