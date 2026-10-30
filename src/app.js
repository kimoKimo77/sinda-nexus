import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const BODY_LIMIT = "100kb";
const MIN_TOKEN_LENGTH = 32;

function parseTokens(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  const tokens = values.map((token) => String(token).trim()).filter(Boolean);
  if (tokens.some((token) => token.length < MIN_TOKEN_LENGTH)) {
    throw new Error(`API_TOKENS entries must be at least ${MIN_TOKEN_LENGTH} characters`);
  }
  return [...new Set(tokens)];
}

function tokenMatches(candidate, tokens) {
  if (typeof candidate !== "string" || !candidate) return false;
  const candidateBuffer = Buffer.from(candidate, "utf8");
  return tokens.some((token) => {
    const expectedBuffer = Buffer.from(token, "utf8");
    return candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

function positiveInteger(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

function isValidProject(item, seenIds) {
  if (!item || typeof item !== "object" || Array.isArray(item) ||
    typeof item.id !== "string" || !item.id.trim() ||
    typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 ||
    typeof item.description !== "string" || item.description.length > 2000 ||
    typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt)) ||
    seenIds.has(item.id)) {
    return false;
  }
  seenIds.add(item.id);
  return true;
}

export function createApp(options = {}) {
  const app = express();
  const projects = new Map();
  const tokens = parseTokens(options.apiTokens ?? process.env.API_TOKENS);
  const storageFileValue = options.dataFile ?? process.env.DATA_FILE ?? "./data/projects.json";
  const storageFile = storageFileValue === ":memory:" ? null : resolve(storageFileValue);
  const maxProjects = positiveInteger(
    options.maxProjects ?? process.env.MAX_PROJECTS,
    1000,
    "MAX_PROJECTS",
    100_000
  );
  const rateLimitWindowMs = positiveInteger(
    options.rateLimitWindowMs ?? process.env.RATE_LIMIT_WINDOW_MS,
    60_000,
    "RATE_LIMIT_WINDOW_MS",
    2_147_483_647
  );
  const rateLimitMax = positiveInteger(
    options.rateLimitMax ?? process.env.RATE_LIMIT_MAX,
    100,
    "RATE_LIMIT_MAX",
    1_000_000
  );

  if (storageFile) {
    mkdirSync(dirname(storageFile), { recursive: true, mode: 0o700 });
    if (existsSync(storageFile)) {
      const fileStat = lstatSync(storageFile);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        throw new Error("DATA_FILE must be a regular file, not a symlink or special file");
      }
      const parsed = JSON.parse(readFileSync(storageFile, "utf8"));
      const seenIds = new Set();
      if (!Array.isArray(parsed) || parsed.length > maxProjects ||
        parsed.some((item) => !isValidProject(item, seenIds))) {
        throw new Error("DATA_FILE must contain a valid project array with unique IDs within MAX_PROJECTS");
      }
      chmodSync(storageFile, 0o600);
      for (const project of parsed) projects.set(project.id, project);
    }
  }

  function persistProjects() {
    if (!storageFile) return;
    const temporaryFile = `${storageFile}.${process.pid}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryFile, JSON.stringify([...projects.values()], null, 2), {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600
      });
      renameSync(temporaryFile, storageFile);
    } catch (error) {
      try { unlinkSync(temporaryFile); } catch { /* temporary file may not exist */ }
      throw error;
    }
  }

  app.disable("x-powered-by");
  app.disable("etag");
  app.use(helmet());

  app.get("/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ status: "ok" });
  });

  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (tokens.length === 0) {
      return res.status(503).json({ error: "auth_not_configured" });
    }
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("authorization") ?? "");
    if (!match || !tokenMatches(match[1], tokens)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  });

  app.use("/api", rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "rate_limit_exceeded" })
  }));

  app.use("/api", express.json({ limit: BODY_LIMIT, strict: true, type: "application/json" }));

  app.get("/api/projects", (_req, res) => {
    return res.status(200).json({ data: [...projects.values()] });
  });

  app.post("/api/projects", (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "invalid_project" });
    }
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
    if (!name || name.length > 120 || description.length > 2000) {
      return res.status(400).json({ error: "invalid_project" });
    }
    if (projects.size >= maxProjects) {
      return res.status(409).json({ error: "project_limit_reached" });
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
    return res.status(200).json({ data: project });
  });

  app.get("/api/reports/summary", (_req, res) => {
    return res.status(200).json({
      data: {
        projectCount: projects.size,
        generatedAt: new Date().toISOString(),
        storage: storageFile ? "json-file-single-process" : "memory"
      }
    });
  });

  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

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
