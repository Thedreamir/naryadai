import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const {data:docs,error:e1}=await admin.from('knowledge_docs').select('id,title,body,source_label,equipment_id').order('id').limit(12)
console.log('docs:',docs?.length,'err:',e1?.message||'no')
const {data:o,error:e2}=await admin.from('orders').select('id,title,status,kind,priority,fault_code,section,deadline,equipment_id,assignee_id,equipment(name,model)').eq('id',532).maybeSingle()
console.log('order err:',e2?.message||'no','order:',o?o.id+' '+o.title:'null','equip:',JSON.stringify(o?.equipment))
console.log('assignee:',o?.assignee_id)
