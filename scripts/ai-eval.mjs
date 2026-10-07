// AI eval (case block C): rule-layer TP/FP/FN vs labels, approve-all baseline, write-guard catches.
// Fixtures created via real RPCs as the acting roles, closed at the end, titled E2E-TEST (hidden by presentation filter).
import {createClient} from '@supabase/supabase-js'
const {SUPABASE_URL,SB_ANON,PW_MASTER,PW_WORKERC}=process.env
const master=createClient(SUPABASE_URL,SB_ANON), worker=createClient(SUPABASE_URL,SB_ANON)
await master.auth.signInWithPassword({email:'master@naryadai.test',password:PW_MASTER})
await worker.auth.signInWithPassword({email:'worker-c@naryadai.test',password:PW_WORKERC})
const MID=(await master.auth.getUser()).data.user.id
const WID='d6184a48-fc97-46e0-809f-21bd28208074'
const PHOTO='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z'
const LONG='Провёл полный осмотр узла, заменил изношенный подшипник, проверил соосность и затяжку креплений, запустил и проконтролировал работу под нагрузкой.'
const CASES=[
 {name:'short works 12-29 chars',label:'bad',kind:'planned',works:'Заменил подшипник'},
 {name:'works repeats title',label:'bad',kind:'planned',title:'Осмотреть и смазать конвейер К-3 полностью',works:'Осмотреть и смазать конвейер К-3 полностью'},
 {name:'digits-only works',label:'bad',kind:'planned',works:'123456789012345678'},
 {name:'material qty zero',label:'bad',kind:'planned',materials:[{name:'Смазка',quantity:0}]},
 {name:'material qty 999',label:'bad',kind:'planned',materials:[{name:'Смазка',quantity:999}]},
 {name:'clean planned',label:'good',kind:'planned',works:LONG,materials:[{name:'Смазка',quantity:0.5}]},
 {name:'clean planned no materials',label:'good',kind:'planned',works:LONG},
 {name:'clean unplanned with photo',label:'good',kind:'unplanned',works:LONG,photos:[PHOTO]},
]
const GUARD=[
 {name:'guard: works<12',kind:'planned',works:'Коротко'},
 {name:'guard: no fault code',kind:'planned',works:LONG,noFault:true},
 {name:'guard: unplanned no photo',kind:'unplanned',works:LONG},
]
const dl=new Date(Date.now()+4*3600e3).toISOString()
async function cancel(id){try{await master.rpc('manage_order',{p_order_id:id,p_action:'cancel',p_assignee:null,p_priority:null,p_reason:'E2E eval cleanup'})}catch{}}
const results=[],guards=[]
async function mk(c){
  const title='E2E-TEST ai-eval: '+(c.title||c.name)
  const {data:ins,error}=await master.from('orders').insert({title,kind:c.kind,equipment_id:1,assignee_id:WID,master_id:MID,priority:'normal',deadline:dl,status:'issued'}).select('id,version').single()
  if(error) throw new Error('insert: '+error.message)
  const id=ins.id
  let v=ins.version
  const {error:perr}=await worker.rpc('record_permit',{order_id:id,kind:'confirmed',note:'E2E eval permit',expected_version:v})
  if(perr) throw new Error('permit: '+perr.message)
  v=(await worker.from('orders').select('version').eq('id',id).single()).data.version
  const tr=async(st,extra={})=>{
    const {data,error}=await worker.rpc('transition_order',{order_id:id,target_status:st,expected_version:v,...extra})
    if(error) throw Object.assign(new Error(error.message),{status:st,id})
    v=data?.version??v+1; return data}
  await tr('accepted'); await tr('in_progress')
  const closure={works:c.works,fault_code:c.noFault?'':'М-02',materials:c.materials||[],photos:c.photos||[]}
  await tr('completed',{closure_data:closure})
  return {id,v}
}
for(const c of GUARD){
  try{const{id}=await mk(c);guards.push({name:c.name,caught:false});await cancel(id)}
  catch(e){guards.push({name:c.name,caught:true,msg:e.message});if(e.id)await cancel(e.id)}
}
for(const c of CASES){
  try{
    const {id,v}=await mk(c)
    const {data,error}=await master.functions.invoke('review-order',{body:{id,version:v}})
    if(error){results.push({name:c.name,label:c.label,flagged:null,err:error.message});continue}
    const r=data?.result||{}
    const REQUIRED=['Описание работ неполное','Нет шифра','Нет фото после']
    const flagged=(r.rule_flags?.length>0)||((r.reasons||[]).some(x=>REQUIRED.includes(x)))
    results.push({name:c.name,label:c.label,flagged,verdict:r.verdict,flags:r.rule_flags||[],mode:r.mode})
    const cur=await worker.from('orders').select('version').eq('id',id).single()
    const cl=await master.rpc('transition_order',{order_id:id,target_status:'closed',expected_version:cur.data.version,human_score:4,reason_text:'E2E eval fixture close'})
    if(cl.error){ // rework verdict blocks direct close: send to rework, then cancel
      const v3=(await worker.from('orders').select('version').eq('id',id).single()).data.version
      await master.rpc('transition_order',{order_id:id,target_status:'rework',expected_version:v3,reason_text:'E2E eval cleanup',closure_data:null,human_score:null,human_comment:''})
      await cancel(id)
    }
  }catch(e){results.push({name:c.name,label:c.label,flagged:null,err:e.message});if(e.id)await cancel(e.id)}
}
let tp=0,fp=0,fn=0,tn=0
for(const r of results){
  if(r.flagged===null){console.log('ERROR',r.name,r.err);continue}
  if(r.label==='bad'&&r.flagged)tp++;else if(r.label==='bad'&&!r.flagged)fn++
  else if(r.label==='good'&&r.flagged)fp++;else tn++
  console.log(`${(r.flagged===(r.label==='bad'))?'OK  ':'MISS'} ${r.name} :: label=${r.label} flagged=${r.flagged} verdict=${r.verdict} flags=${(r.flags||[]).length} mode=${r.mode||''}`)
}
const n=tp+fp+fn+tn
console.log(`\nRULE-LAYER: TP=${tp} FP=${fp} FN=${fn} TN=${tn} accuracy=${n?((tp+tn)/n*100).toFixed(0):'-'}%`)
const valid=results.filter(r=>r.flagged!==null)
  console.log(`BASELINE approve-all: accuracy=${(valid.filter(r=>r.label==='good').length/(valid.length||1)*100).toFixed(0)}% (flags nothing)`)
console.log('\nWRITE GUARD (first line of defence):')
for(const g of guards) console.log(`${g.caught?'CAUGHT':'LEAKED'} ${g.name}${g.msg?' :: '+g.msg:''}`)
