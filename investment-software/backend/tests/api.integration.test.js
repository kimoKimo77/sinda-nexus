import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import request from "supertest";
import {readFile} from "node:fs/promises";
import bcrypt from "bcryptjs";
import {createApp} from "../src/app.js";
const url=process.env.TEST_DATABASE_URL;
test("PostgreSQL API integration",{skip:!url&&"Set TEST_DATABASE_URL to run integration tests"},async t=>{
 process.env.JWT_SECRET="test-only-secret-at-least-32-bytes-long";
 const pool=new pg.Pool({connectionString:url});let app,token,userId;
 before(async()=>{const sql=await readFile(new URL("../migrations/001_initial.sql",import.meta.url),"utf8");await pool.query(sql);await pool.query("TRUNCATE audit_events,projects,users RESTART IDENTITY CASCADE");const hash=await bcrypt.hash("TestPassword!234",10);const u=await pool.query("INSERT INTO users(email,password_hash,role) VALUES('editor@example.test',$1,'editor') RETURNING id",[hash]);userId=u.rows[0].id;app=createApp({pool});const l=await request(app).post("/api/auth/login").send({email:"editor@example.test",password:"TestPassword!234"}).expect(200);token=l.body.token;});
 after(async()=>pool.end());
 await t.test("create writes project and audit event",async()=>{const r=await request(app).post("/api/projects").set("Authorization","Bearer "+token).send({name:"Integration demo",category:"applications",status:"draft",description:"synthetic"}).expect(201);assert.equal(r.body.project.owner_id,userId);const e=await pool.query("SELECT action FROM audit_events WHERE resource_id=$1",[r.body.project.id]);assert.equal(e.rows[0].action,"project.create");});
 await t.test("rejects invalid payload",async()=>request(app).post("/api/projects").set("Authorization","Bearer "+token).send({name:"x",category:"bad",status:"draft",description:""}).expect(400));
 await t.test("rejects unauthenticated request",async()=>request(app).get("/api/projects").expect(401));
 await t.test("audit rows are append-only",async()=>assert.rejects(pool.query("UPDATE audit_events SET action='tampered' WHERE action='project.create'")));
});