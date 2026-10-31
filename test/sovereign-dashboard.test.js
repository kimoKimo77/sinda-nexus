import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations, MIGRATIONS } from "../src/db/migrations.js";
import { hashPassword, verifyPassword, createSessionService, createAuthService } from "../src/auth/service.js";
import { createSindaHttpServer } from "../src/server/http.js";

function migrationPool() {
  const applied=new Map(), calls=[];
  const client={
    async query(sql,params=[]) {
      calls.push(sql.trim().split(/\s+/).slice(0,3).join(" "));
      if(sql.includes("SELECT version, checksum")) return {rows:[...applied].map(([version,checksum])=>({version,checksum}))};
      if(sql.includes("INSERT INTO schema_migrations")) { applied.set(params[0],params[2]); return {rowCount:1}; }
      return {rows:[],rowCount:1};
    },
    release(){calls.push("RELEASE");}
  };
  return {applied,calls,connect:async()=>client};
}

test("versioned PostgreSQL migrations apply once and keep checksums",async()=>{
  const pool=migrationPool();
  const first=await runMigrations({pool});
  assert.deepEqual(first.applied,[1]);
  const second=await runMigrations({pool});
  assert.deepEqual(second.applied,[]);
  assert.equal(pool.applied.size,1);
  assert.ok(pool.calls.includes("COMMIT"));
  assert.ok(pool.calls.includes("RELEASE"));
});

test("migration runner rejects edited applied migrations and rolls back failures",async()=>{
  const pool=migrationPool();
  await runMigrations({pool});
  await assert.rejects(()=>runMigrations({pool,migrations:[{...MIGRATIONS[0],sql:MIGRATIONS[0].sql+" -- changed"}]}),/checksum mismatch/);
  const broken=migrationPool();
  const client=await broken.connect();
  client.query=async sql=>{
    if(sql.includes("SELECT version, checksum")) return {rows:[]};
    if(sql==="BROKEN SQL") throw new Error("syntax error");
    return {rows:[],rowCount:1};
  };
  await assert.rejects(()=>runMigrations({pool:broken,migrations:[{version:1,name:"broken",sql:"BROKEN SQL"}]}),/syntax error/);
});

test("password hashes use scrypt and verify without storing plaintext",async()=>{
  const hash=await hashPassword("a-very-long-test-password");
  assert.match(hash,/^scrypt\$/);
  assert.equal(await verifyPassword("a-very-long-test-password",hash),true);
  assert.equal(await verifyPassword("incorrect-password",hash),false);
  assert.throws(()=>hashPassword("short"),/12 to 256/);
});

test("signed sessions reject tampering and expiration",()=>{
  let now=1_800_000_000_000;
  const sessions=createSessionService({secret:"x".repeat(48),ttlSeconds:300,clock:()=>now});
  const token=sessions.issue({id:"user-1",organization_id:"org-1",role:"owner"});
  assert.equal(sessions.verify(token).sub,"user-1");
  assert.equal(sessions.verify(token+"x"),null);
  now+=301_000;
  assert.equal(sessions.verify(token),null);
});

test("login returns a signed session and generic errors for invalid credentials",async()=>{
  const passwordHash=await hashPassword("correct-horse-battery-staple");
  const pool={query:async(_sql,params)=>({rows:params[0]==="owner@example.test"?[{
    id:"user-1",organization_id:"org-1",email:"owner@example.test",display_name:"Owner",
    role:"owner",password_hash:passwordHash,active:true
  }]:[]})};
  const auth=createAuthService({pool,sessionSecret:"s".repeat(48)});
  const result=await auth.login({email:"OWNER@example.test",password:"correct-horse-battery-staple"});
  assert.equal(auth.authenticate({headers:{authorization:"Bearer "+result.token}}).sub,"user-1");
  await assert.rejects(()=>auth.login({email:"owner@example.test",password:"wrong-password"}),/Invalid email or password/);
});

async function withServer(options,run) {
  const server=createSindaHttpServer(options);
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  try { await run("http://127.0.0.1:"+address.port); }
  finally { await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())); }
}

test("authenticated dashboard routes delegate identity and tenant checks to handlers",async()=>{
  const calls=[];
  const dashboard={
    login:async body=>({token:"preview-token",user:{email:body.email}}),
    me:async request=>{calls.push(request.headers.authorization);return {id:"u1"};},
    projects:async()=>[{id:"p1"}],
    dashboard:async(_request,id)=>({projectId:id}),
    agents:async(_request,id)=>[{projectId:id}],
    createAgent:async(_request,id,body)=>({projectId:id,name:body.name})
  };
  await withServer({dashboard},async base=>{
    const login=await fetch(base+"/api/v1/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"a@b.test"})});
    assert.equal(login.status,200);
    assert.equal((await login.json()).token,"preview-token");
    const headers={authorization:"Bearer preview-token"};
    assert.equal((await fetch(base+"/api/v1/auth/me",{headers})).status,200);
    assert.deepEqual((await (await fetch(base+"/api/v1/projects",{headers})).json()).projects,[{id:"p1"}]);
    assert.equal((await fetch(base+"/api/v1/projects/123e4567-e89b-42d3-a456-426614174000/dashboard",{headers})).status,200);
    const created=await fetch(base+"/api/v1/projects/123e4567-e89b-42d3-a456-426614174000/agents",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({name:"Auditor",agentType:"auditor"})});
    assert.equal(created.status,201);
    assert.equal(calls[0],"Bearer preview-token");
  });
});

test("oversized or malformed JSON bodies are rejected",async()=>{
  await withServer({dashboard:{login:async()=>({})},maxBodyBytes:10},async base=>{
    const oversized=await fetch(base+"/api/v1/auth/login",{method:"POST",body:"{\"email\":\"very-long\"}"});
    assert.equal(oversized.status,413);
    const malformed=await fetch(base+"/api/v1/auth/login",{method:"POST",body:"{"});
    assert.equal(malformed.status,400);
  });
});

test("dashboard page and same-origin script are served with restrictive security headers",async()=>{
  await withServer({},async base=>{
    const page=await fetch(base+"/dashboard");
    assert.equal(page.status,200);
    assert.match(page.headers.get("content-security-policy"),/script-src 'self'/);
    assert.match(await page.text(),/لوحة التحكم السيادية/);
    const script=await fetch(base+"/dashboard.js");
    assert.equal(script.status,200);
    assert.match(script.headers.get("content-type"),/javascript/);
    assert.match(await script.text(),/api\/v1\/auth\/login/);
  });
});
