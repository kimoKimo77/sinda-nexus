import "dotenv/config";
import {createPool} from "./db.js";
import {createApp} from "./app.js";
const pool=createPool();const app=createApp({pool});const port=Number(process.env.PORT)||4180;
const server=app.listen(port,"127.0.0.1",()=>console.log("SINDA preview API listening on 127.0.0.1:"+port));
async function shutdown(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
