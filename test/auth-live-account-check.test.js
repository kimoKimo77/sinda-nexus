import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService, createSessionService } from "../src/auth/service.js";

const secret = "test-session-secret-that-is-at-least-32-bytes-long";
const user = {
  id: "9c6c1c54-23d0-4b28-a950-52f0c5a40a1a",
  organization_id: "0a2f9e11-cf35-4f3c-83a2-7d8b9b5f0a12",
  role: "member"
};

test("authentication rechecks active account state and returns the current database role", async () => {
  let active = true;
  const pool = {
    async query(sql, params) {
      assert.match(sql, /active=true/);
      assert.deepEqual(params, [user.id, user.organization_id]);
      return { rows: active ? [{ id:user.id, organization_id:user.organization_id, role:"viewer" }] : [] };
    }
  };
  const auth = createAuthService({ pool, sessionSecret:secret });
  const sessions = createSessionService({ secret });
  const token = sessions.issue({ ...user, role:"owner" });
  const request = { headers:{ authorization:"Bearer " + token } };

  const current = await auth.authenticate(request);
  assert.equal(current.sub, user.id);
  assert.equal(current.org, user.organization_id);
  assert.equal(current.role, "viewer");

  active = false;
  assert.equal(await auth.authenticate(request), null);
});

test("authentication rejects missing, malformed and expired bearer sessions before database access", async () => {
  let queries = 0;
  const pool = { async query() { queries += 1; return { rows:[{ id:user.id, organization_id:user.organization_id, role:user.role }] }; } };
  const auth = createAuthService({ pool, sessionSecret:secret });
  assert.equal(await auth.authenticate({ headers:{} }), null);
  assert.equal(await auth.authenticate({ headers:{ authorization:"Basic abc" } }), null);
  assert.equal(await auth.authenticate({ headers:{ authorization:"Bearer not-a-token" } }), null);
  assert.equal(queries, 0);
});
