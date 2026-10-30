const BASE_URL = "https://api.g.alchemy.com/prices/v1";
const SYMBOL_PATTERN = /^[A-Z0-9]{2,20}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const NETWORK_PATTERN = /^[a-z0-9-]{2,40}$/;
const ISO_PATTERN = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/;
const INTERVALS = new Set(["1m", "5m", "1h", "1d"]);

const MOCK_PRICES = Object.freeze({
  ETH: "3200.00",
  BTC: "68000.00",
  USDT: "1.00"
});

function mockPrice(symbol, currency = "usd") {
  const usd = MOCK_PRICES[symbol] ?? "10.00";
  const multiplier = currency.toLowerCase() === "usd" ? 1 : 1;
  return {
    currency: currency.toLowerCase(),
    value: (Number(usd) * multiplier).toFixed(2),
    lastUpdatedAt: "2026-01-01T00:00:00Z"
  };
}

export class AlchemyPricesError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = "AlchemyPricesError";
    this.code = code;
    this.status = status;
  }
}

export function createAlchemyPricesService({
  mode = process.env.ALCHEMY_PRICES_MODE ?? "mock",
  apiKey = process.env.ALCHEMY_API_KEY,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!["mock", "alchemy"].includes(mode)) {
    throw new TypeError("invalid_prices_mode");
  }

  async function request(path, { method = "GET", query, body } = {}) {
    if (mode === "mock") return null;
    if (!apiKey) throw new AlchemyPricesError("prices_provider_not_configured", 503);
    const url = new URL(`${BASE_URL}/${path}`);
    if (query) url.search = query.toString();
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(8_000)
      });
    } catch {
      throw new AlchemyPricesError("prices_provider_unavailable", 502);
    }
    if (response.status === 429) throw new AlchemyPricesError("prices_rate_limited", 429);
    if (!response.ok) throw new AlchemyPricesError("prices_provider_error", 502);
    try {
      return await response.json();
    } catch {
      throw new AlchemyPricesError("prices_invalid_provider_response", 502);
    }
  }

  return Object.freeze({
    async bySymbol(symbols) {
      if (!Array.isArray(symbols) || symbols.length < 1 || symbols.length > 25 ||
          symbols.some((s) => typeof s !== "string" || !SYMBOL_PATTERN.test(s))) {
        throw new AlchemyPricesError("invalid_symbols", 400);
      }
      const normalized = [...new Set(symbols.map((s) => s.toUpperCase()))];
      if (mode === "mock") {
        return { mode, data: normalized.map((symbol) => ({
          symbol,
          prices: [mockPrice(symbol)],
          error: null
        })) };
      }
      const query = new URLSearchParams();
      normalized.forEach((symbol) => query.append("symbols", symbol));
      const payload = await request("tokens/by-symbol", { query });
      if (!Array.isArray(payload?.data)) throw new AlchemyPricesError("prices_invalid_provider_response");
      return { mode, ...payload };
    },

    async byAddress(addresses) {
      if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 25 ||
          addresses.some((item) => !item || typeof item !== "object" ||
            typeof item.network !== "string" || !NETWORK_PATTERN.test(item.network) ||
            typeof item.address !== "string" || !ADDRESS_PATTERN.test(item.address))) {
        throw new AlchemyPricesError("invalid_addresses", 400);
      }
      const normalized = addresses.map(({ network, address }) => ({
        network,
        address: address.toLowerCase()
      }));
      if (mode === "mock") {
        return { mode, data: normalized.map((item) => ({
          ...item,
          prices: [mockPrice("UNKNOWN")],
          error: null
        })) };
      }
      const payload = await request("tokens/by-address", {
        method: "POST",
        body: { addresses: normalized }
      });
      if (!Array.isArray(payload?.data)) throw new AlchemyPricesError("prices_invalid_provider_response");
      return { mode, ...payload };
    },

    async historical(input) {
      const validSymbol = typeof input?.symbol === "string" && SYMBOL_PATTERN.test(input.symbol);
      const validAddress = typeof input?.network === "string" &&
        NETWORK_PATTERN.test(input.network) &&
        typeof input?.address === "string" && ADDRESS_PATTERN.test(input.address);
      if ((!validSymbol && !validAddress) ||
          (validSymbol && (input.network !== undefined || input.address !== undefined)) ||
          (validAddress && input.symbol !== undefined) ||
          typeof input.startTime !== "string" || !ISO_PATTERN.test(input.startTime) ||
          typeof input.endTime !== "string" || !ISO_PATTERN.test(input.endTime) ||
          Number.isNaN(Date.parse(input.startTime)) || Number.isNaN(Date.parse(input.endTime)) ||
          Date.parse(input.startTime) >= Date.parse(input.endTime) ||
          !INTERVALS.has(input.interval ?? "1d") ||
          (input.withMarketData !== undefined && typeof input.withMarketData !== "boolean")) {
        throw new AlchemyPricesError("invalid_historical_query", 400);
      }
      const body = {
        ...(validSymbol ? { symbol: input.symbol.toUpperCase() } :
          { network: input.network, address: input.address.toLowerCase() }),
        startTime: input.startTime,
        endTime: input.endTime,
        interval: input.interval ?? "1d",
        ...(input.withMarketData !== undefined ? { withMarketData: input.withMarketData } : {})
      };
      if (mode === "mock") {
        return {
          mode,
          ...(validSymbol ? { symbol: body.symbol } : { network: body.network, address: body.address }),
          currency: "usd",
          data: [
            { value: "3000.00", timestamp: body.startTime },
            { value: "3200.00", timestamp: body.endTime }
          ]
        };
      }
      const payload = await request("tokens/historical", { method: "POST", body });
      if (!Array.isArray(payload?.data)) throw new AlchemyPricesError("prices_invalid_provider_response");
      return { mode, ...payload };
    }
  });
}
