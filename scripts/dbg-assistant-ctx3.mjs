import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const {data:o,error}=await admin.from('orders').select('id,title,status,kind,priority,deadline,equipment_id,assignee_id,equipment(name)').eq('id',532).maybeSingle()
console.log('err:',error?.message||'no')
console.log('order:',o?JSON.stringify({id:o.id,status:o.status,assignee:o.assignee_id}):'null')
console.log('worker-a uid: d8acc918-f58a-4660-a903-da0bfbc2687c  match:',o?.assignee_id==='d8acc918-f58a-4660-a903-da0bfbc2687c')
const {data:past,error:e3}=await admin.from('orders').select('id,title,closure,closed_at').eq('equipment_id',o?.equipment_id||-1).eq('status','closed').order('closed_at',{ascending:false}).limit(3)
console.log('history err:',e3?.message||'no','rows:',past?.length)
