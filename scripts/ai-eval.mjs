// AI eval (case block C): dataset-driven. Outcome classes: clean (review, no flags), flagged (review rule layer), guard (blocked at write).
// Labels: good -> clean expected; bad -> flagged OR guard (two lines of defence); guard -> blocked at write specifically.
// Fixtures via real RPCs as acting roles; closed/cancelled after; titled E2E-TEST (hidden by presentation filter).
import {createClient} from '@supabase/supabase-js'
import {readFileSync} from 'fs'
const {SUPABASE_URL,SB_ANON,PW_MASTER,PW_WORKERC}=process.env
const master=createClient(SUPABASE_URL,SB_ANON), worker=createClient(SUPABASE_URL,SB_ANON)
await master.auth.signInWithPassword({email:'master@naryadai.test',password:PW_MASTER})
await worker.auth.signInWithPassword({email:'worker-c@naryadai.test',password:PW_WORKERC})
const MID=(await master.auth.getUser()).data.user.id
const WID='d6184a48-fc97-46e0-809f-21bd28208074'
const PHOTO='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z'
const CASES=JSON.parse(readFileSync('scripts/eval-dataset.json','utf8'))
const dl=new Date(Date.now()+4*3600e3).toISOString()
async function cancel(id){try{await master.rpc('manage_order',{p_order_id:id,p_action:'cancel',p_assignee:null,p_priority:null,p_reason:'E2E eval cleanup'})}catch{}}
const results=[]
for(const c of CASES){
  const title='E2E-TEST ai-eval: '+(c.title||c.name)
  const rec={name:c.name,label:c.label,outcome:null,detail:''}
  try{
    const {data:ins,error}=await master.from('orders').insert({title,kind:c.kind,equipment_id:1,assignee_id:WID,master_id:MID,priority:'normal',deadline:dl,status:'issued'}).select('id,version').single()
    if(error) throw new Error('insert: '+error.message)
    const id=ins.id
    let v=ins.version
    const {error:perr}=await worker.rpc('record_permit',{order_id:id,kind:'confirmed',note:'E2E eval permit',expected_version:v})
    if(perr) throw Object.assign(new Error('permit: '+perr.message),{id})
    v=(await worker.from('orders').select('version').eq('id',id).single()).data.version
    const tr=async(st,extra={})=>{
      const {data,error}=await worker.rpc('transition_order',{order_id:id,target_status:st,expected_version:v,...extra})
      if(error) throw Object.assign(new Error(error.message),{status:st,id})
      v=(await worker.from('orders').select('version').eq('id',id).single()).data.version}
    await tr('accepted'); await tr('in_progress')
    const closure={works:c.works,fault_code:c.fault||'',materials:c.materials||[],photos:c.photo?[PHOTO]:[]}
    try{
      await tr('completed',{closure_data:closure})
    }catch(e){
      rec.outcome='guard'; rec.detail=e.message
      await cancel(id); results.push(rec); continue
    }
    const rv=await master.functions.invoke('review-order',{body:{id,version:v}})
    if(rv.error){rec.outcome='error';rec.detail=rv.error.message;await cancel(id);results.push(rec);continue}
    const data=rv.data
    const r=data?.result||{}
    const REQUIRED=['Описание работ неполное','Нет шифра','Нет фото после']
    const flagged=(r.rule_flags?.length>0)||((r.reasons||[]).some(x=>REQUIRED.includes(x)))
    rec.outcome=flagged?'flagged':'clean'
    rec.detail=`verdict=${r.verdict} flags=${(r.rule_flags||[]).length} mode=${r.mode}`
    const cur=await worker.from('orders').select('version').eq('id',id).single()
    const cl=await master.rpc('transition_order',{order_id:id,target_status:'closed',expected_version:cur.data.version,human_score:4,reason_text:'E2E eval fixture close'})
    if(cl.error){
      const v3=(await worker.from('orders').select('version').eq('id',id).single()).data.version
      await master.rpc('transition_order',{order_id:id,target_status:'rework',expected_version:v3,reason_text:'E2E eval cleanup',closure_data:null,human_score:null,human_comment:''})
      await cancel(id)
    }
  }catch(e){rec.outcome='error';rec.detail=e.message;if(e.id)await cancel(e.id)}
  results.push(rec)
}
let tp=0,fp=0,fn=0,tn=0,gp=0,gl=0,errs=0
for(const r of results){
  const ok=(r.label==='good'&&r.outcome==='clean')||(r.label==='bad'&&(r.outcome==='flagged'||r.outcome==='guard'))||(r.label==='guard'&&r.outcome==='guard')
  if(r.outcome==='error'){errs++;console.log('ERR ',r.name,'::',r.detail);continue}
  if(r.label==='good'){r.outcome==='clean'?tn++:fp++}
  else if(r.label==='bad'){r.outcome==='flagged'?tp++:(r.outcome==='guard'?gp++:fn++)}
  else if(r.label==='guard'){r.outcome==='guard'?gl++:fn++}
  console.log(`${ok?'OK  ':'MISS'} [${r.label}] ${r.name} -> ${r.outcome} :: ${r.detail}`)
}
const n=tp+fp+fn+tn+gp+gl
console.log(`\nRESULT: review-flags TP=${tp} FP=${fp} FN=${fn} TN=${tn} | guard-catches=${gp+gl} (of which expected-guard=${gl}) | errors=${errs}`)
console.log(`Accuracy (bad caught anywhere + good clean + guard blocked): ${n?(((tp+tn+gp+gl)/n)*100).toFixed(0):'-'}% of ${n}`)
const goods=results.filter(r=>r.label==='good'&&r.outcome!=='error').length
console.log(`BASELINE approve-all: ${goods}/${n} = ${n?((goods/n)*100).toFixed(0):'-'}%`)
