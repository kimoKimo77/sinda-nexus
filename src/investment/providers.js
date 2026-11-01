const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ITEMS = 50;

function isoFromSeconds(value) {
  const date = new Date(Number(value) * 1000);
  if (!Number.isFinite(date.getTime())) throw new TypeError("Invalid provider timestamp.");
  return date.toISOString();
}
function requireNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError("Invalid " + label + ".");
  return number;
}
function snapshot(market, source, asOf, items) {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError("Provider returned no usable market data.");
  return { market, source, asOf, items: items.slice(0, MAX_ITEMS) };
}
function createHttpClient(fetchImpl, timeoutMs) {
  return async (url, options = {}) => {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json", ...options.headers },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error("Market provider HTTP " + response.status);
    return response.json();
  };
}

export function createMarketDataProvider({ env = process.env, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required.");
  const get = createHttpClient(fetchImpl, timeoutMs);
  const providers = {
    async crypto() {
      const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
      const rows = await Promise.all(symbols.map(symbol => get("https://data-api.binance.vision/api/v3/ticker/price?symbol=" + symbol)));
      const asOf = new Date().toISOString();
      return snapshot("crypto", "Binance public spot market data (USDT pairs)", asOf, rows.map(row => ({
        symbol: row.symbol, name: row.symbol.replace("USDT", ""), price: requireNumber(row.price, "crypto price"), currency: "USDT"
      })));
    },
    async forex() {
      const data = await get("https://api.frankfurter.dev/v2/rates?base=USD&quotes=SAR,EUR,GBP,JPY");
      const rows = Array.isArray(data) ? data : data.rates;
      if (!Array.isArray(rows) || !rows.length) throw new TypeError("Frankfurter returned no rates.");
      const asOf = rows[0].date + "T16:00:00.000Z";
      return snapshot("forex", "Frankfurter reference exchange rates (daily; not executable quotes)", asOf, rows.map(row => ({
        symbol: "USD/" + row.quote, name: "US dollar to " + row.quote, price: requireNumber(row.rate, "FX rate"), currency: row.quote
      })));
    },
    async gold() {
      if (!env.GOLDAPI_ACCESS_TOKEN) throw new Error("GOLDAPI_ACCESS_TOKEN is not configured.");
      const data = await get("https://www.goldapi.io/api/XAU/SAR", { headers: { "x-access-token": env.GOLDAPI_ACCESS_TOKEN } });
      return snapshot("gold", "GoldAPI.io spot gold (XAU/SAR)", isoFromSeconds(data.timestamp), [{
        symbol: "XAU/SAR", name: "Gold spot per troy ounce", price: requireNumber(data.price, "gold price"), currency: "SAR",
        changePercent: Number.isFinite(Number(data.change_percent)) ? Number(data.change_percent) : null
      }]);
    },
    async stocks() {
      if (!env.SAHMK_API_KEY) throw new Error("SAHMK_API_KEY is not configured.");
      const symbols = (env.SAHMK_STOCK_SYMBOLS || "2222,1120").split(",").map(value => value.trim()).filter(Boolean).slice(0, 10);
      const rows = await Promise.all(symbols.map(async symbol => {
        const data = await get("https://api.sahmk.sa/api/v1/quote/" + encodeURIComponent(symbol) + "/", { headers: { "X-API-Key": env.SAHMK_API_KEY } });
        return { symbol, name: data.name_en || data.name_ar || symbol, price: requireNumber(data.price, "Saudi stock price"), currency: "SAR", changePercent: Number.isFinite(Number(data.change_percent)) ? Number(data.change_percent) : null, updatedAt: data.updated_at };
      }));
      const times = rows.map(row => Date.parse(row.updatedAt)).filter(Number.isFinite);
      if (times.length !== rows.length) throw new TypeError("SAHMK omitted quote timestamps.");
      return snapshot("stocks", "SAHMK Saudi equities quotes", new Date(Math.min(...times)).toISOString(), rows);
    },
    async ["real-estate"]() {
      if (!env.KITE_API_KEY) throw new Error("KITE_API_KEY is not configured.");
      const data = await get("https://api.kite.sa/v1/market/registered-rents?city=" + encodeURIComponent(env.KITE_CITY || "riyadh") + "&limit=10", {
        headers: { authorization: "Bearer " + env.KITE_API_KEY }
      });
      const rows = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      if (!rows.length) throw new TypeError("Kite returned no registered-rent records.");
      const items = rows.map((row, index) => ({
        symbol: String(row.neighborhood_id || row.neighborhood || row.id || "RIYADH-" + (index + 1)),
        name: String(row.neighborhood_name || row.neighborhood || row.name || "Registered rent statistic"),
        price: requireNumber(row.median_rent ?? row.average_rent ?? row.price ?? row.value, "registered rent"),
        currency: "SAR"
      }));
      const dates = rows.map(row => Date.parse(row.as_of || row.updated_at || row.period_end)).filter(Number.isFinite);
      if (!dates.length) throw new TypeError("Kite omitted registered-rent dates.");
      return snapshot("real-estate", "Kite Saudi registered-rent market data (not asking listings)", new Date(Math.min(...dates)).toISOString(), items);
    }
  };
  return Object.freeze({
    async getSnapshot(market) {
      const provider = providers[market];
      if (!provider) throw new TypeError("Unsupported market.");
      return provider();
    }
  });
}
