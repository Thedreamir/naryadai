// Assertion-based RPC/role tests. Exit 1 on any failure. Environment: hosted Supabase pyqkstbcdxvpmtksziod.
import {createClient} from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL, key=process.env.SB_ANON
const since=new Date(Date.now()-90*86400000).toISOString(), until=new Date().toISOString()
let fails=0
const check=(name,cond,detail='')=>{console.log((cond?'ok':'FAIL')+' - '+name+(detail?' :: '+detail:''));if(!cond)fails++}
const login=async(email,pw)=>{const c=createClient(url,key);const r=await c.auth.signInWithPassword({email,password:pw});return r.error?null:c}

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
  check('master rating has completeness', r.data?.[0]?.factors_available>=4)
  // fresh order
  const {data:eq}=await c.from('equipment').select('id').limit(1)
  const {data:wk}=await c.from('employees').select('id').eq('role','worker').limit(2)
  const me=(await c.auth.getUser()).data.user.id
  const ins=await c.from('orders').insert({master_id:me,title:'TEST-GUARD-038 (удалить после проверки)',kind:'unplanned',equipment_id:eq[0].id,
    assignee_id:wk[0].id,priority:'normal',deadline:new Date(Date.now()+7200000).toISOString(),status:'issued'}).select('id').single()
  check('master issue fresh order', !ins.error, ins.error?.message)
  const oid=ins.data?.id
  if(oid){
    const re=await c.rpc('manage_order',{p_order_id:oid,p_action:'reassign',p_assignee:wk[1].id,p_reason:'guard-test'})
    check('master reassign ok', !re.error, re.error?.message)
    const pr=await c.rpc('manage_order',{p_order_id:oid,p_action:'priority',p_priority:'high',p_reason:'guard-test'})
    check('master priority ok', !pr.error, pr.error?.message)
    const ca=await c.rpc('manage_order',{p_order_id:oid,p_action:'cancel',p_reason:'guard-test'})
    check('master cancel ok', !ca.error, ca.error?.message)
    const {data:ev}=await c.from('order_events').select('reason').eq('order_id',oid)
    const txt=(ev||[]).map(e=>e.reason||'').join(' | ')
    check('3 manage events logged', (txt.match(/мастером/g)||[]).length===3, txt)
    const {data:o}=await c.from('orders').select('assignee_id,priority,cancelled').eq('id',oid).single()
    check('reassignment applied', o?.assignee_id===wk[1].id)
    check('priority applied', o?.priority==='high')
    check('cancel flag applied', o?.cancelled===true)
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
console.log(fails?('FAILURES: '+fails):'ALL ASSERTIONS PASSED')
process.exit(fails?1:0)
