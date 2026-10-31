import { runMigrations } from "./db/migrations.js";
import { createAuthService } from "./auth/service.js";
import { createDashboardHandlers } from "./dashboard/handlers.js";
import { createSindaHttpServer } from "./server/http.js";

export async function createSindaApplication({ pool, migrationPool = pool, env = process.env, runSchemaMigrations = true } = {}) {
  if (!pool || typeof pool.connect !== "function" || typeof pool.query !== "function") {
    throw new TypeError("A PostgreSQL pool is required to create the SINDA application.");
  }
  if (runSchemaMigrations) await runMigrations({ pool:migrationPool });
  const auth=createAuthService({
    pool,
    sessionSecret:env.SINDA_SESSION_SECRET,
    sessionTtlSeconds:Number(env.SINDA_SESSION_TTL_SECONDS||3600)
  });
  const dashboard=createDashboardHandlers({ pool,auth });
  const server=createSindaHttpServer({
    dashboard,
    healthChecks:{postgres:async()=>{
      const result=await pool.query("SELECT 1 AS healthy");
      return result.rows?.[0]?.healthy===1;
    }}
  });
  return { server,auth,dashboard };
}
