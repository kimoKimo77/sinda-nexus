import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {z} from "zod";
import {passwordHash,verifyPassword,issueToken,requireAuth,allowRoles} from "./auth.js";
const projectInput=z.object({name:z.string().trim().min(2).max(80),category:z.enum(["applications","websites","forums","stores","social"]),status:z.enum(["draft","active","review"]),description:z.string().max(500).default("")}).strict();
export function createApp({pool}){
 if(!pool) throw new Error("PostgreSQL pool required");
 const app=express(); app.disable("x-powered-by"); app.use(helmet()); app.use(express.json({limit:"32kb",strict:true}));
 const origins=(process.env.CORS_ORIGIN||"").split(",").map(s=>s.trim()).filter(Boolean);
 app.use((req,res,next)=>{const origin=req.get("origin");if(origin&&origins.includes(origin)){res.set("Access-Control-Allow-Origin",origin);res.set("Vary","Origin");res.set("Access-Control-Allow-Headers","Authorization, Content-Type");res.set("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");}if(req.method==="OPTIONS")return res.sendStatus(204);next();});
 app.use("/api",rateLimit({windowMs:900000,limit:120,standardHeaders:"draft-8",legacyHeaders:false}));
 app.use("/api/auth",rateLimit({windowMs:900000,limit:10,standardHeaders:"draft-8",legacyHeaders:false}));
 const audit=(client,actor,action,type,id,metadata={})=>client.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5)",[actor,action,type,id,JSON.stringify(metadata)]);
 app.get("/health",async(_req,res)=>{try{await pool.query("SELECT 1");res.json({status:"ok",database:"connected"});}catch{res.status(503).json({status:"unavailable",database:"disconnected"});}});
 app.post("/api/auth/register",async(req,res,next)=>{
  if(process.env.ALLOW_REGISTRATION!=="true")return res.status(403).json({error:"Registration is disabled"});
  const p=z.object({email:z.string().email().max(254),password:z.string().min(12).max(128)}).strict().safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid input"});
  try{const hash=await passwordHash(p.data.password);const r=await pool.query("INSERT INTO users(email,password_hash,role) VALUES(lower($1),$2,'viewer') RETURNING id,email,role",[p.data.email,hash]);await pool.query("INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES($1,'user.register','user',$1)",[r.rows[0].id]);res.status(201).json({user:r.rows[0],token:issueToken(r.rows[0])});}catch(e){if(e.code==="23505")return res.status(409).json({error:"Account already exists"});next(e);}
 });
 app.post("/api/auth/login",async(req,res,next)=>{
  const p=z.object({email:z.string().email().max(254),password:z.string().min(1).max(128)}).strict().safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid credentials"});
  try{const r=await pool.query("SELECT id,email,role,password_hash FROM users WHERE email=lower($1)",[p.data.email]);const u=r.rows[0];if(!u||!(await verifyPassword(p.data.password,u.password_hash)))return res.status(401).json({error:"Invalid credentials"});res.json({user:{id:u.id,email:u.email,role:u.role},token:issueToken(u)});}catch(e){next(e);}
 });
 app.use("/api",requireAuth);
 app.get("/api/projects",async(req,res,next)=>{try{const admin=req.auth.role==="admin";const r=await pool.query("SELECT id,owner_id,name,category,status,description,created_at,updated_at FROM projects WHERE "+(admin?"TRUE":"owner_id=$1")+" ORDER BY updated_at DESC LIMIT 200",admin?[]:[req.auth.sub]);res.json({projects:r.rows});}catch(e){next(e);}});
 app.post("/api/projects",allowRoles("admin","editor"),async(req,res,next)=>{
  const p=projectInput.safeParse(req.body);if(!p.success)return res.status(400).json({error:"Invalid project data"});const c=await pool.connect();
  try{await c.query("BEGIN");const v=p.data;const r=await c.query("INSERT INTO projects(owner_id,name,category,status,description) VALUES($1,$2,$3,$4,$5) RETURNING *",[req.auth.sub,v.name,v.category,v.status,v.description]);await audit(c,req.auth.sub,"project.create","project",r.rows[0].id,{category:v.category});await c.query("COMMIT");res.status(201).json({project:r.rows[0]});}catch(e){await c.query("ROLLBACK");next(e);}finally{c.release();}
 });
 app.patch("/api/projects/:id",allowRoles("admin","editor"),async(req,res,next)=>{
  const p=projectInput.partial().strict().safeParse(req.body);if(!p.success||!Object.keys(req.body||{}).length)return res.status(400).json({error:"Invalid project data"});const c=await pool.connect();
  try{await c.query("BEGIN");const admin=req.auth.role==="admin";const f=await c.query("SELECT * FROM projects WHERE id=$1"+(admin?"":" AND owner_id=$2"),admin?[req.params.id]:[req.params.id,req.auth.sub]);if(!f.rowCount){await c.query("ROLLBACK");return res.status(404).json({error:"Project not found"});}const n={...f.rows[0],...p.data};const r=await c.query("UPDATE projects SET name=$1,category=$2,status=$3,description=$4,updated_at=now() WHERE id=$5 RETURNING *",[n.name,n.category,n.status,n.description,req.params.id]);await audit(c,req.auth.sub,"project.update","project",req.params.id,{fields:Object.keys(p.data)});await c.query("COMMIT");res.json({project:r.rows[0]});}catch(e){await c.query("ROLLBACK");next(e);}finally{c.release();}
 });
 app.delete("/api/projects/:id",allowRoles("admin","editor"),async(req,res,next)=>{
  const c=await pool.connect();try{await c.query("BEGIN");const admin=req.auth.role==="admin";const r=await c.query("DELETE FROM projects WHERE id=$1"+(admin?"":" AND owner_id=$2")+" RETURNING id",admin?[req.params.id]:[req.params.id,req.auth.sub]);if(!r.rowCount){await c.query("ROLLBACK");return res.status(404).json({error:"Project not found"});}await audit(c,req.auth.sub,"project.delete","project",req.params.id);await c.query("COMMIT");res.status(204).end();}catch(e){await c.query("ROLLBACK");next(e);}finally{c.release();}
 });
 app.get("/api/audit",allowRoles("admin"),async(_req,res,next)=>{try{const r=await pool.query("SELECT id,actor_id,action,resource_type,resource_id,metadata,created_at FROM audit_events ORDER BY id DESC LIMIT 200");res.json({events:r.rows});}catch(e){next(e);}});
 app.use((err,_req,res,_next)=>res.status(500).json({error:"Internal server error"}));
 return app;
}
