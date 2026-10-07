// Assertion-based RPC/role tests. Exit 1 on any failure. Environment: hosted Supabase pyqkstbcdxvpmtksziod.
import {createClient} from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL, key=process.env.SB_ANON
const since=new Date(Date.now()-90*86400000).toISOString(), until=new Date().toISOString()
let fails=0
const check=(name,cond,detail='')=>{console.log((cond?'ok':'FAIL')+' - '+name+(detail?' :: '+detail:''));if(!cond) { fails++; throw new Error('Assertion failed: '+name) }}
const login=async(email,pw)=>{const c=createClient(url,key);const r=await c.auth.signInWithPassword({email,password:pw});return r.error?null:c}

const cleanup=createClient(url,process.env.SB_SERVICE)
try {
// Ephemeral synthetic auth account exercises real JWT with no employee, then disabled employee.
const tempEmail='guard-'+Date.now()+'@naryadai.test'
const tempPw='G!'+crypto.randomUUID()
const made=await cleanup.auth.admin.createUser({email:tempEmail,password:tempPw,email_confirm:true})
check('temporary auth account created',!made.error)
const tid=made.data.user.id
try {
 const tc=await login(tempEmail,tempPw)
 check('nonemployee authenticated',!!tc)
 const guard=async(label)=>{
  for(const fn of ['worker_rating','anomaly_report','downtime_report','materials_report']) {
   const x=await tc.rpc(fn,{since,until}); check(label+' '+fn+' refused',!!x.error,x.error?.message)
  }
  for(const [fn,args] of [
   ['manage_order',{p_order_id:1,p_action:'cancel'}],['review_fallback',{p_order_id:1,p_expected_version:1}],
   ['mark_report_seen',{order_id:1}],['pin_unlock',{employee_email:'nobody@naryadai.test'}],
   ['set_employee_pin',{p_employee:tid,p_pin:'1234'}],['review_refusal',{p_event_id:1,p_classification:'justified',p_note:'test'}],
   ['check_deadlines',{}],['verify_employee_pin',{p_employee:tid,p_pin:'1234'}]
  ]) { const x=await tc.rpc(fn,args); check(label+' '+fn+' refused',!!x.error,x.error?.message) }
 }
 await guard('nonemployee')
 const emp=await cleanup.from('employees').insert({id:tid,name:'TEMP disabled guard test',role:'master',is_active:false})
 check('disabled temporary employee inserted',!emp.error,emp.error?.message)
 await guard('disabled')
 await tc.auth.signOut()
} finally {
 const d=await cleanup.from('employees').delete().eq('id',tid); check('temporary employee removed',!d.error)
 const a=await cleanup.auth.admin.deleteUser(tid);check('temporary auth removed',!a.error)
}
// Shared pure semantics are the same functions used by worker_rating, not copied formulas.
for(const [reason,expected] of [['no_materials: Нет материала','justified'],['no_permit: Нет допуска','justified'],['busy_emergency: Срочная работа','justified'],['wrong_specialty: Не моя специальность','justified'],['','unjustified'],['unjustified: Проверено мастером','unjustified'],['other: нет материала','unknown'],['нет материалов','unknown'],['banana: авария','unknown']]) {
 const x=await cleanup.rpc('refusal_class',{reason});check('reason '+JSON.stringify(reason)+' = '+expected,!x.error && x.data===expected)
}
const repeatBase={eq_a:1,eq_b:1,fault_a:'M-02',fault_b:'M-02',closed_a:'2026-09-01T00:00:00Z',opened_b:'2026-09-05T00:00:00Z',cutoff:'2026-09-10T00:00:00Z'}
for(const [label,patch,expected] of [
 ['same fault 4d',{},true],['different fault',{fault_b:'M-03'},false],['different unit same name irrelevant',{eq_b:2},false],
 ['exact 7d',{opened_b:'2026-09-08T00:00:00Z'},true],['after 7d',{opened_b:'2026-09-08T00:00:01Z'},false],
 ['beyond historical until',{cutoff:'2026-09-04T00:00:00Z'},false],['exact until excluded',{cutoff:'2026-09-05T00:00:00Z'},false],
 ['missing fault',{fault_a:null},false],['empty fault',{fault_a:'',fault_b:''},false],['before closure',{opened_b:'2026-08-31T00:00:00Z'},false]
]) { const x=await cleanup.rpc('is_repeat_asof',{...repeatBase,...patch});check('repeat '+label,!x.error && x.data===expected,x.error?.message) }

// 1. bad login must fail
check('bad login rejected', (await login('master@naryadai.test','wrong-password'))===null)

// 2. no JWT: analytics RPCs must refuse
{
  const c=createClient(url,key)
  const r=await c.rpc('worker_rating',{since,until})
  check('noJWT worker_rating refused', !!r.error, r.error?.message)
  const a=await c.rpc('anomaly_report',{since,until})
  check('noJWT anomaly_report refused', !!a.error, a.error?.message)
}

// 3. worker scope
{
  const c=await login('worker-a@naryadai.test',process.env.PW_WORKERA)
  check('worker login', !!c)
  const me=(await c.auth.getUser()).data.user.id
  const r=await c.rpc('worker_rating',{since,until})
  check('worker rating succeeds', !r.error, r.error?.message)
  check('worker rating exactly one row', r.data?.length===1, 'rows='+r.data?.length)
  check('worker rating row is self', r.data?.[0]?.worker_id===me)
  for(const fn of ['anomaly_report','downtime_report','materials_report']){
    const x=await c.rpc(fn,{since,until})
    check('worker '+fn+' refused', !!x.error && /master\/leader/.test(x.error.message), x.error?.message)
  }
  // worker must not manage orders
  const mo=await c.rpc('manage_order',{p_order_id:1,p_action:'cancel',p_reason:'test'})
  check('worker manage_order refused', !!mo.error, mo.error?.message)
  await c.auth.signOut()
}

// 4. master scope + manage_order cycle on a FRESH order (QA rows untouched)
{
  const c=await login('master@naryadai.test',process.env.PW_MASTER)
  check('master login', !!c)
  const r=await c.rpc('worker_rating',{since,until})
  check('master rating all rows', !r.error && r.data.length>5, 'rows='+r.data?.length)
  check('dataset distinguishes total from rework sorting',r.data.some((x,i)=>i>0 && r.data[i-1].f_rework<x.f_rework))
  check('master rating named total monotonic', r.data.every((x,i)=>i===0 || r.data[i-1].total>=x.total))
  check('unknown refusal factor is excluded', r.data.filter(x=>x.rejects_unclassified>0).every(x=>x.f_rejects===null && x.factors_available<5))
  // fresh order
  const {data:eq}=await c.from('equipment').select('id').limit(1)
  const worker=await login('worker-a@naryadai.test',process.env.PW_WORKERA)
  const wa=(await worker.auth.getUser()).data.user.id
  const {data:others}=await c.from('employees').select('id').eq('role','worker').neq('id',wa).limit(1)
  const wk=[{id:wa},others[0]]
  const me=(await c.auth.getUser()).data.user.id
  const ins=await c.from('orders').insert({master_id:me,title:'TEST-GUARD-038 (удалить после проверки)',kind:'unplanned',equipment_id:eq[0].id,
    assignee_id:wk[0].id,priority:'normal',deadline:new Date(Date.now()+7200000).toISOString(),status:'issued'}).select('id').single()
  check('master issue fresh order', !ins.error, ins.error?.message)
  const oid=ins.data?.id
  if(oid){
    const before=await c.rpc('worker_rating',{since,until:new Date().toISOString()})
    const prior=before.data.find(x=>x.worker_id===wa)
    const ev=await cleanup.from('order_events').insert({order_id:oid,actor_id:wa,new_status:'rejected',reason:'other: спорная причина'}).select('id').single()
    check('disputed refusal event seeded',!ev.error,ev.error?.message)
    const re=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wk[1].id,p_reason:'guard-test'})
    check('master reassign ok', !re.error, re.error?.message)
    const rated=await c.rpc('worker_rating',{since,until:new Date().toISOString()})
    const ar=rated.data.find(x=>x.worker_id===wa)
    check('reassigned refusal stays with event actor',ar.rejects_unclassified===prior.rejects_unclassified+1 && ar.f_rejects===null)
    const decision=await c.rpc('review_refusal',{p_event_id:ev.data.id,p_classification:'justified',p_note:'Синтетический тест: причина подтверждена'})
    check('master stores disputed refusal decision',!decision.error,decision.error?.message)
    const after=await c.rpc('worker_rating',{since,until:new Date().toISOString()})
    const rr=after.data.find(x=>x.worker_id===wa)
    check('reviewed reason classified as justified',rr.rejects_unclassified===prior.rejects_unclassified && rr.rejects_justified===prior.rejects_justified+1)
    const review=await cleanup.from('refusal_reviews').select('*').eq('event_id',ev.data.id).single()
    check('review persisted with master identity',!review.error && review.data.reviewer_id===me && review.data.classification==='justified')
    const hist=await c.rpc('worker_rating',{since,until})
    check('historical asof excludes later refusal/review',hist.data.find(x=>x.worker_id===wa).rejects_unclassified===prior.rejects_unclassified)

    const pr=await c.rpc('manage_order',{p_order_id:oid,p_action:'priority',p_priority:'high',p_reason:'guard-test'})
    check('master priority ok', !pr.error, pr.error?.message)
    const back=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wa,p_reason:'negative cancel test'})
    check('reassign back succeeds',!back.error)
    const accepted=await worker.from('orders').update({status:'accepted'}).eq('id',oid)
    check('fresh assigned worker accepts',!accepted.error,accepted.error?.message)
    const unsafe=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wk[1].id})
    check('accepted order reassign blocked',!!unsafe.error && /only issued/.test(unsafe.error.message))
    const started=await worker.from('orders').update({status:'in_progress'}).eq('id',oid)
    check('fresh worker starts',!started.error,started.error?.message)
    const moving=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wk[1].id})
    check('in_progress reassign denied',!!moving.error && /only issued/.test(moving.error.message))
    const paused=await worker.from('orders').update({status:'paused'}).eq('id',oid)
    check('fresh worker pauses',!paused.error,paused.error?.message)
    const pa=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wk[1].id})
    check('paused reassign denied',!!pa.error && /only issued/.test(pa.error.message))
    const ca=await c.rpc('manage_order',{p_order_id:oid,p_action:'cancel',p_reason:'guard-test'})
    check('master cancel ok', !ca.error, ca.error?.message)
    const {data:loggedEvents}=await c.from('order_events').select('reason').eq('order_id',oid)
    const txt=(loggedEvents||[]).map(e=>e.reason||'').join(' | ')
    check('4 manage events logged', (txt.match(/мастером/g)||[]).length===4, txt)
    const {data:o}=await c.from('orders').select('assignee_id,priority,cancelled').eq('id',oid).single()
    check('reassignment applied', o?.assignee_id===wa)
    check('priority applied', o?.priority==='high')
    check('cancel flag applied', o?.cancelled===true)
    const neg=await worker.from('orders').update({status:'accepted'}).eq('id',oid)
    check('cancel -> worker transition blocked',!!neg.error && /cancelled/.test(neg.error.message),neg.error?.message)
    const rep=await c.rpc('manage_order',{p_order_id:oid,p_action:'priority',p_priority:'normal'})
    check('cancel -> management blocked',!!rep.error && /cancelled/.test(rep.error.message))
  }
  await c.auth.signOut()
}

// 5. leader read scope
{
  const c=await login('leader@naryadai.test',process.env.PW_LEADER)
  check('leader login', !!c)
  const mo=await c.rpc('manage_order',{p_order_id:1,p_action:'cancel',p_reason:'test'})
  check('leader manage_order refused', !!mo.error, mo.error?.message)
  const a=await c.rpc('anomaly_report',{since,until})
  check('leader anomaly ok', !a.error && a.data.length>0, a.error?.message)
  await c.auth.signOut()
}
} finally {
 const q=await cleanup.from('orders').select('id').like('title','TEST-GUARD-038%')
 for(const o of q.data||[]) {
  const evs=await cleanup.from('order_events').select('id').eq('order_id',o.id)
  for(const e of evs.data||[]) await cleanup.from('refusal_reviews').delete().eq('event_id',e.id)
  const e=await cleanup.from('order_events').delete().eq('order_id',o.id); if(e.error) throw e.error
  const d=await cleanup.from('orders').delete().eq('id',o.id); if(d.error) throw d.error
 }
 const left=await cleanup.from('orders').select('id').like('title','TEST-GUARD-038%'); check('test rows cleaned',!left.error && left.data.length===0)
}
console.log(fails?('FAILURES: '+fails):'ALL ASSERTIONS PASSED')
process.exit(fails?1:0)
