import test from "node:test";
import assert from "node:assert/strict";
import { createInvestmentReadHandlers } from "../src/investment/handlers.js";
import { INVESTMENT_MARKETS, INVESTMENT_RESTRICTIONS } from "../src/investment/catalog.js";
import { createSindaHttpServer } from "../src/server/http.js";

const auth = { authenticate: request => request.headers.authorization === "Bearer test-token" ? { sub:"user-1" } : null };

async function withServer(options, run) {
  const server=createSindaHttpServer(options);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  try { await run("http://127.0.0.1:"+address.port); }
  finally { await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
}

test("investment catalog contains the five approved markets and explicit read-only restrictions",async()=>{
  const handlers=createInvestmentReadHandlers({auth});
  const result=await handlers.markets({headers:{authorization:"Bearer test-token"}});
  assert.deepEqual(result.markets.map(item=>item.id),["stocks","crypto","gold","forex","real-estate"]);
  assert.equal(result.mode,"read-only");
  assert.equal(result.restrictions.financialTransactions,false);
  assert.equal(result.restrictions.orderPlacement,false);
  assert.equal(result.restrictions.deposits,false);
  assert.equal(result.restrictions.withdrawals,false);
  assert.equal(INVESTMENT_MARKETS.length,5);
  assert.equal(INVESTMENT_RESTRICTIONS.automaticTrading,false);
});

test("investment handlers require authentication",async()=>{
  const handlers=createInvestmentReadHandlers({auth});
  await assert.rejects(()=>handlers.markets({headers:{}}),error=>error.status===401);
  await assert.rejects(()=>handlers.snapshot({headers:{}}, "stocks"),error=>error.status===401);
});

test("missing market provider is reported as unavailable and never fabricates prices",async()=>{
  const handlers=createInvestmentReadHandlers({auth});
  const result=await handlers.snapshot({headers:{authorization:"Bearer test-token"}}, "gold");
  assert.equal(result.status,"unavailable");
  assert.equal(result.data,null);
  assert.equal(result.reason,"market_data_provider_not_configured");
});

test("market provider data is validated and provenance is retained",async()=>{
  const provider={getSnapshot:async market=>({market,asOf:"2026-10-31T08:00:00Z",source:" approved-test-feed ",items:[{symbol:"XAU",name:"Gold",price:"2800",currency:"USD",changePercent:0.2}]})};
  const handlers=createInvestmentReadHandlers({auth,marketDataProvider:provider});
  const result=await handlers.snapshot({headers:{authorization:"Bearer test-token"}}, "gold");
  assert.equal(result.status,"available");
  assert.equal(result.data.source,"approved-test-feed");
  assert.equal(result.data.items[0].price,2800);
  assert.equal(result.data.asOf,"2026-10-31T08:00:00.000Z");
});

test("null change percentage remains null instead of being coerced to zero",async()=>{
  const provider={getSnapshot:async market=>({market,asOf:"2026-10-31T08:00:00Z",source:"test-feed",items:[{symbol:"XAU",name:"Gold",price:null,changePercent:null}]})};
  const handlers=createInvestmentReadHandlers({auth,marketDataProvider:provider});
  const result=await handlers.snapshot({headers:{authorization:"Bearer test-token"}}, "gold");
  assert.equal(result.status,"available");
  assert.equal(result.data.items[0].price,null);
  assert.equal(result.data.items[0].changePercent,null);
});

test("invalid provenance, malformed numbers and oversized provider responses fail closed",async()=>{
  const invalidSnapshots=[
    market=>({market,asOf:"not-a-date",source:"feed",items:[]}),
    market=>({market,asOf:"2026-10-31T08:00:00Z",source:"  ",items:[]}),
    market=>({market,asOf:"2026-10-31T08:00:00Z",source:"feed",items:[{symbol:"X",name:"X",price:"",changePercent:0}]}),
    market=>({market,asOf:"2026-10-31T08:00:00Z",source:"feed",items:[{symbol:"X",name:"X",price:1,changePercent:true}]}),
    market=>({market,asOf:"2026-10-31T08:00:00Z",source:"feed",items:Array.from({length:101},(_,i)=>({symbol:"S"+i,name:"Item "+i,price:1}))})
  ];
  for (const makeSnapshot of invalidSnapshots) {
    const provider={getSnapshot:async market=>makeSnapshot(market)};
    const handlers=createInvestmentReadHandlers({auth,marketDataProvider:provider});
    const result=await handlers.snapshot({headers:{authorization:"Bearer test-token"}}, "stocks");
    assert.equal(result.status,"unavailable");
    assert.equal(result.data,null);
    assert.equal(result.reason,"market_data_provider_error");
  }
});

test("invalid provider prices fail closed without leaking provider errors",async()=>{
  const provider={getSnapshot:async market=>({market,asOf:"2026-10-31T08:00:00Z",source:"test",items:[{symbol:"BAD",name:"Bad",price:-1}]})};
  const handlers=createInvestmentReadHandlers({auth,marketDataProvider:provider});
  const result=await handlers.snapshot({headers:{authorization:"Bearer test-token"}}, "stocks");
  assert.equal(result.status,"unavailable");
  assert.equal(result.data,null);
  assert.equal(result.reason,"market_data_provider_error");
});

test("investment HTTP routes are authenticated, read-only and served with restrictive headers",async()=>{
  const investment=createInvestmentReadHandlers({auth});
  await withServer({investment},async base=>{
    const page=await fetch(base+"/investment");
    assert.equal(page.status,200);
    assert.match(page.headers.get("content-security-policy"),/script-src 'self'/);
    assert.match(await page.text(),/الاستثمار الذكي/);
    const unauthorized=await fetch(base+"/api/v1/investment/markets");
    assert.equal(unauthorized.status,401);
    const headers={authorization:"Bearer test-token"};
    const response=await fetch(base+"/api/v1/investment/markets",{headers});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.deepEqual(body.markets.map(item=>item.id),["stocks","crypto","gold","forex","real-estate"]);
    assert.equal((await fetch(base+"/api/v1/investment/markets",{method:"POST",headers})).status,405);
    assert.equal((await fetch(base+"/api/v1/investment/markets/stocks",{method:"DELETE",headers})).status,405);
    assert.equal((await fetch(base+"/api/v1/investment/markets/stocks",{method:"PATCH",headers})).status,405);
    assert.equal((await fetch(base+"/api/v1/investment/markets/stocks",{method:"PUT",headers})).status,405);
  });
});
