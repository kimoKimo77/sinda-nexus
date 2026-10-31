import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export const PREVIEW_MODULES = Object.freeze([
  { id: "project-factory", name: "Commercial project factory", status: "planned", mode: "preview" },
  { id: "fundraising-simulator", name: "Crowdfunding simulator", status: "planned", mode: "simulation-only" },
  { id: "wallet-lab", name: "Sandbox wallet lab", status: "planned", mode: "test-data-only" },
  { id: "token-lab", name: "Digital asset and contract lab", status: "planned", mode: "testnet-only" },
  { id: "design-studio", name: "Digital engraving and design studio", status: "planned", mode: "offline-preview" },
  { id: "security-audit", name: "Security and audit center", status: "planned", mode: "read-only-preview" }
]);

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
  response.end(body);
}

export function createSindaHttpServer({ healthChecks = {}, modules = PREVIEW_MODULES, maxRequestsPerMinute = 120 } = {}) {
  const requests = [];
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);

    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { error: "method_not_allowed", requestId });
      return;
    }

    const now = Date.now();
    while (requests.length && requests[0] <= now - 60_000) requests.shift();
    if (requests.length >= maxRequestsPerMinute) {
      sendJson(response, 429, { error: "rate_limited", requestId });
      return;
    }
    requests.push(now);

    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    if (pathname === "/healthz") {
      sendJson(response, 200, { status: "ok", service: "sinda-sovereign-preview", requestId });
      return;
    }
    if (pathname === "/readyz") {
      const checks = {};
      for (const [name, check] of Object.entries(healthChecks)) {
        try { checks[name] = (await check()) === true ? "ok" : "not_ready"; }
        catch { checks[name] = "error"; }
      }
      const ready = Object.values(checks).every(value => value === "ok");
      sendJson(response, ready ? 200 : 503, { status: ready ? "ready" : "not_ready", checks, requestId });
      return;
    }
    if (pathname === "/api/v1/modules") {
      sendJson(response, 200, { mode: "preview", modules, restrictions: {
        real_fundraising: false,
        custody_or_private_keys: false,
        mainnet_minting_or_deployment: false,
        financial_transactions: false
      }, requestId });
      return;
    }
    sendJson(response, 404, { error: "not_found", requestId });
  });
}
