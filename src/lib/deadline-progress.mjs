// Read-only order deadline display. This is neither work completion nor downtime.
const ACTIVE = new Set(['issued', 'queued', 'accepted', 'in_progress', 'paused', 'rework'])
const FINISHED = new Set(['completed', 'ai_review', 'closed', 'rejected'])
export const DEADLINE_PROGRESS_POLICY = Object.freeze({warningFraction: 0.75, warningMinutes: 15})

function timestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null
  if (typeof value !== 'string') return null
  // Reject ambiguous local dates and silently normalized impossible dates.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return null
  const [,year,month,day,hour,minute,second,zone] = match
  const calendar = new Date(Date.UTC(+year, +month - 1, +day))
  if (calendar.getUTCFullYear() !== +year || calendar.getUTCMonth() !== +month - 1 || calendar.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59) return null
  if (zone !== 'Z' && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59)) return null
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : null
}
function duration(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000))
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60), remainder = minutes % 60
  if (hours < 24) return `${hours} ч${remainder ? ` ${remainder} мин` : ''}`
  const days = Math.floor(hours / 24), rest = hours % 24
  return `${days} д${rest ? ` ${rest} ч` : ''}`
}
export function deadlineProgress({deadline, issuedAt, now, status, cancelled = false} = {}) {
  const neutral = (state, label, reason) => ({state, label, reason, tone: 'neutral', deadlineAt: null, remainingMs: null, elapsedPercent: null, progressAvailable: false, overdue: false})
  if (cancelled === true) return neutral('inactive', 'Наряд отменён', 'cancelled')
  if (FINISHED.has(status)) return neutral('inactive', {completed: 'Отчёт сдан', ai_review: 'Отчёт на проверке', closed: 'Наряд закрыт', rejected: 'Наряд отклонён'}[status], 'inactive_status')
  if (!ACTIVE.has(status)) return neutral('unknown', 'Состояние наряда неизвестно', 'unknown_status')
  const at = timestamp(deadline)
  if (at === null) return neutral('unknown', 'Срок не указан или некорректен', 'invalid_deadline')
  const current = timestamp(now)
  if (current === null) return neutral('unknown', 'Время проверки неизвестно', 'invalid_now')
  const start = timestamp(issuedAt), remainingMs = at - current
  const progressAvailable = start !== null && start < at && start <= current
  const fraction = progressAvailable ? Math.min(1, Math.max(0, (current - start) / (at - start))) : null
  // Exact boundary is due now, not overdue. Display rounding cannot set urgency.
  const state = remainingMs < 0 ? 'overdue' : remainingMs === 0 ? 'due' : remainingMs <= DEADLINE_PROGRESS_POLICY.warningMinutes * 60000 || (fraction !== null && fraction >= DEADLINE_PROGRESS_POLICY.warningFraction) ? 'soon' : 'on_track'
  return {state, label: state === 'overdue' ? `Просрочен на ${duration(-remainingMs)}` : state === 'due' ? 'Срок наступил' : `До срока ${duration(remainingMs)}`, reason: progressAvailable ? null : 'invalid_window', tone: state === 'overdue' || state === 'due' ? 'danger' : state === 'soon' ? 'warning' : 'normal', deadlineAt: at, remainingMs, elapsedPercent: fraction === null ? null : Math.floor(fraction * 100), progressAvailable, overdue: remainingMs < 0}
}
