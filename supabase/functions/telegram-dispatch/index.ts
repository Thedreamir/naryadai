import {constantTimeEqual} from '../_shared/request-security.mjs';
// Staged only. Disabled unless explicitly enabled after recipient/text review and grants.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {dispatchOnce,notificationText,miniAppKeyboard} from '../_shared/telegram-core.mjs';
Deno.serve(async(req:Request)=>{
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 const secret=Deno.env.get('TELEGRAM_DISPATCH_SECRET');
 if(req.method!=='POST')return reply({error:'method'},405);
 if(!secret||!await constantTimeEqual(req.headers.get('X-Tekton-Telegram-Secret')||'',secret))return reply({error:'forbidden'},403);
 if(Deno.env.get('TELEGRAM_DELIVERY_ENABLED')!=='true')return reply({state:'disabled'});
 const token=Deno.env.get('TELEGRAM_BOT_TOKEN');const origin=Deno.env.get('PWA_ORIGIN');if(!token||!origin)return reply({error:'not configured'},503);
 try{const {notification_id}=await req.json();if(!Number.isSafeInteger(notification_id)||notification_id<=0)return reply({error:'invalid id'},400);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {data:n,error:ne}=await db.from('notifications').select('id,order_id,recipient_id,message,kind').eq('id',notification_id).single();if(ne||!n)return reply({error:'notification unavailable'},404);
 const key={notification_id,employee_id:n.recipient_id};
 const result=await dispatchOnce({key,enabled:true,claim:async()=>{const {error}=await db.from('telegram_deliveries').insert({...key,state:'claimed'});if(error&&error.code!=='23505')throw Error('claim unavailable');return !error},
 load:async()=>{const [b,e,o,fresh]=await Promise.all([db.from('telegram_connections').select('*').eq('employee_id',n.recipient_id).single(),db.from('employees').select('id,role,is_active').eq('id',n.recipient_id).single(),db.from('orders').select('id,title,assignee_id,master_id,cancelled').eq('id',n.order_id).single(),db.from('notifications').select('id,recipient_id,order_id,message,kind').eq('id',notification_id).single()]);if([b,e,o,fresh].some(x=>x.error))throw Error('recipient unverified');return {binding:b.data?{employeeId:b.data.employee_id,confirmedAt:b.data.confirmed_at,revokedAt:b.data.revoked_at,chatId:b.data.chat_id}:null,employee:e.data,order:o.data,notification:fresh.data}},
 send:async(c:any)=>{const payload={chat_id:c.binding.chatId,text:notificationText(c.notification,c.order),disable_web_page_preview:true,reply_markup:miniAppKeyboard(origin,c.order.id)};
 // Deliberately no parse_mode, no free-text instructions, no external forwarding.
 const res=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});const j=await res.json();return {ok:res.ok&&j.ok===true,message_id:j.result?.message_id}},
 finish:async(_:unknown,state:string,message_id?:number)=>{const {error}=await db.from('telegram_deliveries').update({state,finished_at:new Date().toISOString(),message_id:message_id==null?null:String(message_id)}).match(key);if(error)throw Error('receipt unavailable')}
 });return reply(result);
 }catch{return reply({error:'delivery unavailable'},503)}
});
