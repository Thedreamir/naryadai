import {almatyDeadline} from '../_shared/order-time.mjs';
// Read-only extractive assistant. Sources come from caller-JWT/RLS-visible orders
// and approved knowledge. No external model call, status change or safety approval.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const allowed=(Deno.env.get('PWA_ORIGIN')||'').split(',').map(s=>s.trim()).filter(Boolean);
const devOrigins=Deno.env.get('ASSISTANT_DEV_MODE')==='true'?['http://127.0.0.1:4173','http://localhost:4173','http://127.0.0.1:5173','http://localhost:5173']:[];
const cors={'Access-Control-Allow-Origin':allowed[0]||'','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Vary':'Origin'};
import {groundedAnswer} from '../_shared/assistant-grounding.mjs';
const RATE_LIMIT_PER_HOUR=30;
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'';
 const allowOrigin=[...allowed,...devOrigins].includes(origin)?origin:(allowed[0]||'');
 const corsDyn={...cors,'Access-Control-Allow-Origin':allowOrigin};
 const headers={...corsDyn,'Content-Type':'application/json'};
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsDyn});
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
 try{
 const token=req.headers.get('Authorization');if(!token)return reply({error:'authentication required'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}}});
 const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return reply({error:'invalid session'},401);
 const{data:employee}=await db.from('employees').select('role,is_active').eq('id',user.id).single();if(!employee||employee.is_active!==true||!['worker','master','leader','admin'].includes(employee.role))return reply({error:'employee required'},403);
 const body=await req.json();
 const message=String(body?.message||'').trim();
 if(message.length<2)return reply({error:'empty message'},400);
 if(message.length>2000)return reply({error:'message too long'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 // ---- free-quota bound: per-user hourly request limit ----
 {const{data:ok,error:qe}=await admin.rpc('assistant_quota_take',{p_user:user.id,p_limit:RATE_LIMIT_PER_HOUR});
  if(qe)return reply({error:'quota check failed',answer:'[Нет данных] Не удалось проверить лимит обращений, попробуйте позже.',sources:[],mode:'limited',knowledge_used:false},503);
  if(ok!==true)return reply({error:'rate limited',answer:'[Нет данных] Лимит обращений к ассистенту исчерпан на этот час (демо, ограничение нагрузки). Попробуйте позже.',sources:[],mode:'limited',knowledge_used:false},429)}
 // Service-role access is for quota only. All content retrieval uses caller JWT + RLS.
 const suppliedOrder=body?.order_id !== null && body?.order_id !== undefined;
 const orderId=Number(body?.order_id);
 if(suppliedOrder && (!Number.isSafeInteger(orderId)||orderId<=0))return reply({error:'invalid order id'},400);
 let orderCtx:any=null;
 if(suppliedOrder){
  const{data:o,error}=await db.from('orders').select('id,title,status,kind,priority,deadline,equipment_id,assignee_id,equipment(name)').eq('id',orderId).maybeSingle();
  if(error)return reply({error:'order retrieval unavailable'},503);
  if(!o || (employee.role==='worker' && o.assignee_id!==user.id))return reply({error:'order unavailable'},404);
  orderCtx={...o,equipment:(o as any).equipment?.name||null,deadline_almaty:almatyDeadline(o.deadline)};
 }
 // Without a visible selected order, only plant-wide approved material is eligible.
 const scope=orderCtx?.equipment_id != null ? `equipment_id.is.null,equipment_id.eq.${Number(orderCtx.equipment_id)}` : 'equipment_id.is.null';
 const [d,m]=await Promise.all([
  db.from('knowledge_docs').select('id,title,body,status,source_label,equipment_id,version,reviewed_by,reviewed_at,content_domain,safety_sensitive,worker_extract_eligible').eq('status','approved').or(scope).order('id').limit(201),
  db.from('repair_memory').select('id,title,body,status,version,equipment_id,order_id,reviewed_by,reviewed_at,content_domain,safety_sensitive,worker_extract_eligible').eq('status','approved').or(scope).order('id').limit(201)
 ]);
 if(d.error||m.error)return reply({error:'knowledge retrieval unavailable'},503);
 let history:any[]=[];
 if(orderCtx?.equipment_id != null){
  let hq=db.from('orders').select('id,title,status,equipment_id,closed_at').eq('equipment_id',orderCtx.equipment_id).eq('status','closed');
  if(employee.role==='worker')hq=hq.eq('assignee_id',user.id);
  const h=await hq.order('closed_at',{ascending:false}).limit(3);
  if(h.error)return reply({error:'history retrieval unavailable'},503);
  history=h.data||[];
 }
 // No external model call or side effect. Exact excerpts + citations, not inferred facts.
 return reply(groundedAnswer({message,order:orderCtx,docs:(d.data||[]).slice(0,200),memory:(m.data||[]).slice(0,200),history,retrievalTruncated:(d.data?.length||0)>200||(m.data?.length||0)>200}));
 }catch(e){console.error('Assistant request failed',String(e));return reply({error:'assistant request failed'},400)}
});
