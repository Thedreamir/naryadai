/** Rules over loaded, role-visible synthetic history. Never a failure probability. */
export const DEFAULT_CHECK_CONFIG = Object.freeze({lookbackDays:90, repeatWindowDays:7, pairThreshold:2})
const DAY = 86400000
export function validateCheckConfig(config = {}) {
  const value = {...DEFAULT_CHECK_CONFIG, ...config}
  for (const [key,max] of [['lookbackDays',365],['repeatWindowDays',90],['pairThreshold',100]]) {
    if (!Number.isInteger(value[key]) || value[key]<1 || value[key]>max) throw new RangeError(`Invalid ${key}`)
  }
  if(value.repeatWindowDays>value.lookbackDays) throw new RangeError('Repeat window exceeds history')
  return value
}
// Require an explicit timezone: local dates vary with the browser timezone.
const time = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN
const validId = id => (typeof id==='number'&&Number.isSafeInteger(id)&&id>0)||(typeof id==='string'&&id.trim().length>0)
export function checkPriority(orders, equipmentId, config = {}, asOf = Date.now()) {
  const settings = validateCheckConfig(config)
  if (!Array.isArray(orders)||!Number.isFinite(asOf)||!validId(equipmentId)) throw new TypeError('Invalid history, equipment or asOf')
  const since = asOf-settings.lookbackDays*DAY
  const rows = orders.filter(o=>o && String(o.equipment_id)===String(equipmentId))
  const idCounts = new Map()
  for(const o of orders) if(o && validId(o.id)) idCounts.set(String(o.id),(idCounts.get(String(o.id))||0)+1)
  const groups = new Map(); let eligibleCount=0, excludedCount=0, missingCount=0
  for(const o of rows) {
    if(o.cancelled || o.kind!=='unplanned' || o.status!=='closed') { excludedCount++; continue }
    const created=time(o.created_at), closed=time(o.closed_at)
    const code=typeof o.closure?.fault_code==='string'?o.closure.fault_code.trim():''
    if(!validId(o.id)||idCounts.get(String(o.id))!==1||!code||!Number.isFinite(created)||!Number.isFinite(closed)||closed<created) {missingCount++; continue}
    if(created<since||created>asOf||closed>asOf) {excludedCount++;continue}
    eligibleCount++
    const list=groups.get(code)||[];list.push({id:o.id,created,closed,code});groups.set(code,list)
  }
  const pairs=[]
  for(const [code,list] of [...groups].sort(([a],[b])=>a.localeCompare(b))) {
    list.sort((a,b)=>a.created-b.created||String(a.id).localeCompare(String(b.id)))
    for(let i=1;i<list.length;i++) {
      const first=list[i-1],second=list[i],gapDays=(second.created-first.created)/DAY
      if(gapDays<=settings.repeatWindowDays) pairs.push({code,firstOrderId:first.id,secondOrderId:second.id,firstCreatedAt:new Date(first.created).toISOString(),secondCreatedAt:new Date(second.created).toISOString(),firstClosedAt:new Date(first.closed).toISOString(),secondClosedAt:new Date(second.closed).toISOString(),overlappingWork:second.created<first.closed,gapDays})
    }
  }
  const status=eligibleCount<2?'insufficient':pairs.length>=settings.pairThreshold?'review':'below_threshold'
  return {label:'Приоритет проверки',method:'rules-v1',source:'synthetic-role-visible-history',status,pairCount:pairs.length,eligibleCount,excludedCount,missingCount,pairs,config:settings,asOf:new Date(asOf).toISOString(),since:new Date(since).toISOString()}
}
