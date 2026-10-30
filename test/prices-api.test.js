import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createAlchemyPricesService } from "../src/prices/alchemy.js";

const address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const startTime = "2026-01-01T00:00:00Z";
const endTime = "2026-01-02T00:00:00Z";

test("mock symbol prices return deterministic fixture data", async () => {
  const result = await createAlchemyPricesService({ mode: "mock" }).bySymbol(["eth", "BTC"]);
  assert.equal(result.mode, "mock");
  assert.equal(result.data[0].symbol, "ETH");
  assert.equal(result.data[0].prices[0].value, "3200.00");
  assert.equal(result.data[1].symbol, "BTC");
});

test("symbol endpoint rejects invalid symbols", async () => {
  await assert.rejects(
    () => createAlchemyPricesService({ mode: "mock" }).bySymbol(["bad symbol"]),
    (error) => error.code === "invalid_symbols" && error.status === 400
  );
});

test("mock address prices validate network and address", async () => {
  const result = await createAlchemyPricesService({ mode: "mock" }).byAddress([
    { network: "eth-mainnet", address }
  ]);
  assert.equal(result.data[0].address, address);
  assert.equal(result.data[0].network, "eth-mainnet");
});

test("address endpoint rejects malformed contract addresses", async () => {
  await assert.rejects(
    () => createAlchemyPricesService({ mode: "mock" }).byAddress([
      { network: "eth-mainnet", address: "0x123" }
    ]),
    (error) => error.code === "invalid_addresses"
  );
});

test("mock historical prices return ordered sample points", async () => {
  const result = await createAlchemyPricesService({ mode: "mock" }).historical({
    symbol: "ETH", startTime, endTime, interval: "1d", withMarketData: true
  });
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].timestamp, startTime);
  assert.equal(result.data[1].timestamp, endTime);
});

test("historical endpoint rejects reversed time ranges", async () => {
  await assert.rejects(
    () => createAlchemyPricesService({ mode: "mock" }).historical({
      symbol: "ETH", startTime: endTime, endTime: startTime
    }),
    (error) => error.code === "invalid_historical_query" && error.status === 400
  );
});

test("historical endpoint accepts contract-address lookup", async () => {
  const result = await createAlchemyPricesService({ mode: "mock" }).historical({
    network: "eth-mainnet", address, startTime, endTime
  });
  assert.equal(result.network, "eth-mainnet");
  assert.equal(result.address, address);
});

test("Alch​emy mode keeps API key in Authorization header and posts address payload", async () => {
  let observed;
  const service = createAlchemyPricesService({
    mode: "alchemy",
    apiKey: "test-only-secret",
    fetchImpl: async (url, options) => {
      observed = { url: String(url), options };
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }
  });
  await service.byAddress([{ network: "eth-mainnet", address }]);
  assert.equal(observed.url, "https://api.g.alchemy.com/prices/v1/tokens/by-address");
  assert.equal(observed.options.headers.authorization, "Bearer test-only-secret");
  assert.deepEqual(JSON.parse(observed.options.body), {
    addresses: [{ network: "eth-mainnet", address }]
  });
});

test("provider 429 is mapped to a rate-limit error", async () => {
  const service = createAlchemyPricesService({
    mode: "alchemy",
    apiKey: "test",
    fetchImpl: async () => ({ ok: false, status: 429 })
  });
  await assert.rejects(
    () => service.bySymbol(["ETH"]),
    (error) => error.code === "prices_rate_limited" && error.status === 429
  );
});

test("HTTP preview routes expose all three read-only price functions", async () => {
  const app = createApp({ pricesService: createAlchemyPricesService({ mode: "mock" }) });
  const symbols = await request(app).get("/api/prices/by-symbol?symbols=ETH,BTC");
  assert.equal(symbols.status, 200);
  assert.equal(symbols.body.data.data.length, 2);

  const byAddress = await request(app).post("/api/prices/by-address").send({
    addresses: [{ network: "eth-mainnet", address }]
  });
  assert.equal(byAddress.status, 200);
  assert.equal(byAddress.body.data.data[0].address, address);

  const historical = await request(app).post("/api/prices/historical").send({
    symbol: "ETH", startTime, endTime, interval: "1d"
  });
  assert.equal(historical.status, 200);
  assert.equal(historical.body.data.data.length, 2);
});
