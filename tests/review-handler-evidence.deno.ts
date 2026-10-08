// Isolated handler tests. Replaces provider client and serve before import; no network.
const source = await Deno.readTextFile(new URL('../supabase/functions/review-order/index.ts',import.meta.url));
const patched=source.replace(/import \{ createClient \} from 'npm:[^']+';/,"const createClient = (globalThis as any).__reviewClient;").replace('Deno.serve(', '(globalThis as any).__reviewServe(');
const temp = new URL('../supabase/functions/review-order/.qa-handler.ts',import.meta.url);
await Deno.writeTextFile(temp,patched);
try {
 for(const fail of ['order_events','own_photos','foreign_photos','intake','norms','faults','history','people','materials']){
  Deno.test('required read error '+fail+' prevents model and update',async()=>{
   let handler:any,updates=0,external=0;const originalFetch=globalThis.fetch;
   globalThis.fetch=(()=>{external++;throw Error('Network forbidden')}) as typeof fetch;
   (globalThis as any).__reviewServe=(fn:any)=>{handler=fn};
   let clientNumber=0;
   (globalThis as any).__reviewClient=()=>{
    const admin=clientNumber++>0;
    return {auth:{getUser:async()=>({data:{user:{id:'qa'}},error:null})},from(table:string){
     let own=true;let mutation=false;
     const q:any={};
     for(const method of ['select','eq','neq','order','limit','in','single','maybeSingle','update','insert','upsert'])q[method]=(...args:any[])=>{if(method==='neq'&&table==='order_photos')own=false;if(method==='update'){updates++;mutation=true}return q};
     q.then=(resolve:any)=>{
      const key=table==='order_events'?'order_events':table==='order_photos'?(own?'own_photos':'foreign_photos'):table==='order_intake_photos'?'intake':table==='work_norms'?'norms':table==='fault_codes'?'faults':table==='orders'?'history':table==='employees'?'people':'materials';
      let data:any=[];
      if(!admin&&table==='employees')data={role:'master',is_active:true};
      if(!admin&&table==='orders')data={id:10,version:1,status:'completed',equipment_id:1,title:'Замена насоса',closure:{works:'Замена уплотнения насоса',photos:['data:image/png;base64,YQ==']},deadline:'2026-10-08T10:00:00Z'};
      return Promise.resolve({data:admin&&key===fail?null:data,error:admin&&key===fail?{code:'QA_FAIL'}:null}).then(resolve);
     };return q;
    }};
   };
   Deno.env.set('SUPABASE_URL','https://qa.invalid');Deno.env.set('SUPABASE_ANON_KEY','not-secret');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','not-secret');Deno.env.set('GEMINI_API_KEY','not-secret');Deno.env.set('GEMINI_MODEL','qa');
   try{
    await import(temp.href+'?'+fail);
    const res=await handler(new Request('https://qa.invalid/review',{method:'POST',headers:{Authorization:'Bearer qa'},body:JSON.stringify({id:10,version:1})}));
    if(res.status!==503)throw Error('expected503 got '+res.status);
    const body=await res.json();if(body.code!=='EVIDENCE_UNAVAILABLE')throw Error('wrong code');
    if(updates||external)throw Error('side effect occurred '+updates+'/'+external);
   }finally{globalThis.fetch=originalFetch}
  });
 }
} finally {
 // Temp module must exist until registered tests have run. Removal handled on unload.
 globalThis.addEventListener('unload',()=>{try{Deno.removeSync(temp)}catch{}});
}
