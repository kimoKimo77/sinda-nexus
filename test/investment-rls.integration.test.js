import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runMigrations } from "../src/db/migrations.js";

const migrationUrl=process.env.SINDA_PG_TENANT_TEST_URL;
const runtimeUrl=process.env.SINDA_PG_RUNTIME_TEST_URL;

test("tenant RLS isolates projects and investment-adjacent records for a non-owner read-only role", {
  skip: (!migrationUrl || !runtimeUrl) && "Set disposable tenant migration and runtime PostgreSQL URLs."
}, async()=>{
  const { Pool } = await import("pg");
  const owner=new Pool({connectionString:migrationUrl,max:2});
  const runtime=new Pool({connectionString:runtimeUrl,max:2});
  const orgA=randomUUID(), orgB=randomUUID();
  const userA=randomUUID(), userB=randomUUID();
  const projectA=randomUUID(), projectB=randomUUID();
  const agentA=randomUUID(), agentB=randomUUID();
  try {
    await runMigrations({pool:owner});
    await owner.query("GRANT SELECT ON projects, project_members, agents, audit_events TO sinda_runtime");
    const ownerClient=await owner.connect();
    try {
      await ownerClient.query("BEGIN");
      await ownerClient.query("INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)",[orgA,"Tenant A",orgB,"Tenant B"]);
      await ownerClient.query(
        "INSERT INTO users(id,organization_id,email,password_hash,display_name,role) VALUES($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)",
        [userA,orgA,"tenant-a@example.test","test-hash","Tenant A","owner",userB,orgB,"tenant-b@example.test","test-hash","Tenant B","owner"]
      );
      await ownerClient.query("SELECT set_config('sinda.organization_id',$1,true),set_config('sinda.user_id',$2,true),set_config('sinda.project_id',$3,true)",[orgA,userA,projectA]);
      await ownerClient.query("INSERT INTO projects(id,organization_id,name,created_by) VALUES($1,$2,$3,$4)",[projectA,orgA,"Project A",userA]);
      await ownerClient.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)",[projectA,userA,"owner"]);
      await ownerClient.query("INSERT INTO agents(id,project_id,name,agent_type,created_by) VALUES($1,$2,$3,$4,$5)",[agentA,projectA,"Agent A","analyst",userA]);
      await ownerClient.query("INSERT INTO audit_events(organization_id,project_id,actor_user_id,event_type) VALUES($1,$2,$3,$4)",[orgA,projectA,userA,"preview.test"]);
      await ownerClient.query("SELECT set_config('sinda.organization_id',$1,true),set_config('sinda.user_id',$2,true),set_config('sinda.project_id',$3,true)",[orgB,userB,projectB]);
      await ownerClient.query("INSERT INTO projects(id,organization_id,name,created_by) VALUES($1,$2,$3,$4)",[projectB,orgB,"Project B",userB]);
      await ownerClient.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,$3)",[projectB,userB,"owner"]);
      await ownerClient.query("INSERT INTO agents(id,project_id,name,agent_type,created_by) VALUES($1,$2,$3,$4,$5)",[agentB,projectB,"Agent B","analyst",userB]);
      await ownerClient.query("INSERT INTO audit_events(organization_id,project_id,actor_user_id,event_type) VALUES($1,$2,$3,$4)",[orgB,projectB,userB,"preview.test"]);
      await ownerClient.query("COMMIT");
    } catch(error) {
      await ownerClient.query("ROLLBACK");
      throw error;
    } finally {
      ownerClient.release();
    }

    async function readAsA(sql,params=[]) {
      const client=await runtime.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('sinda.organization_id',$1,true),set_config('sinda.user_id',$2,true),set_config('sinda.project_id',$3,true)",[orgA,userA,projectA]);
        const result=await client.query(sql,params);
        await client.query("COMMIT");
        return result.rows;
      } catch(error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }

    assert.deepEqual((await readAsA("SELECT id FROM projects ORDER BY id")).map(row=>row.id),[projectA]);
    assert.deepEqual((await readAsA("SELECT project_id FROM project_members ORDER BY project_id")).map(row=>row.project_id),[projectA]);
    assert.deepEqual((await readAsA("SELECT id FROM agents ORDER BY id")).map(row=>row.id),[agentA]);
    assert.deepEqual((await readAsA("SELECT project_id FROM audit_events ORDER BY project_id")).map(row=>row.project_id),[projectA]);
    assert.equal((await readAsA("SELECT id FROM projects WHERE id=$1",[projectB])).length,0);
    const privileges=await runtime.query("SELECT has_table_privilege(current_user, 'public.projects', 'INSERT') AS can_insert");
    assert.equal(privileges.rows[0].can_insert,false);
  } finally {
    await Promise.all([owner.end(),runtime.end()]);
  }
});
