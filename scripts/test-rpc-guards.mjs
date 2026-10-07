import {createClient} from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL, key=process.env.SB_ANON
const since=new Date(Date.now()-90*86400000).toISOString(), until=new Date().toISOString()
async function as(email,pw){
  const c=createClient(url,key)
  const {error}=await c.auth.signInWithPassword({email,password:pw})
  if(error) return {email,login:error.message}
  const out={email}
  const me=(await c.auth.getUser()).data.user.id
  const r=await c.rpc('worker_rating',{since,until})
  out.rating=r.error?('ERR '+r.error.message):(r.data.length+' rows; self-only='+r.data.every(d=>d.worker_id===me))
  const a=await c.rpc('anomaly_report',{since,until})
  out.anomalies=a.error?('ERR '+a.error.message):(a.data.length+' rows')
  const d=await c.rpc('downtime_report',{since,until})
  out.downtime=d.error?('ERR '+d.error.message):(d.data.length+' rows; first cols='+Object.keys(d.data[0]||{}).join(','))
  const m=await c.rpc('materials_report',{since,until})
  out.materials=m.error?('ERR '+m.error.message):(m.data.length+' rows')
  await c.auth.signOut()
  return out
}
console.log(JSON.stringify(await as('master@naryadai.test',process.env.PW_MASTER),null,1))
console.log(JSON.stringify(await as('worker-a@naryadai.test',process.env.PW_WORKERA),null,1))
console.log(JSON.stringify(await as('leader@naryadai.test',process.env.PW_LEADER),null,1))
