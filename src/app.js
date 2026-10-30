import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { validateEvmTransaction, validatePayloadHash } from "./web3/validation.js";

export function createApp({ fetchImpl = globalThis.fetch, rpcUrls = process.env, apiKey = process.env.WEB3_VALIDATION_API_KEY } = {}) {
  const app = express();
  const projects = new Map();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb", strict: true }));
  app.use(rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    limit: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: "draft-8",
    legacyHeaders: false
  }));
  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

  const protectWeb3 = (req, res, next) => {
    if (process.env.NODE_ENV === "production" && !apiKey) {
      return res.status(503).json({ error: "web3_validation_not_configured" });
    }
    if (!apiKey) return next();
    const supplied = req.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const expectedBuffer = Buffer.from(apiKey);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  };

  app.post("/api/web3/validate", protectWeb3, async (req, res) => {
    const { network, transactionHash } = req.body ?? {};
    const result = await validateEvmTransaction({ network, transactionHash, rpcUrls, fetchImpl });
    return res.status(result.status === "invalid" ? 422 : 200).json({ data: result });
  });
  app.post("/api/web3/hash", protectWeb3, (req, res) => {
    try {
      const sha256 = validatePayloadHash(req.body?.payload);
      return res.status(200).json({ data: { algorithm: "SHA-256", sha256 } });
    } catch {
      return res.status(400).json({ error: "invalid_payload", message: "payload must be a string up to 1 MB." });
    }
  });

  app.get("/api/projects", (_req, res) => res.json({ data: [...projects.values()] }));
  app.post("/api/projects", (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!name || name.length > 120 || description.length > 2000) {
      return res.status(400).json({ error: "invalid_project", message: "A name (1-120 chars) and description (up to 2000 chars) are required." });
    }
    const project = { id: randomUUID(), name, description, createdAt: new Date().toISOString() };
    projects.set(project.id, project);
    return res.status(201).json({ data: project });
  });
  app.get("/api/projects/:id", (req, res) => {
    const project = projects.get(req.params.id);
    if (!project) return res.status(404).json({ error: "not_found" });
    return res.json({ data: project });
  });
  app.get("/api/reports/summary", (_req, res) => res.json({
    data: { projectCount: projects.size, generatedAt: new Date().toISOString(), note: "Summary covers in-memory project records for this process only." }
  }));
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "invalid_json" });
    return res.status(500).json({ error: "internal_server_error" });
  });
  return app;
}