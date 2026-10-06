// PIN quick login: verifies a hashed PIN and mints a session via magic-link token.
// Lockout after 5 failures for 10 minutes. Raw PINs are never stored or logged.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const cors={'Access-Control-Allow-Origin':Deno.env.get('PWA_ORIGIN')||'','Access-Control-Allow-Headers':'authorization, apikey, content-type','Vary':'Origin'};
Deno.serve(async req=>{
 const headers={...cors,'Content-Type':'application/json'};
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(req.method!=='POST')return reply({error:'method not allowed'},405);
 try{
 const{email,pin}=await req.json();
 if(typeof email!=='string'||typeof pin!=='string'||!/^\d{4,6}$/.test(pin))return reply({error:'email and 4-6 digit pin required'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 const{data:emp}=await admin.from('employees').select('id,pin_hash').eq('email',email.toLowerCase()).single();
 if(!emp?.pin_hash)return reply({error:'pin not available for this account'},403);
 const{data:att}=await admin.from('pin_attempts').select('*').eq('employee_id',emp.id).maybeSingle();
 if(att?.locked_until&&new Date(att.locked_until)>new Date())return reply({error:'pin locked, try later'},429);
 const{data:ok}=await admin.rpc('verify_employee_pin',{p_employee:emp.id,p_pin:pin});
 if(!ok){
  const failures=(att?.failures||0)+1;const locked=failures>=5?new Date(Date.now()+10*60000).toISOString():null;
  await admin.from('pin_attempts').upsert({employee_id:emp.id,failures:locked?0:failures,locked_until:locked});
  return reply({error:locked?'pin locked, try later':'wrong pin'},locked?429:403);
 }
 await admin.from('pin_attempts').upsert({employee_id:emp.id,failures:0,locked_until:null});
 const{data:link,error:linkErr}=await admin.auth.admin.generateLink({type:'magiclink',email:email.toLowerCase()});
 if(linkErr||!link?.properties?.hashed_token)throw Error('link generation failed');
 return reply({token_hash:link.properties.hashed_token});
 }catch(e){console.error('pin-login failed',String(e));return reply({error:'pin login failed'},500)}
});
