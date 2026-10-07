import {createClient} from '@supabase/supabase-js'
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
await s.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
const {data:o}=await s.from('orders').select('id,status,version').eq('id',645).single()
console.log('order:',JSON.stringify(o))
const {data,error}=await s.rpc('transition_order',{order_id:645,target_status:'in_progress',expected_version:o.version,reason_text:'',closure_data:null,human_score:null,human_comment:''})
console.log(error?('ERR '+error.message):('OK '+JSON.stringify(data)))
await s.auth.signOut()
