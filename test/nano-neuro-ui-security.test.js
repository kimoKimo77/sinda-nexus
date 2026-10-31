import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../web/nano-neuro-preview.html", import.meta.url), "utf8");
const script = await readFile(new URL("../web/nano-neuro-preview.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../web/nano-neuro-preview.css", import.meta.url), "utf8");

test("preview UI uses a restrictive no-network content security policy", () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /src="\.\/nano-neuro-preview\.js"/);
  assert.match(html, /href="\.\/nano-neuro-preview\.css"/);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
});

test("preview assets have no dynamic code execution, storage or network APIs", () => {
  const combined = `${script}\n${styles}`;
  assert.doesNotMatch(combined, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|\beval\s*\(|new\s+Function|innerHTML|localStorage|sessionStorage/i);
  assert.doesNotMatch(styles, /url\s*\(/i);
  assert.match(script, /addEventListener\("click"/);
});
