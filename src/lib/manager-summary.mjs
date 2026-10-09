const activeStatuses=new Set(['issued','queued','accepted','in_progress','paused','rework'])
export function currentSummary(orders,now=Date.now()) {
  const current=orders.filter(o=>!o.cancelled)
  const active=current.filter(o=>activeStatuses.has(o.status))
  return {active,overdue:active.filter(o=>Number.isFinite(Date.parse(o.deadline))&&Date.parse(o.deadline)<now),review:current.filter(o=>['completed','ai_review'].includes(o.status)),inWork:active.filter(o=>o.status==='in_progress')}
}
export function workerLoad(employees,orders,now=Date.now()) {
  const current=currentSummary(orders,now)
  return employees.filter(e=>e.role==='worker'&&e.is_active!==false).map(worker=>{
    const assigned=current.active.filter(o=>String(o.assignee_id)===String(worker.id))
    const queued=assigned.filter(o=>o.status==='queued').length
    const working=assigned.filter(o=>o.status==='in_progress').length
    const reviewing=current.review.filter(o=>String(o.assignee_id)===String(worker.id)).length
    const availability=worker.on_shift===false?'off':worker.on_shift!==true?'unknown':working?'busy':queued?'queue':assigned.length?'assigned':'free'
    return {worker,assigned,queued,working,reviewing,availability,overdue:current.overdue.filter(o=>String(o.assignee_id)===String(worker.id)).length}
  }).sort((a,b)=>b.overdue-a.overdue||b.assigned.length-a.assigned.length||a.worker.name.localeCompare(b.worker.name,'ru'))
}
export function repeatRows(rows,equipment,section='') {
  const allowed=new Set(equipment.filter(e=>!section||e.section===section).map(e=>String(e.id)))
  return rows.filter(r=>!section||allowed.has(String(r.equipment_id))).map(r=>({...r,closed_count:Number(r.closed_count)||0,pairs_within_window:Number(r.pairs_within_window)||0})).sort((a,b)=>b.pairs_within_window-a.pairs_within_window||b.closed_count-a.closed_count)
}
