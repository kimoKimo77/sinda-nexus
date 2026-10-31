import { randomUUID } from "node:crypto";

async function inTenantTransaction(pool, identity, projectId, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('sinda.organization_id',$1,true), set_config('sinda.user_id',$2,true), set_config('sinda.project_id',$3,true)",
      [identity.org, identity.sub, projectId ?? ""]
    );
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

function requireIdentity(auth, request) {
  const identity = auth.authenticate(request);
  if (!identity) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  return identity;
}

async function requireProjectRole(client, projectId, userId, allowed) {
  const result = await client.query(
    "SELECT pm.role FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND p.status='preview' LIMIT 1",
    [projectId,userId]
  );
  const role = result.rows[0]?.role;
  if (!role || !allowed.includes(role)) {
    const error = new Error("Project access denied.");
    error.status = 403;
    throw error;
  }
  return role;
}

export function createDashboardHandlers({ pool, auth } = {}) {
  if (!pool || typeof pool.connect !== "function" || !auth || typeof auth.authenticate !== "function") {
    throw new TypeError("A PostgreSQL pool and authentication service are required.");
  }
  return {
    async login(body) { return auth.login(body); },

    async me(request) {
      const identity = requireIdentity(auth,request);
      return inTenantTransaction(pool,identity,null,async client => {
        const result = await client.query(
          "SELECT id,email,display_name,role FROM users WHERE id=$1 AND organization_id=$2 AND active=true LIMIT 1",
          [identity.sub,identity.org]
        );
        if (!result.rows[0]) {
          const error = new Error("Account is unavailable.");
          error.status = 401;
          throw error;
        }
        const user=result.rows[0];
        return { id:user.id,email:user.email,displayName:user.display_name,role:user.role };
      });
    },

    async projects(request) {
      const identity=requireIdentity(auth,request);
      return inTenantTransaction(pool,identity,null,async client => {
        const result=await client.query(
          `SELECT p.id,p.name,p.description,p.status,p.created_at,pm.role
           FROM projects p JOIN project_members pm ON pm.project_id=p.id
           WHERE pm.user_id=$1 ORDER BY p.created_at DESC LIMIT 100`,
          [identity.sub]
        );
        return result.rows;
      });
    },

    async dashboard(request, projectId) {
      const identity=requireIdentity(auth,request);
      return inTenantTransaction(pool,identity,projectId,async client => {
        const role=await requireProjectRole(client,projectId,identity.sub,["owner","admin","member","viewer"]);
        const [agents,audit]=await Promise.all([
          client.query("SELECT status,count(*)::int AS count FROM agents WHERE project_id=$1 GROUP BY status",[projectId]),
          client.query("SELECT event_type,details,created_at FROM audit_events WHERE project_id=$1 ORDER BY created_at DESC LIMIT 20",[projectId])
        ]);
        return { projectId,role,mode:"preview",agentCounts:agents.rows,recentAudit:audit.rows,
          capabilities:{realFundraising:false,custody:false,financialTransactions:false,mainnetDeployment:false} };
      });
    },

    async agents(request, projectId) {
      const identity=requireIdentity(auth,request);
      return inTenantTransaction(pool,identity,projectId,async client => {
        await requireProjectRole(client,projectId,identity.sub,["owner","admin","member","viewer"]);
        const result=await client.query(
          "SELECT id,name,agent_type,status,config,created_at FROM agents WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100",
          [projectId]
        );
        return result.rows;
      });
    },

    async createAgent(request, projectId, body) {
      const identity=requireIdentity(auth,request);
      const name=typeof body?.name==="string" ? body.name.trim() : "";
      const type=body?.agentType;
      if (!name || name.length>120 || !["planner","auditor","builder","analyst"].includes(type)) {
        const error=new Error("A name and supported agentType are required.");
        error.status=400;
        throw error;
      }
      return inTenantTransaction(pool,identity,projectId,async client => {
        await requireProjectRole(client,projectId,identity.sub,["owner","admin","member"]);
        const id=randomUUID();
        const result=await client.query(
          "INSERT INTO agents(id,project_id,name,agent_type,status,config,created_by) VALUES($1,$2,$3,$4,'idle','{}'::jsonb,$5) RETURNING id,name,agent_type,status,created_at",
          [id,projectId,name,type,identity.sub]
        );
        await client.query(
          "INSERT INTO audit_events(organization_id,project_id,actor_user_id,event_type,details) VALUES($1,$2,$3,'agent.created',$4::jsonb)",
          [identity.org,projectId,identity.sub,JSON.stringify({agentId:id,agentType:type})]
        );
        return result.rows[0];
      });
    }
  };
}
