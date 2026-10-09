import {constantTimeEqual,readBoundedBody} from '../_shared/request-security.mjs';
// send-push: called by the pg_net trigger (shared secret) with an order id.
// Looks up the assignee's push subscriptions and delivers a Web Push (VAPID).
import webpush from 'npm:web-push@3.6.7';
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
Deno.serve(async req=>{
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 try{
  const secret=Deno.env.get('PUSH_HOOK_SECRET');
  if(!secret||!await constantTimeEqual(req.headers.get('X-Push-Secret')||'',secret))return reply({error:'forbidden'},403);
  if(req.method!=='POST')return reply({error:'method not allowed'},405);
  const{order_id}=JSON.parse(await readBoundedBody(req,4096));
  if(!Number.isSafeInteger(order_id)||order_id<=0)return reply({error:'invalid order id'},400);
  const pub=Deno.env.get('VAPID_PUBLIC'),priv=Deno.env.get('VAPID_PRIVATE');
  if(!pub||!priv)return reply({error:'vapid not configured'},500);
  webpush.setVapidDetails('mailto:webpush@example.invalid',pub,priv);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{data:o}=await admin.from('orders').select('id,title,assignee_id,priority,deadline,cancelled').eq('id',order_id).single();
  if(!o||o.cancelled)return reply({error:'order unavailable'},404);
  const{data:employee}=await admin.from('employees').select('is_active').eq('id',o.assignee_id).single();if(employee?.is_active!==true)return reply({error:'inactive recipient'},409);
  const{data:subs}=await admin.from('push_subscriptions').select('*').eq('user_id',o.assignee_id);
  let sent=0,failed=0,stale=0;
  for(const s of subs||[]){
   try{
    await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
     JSON.stringify({priority:o.priority,order_id:o.id,title:o.priority==='emergency'?'Аварийный наряд':'Новый наряд',body:`#${o.id} · ${String(o.title||'').slice(0,160)}`,tag:'order-'+o.id}),
     {TTL:3600,urgency:o.priority==='emergency'?'high':'normal'});
    sent++;
   }catch(e:any){
    failed++;
    if(e?.statusCode===404||e?.statusCode===410){await admin.from('push_subscriptions').delete().eq('id',s.id);stale++}
   }
  }
  return reply({sent,failed,stale,subscriptions:(subs||[]).length});
 }catch(e){console.error('send-push failed',String(e));return reply({error:'send failed'},400)}
});
