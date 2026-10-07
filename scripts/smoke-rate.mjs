import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
const {data:a}=await s.auth.signInWithPassword({email:'worker-b@naryadai.test',password:process.env.PW_WORKERB})
const uid=a.user.id
await admin.from('assistant_requests').delete().eq('user_id',uid)
await admin.from('assistant_requests').insert(Array.from({length:30},()=>({user_id:uid})))
const r=await s.functions.invoke('assistant-chat',{body:{message:'Проверка лимита'}})
const status=r.error?.context?.status
console.log('rate-bound status (expect 429):',status)
const t=await r.error?.context?.text?.()
console.log(t?.slice(0,200))
await admin.from('assistant_requests').delete().eq('user_id',uid)
const {count}=await admin.from('assistant_requests').select('id',{count:'exact',head:true}).eq('user_id',uid)
console.log('cleanup rows left:',count)
