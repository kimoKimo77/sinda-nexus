import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, randomUUID } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const b64 = value => Buffer.from(value).toString("base64url");

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new TypeError("Password must contain 12 to 256 characters.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return "scrypt$" + salt.toString("base64url") + "$" + Buffer.from(derived).toString("base64url");
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const [scheme, saltText, hashText] = encoded.split("$");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, "base64url"), expected.length));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function createSessionService({ secret, ttlSeconds = 3600, clock = () => Date.now() } = {}) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new TypeError("SINDA_SESSION_SECRET must contain at least 32 bytes.");
  }
  const sign = input => createHmac("sha256", secret).update(input).digest();
  return {
    issue(user) {
      const now = Math.floor(clock() / 1000);
      const payload = { sub:user.id, org:user.organization_id, role:user.role, iat:now, exp:now+Math.min(Math.max(ttlSeconds,300),86400), jti:randomUUID() };
      const body = b64(JSON.stringify(payload));
      return body + "." + sign(body).toString("base64url");
    },
    verify(token) {
      if (typeof token !== "string" || token.length > 4096) return null;
      const [body, signature, extra] = token.split(".");
      if (!body || !signature || extra) return null;
      const expected = sign(body);
      let supplied;
      try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
      try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        const now = Math.floor(clock() / 1000);
        if (!payload.sub || !payload.org || !payload.role || !Number.isInteger(payload.exp) || payload.exp <= now) return null;
        return payload;
      } catch { return null; }
    }
  };
}

export function createAuthService({ pool, sessionSecret, sessionTtlSeconds } = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("A PostgreSQL pool is required.");
  const sessions = createSessionService({ secret:sessionSecret, ttlSeconds:sessionTtlSeconds });
  return {
    async login({ email, password } = {}) {
      if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 256) {
        const error = new Error("Invalid email or password."); error.status=401; throw error;
      }
      const result = await pool.query(
        "SELECT id, organization_id, email, display_name, role, password_hash, active FROM users WHERE email = $1 LIMIT 1",
        [email.trim().toLowerCase()]
      );
      const user = result.rows[0];
      if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) {
        throw new Error("Invalid email or password.");
      }
      return { token:sessions.issue(user), user:{ id:user.id, organizationId:user.organization_id, email:user.email, displayName:user.display_name, role:user.role } };
    },
    authenticate(request) {
      const header = request.headers.authorization ?? "";
      if (!header.startsWith("Bearer ")) return null;
      return sessions.verify(header.slice(7));
    }
  };
}

export async function provisionFirstOwner({ pool, email, password, displayName, organizationName, initialProjectName = "My first project" } = {}) {
  if (!pool || typeof pool.connect !== "function") throw new TypeError("A PostgreSQL pool is required.");
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) throw new TypeError("A valid email is required.");
  const passwordHash=await hashPassword(password);
  const client=await pool.connect();
  const organizationId=randomUUID(), userId=randomUUID(), projectId=randomUUID();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)",[741923605]);
    const count=await client.query("SELECT count(*)::int AS count FROM users");
    if (count.rows[0].count!==0) throw new Error("Initial owner provisioning is only available when the users table is empty.");
    await client.query("INSERT INTO organizations(id,name) VALUES($1,$2)",[organizationId,String(organizationName||"SINDA Workspace").slice(0,160)]);
    await client.query(
      "INSERT INTO users(id,organization_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,'owner')",
      [userId,organizationId,email.trim().toLowerCase(),passwordHash,String(displayName||"Workspace Owner").slice(0,120)]
    );
    await client.query(
      "SELECT set_config('sinda.organization_id',$1,true),set_config('sinda.user_id',$2,true),set_config('sinda.project_id',$3,true)",
      [organizationId,userId,projectId]
    );
    await client.query(
      "INSERT INTO projects(id,organization_id,name,description,status,created_by) VALUES($1,$2,$3,'Initial Preview workspace','preview',$4)",
      [projectId,organizationId,String(initialProjectName).slice(0,160),userId]
    );
    await client.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner')",[projectId,userId]);
    await client.query(
      "INSERT INTO audit_events(organization_id,project_id,actor_user_id,event_type,details) VALUES($1,$2,$3,'workspace.owner_provisioned','{}'::jsonb)",
      [organizationId,projectId,userId]
    );
    await client.query("COMMIT");
    return { organizationId,userId,projectId,email:email.trim().toLowerCase() };
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
