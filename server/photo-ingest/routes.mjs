// Private local canonical ingest. Authentication is supplied by the server, never by request body.
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const decoder=fileURLToPath(new URL('./decode.py',import.meta.url));
export function decodePhoto(raw){return new Promise((ok,no)=>{const p=spawn('python3',[decoder],{stdio:['pipe','pipe','pipe']});let parts=[],size=0;const timer=setTimeout(()=>p.kill('SIGKILL'),15000);p.stdout.on('data',b=>{size+=b.length;if(size>290000)p.kill();else parts.push(b)});p.stdin.on('error',()=>{});p.on('error',no);p.on('close',code=>{clearTimeout(timer);code===0&&size>0?ok(Buffer.concat(parts)):no(Error('image decode rejected'))});p.stdin.end(raw)})}
function reply(res,status,x){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(x))}
export function createPhotoIngestHandler({pool,authenticate,storageRoot}){
 let busy=0;
 return async(req,res)=>{
  const match=new URL(req.url,'http://localhost').pathname.match(/^\/api\/canonical-photo\/(\d+)$/);if(req.method!=='POST'||!match)return false;
  let c,path,committing=false,acquired=false;
  try{
   const actor=await authenticate(req);if(!actor?.id)return reply(res,401,{error:'authentication required'}),true;
   const version=Number(req.headers['x-order-version']);if(!Number.isInteger(version)||version<1)throw Error('version required');
   if(busy>=2)return reply(res,429,{error:'decoder busy'}),true;busy++;acquired=true;
   // Read no more than 12MB; caller MIME and hashes are deliberately ignored.
   let n=0,parts=[];for await(const b of req){n+=b.length;if(n>12*1024*1024)throw Error('input too large');parts.push(b)}
   c=await pool.connect();await c.query('begin');
   const o=(await c.query('select o.*,e.is_active,e.role from orders o join employees e on e.id=$2 where o.id=$1 for update of o',[match[1],actor.id])).rows[0];
   if(!o||!o.is_active||o.role!=='worker'||o.assignee_id!==actor.id)throw Error('order unavailable');
   if(!o.started_at||o.cancelled||!['in_progress','rework'].includes(o.status)||o.version!==version)throw Error('order state/version changed');
   const bytes=await decodePhoto(Buffer.concat(parts));const hash=createHash('sha256').update(bytes).digest('hex');
   const relative=`${actor.id}/${o.id}/${randomUUID()}.jpg`;path=resolve(storageRoot,relative);await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:'wx',mode:0o600});
   // Read stored object back. Evidence describes actual durable bytes, not a client receipt.
   const stored=await readFile(path);if(createHash('sha256').update(stored).digest('hex')!==hash)throw Error('storage verification failed');
   const duplicate=(await c.query('select order_id from canonical_photo_evidence where sha256=$1 and order_id<>$2 limit 1',[hash,o.id])).rows[0];
   const previous=(await c.query("select storage_path,received_at from canonical_photo_evidence where order_id=$1 and uploaded_by=$2 and sha256=$3 and phase='after'",[o.id,actor.id,hash])).rows[0];
   let evidence=previous;if(previous){const existing=await readFile(resolve(storageRoot,previous.storage_path));if(createHash('sha256').update(existing).digest('hex')!==hash)throw Error('prior stored object unavailable or changed');await unlink(path);path=null}else{evidence=(await c.query("insert into canonical_photo_evidence(order_id,uploaded_by,storage_path,sha256,byte_size,mime_type,phase,decoder_version) values($1,$2,$3,$4,$5,'image/jpeg','after','pillow-canonical-v1') returning storage_path,received_at",[o.id,actor.id,relative,hash,stored.length])).rows[0];}
   committing=true;await c.query('commit');
   reply(res,201,{canonical:'data:image/jpeg;base64,'+stored.toString('base64'),sha256:hash,byte_size:stored.length,mime_type:'image/jpeg',phase:'after',storage_path:evidence.storage_path,server_received_at:evidence.received_at,duplicate_order_id:duplicate?.order_id??null,limits:'Server decoded/stored bytes; not proof of capture time or repair quality'});
  }catch(e){if(c){try{await c.query('rollback')}catch{}}if(path&&!committing){try{await unlink(path)}catch{}}reply(res,400,{error:e.message,uncertain_commit:committing});}
  finally{if(c)c.release();if(acquired)busy=Math.max(0,busy-1)}
  return true;
 }
}
