import { createSindaHttpServer } from "./server/http.js";
import { createSindaApplication } from "./application.js";

const port=Number.parseInt(process.env.PORT ?? "3000",10);
const host=process.env.HOST ?? "127.0.0.1";
if(!Number.isInteger(port)||port<1||port>65535) throw new Error("PORT must be an integer between 1 and 65535.");

let server;
if(process.env.SINDA_DATABASE_POOL_MODULE) {
  const adapterModule=await import(process.env.SINDA_DATABASE_POOL_MODULE);
  const supplied=typeof adapterModule.createPool==="function" ? await adapterModule.createPool({connectionString:process.env.DATABASE_URL}) : adapterModule;
  const pool=supplied.pool ?? supplied;
  const migrationPool=supplied.migrationPool ?? pool;
  if(!pool || typeof pool.query!=="function" || typeof pool.connect!=="function") throw new Error("SINDA_DATABASE_POOL_MODULE must export a PostgreSQL pool or createPool() result.");
  const application=await createSindaApplication({
    pool,
    migrationPool,
    env:process.env,
    runSchemaMigrations:process.env.SINDA_RUN_MIGRATIONS==="true"
  });
  server=application.server;
} else {
  server=createSindaHttpServer();
  process.stderr.write("SINDA_DATABASE_POOL_MODULE is unset; starting liveness-only Preview mode. Dashboard and PostgreSQL routes are disabled.\n");
}
server.listen(port,host,()=>process.stdout.write(`SINDA Sovereign Preview listening on http://${host}:${port}\n`));
for(const signal of ["SIGINT","SIGTERM"]) {
  process.on(signal,()=>server.close(()=>process.exit(0)));
}
