import { INVESTMENT_MARKETS, INVESTMENT_RESTRICTIONS } from "./catalog.js";

function requireIdentity(auth, request) {
  const identity = auth?.authenticate?.(request);
  if (!identity) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  return identity;
}

function optionalFiniteNumber(value, fieldName) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" && typeof value !== "string") {
    throw new TypeError("Market data provider returned an invalid " + fieldName + ".");
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new TypeError("Market data provider returned an invalid " + fieldName + ".");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError("Market data provider returned an invalid " + fieldName + ".");
  }
  return parsed;
}

function safeSnapshot(snapshot, market) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Market data provider returned an invalid snapshot.");
  }
  if (snapshot.market !== market || typeof snapshot.asOf !== "string" ||
      !Number.isFinite(Date.parse(snapshot.asOf)) ||
      typeof snapshot.source !== "string" || !snapshot.source.trim()) {
    throw new TypeError("Market data provider omitted valid provenance fields.");
  }
  if (!Array.isArray(snapshot.items) || snapshot.items.length > 100) {
    throw new TypeError("Market data provider must return at most 100 items.");
  }
  return {
    market,
    asOf: new Date(snapshot.asOf).toISOString(),
    source: snapshot.source.trim().slice(0, 120),
    items: snapshot.items.map(item => {
      if (!item || typeof item !== "object" || Array.isArray(item) ||
          typeof item.symbol !== "string" || !item.symbol.trim() ||
          typeof item.name !== "string" || !item.name.trim()) {
        throw new TypeError("Market data provider returned an invalid item.");
      }
      const price = optionalFiniteNumber(item.price, "price");
      if (price !== null && price < 0) {
        throw new TypeError("Market data provider returned an invalid price.");
      }
      return {
        symbol: item.symbol.trim().slice(0, 32),
        name: item.name.trim().slice(0, 120),
        price,
        currency: typeof item.currency === "string" && item.currency.trim()
          ? item.currency.trim().slice(0, 8)
          : null,
        changePercent: optionalFiniteNumber(item.changePercent, "changePercent")
      };
    })
  };
}

export function createInvestmentReadHandlers({ auth, marketDataProvider = null } = {}) {
  if (!auth || typeof auth.authenticate !== "function") {
    throw new TypeError("An authentication service is required.");
  }
  return {
    async markets(request) {
      const identity = requireIdentity(auth, request);
      return {
        userId: identity.sub,
        mode: "read-only",
        markets: INVESTMENT_MARKETS,
        restrictions: INVESTMENT_RESTRICTIONS
      };
    },
    async snapshot(request, marketId) {
      requireIdentity(auth, request);
      const market = INVESTMENT_MARKETS.find(item => item.id === marketId);
      if (!market) {
        const error = new Error("Unknown market.");
        error.status = 404;
        throw error;
      }
      if (!marketDataProvider || typeof marketDataProvider.getSnapshot !== "function") {
        return {
          market: marketId,
          status: "unavailable",
          data: null,
          reason: "market_data_provider_not_configured",
          message: "لم يتم ربط مصدر بيانات سوق موثوق بعد؛ لا تُعرض أسعار تجريبية على أنها أسعار حقيقية."
        };
      }
      try {
        return {
          market: marketId,
          status: "available",
          data: safeSnapshot(await marketDataProvider.getSnapshot(marketId), marketId)
        };
      } catch {
        return {
          market: marketId,
          status: "unavailable",
          data: null,
          reason: "market_data_provider_error"
        };
      }
    }
  };
}
