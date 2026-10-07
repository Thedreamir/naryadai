import {createClient} from '@supabase/supabase-js'
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
const t=process.argv[2]
if(t==='worker'){
 await s.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
 for(const [name,msg,oid] of [
  ['owned-order-doc','Как часто смазывать подшипники конвейера К-3 и какой смазкой?',532],
  ['memory-cite','Что было при последнем ремонте насоса Н-4?',618],
  ['debug-gone','__debug_ping__',null],
  ['foreign-order','Что в наряде?',597]]){
  const {data,error}=await s.functions.invoke('assistant-chat',{body:{message:msg,order_id:oid}})
  console.log('## '+name, 'ERR:',error?String(error).slice(0,80):'no')
  console.log(JSON.stringify(data)?.slice(0,600),'\n---')
 }
}
if(t==='oversize'){
 await s.auth.signInWithPassword({email:'worker-b@naryadai.test',password:process.env.PW_WORKERB})
 const {data,error}=await s.functions.invoke('assistant-chat',{body:{message:'x'.repeat(2100)}})
 console.log('## oversize ERR:',error?String(error).slice(0,200):'no','DATA:',JSON.stringify(data)?.slice(0,200))
}
