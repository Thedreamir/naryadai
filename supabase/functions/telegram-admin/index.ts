// STAGED, no deployment yet. Existing project's authenticated admin only.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
Deno.serve(async(req:Request)=>{
 const headers={'Content-Type':'application/json'};const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
 const auth=req.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return reply({error:'unauthorized'},401);
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
 const user=createClient(url,key,{global:{headers:{Authorization:auth}}});const {data:who,error}=await user.auth.getUser();if(error||!who.user)return reply({error:'unauthorized'},401);
 const {data:role,error:roleError}=await user.rpc('current_actor_role');if(roleError||role!=='admin')return reply({error:'forbidden'},403);
 const {action}=await req.json();if(!['inspect','set_menu'].includes(action))return reply({error:'action not allowed'},400);
 const token=Deno.env.get('TELEGRAM_BOT_TOKEN');if(!token)return reply({error:'not configured'},503);
 async function bot(method:string,body:unknown={}){const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});const j=await r.json();if(!r.ok||!j.ok)throw Error('bot operation failed');return j.result}
 const me=await bot('getMe');if(me.username!=='TektonOSdreamlabs_bot'||!me.is_bot)return reply({error:'wrong bot identity'},409);
 const before=await bot('getChatMenuButton');const origin='https://naryadai.vercel.app/';
 if(action==='inspect')return reply({bot_username:me.username,menu:before});
 // Check fixed intended outcome, not a client-supplied arbitrary URL/text.
 await bot('setChatMenuButton',{menu_button:{type:'web_app',text:'Tekton',web_app:{url:origin}}});
 const after=await bot('getChatMenuButton');
 return reply({bot_username:me.username,before,after,verified:after.type==='web_app'&&after.text==='Tekton'&&after.web_app?.url===origin});
 }catch{return reply({error:'configuration unverified'},503)}
});
