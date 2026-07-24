import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { config, supabase } from "../config.js";
import { requireJwt, requireScope } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

export const externalRoutes = new Hono<AppEnv>();

externalRoutes.use("*", requireJwt);

externalRoutes.post("/files/upload-requests", requireScope("forest.write"), async (c) => {
  const body = await c.req.json<{ fileName: string }>();
  const objectId = randomUUID();
  const safeFileName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${objectId}/${safeFileName}`;
  const { data, error } = await supabase.storage.from(config.storageBucket).createSignedUploadUrl(objectPath);
  if (error) throw error;
  return c.json({ data: {
    uploadUrl: data.signedUrl,
    objectUri: `supabase://${config.storageBucket}/${objectPath}`,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  } }, 201);
});

externalRoutes.get("/reference-data/:type", requireScope("forest.read"), (c) => {
  return c.json({ data: [], page: { nextCursor: null, limit: 50 }, meta: { type: c.req.param("type") } });
});
