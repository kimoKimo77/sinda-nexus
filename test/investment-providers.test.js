import test from "node:test";
import assert from "node:assert/strict";
import { createMarketDataProvider } from "../src/investment/providers.js";

function mockFetch(routes, calls) {
  return async (url, options = {}) => {
    calls.push({ url:String(url), method:options.method || "GET", headers:options.headers || {} });
    const match = Object.entries(routes).find(([fragment]) => String(url).includes(fragment));
    if (!match) throw new Error("Unexpected URL: " + url);
    const value = typeof match[1] === "function" ? match[1](url, options) : match[1];
    return { ok:true, status:200, json:async()=>value };
  };
}

test("public crypto and FX providers normalize read-only quotes", async () => {
  const calls=[];
  const provider=createMarketDataProvider({fetchImpl:mockFetch({
    "ticker/price?symbol=BTCUSDT":{symbol:"BTCUSDT",price:"65000"},
    "ticker/price?symbol=ETHUSDT":{symbol:"ETHUSDT",price:"3000"},
    "ticker/price?symbol=SOLUSDT":{symbol:"SOLUSDT",price:"150"},
    "/v2/rates?base=USD&quotes=SAR,EUR,GBP,JPY":[
      {date:new Date().toISOString().slice(0,10),base:"USD",quote:"SAR",rate:3.75},
      {date:new Date().toISOString().slice(0,10),base:"USD",quote:"EUR",rate:0.92}
    ]
  },calls)});
  const crypto=await provider.getSnapshot("crypto");
  const forex=await provider.getSnapshot("forex");
  assert.equal(crypto.items.length,3);
  assert.equal(crypto.items[0].price,65000);
  assert.equal(forex.items[0].symbol,"USD/SAR");
  assert.equal(forex.items[0].price,3.75);
  assert.ok(calls.every(call=>call.method==="GET"));
});

test("gold, Saudi equities and registered real-estate providers require server-side keys", async () => {
  const provider=createMarketDataProvider({env:{},fetchImpl:async()=>{throw new Error("must not call without credentials");}});
  await assert.rejects(()=>provider.getSnapshot("gold"),/GOLDAPI_ACCESS_TOKEN/);
  await assert.rejects(()=>provider.getSnapshot("stocks"),/SAHMK_API_KEY/);
  await assert.rejects(()=>provider.getSnapshot("real-estate"),/KITE_API_KEY/);
});

test("credentialed sources send tokens only in server-side request headers and normalize responses", async () => {
  const calls=[];
  const provider=createMarketDataProvider({
    env:{GOLDAPI_ACCESS_TOKEN:"gold-secret-test",SAHMK_API_KEY:"sahmk-secret-test",KITE_API_KEY:"kite-secret-test",SAHMK_STOCK_SYMBOLS:"2222",KITE_CITY:"riyadh"},
    fetchImpl:mockFetch({
      "goldapi.io/api/XAU/SAR":{timestamp:Math.floor(Date.now()/1000),price:9000,change_percent:0.2},
      "/quote/2222/":{symbol:"2222",name_en:"Saudi Aramco",price:27.5,change_percent:0.1,updated_at:new Date().toISOString()},
      "/market/registered-rents?city=riyadh":{data:[{id:"north",neighborhood_name:"North Riyadh",median_rent:42000,as_of:new Date().toISOString()}]}
    },calls)
  });
  const gold=await provider.getSnapshot("gold");
  const stocks=await provider.getSnapshot("stocks");
  const property=await provider.getSnapshot("real-estate");
  assert.equal(gold.items[0].currency,"SAR");
  assert.equal(stocks.items[0].symbol,"2222");
  assert.equal(property.items[0].price,42000);
  assert.equal(calls.find(call=>call.url.includes("goldapi.io")).headers["x-access-token"],"gold-secret-test");
  assert.equal(calls.find(call=>call.url.includes("sahmk.sa")).headers["X-API-Key"],"sahmk-secret-test");
  assert.equal(calls.find(call=>call.url.includes("kite.sa")).headers.authorization,"Bearer kite-secret-test");
  assert.ok(calls.every(call=>call.method==="GET"));
});

test("invalid provider responses fail closed", async () => {
  const provider=createMarketDataProvider({fetchImpl:mockFetch({
    "ticker/price?symbol=BTCUSDT":{symbol:"BTCUSDT",price:"NaN"},
    "ticker/price?symbol=ETHUSDT":{symbol:"ETHUSDT",price:"NaN"},
    "ticker/price?symbol=SOLUSDT":{symbol:"SOLUSDT",price:"NaN"}
  },[])});
  await assert.rejects(()=>provider.getSnapshot("crypto"),/Invalid crypto price/);
});
