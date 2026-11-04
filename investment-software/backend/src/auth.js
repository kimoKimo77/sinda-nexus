import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
export function passwordHash(password){
 const rounds=Number(process.env.BCRYPT_ROUNDS||12);
 if(!Number.isInteger(rounds)||rounds<10||rounds>14) throw new Error("BCRYPT_ROUNDS must be 10..14");
 return bcrypt.hash(password,rounds);
}
export const verifyPassword=(password,hash)=>bcrypt.compare(password,hash);
export function issueToken(user){
 const secret=process.env.JWT_SECRET;
 if(!secret||Buffer.byteLength(secret)<32) throw new Error("JWT_SECRET must contain at least 32 bytes");
 return jwt.sign({sub:user.id,role:user.role},secret,{expiresIn:process.env.JWT_EXPIRES_IN||"15m",issuer:"sinda-api",audience:"sinda-workspace"});
}
export function requireAuth(req,res,next){
 try{
  const header=req.get("authorization")||"";
  if(!header.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  const secret=process.env.JWT_SECRET;
  if(!secret||Buffer.byteLength(secret)<32) return res.status(503).json({error:"Authentication is not configured"});
  req.auth=jwt.verify(header.slice(7),secret,{issuer:"sinda-api",audience:"sinda-workspace"}); next();
 }catch{res.status(401).json({error:"Invalid or expired token"});}
}
export const allowRoles=(...roles)=>(req,res,next)=>roles.includes(req.auth?.role)?next():res.status(403).json({error:"Insufficient permissions"});
