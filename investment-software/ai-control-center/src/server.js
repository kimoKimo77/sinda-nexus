import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createApp } from "./app.js";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.CONTROL_CENTER_ADMIN_TOKEN || Buffer.byteLength(process.env.CONTROL_CENTER_ADMIN_TOKEN) < 32)
  throw new Error("CONTROL_CENTER_ADMIN_TOKEN must be at least 32 bytes");
if (!process.env.KEY_ENCRYPTION_KEY) throw new Error("KEY_ENCRYPTION_KEY is required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined });
const app = createApp({ pool });
const server = app.listen(Number(process.env.PORT || 4180), "127.0.0.1");
const shutdown = async () => { server.close(); await pool.end(); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
