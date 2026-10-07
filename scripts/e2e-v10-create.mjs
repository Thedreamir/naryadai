import {createClient} from '@supabase/supabase-js'
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
await s.auth.signInWithPassword({email:'master@naryadai.test',password:process.env.PW_MASTER})
const {data:{user}}=await s.auth.getUser()
const {data,error}=await s.from('orders').insert({
  title:'E2E v10c: осмотр и смазка конвейера К-3 (одноразовый)',
  kind:'planned', equipment_id:1, assignee_id:'cdcc61f6-3088-4633-a34a-91d16d334935',
  priority:'normal', deadline:new Date(Date.now()+24*3600e3).toISOString(), master_id:user.id, status:'issued', before_photos:[]}).select('id').single()
console.log(error?('ERR '+error.message):('created order '+data.id))
await s.auth.signOut()
