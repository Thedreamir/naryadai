// Private local service against LOCAL database only. Never configure a live DB here.
// Caller identity is verified through Supabase auth.getUser-equivalent, not JWT decoding.
import{createServer}from'node:http';import pg from'pg';import{createPhotoIngestHandler}from'./routes.mjs';
export function createCanonicalService({pool,storageRoot,verifyUser,origin}){
 const handler=createPhotoIngestHandler({pool,storageRoot,authenticate:async req=>{const token=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];return token?verifyUser(token):null}});
 return createServer(async(req,res)=>{
  const observed=req.headers.origin;if(observed&&observed!==origin){res.writeHead(403);res.end();return}
  if(observed){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  res.setHeader('Access-Control-Allow-Headers','authorization,content-type,x-order-version');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  if(!await handler(req,res)){res.writeHead(404);res.end()}
 });
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const db=new URL(process.env.LOCAL_PHOTO_DATABASE_URL||'');if(!['127.0.0.1','localhost','[::1]'].includes(db.hostname))throw Error('Local database required');
 const authUrl=process.env.PHOTO_AUTH_URL;const key=process.env.PHOTO_AUTH_ANON_KEY;const origin=process.env.PHOTO_PWA_ORIGIN;if(!authUrl||!key||!origin)throw Error('Verified auth and explicit PWA origin required');
 const pool=new pg.Pool({connectionString:db.href,max:3});const verifyUser=async token=>{try{const response=await fetch(authUrl.replace(/\/$/,'')+'/auth/v1/user',{headers:{authorization:'Bearer '+token,apikey:key},signal:AbortSignal.timeout(5000)});if(!response.ok)return null;const u=await response.json();return typeof u.id==='string'?{id:u.id}:null}catch{return null}};
 const server=createCanonicalService({pool,storageRoot:process.env.CANONICAL_STORAGE_ROOT||'.local/private-canonical',verifyUser,origin});server.listen(3012,'127.0.0.1',()=>console.log('Canonical local-only photo service on127.0.0.1:3012'));
 for(const signal of['SIGINT','SIGTERM'])process.on(signal,async()=>{server.close();await pool.end()});
}
