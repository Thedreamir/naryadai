import {createClient} from '@supabase/supabase-js'
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
await s.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
for(const [msg,oid] of [
  ['Как часто смазывать подшипники конвейера К-3 и какой смазкой?',532],
  ['Какой момент затяжки болтов на дробилке?',null],
  ['Что у меня сейчас в работе и какой срок?',532]]){
  const {data,error}=await s.functions.invoke('assistant-chat',{body:{message:msg,order_id:oid}})
  console.log('Q:',msg)
  console.log('ERR:',error?String(error).slice(0,120):'no')
  console.log('A:',JSON.stringify(data)?.slice(0,500),'\n---')
}
await s.auth.signOut()
