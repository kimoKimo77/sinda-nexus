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
        throw new Error("Invalid email or password.");
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
