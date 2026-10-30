import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

const hashToken = (value) => createHash("sha256").update(value, "utf8").digest();
const safeTokenMatch = (candidate, expected) => timingSafeEqual(hashToken(candidate), hashToken(expected));

export function createApp({ apiToken = process.env.API_TOKEN } = {}) {
  const app = express();
  const projects = new Map();

  app.disable("x-powered-by");
  app.disable("etag");
  app.use(helmet());
  app.use(express.json({ limit: "100kb", strict: true, type: "application/json" }));
  app.use(rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "rate_limit_exceeded" })
  }));

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  app.use("/api", (req, res, next) => {
    if (!apiToken || apiToken.length < 32) {
      return res.status(503).json({ error: "authentication_not_configured" });
    }
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("authorization") || "");
    if (!match || !safeTokenMatch(match[1], apiToken)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  });

  app.get("/api/projects", (_req, res) => res.json({ data: [...projects.values()] }));

  app.post("/api/projects", (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "invalid_project" });
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    if (!name || name.length > 120 || description.length > 2000) {
      return res.status(400).json({ error: "invalid_project", message: "A name (1-120 chars) and description (up to 2000 chars) are required." });
    }
    const project = { id: randomUUID(), name, description, createdAt: new Date().toISOString() };
    projects.set(project.id, project);
    console.info(JSON.stringify({ event: "project.created", projectId: project.id, occurredAt: project.createdAt }));
    return res.status(201).json({ data: project });
  });

  app.get("/api/projects/:id", (req, res) => {
    const project = projects.get(req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    return res.json({ data: project });
  });

  app.get("/api/reports/summary", (_req, res) => res.json({
    data: { projectCount: projects.size, generatedAt: new Date().toISOString(), storage: "process-memory",
      note: "This summary covers in-memory records in this process only." }
  }));

  app.use((_req, res) => res.status(404).json({ error: "not_found" }));
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "invalid_json" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
    return res.status(500).json({ error: "internal_server_error" });
  });
  return app;
}
