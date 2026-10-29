import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseTokens(value) {
  return String(value ?? "").split(",").map((token) => token.trim()).filter(Boolean);
}

function tokenMatches(candidate, tokens) {
  if (!candidate) return false;
  const candidateBuffer = Buffer.from(candidate);
  return tokens.some((token) => {
    const expectedBuffer = Buffer.from(token);
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

export function createApp(options = {}) {
  const app = express();
  const projects = new Map();
  const tokens = parseTokens(options.apiTokens ?? process.env.API_TOKENS);
  const storageFileValue = options.dataFile ?? process.env.DATA_FILE ?? "./data/projects.json";
  const storageFile = storageFileValue === ":memory:" ? null : resolve(storageFileValue);
  const maxProjectsValue = options.maxProjects ?? process.env.MAX_PROJECTS;
  const maxProjects = maxProjectsValue === undefined || maxProjectsValue === "" ? 1000 : Number(maxProjectsValue);

  if (!Number.isInteger(maxProjects) || maxProjects < 1 || maxProjects > 100_000) {
    throw new Error("MAX_PROJECTS must be an integer between 1 and 100000");
  }

  if (storageFile) {
    mkdirSync(dirname(storageFile), { recursive: true, mode: 0o700 });
    if (existsSync(storageFile)) {
      const parsed = JSON.parse(readFileSync(storageFile, "utf8"));
      if (!Array.isArray(parsed) || parsed.length > maxProjects || parsed.some((item) =>
        !item || typeof item.id !== "string" || typeof item.name !== "string" ||
        typeof item.description !== "string" || typeof item.createdAt !== "string"
      )) {
        throw new Error("DATA_FILE must contain a valid project array within MAX_PROJECTS");
      }
      for (const project of parsed) projects.set(project.id, project);
    }
  }

  function persistProjects() {
    if (!storageFile) return;
    const temporaryFile = `${storageFile}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryFile, JSON.stringify([...projects.values()], null, 2), { encoding: "utf8", mode: 0o600 });
      renameSync(temporaryFile, storageFile);
    } catch (error) {
      try { unlinkSync(temporaryFile); } catch { /* no temporary file to clean up */ }
      throw error;
    }
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api", (req, res, next) => {
    if (tokens.length === 0) {
      return res.status(503).json({ error: "auth_not_configured", message: "API access is disabled until API_TOKENS is configured." });
    }
    const authorization = req.get("authorization") ?? "";
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match || !tokenMatches(match[1], tokens)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  });
  app.use("/api", express.json({ limit: "100kb", strict: true }));

  app.get("/api/projects", (_req, res) => {
    res.json({ data: [...projects.values()] });
  });

  app.post("/api/projects", (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";

    if (!name || name.length > 120 || description.length > 2000) {
      return res.status(400).json({ error: "invalid_project", message: "A name (1-120 chars) and description (up to 2000 chars) are required." });
    }
    if (projects.size >= maxProjects) {
      return res.status(409).json({ error: "project_limit_reached", message: "The configured project limit has been reached." });
    }

    const project = {
      id: randomUUID(),
      name,
      description,
      createdAt: new Date().toISOString()
    };
    projects.set(project.id, project);
    try {
      persistProjects();
    } catch {
      projects.delete(project.id);
      return res.status(500).json({ error: "storage_error" });
    }
    return res.status(201).json({ data: project });
  });

  app.get("/api/projects/:id", (req, res) => {
    const project = projects.get(req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    return res.json({ data: project });
  });

  app.get("/api/reports/summary", (_req, res) => {
    res.json({
      data: {
        projectCount: projects.size,
        generatedAt: new Date().toISOString()
      }
    });
  });

  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err?.type === "entity.too.large" || err?.status === 413) {
      return res.status(413).json({ error: "payload_too_large" });
    }
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "invalid_json" });
    }
    return res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}
