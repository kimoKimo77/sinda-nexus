import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(root, 'public');
const wallets = new Map();
const requests = new Map();
const MAX_BODY = 16 * 1024;
const WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const CHAINS = new Set(['1', '11155111']);

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function validAddress(value) { return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value); }
function secureHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
}
async function bodyJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('Request body too large'), { status: 413 });
  }
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function rateAllowed(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = requests.get(key) || { start: now, count: 0 };
  if (now - current.start > WINDOW_MS) { current.start = now; current.count = 0; }
  current.count++;
  requests.set(key, current);
  return current.count <= RATE_LIMIT;
}
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };

export function createServer() {
  return http.createServer(async (req, res) => {
    secureHeaders(res);
    if (!rateAllowed(req)) return json(res, 429, { error: 'Rate limit exceeded' });
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok', mode: 'preview', persistence: 'memory-only' });
      if (req.method === 'GET' && url.pathname === '/api/wallets') return json(res, 200, { items: [...wallets.values()] });
      if (req.method === 'POST' && url.pathname === '/api/wallets') {
        const data = await bodyJson(req);
        const address = typeof data.address === 'string' ? data.address.trim() : '';
        const label = typeof data.label === 'string' ? data.label.trim().slice(0, 64) : '';
        if (!validAddress(address)) return json(res, 400, { error: 'A valid 20-byte EVM address is required' });
        const key = address.toLowerCase();
        if (wallets.has(key)) return json(res, 409, { error: 'Wallet already exists' });
        const item = { id: randomUUID(), address, label, chainId: '1', createdAt: new Date().toISOString() };
        wallets.set(key, item);
        return json(res, 201, { item });
      }
      const remove = url.pathname.match(/^\/api\/wallets\/(0x[a-fA-F0-9]{40})$/);
      if (req.method === 'DELETE' && remove) {
        const existed = wallets.delete(remove[1].toLowerCase());
        return json(res, existed ? 200 : 404, existed ? { deleted: true } : { error: 'Wallet not found' });
      }
      const balance = url.pathname.match(/^\/api\/wallets\/(0x[a-fA-F0-9]{40})\/balance$/);
      if (req.method === 'GET' && balance) {
        const chainId = url.searchParams.get('chainid') || '1';
        if (!CHAINS.has(chainId)) return json(res, 400, { error: 'Unsupported chain for this preview' });
        const apiKey = process.env.ETHERSCAN_API_KEY;
        if (!apiKey) return json(res, 503, { error: 'Etherscan API is not configured; set ETHERSCAN_API_KEY on the server' });
        const endpoint = new URL('https://api.etherscan.io/v2/api');
        for (const [key, value] of Object.entries({ chainid: chainId, module:'account', action:'balance', address:balance[1], tag:'latest', apikey:apiKey })) endpoint.searchParams.set(key, value);
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return json(res, 502, { error: 'Etherscan upstream request failed' });
        const result = await response.json();
        if (result.status !== '1') return json(res, 502, { error: 'Etherscan returned an API error', detail: String(result.message || 'Unknown error') });
        return json(res, 200, { address: balance[1], chainId, balanceWei: result.result, source: 'Etherscan API V2' });
      }
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const safePath = normalize(requested).replace(/^([.][.][/\\])+/, '');
        const file = join(publicDir, safePath);
        if (!file.startsWith(publicDir)) return json(res, 403, { error: 'Forbidden' });
        try {
          const content = await readFile(file);
          res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
          return res.end(content);
        } catch { return json(res, 404, { error: 'Not found' }); }
      }
      return json(res, 404, { error: 'Not found' });
    } catch (error) {
      return json(res, error.status || 500, { error: error.status ? error.message : 'Internal server error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`SINDA Crypto Management Center listening on 127.0.0.1:${port}`));
}
