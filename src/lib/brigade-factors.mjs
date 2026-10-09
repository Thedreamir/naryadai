// Factor summaries only. No brigade total, ranking, roster inference or order weighting.
export const BRIGADE_FACTORS = Object.freeze([
  {key:'f_quality', label:'Качество', weight:30},
  {key:'f_ontime', label:'В срок', weight:25},
  {key:'f_rework', label:'Без доработок', weight:20},
  {key:'f_volume', label:'Объём', weight:15},
  {key:'f_rejects', label:'Без отказов', weight:10},
].map(Object.freeze))
export function factorValue(value) {
  if (typeof value === 'string') {
    if (!/^\d+(?:\.\d+)?$/.test(value.trim())) return null
    value = Number(value.trim())
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}
function id(value) { return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : null }
export function brigadeFactors(ratings, employees, {brigade = null} = {}) {
  const source = Array.isArray(ratings) ? ratings : []
  const people = Array.isArray(employees) ? employees : []
  const ratingCounts = new Map(), personCounts = new Map(), roster = new Map()
  for (const r of source) { const key=id(r?.worker_id); if(key!==null) ratingCounts.set(key,(ratingCounts.get(key)||0)+1) }
  for (const e of people) { const key=id(e?.id); if(key!==null) {personCounts.set(key,(personCounts.get(key)||0)+1); roster.set(key,e)} }
  const groups = new Map(); let omittedRows=0, invalidFactors=0
  for (const r of source) {
    const key=id(r?.worker_id), person=roster.get(key)
    if(key===null || ratingCounts.get(key)!==1 || personCounts.get(key)!==1 || person?.role!=='worker' || typeof person.brigade!=='string' || !person.brigade.trim()) {omittedRows++; continue}
    const name=person.brigade.trim()
    if(brigade!==null && name!==brigade) continue
    const values=BRIGADE_FACTORS.map(f=>factorValue(r[f.key]))
    for (let i=0;i<values.length;i++) if(values[i]===null && r[BRIGADE_FACTORS[i].key]!=null) invalidFactors++
    const activeWeight=BRIGADE_FACTORS.reduce((sum,f,i)=>sum+(values[i]!==null?f.weight:0),0)
    const profile=values.map(v=>v===null?'0':'1').join('')
    if(!groups.has(name)) groups.set(name,[])
    groups.get(name).push({values,activeWeight,profile})
  }
  const brigades=[...groups].sort(([a],[b])=>a.localeCompare(b,'ru')).map(([name,workers])=>({
    name, workerCount:workers.length,
    heterogeneousWeights:new Set(workers.map(w=>w.profile)).size>1,
    weightProfiles:[...new Set(workers.map(w=>w.profile))].map(profile=>{
      const matching=workers.filter(w=>w.profile===profile), activeWeight=matching[0].activeWeight
      return {profile,workerCount:matching.length,activeWeight,weights:Object.fromEntries(BRIGADE_FACTORS.map((f,i)=>[f.key,profile[i]==='1' ? f.weight / activeWeight * 100 : 0]))}
    }),
    factors:BRIGADE_FACTORS.map((f,i)=>{
      const known=workers.map(w=>w.values[i]).filter(v=>v!==null)
      return {...f,mean:known.length?known.reduce((a,b)=>a+b,0)/known.length:null,available:known.length,missing:workers.length-known.length,min:known.length?Math.min(...known):null,max:known.length?Math.max(...known):null}
    })
  }))
  return {brigades,omittedRows,invalidFactors,sourceRows:source.length}
}
