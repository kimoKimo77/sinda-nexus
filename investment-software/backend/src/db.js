import pg from "pg";
const {Pool}=pg;
export function createPool(connectionString=process.env.DATABASE_URL){
 if(!connectionString) throw new Error("DATABASE_URL is required");
 return new Pool({connectionString,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,ssl:process.env.PGSSL==="true"?{rejectUnauthorized:true}:undefined});
}
