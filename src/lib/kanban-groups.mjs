import {awaitingWorkOverdue} from './deadline-state.mjs'

/** Six display groups; overdue is a placement overlay, never a lifecycle status. */
export const KANBAN_GROUPS = Object.freeze([
  {key: 'issued', label: 'Выданные'},
  {key: 'queued', label: 'В очереди'},
  {key: 'accepted', label: 'Принятые'},
  {key: 'work', label: 'В работе'},
  {key: 'review', label: 'Выполненные'},
  {key: 'overdue', label: 'Просроченные'},
].map(Object.freeze))

const statusGroups = new Map([
  ['issued', 'issued'], ['queued', 'queued'], ['accepted', 'accepted'],
  ['in_progress', 'work'], ['paused', 'work'], ['rework', 'work'],
  ['completed', 'review'], ['ai_review', 'review'],
])
const terminalStatuses = new Set(['closed', 'rejected', 'cancelled'])
const labels = new Map(KANBAN_GROUPS.map(group => [group.key, group.label]))

function assertNow(now) {
  if (typeof now !== 'number' || !Number.isFinite(now)) {
    throw new TypeError('Kanban now must be finite epoch milliseconds')
  }
}

function deadlineMillis(value) {
  // In particular, null must not silently become the Unix epoch.
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value !== 'string' || value.trim() === '') return NaN
  return Date.parse(value)
}

/** Pure current-state classification. Unknown deadlines abstain, not overdue. */
export function classifyKanbanOrder(order, now = Date.now()) {
  assertNow(now)
  if (!order || typeof order !== 'object') {
    return {included: false, reason: 'invalid_order'}
  }
  if (order.cancelled || terminalStatuses.has(order.status)) {
    return {included: false, reason: 'terminal'}
  }
  const statusGroup = statusGroups.get(order.status)
  if (!statusGroup) return {included: false, reason: 'unknown_status'}
  const deadline = deadlineMillis(order.deadline)
  const deadlineKnown = Number.isFinite(deadline)
  const overdue = deadlineKnown && awaitingWorkOverdue({...order, deadline}, now)
  return {
    included: true,
    status: order.status,
    statusGroup,
    displayGroup: overdue ? 'overdue' : statusGroup,
    deadlineState: !deadlineKnown ? 'unknown' : overdue ? 'overdue' : 'not_overdue',
    overdue,
    // Preserve lifecycle meaning even when a card is placed in overdue.
    labels: overdue ? [labels.get(statusGroup), labels.get('overdue')] : [labels.get(statusGroup)],
  }
}

/**
 * Call only with caller-authorized, already-filtered current orders.
 * Every order is rendered once; sum(groups.count) === total.
 * statusCounts are a separate lifecycle breakdown of that same total, not additive
 * with overdueCount. No events, shift totals, RLS or state transitions are inferred.
 * Duplicate canonical IDs fail rather than selecting an arbitrary stale snapshot.
 */
export function buildKanbanGroups(orders, now = Date.now()) {
  assertNow(now)
  if (!Array.isArray(orders)) throw new TypeError('Kanban orders must be an array')
  const seen = new Set()
  const groups = KANBAN_GROUPS.map(group => ({...group, count: 0, cards: []}))
  const byKey = new Map(groups.map(group => [group.key, group]))
  const statusCounts = {issued: 0, queued: 0, accepted: 0, work: 0, review: 0}
  const excluded = []
  let unknownDeadlineCount = 0
  for (const order of orders) {
    const id = order?.id
    if (!((typeof id === 'string' && id.trim() !== '' && id === id.trim()) ||
          (typeof id === 'number' && Number.isSafeInteger(id)))) {
      throw new TypeError('Kanban order requires a nonblank string or safe integer ID')
    }
    const identity = String(id)
    if (seen.has(identity)) throw new RangeError(`Duplicate kanban order ID: ${identity}`)
    seen.add(identity)
    const classification = classifyKanbanOrder(order, now)
    if (!classification.included) {
      excluded.push({order, reason: classification.reason})
      continue
    }
    const group = byKey.get(classification.displayGroup)
    group.cards.push({order, classification})
    group.count++
    statusCounts[classification.statusGroup]++
    if (classification.deadlineState === 'unknown') unknownDeadlineCount++
  }
  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.count, 0),
    statusCounts,
    overdueCount: byKey.get('overdue').count,
    unknownDeadlineCount,
    excluded,
  }
}
