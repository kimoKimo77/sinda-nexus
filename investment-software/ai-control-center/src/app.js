import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { encryptSecret } from "./crypto.js";

const credentialInput = z.object({
  provider: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9._-]+$/),
  label: z.string().trim().min(2).max(100),
  apiKey: z.string().min(8).max(4096)
}).strict();

function authorized(req) {
  const expected = Buffer.from(process.env.CONTROL_CENTER_ADMIN_TOKEN || "");
  const supplied = Buffer.from((req.get("authorization") || "").replace(/^Bearer /, ""));
  return expected.length >= 32 && supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createApp({ pool }) {
  if (!pool) throw new Error("PostgreSQL pool required");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "8kb", strict: true }));
  const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");
  app.use(express.static(webDir, { index: "index.html", dotfiles: "deny", fallthrough: true }));
  const origins = (process.env.CORS_ORIGIN || "").split(",").map(v => v.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && origins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false }));
  app.use((req, res, next) => authorized(req) ? next() : res.status(401).json({ error: "Unauthorized" }));

  app.get("/health", async (_req, res) => {
    try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "connected" }); }
    catch { res.status(503).json({ status: "unavailable" }); }
  });

  app.get("/api/credentials", async (_req, res, next) => {
    try {
      const result = await pool.query(
        "SELECT id,provider,label,key_fingerprint,created_at,updated_at FROM api_credentials ORDER BY created_at DESC LIMIT 200"
      );
      res.json({ credentials: result.rows });
    } catch (error) { next(error); }
  });

  app.post("/api/credentials", async (req, res, next) => {
    const parsed = credentialInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credential input" });
    try {
      const encrypted = encryptSecret(parsed.data.apiKey);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const saved = await client.query(
          "INSERT INTO api_credentials(provider,label,key_ciphertext,key_iv,key_auth_tag,key_fingerprint) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,provider,label,key_fingerprint,created_at",
          [parsed.data.provider, parsed.data.label, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.fingerprint]
        );
        await client.query(
          "INSERT INTO control_audit_events(action,credential_id,metadata) VALUES('credential.create',$1,$2)",
          [saved.rows[0].id, JSON.stringify({ provider: parsed.data.provider })]
        );
        await client.query("COMMIT");
        res.status(201).json({ credential: saved.rows[0], secretReturned: false });
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    } catch (error) { next(error); }
  });

  app.delete("/api/credentials/:id", async (req, res, next) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ error: "Invalid credential id" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await client.query("DELETE FROM api_credentials WHERE id=$1 RETURNING id,provider", [req.params.id]);
      if (!deleted.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Credential not found" }); }
      await client.query("INSERT INTO control_audit_events(action,credential_id,metadata) VALUES('credential.delete',$1,$2)",
        [deleted.rows[0].id, JSON.stringify({ provider: deleted.rows[0].provider })]);
      await client.query("COMMIT");
      res.status(204).end();
    } catch (error) { await client.query("ROLLBACK"); next(error); }
    finally { client.release(); }
  });

  app.get("/api/audit", async (_req, res, next) => {
    try {
      const result = await pool.query("SELECT id,action,credential_id,metadata,created_at FROM control_audit_events ORDER BY id DESC LIMIT 200");
      res.json({ events: result.rows });
    } catch (error) { next(error); }
  });

  app.use((error, _req, res, _next) => {
    // Never log request bodies or credential material.
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
