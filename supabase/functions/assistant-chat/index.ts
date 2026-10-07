// assistant-chat: worker assistant. Answers TEXT only, grounded in order context + curated
// knowledge_docs. Never invents specs; never changes order/safety state; never instructs
// to energize equipment. Free Gemini model via env; rules-only fallback without a key.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const allowed=(Deno.env.get('PWA_ORIGIN')||'').split(',').map(s=>s.trim()).filter(Boolean);
const devOrigins=['http://127.0.0.1:4173','http://localhost:4173'];
const cors={'Access-Control-Allow-Origin':allowed[0]||'','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-api-version','Vary':'Origin'};
const NO_DATA='В базе знаний по этому вопросу данных нет. Уточните у мастера или в документации оборудования.';
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
 const{data:employee}=await db.from('employees').select('role,name').eq('id',user.id).single();if(!employee)return reply({error:'employee required'},403);
 const body=await req.json();
 const message=String(body?.message||'').trim();
 if(message.length<2)return reply({error:'empty message'},400);
 if(message.length>2000)return reply({error:'message too long'},400);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 // ---- context: current order (if given and assigned to this user) ----
 let orderCtx:any=null;
 const orderId=Number(body?.order_id);
 if(orderId){
  const{data:o}=await admin.from('orders').select('id,title,status,kind,priority,deadline,equipment_id,assignee_id,equipment(name)').eq('id',orderId).maybeSingle();
  if(o&&o.assignee_id===user.id)orderCtx={id:o.id,title:o.title,status:o.status,kind:o.kind,priority:o.priority,section:o.section,deadline:o.deadline,equipment:(o as any).equipment?.name||null};
 }
 // ---- context: curated knowledge docs (equipment-scoped first, then global) ----
 const equipmentId=orderCtx?undefined:undefined;
 let docs:any[]=[];
 {const q=admin.from('knowledge_docs').select('id,title,body,source_label,equipment_id').order('id').limit(12);
  const{data}=await q; docs=data||[]}
 const docText=docs.map((d:any)=>`«${d.title}» [${d.source_label}]: ${d.body}`).join('\n');
 // approved repair memory only; revoked/rejected/candidate never enter retrieval
 let memory:any[]=[];
 {const{data}=await admin.from('repair_memory').select('id,title,body,version,equipment_id,order_id').eq('status','approved').order('id').limit(10); memory=data||[]}
 const memText=memory.map((m:any)=>`«${m.title}» [Память · наряд #${m.order_id} · версия ${m.version} · проверено мастером]: ${m.body}`).join('\n');
 // ---- context: recent closures for same equipment (order history) ----
 let history:string[]=[];
 if(orderId){const{data:o}=await admin.from('orders').select('equipment_id').eq('id',orderId).maybeSingle();
  if(o){const{data:past}=await admin.from('orders').select('id,title,closure,closed_at').eq('equipment_id',o.equipment_id).eq('status','closed').order('closed_at',{ascending:false}).limit(3);
   history=(past||[]).map((p:any)=>`#${p.id} ${p.title}: ${p.closure?.works||''}`).filter((s:string)=>s.length>3)}}
 const key=Deno.env.get('GEMINI_API_KEY'),model=Deno.env.get('GEMINI_MODEL');
 const contextBlock=`[Контекст наряда] ${orderCtx?JSON.stringify(orderCtx):'нет'}\n[История по этому оборудованию] ${history.length?history.join(' | '):'нет'}\n[Документация] ${docText||'нет'}\n[Память ремонтов] ${memText||'нет'}`;
 const instruction='Ты ассистент рабочего на заводе в системе Tekton OS (Ptah AI) (демо, синтетические данные). Отвечай на русском, кратко (до 120 слов). ЖЁСТКИЕ ПРАВИЛА: 1) Отвечай только на основе разделов [Контекст наряда], [История по этому оборудованию] и [Документация] ниже. Общие знания модели о моментах затяжки, допусках, напряжениях, зазорах и любых численных параметрах использовать ЗАПРЕЩЕНО. 2) Если в этих разделах нет ответа — честно скажи, что данных нет, и предложи уточнить у мастера. 3) Помечай каждый ответ меткой источника: [Документация], [История], [Память], [Контекст наряда] или [Нет данных]. 4) Никогда не давай инструкций по включению/подаче напряжения на оборудование. 5) Никогда не утверждай, что статус наряда изменён, что работа принята или что безопасность подтверждена — ты только советуешь, решения принимает человек. 6) Вопросы вне работы отклоняй коротко.';
 const fallback=()=>{ // rules-only: keyword match into docs
  const words=message.toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(w=>w.length>3);
  const hits=docs.filter(d=>words.some(w=>(d.title+' '+d.body).toLowerCase().includes(w)));
  if(hits.length){const d=hits[0];return {answer:`[Документация] ${d.title}: ${d.body}`,sources:[d.title],mode:'rules',knowledge_used:true}}
  const mhits=memory.filter((m:any)=>words.some(w=>(m.title+' '+m.body).toLowerCase().includes(w)));
  if(mhits.length){const m=mhits[0];return {answer:`[Память] ${m.title} (наряд #${m.order_id}, версия ${m.version}, проверено мастером): ${m.body}`,sources:[m.title],mode:'rules',knowledge_used:true}}
  if(orderCtx)return {answer:`[Контекст наряда] По наряду #${orderCtx.id} могу подсказать статус, срок и оборудование. По вашему вопросу в документации данных нет — уточните у мастера.`,sources:[],mode:'rules',knowledge_used:false};
  return {answer:'[Нет данных] '+NO_DATA,sources:[],mode:'rules',knowledge_used:false}};
 if(!key||!model)return reply(fallback());
 try{
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(20000),body:JSON.stringify({model,input:instruction+'\n\n'+contextBlock+'\n\n[Вопрос рабочего] '+message,response_format:{type:'text',mime_type:'application/json',schema:{type:'object',properties:{answer:{type:'string'},source:{type:'string',enum:['Документация','История','Память','Контекст наряда','Нет данных']},doc_title:{type:'string'}},required:['answer','source']}}})});
  if(!response.ok)throw Error('model HTTP '+response.status);
  const raw=await response.json();
  const steps=Array.isArray(raw?.steps)?raw.steps:[];
  const lastOut=[...steps].reverse().find((st:any)=>st?.type==='model_output');
  const content=Array.isArray(lastOut?.content)?lastOut.content:[];
  const text=content.filter((c:any)=>c?.type==='text').map((c:any)=>c.text||'').join('').replace(/^```(?:json)?\s*|\s*```$/g,'').trim();
  const parsed=JSON.parse(text);
  if(typeof parsed.answer!=='string'||!parsed.answer.trim())throw Error('invalid model JSON');
  const src=['Документация','История','Контекст наряда','Нет данных'].includes(parsed.source)?parsed.source:'Нет данных';
  return reply({answer:`[${src}] ${parsed.answer.trim()}`,sources:parsed.doc_title?[parsed.doc_title]:[],mode:'live',model,knowledge_used:src!=='Нет данных'});
 }catch(e){console.error('Assistant model failed',String(e));return reply({...fallback(),fallback_reason:'Модель недоступна, ответ по правилам.'})}
 }catch(e){console.error('Assistant request failed',String(e));return reply({error:'assistant request failed'},400)}
});
