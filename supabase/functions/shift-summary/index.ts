// Shift summary: aggregates only, never personal data. Gemini free-tier model, explicit env choice.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const cors={'Access-Control-Allow-Origin':Deno.env.get('PWA_ORIGIN')||'','Access-Control-Allow-Headers':'authorization, apikey, content-type','Vary':'Origin'};
Deno.serve(async req=>{
 const headers={...cors,'Content-Type':'application/json'};
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers});
 if(req.method!=='POST')return reply({error:'method not allowed'},405);
 try{
 const token=req.headers.get('Authorization');if(!token)return reply({error:'authentication required'},401);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}}});
 const{data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return reply({error:'invalid session'},401);
 const{data:employee}=await db.from('employees').select('role').eq('id',user.id).single();if(!employee||!['master','leader','admin'].includes(employee.role))return reply({error:'report role required'},403);
 const stats=await req.json();
 const task=typeof stats?.task==='string'?stats.task:'shift_summary';
 const key=Deno.env.get('GEMINI_API_KEY'),model=Deno.env.get('GEMINI_MODEL');
 if(!key||!model)return reply({error:'model not configured'},503);
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(20000),body:JSON.stringify({model,input:(task==='rating_explain'?'Ты объясняешь рейтинг исполнителя по компонентам из данных. По-русски, 3-5 предложений: как формируется оценка по формуле, где слабые места, что улучшить. Без персональных данных и выдумок. Данные: ':'Ты аналитик смены на промышленной площадке. По агрегированным показателям (без персональных данных) дай краткую сводку: 3-5 пунктов с выводами и 1-2 рекомендации. По-русски, по делу, без преувеличений. Если данных мало или они нулевые, скажи прямо. Данные: ')+JSON.stringify(stats)})});
 if(!response.ok)throw Error('model HTTP '+response.status);
 const raw=await response.json();const steps=Array.isArray(raw?.steps)?raw.steps:[];const lastOut=[...steps].reverse().find((st:any)=>st?.type==='model_output');const content=Array.isArray(lastOut?.content)?lastOut.content:[];const text=content.filter((c:any)=>c?.type==='text').map((c:any)=>c.text||'').join('').trim();
 if(!text)throw Error('empty model output');
 return reply({summary:text,mode:'live'});
 }catch(e){console.error('Summary failed',String(e));return reply({error:'summary failed'},500)}
});
