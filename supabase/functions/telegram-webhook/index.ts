// Staged only. Registering a webhook and sending bot replies are separate release gates.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {privateStart,hashToken} from '../_shared/telegram-core.mjs';
Deno.serve(async(req:Request)=>{
 const reply=(status:number)=>new Response(JSON.stringify({ok:status===200}),{status,headers:{'Content-Type':'application/json'}});
 const secret=Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
 if(req.method!=='POST')return reply(405);
 if(!secret||req.headers.get('X-Telegram-Bot-Api-Secret-Token')!==secret)return reply(403);
 const limit=16384;if(Number(req.headers.get('content-length')||0)>limit)return reply(413);
 try{const body=await req.text();if(body.length>limit)return reply(413);const start=privateStart(JSON.parse(body));if(!start)return reply(200);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const {error}=await admin.rpc('telegram_pending_bind',{p_hash:await hashToken(start.token),p_chat:start.chatId,p_telegram:start.telegramId,p_update:start.updateId});
 // No confirmation, data or order information sent to Telegram here.
 return reply(error?503:200);
 }catch{return reply(400)}
});
