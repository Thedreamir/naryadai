// Read-only display selection. Never schedules work or changes an order status.
export const workerStatusLabels = {issued:'Выдан',queued:'В очереди',accepted:'Принят',in_progress:'В работе',paused:'Приостановлен',rework:'Доработка'}
export function workerOverview(orders, actorId, hideTechnical = false, technical = () => false) {
  const mine = orders.filter(o => o.assignee_id === actorId && !o.cancelled && Object.hasOwn(workerStatusLabels, o.status))
  const visible = mine.filter(o => !hideTechnical || !technical(o.title) || ['accepted','in_progress','paused','rework'].includes(o.status))
  const active = visible.filter(o => ['in_progress','rework','paused'].includes(o.status))
  const running = active.filter(o => ['in_progress','rework'].includes(o.status))
  const accepted = visible.filter(o => o.status === 'accepted')
  const pending = visible.filter(o => ['issued','queued'].includes(o.status))
  const focus = running.length === 1 ? running[0] : active.length === 1 ? active[0] : active.length === 0 && accepted.length === 1 ? accepted[0] : active.length === 0 && accepted.length === 0 && pending.length === 1 ? pending[0] : null
  return {mine:visible, focus, queue:visible.filter(o => o.id !== focus?.id)}
}
export function workerDeadline(deadline, now = Date.now()) {
  const at = deadline ? Date.parse(deadline) : NaN
  if (!Number.isFinite(at)) return {valid:false,overdue:false,minutes:0,at:null}
  const delta = at - now
  return {valid:true,overdue:delta < 0,minutes:Math.ceil(Math.abs(delta)/60000),at}
}
export function workerNextAction(status) {
  return {issued:'Посмотреть и ответить',queued:'Открыть наряд из очереди',accepted:'Проверить условия начала',in_progress:'Открыть работу и отчёт',paused:'Открыть приостановленный наряд',rework:'Открыть доработку'}[status] || 'Открыть наряд'
}
