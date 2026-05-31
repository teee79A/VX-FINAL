/**
 * VYRDX Cloud — Serves the React + Three.js SPA from packages/vyrdx-app/dist.
 * In cloud mode, all non-API routes serve the SPA (client-side routing).
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import { readFile } from "node:fs/promises";
import path from "node:path";

const FORBIDDEN_PUBLIC_PREFIXES = [
  "/operational",
  "/campaign",
  "/ai-internal",
  "/evidence-private",
  "/shared",
  "/asus",
  "/kitty-internal",
  "/monitor",
  "/api/monitor",
  "/ops",
];

const CANONICAL_ROOM_PATHS = new Set([
  "/room/commercial",
  "/room/operations",
  "/room/cloudruntime",
  "/room/monitor",
  "/room/archive",
]);


function privateWorkflowWarning(pathOnly: string) {
  return {
    error: "private_vyrdon_workflow",
    message:
      "PRIVATE VYRDON COMPANY WORKFLOW ENGINEERING — NOT PUBLIC LOGIN — NOT OPEN ACCESS — PROPRIETARY INTERNAL CONTROL SURFACE FOR VYRDON.COM",
    path: pathOnly,
  };
}

function isForbiddenPublicPath(pathOnly: string): boolean {
  return FORBIDDEN_PUBLIC_PREFIXES.some((prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));
}

function resolveStaticDir(): string {
  // In production: dist/server/vyrdx.js → ../../vyrdx-static (sibling of dist/)
  // In dev: server/vyrdx.ts → ../packages/vyrdx-app/dist
  const fromDist = path.join(import.meta.dirname, "..", "..", "vyrdx-static");
  if (process.env.VYRDX_STATIC_DIR) return process.env.VYRDX_STATIC_DIR;

  // Check which path exists at runtime
  return fromDist;
}

function applyCacheHeadersForStaticAsset(res: { setHeader: (name: string, value: string) => void }, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return;
  }

  const assetSegment = `${path.sep}assets${path.sep}`;
  if (filePath.includes(assetSegment)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
}

export async function registerVyrdxRoutes(app: FastifyInstance): Promise<void> {
  const staticDir = resolveStaticDir();

  async function serveIndex(reply: FastifyReply) {
    try {
      const indexPath = path.join(staticDir, "index.html");
      const html = await readFile(indexPath, "utf-8");
      return reply
        .header("Cache-Control", "no-store, max-age=0")
        .type("text/html")
        .send(html);
    } catch {
      return reply.code(404).send({ error: "VYRDx app not found" });
    }
  }

  // Landing — serve SPA directly (no redirect). Client router maps `/` → `/runtime`.
  app.get("/", async (_req, reply) => serveIndex(reply));

  // Serve static assets (JS, CSS, images)
  await app.register(fastifyStatic, {
    root: staticDir,
    prefix: "/",
    decorateReply: false,
    wildcard: true,
    setHeaders: (res, filePath) => {
      applyCacheHeadersForStaticAsset(res, filePath);
    },
  });

  // SPA fallback — all non-API, non-health routes serve index.html.
  // Never serve HTML for missing asset paths; that causes module MIME errors
  // and can poison edge cache with wrong content-type for JS/CSS files.
  app.setNotFoundHandler(async (req, reply) => {
    const rawPath = req.raw.url ?? req.url ?? "/";
    const pathOnly = rawPath.split("?")[0] ?? "/";
    if (isForbiddenPublicPath(pathOnly)) {
      return reply.code(403).type("application/json").send(privateWorkflowWarning(pathOnly));
    }

    if (pathOnly === "/room" || pathOnly === "/rooms") {
      return reply.code(403).type("application/json").send(privateWorkflowWarning(pathOnly));
    }

    if (pathOnly.startsWith("/rooms/")) {
      const canonical = pathOnly.replace(/^\/rooms\//, "/room/");
      if (!CANONICAL_ROOM_PATHS.has(canonical)) {
        return reply.code(403).type("application/json").send(privateWorkflowWarning(pathOnly));
      }
      return reply.redirect(canonical, 308);
    }

    if (pathOnly.startsWith("/room/") && !CANONICAL_ROOM_PATHS.has(pathOnly)) {
      return reply.code(403).type("application/json").send(privateWorkflowWarning(pathOnly));
    }

    const isStaticAsset =
      pathOnly.startsWith("/assets/") ||
      /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i.test(pathOnly);

    if (isStaticAsset) {
      return reply.code(404).type("text/plain").send("Not Found");
    }

    return serveIndex(reply);
  });
}
