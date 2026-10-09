// PIN quick login: verifies a hashed PIN and mints a session via magic-link token.
// Exponential account backoff, capped at 10 minutes. Raw PINs are never stored or logged.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const cors={'Access-Control-Allow-Origin':Deno.env.get('PWA_ORIGIN')||'','Access-Control-Allow-Headers':'authorization, apikey, content-type','Vary':'Origin'};
Deno.serve(async req=>{
 const headers={...cors,'Content-Type':'application/json'};
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(req.method!=='POST')return reply({error:'method not allowed'},405);
 try{
 const{email,pin}=await req.json();
 if(typeof email!=='string'||typeof pin!=='string'||!/^\d{6}$/.test(pin))return reply({error:'email and 6 digit pin required'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const salt=Deno.env.get('PIN_RATE_SALT');if(!salt)return reply({error:'pin rate gate not configured'},503);
 // Fail closed pending independently verified ingress that overwrites XFF.
 if(Deno.env.get('PIN_TRUSTED_INGRESS')!=='overwrites-xff')return reply({error:'trusted ingress not verified'},503);
 const ip=(req.headers.get('x-forwarded-for')||'').split(',').at(-1)?.trim()||'';if(!ip)return reply({error:'trusted ingress address unavailable'},503);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'|'+ip));const bucket=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const{data:gate,error:gateError}=await admin.rpc('pin_login_gate',{p_email:email.toLowerCase(),p_pin:pin,p_bucket:bucket});
 if(gateError)return reply({error:'pin verification unavailable'},503);
 if(gate?.status!=='ok')return reply({error:gate?.status==='locked'?'pin locked, try later':'pin login denied'},gate?.status==='locked'?429:403);
 const{data:link,error:linkErr}=await admin.auth.admin.generateLink({type:'magiclink',email:email.toLowerCase()});
 if(linkErr||!link?.properties?.hashed_token)throw Error('link generation failed');
 return reply({token_hash:link.properties.hashed_token});
 }catch(e){console.error('pin-login failed',String(e));return reply({error:'pin login failed'},500)}
});
