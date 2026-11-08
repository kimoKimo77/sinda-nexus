import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.mjs';

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test('health endpoint reports preview and memory-only persistence', async () => withServer(async (base) => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).persistence, 'memory-only');
}));
test('wallet endpoint rejects malformed EVM address', async () => withServer(async (base) => {
  const response = await fetch(base + '/api/wallets', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ address:'0x123' }) });
  assert.equal(response.status, 400);
}));
test('wallet can be added, listed and deleted', async () => withServer(async (base) => {
  const address = '0x60f028C82f9f3bF71e0C13f9e8E7f916b345C000';
  const added = await fetch(base + '/api/wallets', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ address, label:'test' }) });
  assert.equal(added.status, 201);
  const listed = await (await fetch(base + '/api/wallets')).json();
  assert.equal(listed.items.length, 1);
  const deleted = await fetch(base + '/api/wallets/' + address, { method:'DELETE' });
  assert.equal(deleted.status, 200);
}));
test('security headers are present', async () => withServer(async (base) => {
  const response = await fetch(base + '/api/health');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
}));
