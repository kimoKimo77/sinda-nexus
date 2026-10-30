import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? "3000");
const host = process.env.HOST || "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer between 1 and 65535");
if (process.env.NODE_ENV === "production" && (!process.env.API_TOKEN || process.env.API_TOKEN.length < 32)) {
  throw new Error("A strong API_TOKEN (at least 32 characters) is required in production");
}

const server = createApp().listen(port, host, () => {
  console.log(`Sinda Nexus API listening on http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; closing HTTP server`);
  server.close((error) => {
    if (error) {
      console.error("Graceful shutdown failed", error);
      process.exitCode = 1;
    }
  });
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
