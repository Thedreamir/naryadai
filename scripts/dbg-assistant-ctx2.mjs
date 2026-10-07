import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const {data:o,error}=await admin.from('orders').select('id,title,status,kind,priority,fault_code,section,deadline,equipment_id,assignee_id,equipment(name)').eq('id',532).maybeSingle()
console.log('err:',error?.message||'no','order:',o?JSON.stringify({id:o.id,title:o.title,status:o.status,assignee:o.assignee_id,equip:o.equipment}):'null')
