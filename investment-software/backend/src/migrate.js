import "dotenv/config";
import {readFile} from "node:fs/promises";
import {createPool} from "./db.js";
const pool=createPool();try{const sql=await readFile(new URL("../migrations/001_initial.sql",import.meta.url),"utf8");await pool.query(sql);console.log("Migration 001 applied");}finally{await pool.end();}
