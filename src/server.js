import { createApp } from "./app.js";

const portValue = process.env.PORT;
const port = portValue === undefined || portValue === "" ? 3000 : Number(portValue);
const host = process.env.HOST?.trim() || "127.0.0.1";

if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const app = createApp();
const server = app.listen(port, host, () => {
  console.log(`Sinda Nexus API listening on http://${host}:${port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; closing HTTP server`);
  server.close((error) => {
    if (error) {
      console.error("Graceful shutdown failed", error);
      process.exitCode = 1;
    }
  });
  server.closeIdleConnections?.();
}

server.on("error", (error) => {
  console.error("HTTP server error", error);
  process.exitCode = 1;
});

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
