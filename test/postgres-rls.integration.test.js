import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runMigrations } from "../src/db/migrations.js";

const databaseUrl=process.env.SINDA_PG_TEST_URL;

test("PostgreSQL RLS isolates tenants under a non-owner runtime role", {skip:!databaseUrl && "Set SINDA_PG_TEST_URL to a disposable PostgreSQL database."}, async()=>{
  const { Pool }=await import("pg");
  const admin=new Pool({connectionString:databaseUrl});
  const role="sinda_rls_"+randomUUID().replaceAll("-","");
  const ids={orgA:randomUUID(),orgB:randomUUID(),userA:randomUUID(),userB:randomUUID(),projectA:randomUUID(),projectB:randomUUID(),agentA:randomUUID(),agentB:randomUUID()};
  try {
    await runMigrations({pool:admin});
    await admin.query(`CREATE ROLE ${role} NOLOGIN`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await admin.query(`GRANT SELECT ON projects, project_members, agents, audit_events TO ${role}`);
    await admin.query("INSERT INTO organizations(id,name) VALUES($1,'Tenant A'),($2,'Tenant B')",[ids.orgA,ids.orgB]);
    await admin.query(
      "INSERT INTO users(id,organization_id,email,password_hash,display_name,role) VALUES($1,$2,$3,'test','A','owner'),($4,$5,$6,'test','B','owner')",
      [ids.userA,ids.orgA,ids.userA+"@test.invalid",ids.userB,ids.orgB,ids.userB+"@test.invalid"]
    );
    await admin.query(
      "INSERT INTO projects(id,organization_id,name,status,created_by) VALUES($1,$2,'Project A','preview',$3),($4,$5,'Project B','preview',$6)",
      [ids.projectA,ids.orgA,ids.userA,ids.projectB,ids.orgB,ids.userB]
    );
    await admin.query(
      "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner'),($3,$4,'owner')",
      [ids.projectA,ids.userA,ids.projectB,ids.userB]
    );
    await admin.query(
      "INSERT INTO agents(id,project_id,name,agent_type,created_by) VALUES($1,$2,'Agent A','auditor',$3),($4,$5,'Agent B','auditor',$6)",
      [ids.agentA,ids.projectA,ids.userA,ids.agentB,ids.projectB,ids.userB]
    );
    await admin.query(
      "INSERT INTO audit_events(organization_id,project_id,actor_user_id,event_type) VALUES($1,$2,$3,'test.a'),($4,$5,$6,'test.b')",
      [ids.orgA,ids.projectA,ids.userA,ids.orgB,ids.projectB,ids.userB]
    );

    const client=await admin.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query(
        "SELECT set_config('sinda.organization_id',$1,true),set_config('sinda.user_id',$2,true),set_config('sinda.project_id',$3,true)",
        [ids.orgA,ids.userA,ids.projectA]
      );
      for(const table of ["projects","project_members","agents","audit_events"]) {
        const result=await client.query(`SELECT count(*)::int AS count FROM ${table}`);
        assert.equal(result.rows[0].count,1,`${table} leaked a row from another tenant`);
      }
      const projects=await client.query("SELECT id FROM projects");
      assert.equal(projects.rows[0].id,ids.projectA);
      await client.query("ROLLBACK");
    } finally { client.release(); }
  } finally {
    await admin.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${role}`).catch(()=>{});
    await admin.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${role}`).catch(()=>{});
    await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(()=>{});
    await admin.end();
  }
});
