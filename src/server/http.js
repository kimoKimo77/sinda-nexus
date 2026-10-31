import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { DASHBOARD_HTML } from "../dashboard/page.js";
import { DASHBOARD_CLIENT_JS } from "../dashboard/client-asset.js";

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
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
  });
  response.end(body);
}

async function readJson(request, maxBytes) {
  let size=0;
  const chunks=[];
  for await (const chunk of request) {
    size+=chunk.length;
    if (size>maxBytes) {
      const error=new Error("Request body too large.");
      error.status=413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const parsed=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed!=="object" || Array.isArray(parsed)) throw new Error("Object required.");
    return parsed;
  } catch {
    const error=new Error("A valid JSON object is required.");
    error.status=400;
    throw error;
  }
}

export function createSindaHttpServer({
  healthChecks = {}, modules = PREVIEW_MODULES, maxRequestsPerMinute = 120,
  dashboard, maxBodyBytes = 16_384
} = {}) {
  const requests=[];
  return createServer(async (request,response) => {
    const requestId=randomUUID();
    response.setHeader("x-request-id",requestId);
    try {
      if (!["GET","HEAD","POST"].includes(request.method)) {
        sendJson(response,405,{error:"method_not_allowed",requestId});
        return;
      }
      const now=Date.now();
      while(requests.length && requests[0]<=now-60_000) requests.shift();
      if(requests.length>=maxRequestsPerMinute) {
        sendJson(response,429,{error:"rate_limited",requestId});
        return;
      }
      requests.push(now);

      const url=new URL(request.url ?? "/", "http://localhost");
      const pathname=url.pathname;
      if(pathname==="/dashboard" && request.method==="GET") {
        const body=DASHBOARD_HTML;
        response.writeHead(200,{"content-type":"text/html; charset=utf-8","content-length":Buffer.byteLength(body),"cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
        response.end(body);
        return;
      }
      if(pathname==="/dashboard.js" && request.method==="GET") {
        const body=DASHBOARD_CLIENT_JS;
        response.writeHead(200,{"content-type":"text/javascript; charset=utf-8","content-length":Buffer.byteLength(body),"cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; script-src 'self'"});
        response.end(body);
        return;
      }
      if(pathname==="/healthz" && ["GET","HEAD"].includes(request.method)) {
        sendJson(response,200,{status:"ok",service:"sinda-sovereign-preview",requestId});
        return;
      }
      if(pathname==="/readyz" && ["GET","HEAD"].includes(request.method)) {
        const checks={};
        for(const [name,check] of Object.entries(healthChecks)) {
          try { checks[name]=(await check())===true?"ok":"not_ready"; }
          catch { checks[name]="error"; }
        }
        const checkNames=Object.keys(checks);
        const ready=checkNames.length>0 && checkNames.every(name=>checks[name]==="ok");
        sendJson(response,ready?200:503,{status:ready?"ready":"not_ready",checks,requestId});
        return;
      }
      if(pathname==="/api/v1/modules" && request.method==="GET") {
        sendJson(response,200,{mode:"preview",modules,restrictions:{
          real_fundraising:false,custody_or_private_keys:false,
          mainnet_minting_or_deployment:false,financial_transactions:false
        },requestId});
        return;
      }
      if(["/healthz","/readyz","/api/v1/modules","/dashboard","/dashboard.js"].includes(pathname)) {
        sendJson(response,405,{error:"method_not_allowed",requestId});
        return;
      }
      const dashboardRoute=pathname==="/api/v1/auth/login" || pathname==="/api/v1/auth/me" || pathname==="/api/v1/projects" || /^\/api\/v1\/projects\/[0-9a-f-]{36}\/(dashboard|agents)$/i.test(pathname);
      if(!dashboard && dashboardRoute) {
        sendJson(response,503,{error:"dashboard_not_configured",requestId});
        return;
      }
      if(pathname==="/api/v1/auth/login" && request.method==="POST") {
        const body=await readJson(request,maxBodyBytes);
        const result=await dashboard.login(body);
        sendJson(response,200,{...result,requestId});
        return;
      }
      if(pathname==="/api/v1/auth/me" && request.method==="GET") {
        sendJson(response,200,{user:await dashboard.me(request),requestId});
        return;
      }
      if(pathname==="/api/v1/projects" && request.method==="GET") {
        sendJson(response,200,{projects:await dashboard.projects(request),requestId});
        return;
      }
      const projectMatch=pathname.match(/^\/api\/v1\/projects\/([0-9a-f-]{36})\/(dashboard|agents)$/i);
      if(projectMatch) {
        const [,projectId,resource]=projectMatch;
        if(resource==="dashboard" && request.method==="GET") {
          sendJson(response,200,{dashboard:await dashboard.dashboard(request,projectId),requestId});
          return;
        }
        if(resource==="agents" && request.method==="GET") {
          sendJson(response,200,{agents:await dashboard.agents(request,projectId),requestId});
          return;
        }
        if(resource==="agents" && request.method==="POST") {
          const body=await readJson(request,maxBodyBytes);
          sendJson(response,201,{agent:await dashboard.createAgent(request,projectId,body),requestId});
          return;
        }
      }
      sendJson(response,404,{error:"not_found",requestId});
    } catch(error) {
      const status=Number.isInteger(error.status)?error.status:500;
      sendJson(response,status,{error:status>=500?"internal_error":error.message,requestId});
    }
  });
}
