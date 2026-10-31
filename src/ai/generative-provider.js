export class GenerativeProvider {
  constructor({ endpoint, apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
    if (!endpoint || !model || typeof fetchImpl !== "function") throw new TypeError("endpoint, model, and fetch implementation are required.");
    const url = new URL(endpoint);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("Provider endpoint must use HTTPS (HTTP is allowed only for localhost).");
    this.endpoint = url.toString();
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async generateJSON({ system, input } = {}) {
    if (typeof system !== "string" || typeof input !== "string") throw new TypeError("system and input must be strings.");
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: "Bearer " + this.apiKey } : {})
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: input }]
      }),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw new Error("Generative provider returned HTTP " + response.status + ".");
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Provider response did not contain JSON content.");
    try { return JSON.parse(content); } catch { throw new Error("Provider returned invalid JSON."); }
  }
}
