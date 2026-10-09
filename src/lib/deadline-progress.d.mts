export type DeadlineTimestamp = string | number | null | undefined
export type DeadlineProgressInput = {
  deadline?: DeadlineTimestamp
  issuedAt?: DeadlineTimestamp
  now?: DeadlineTimestamp
  status?: string
  cancelled?: boolean
}
export type DeadlineProgressResult = {
  state: 'unknown' | 'inactive' | 'overdue' | 'due' | 'soon' | 'on_track'
  label: string
  reason: string | null
  tone: 'neutral' | 'danger' | 'warning' | 'normal'
  deadlineAt: number | null
  remainingMs: number | null
  elapsedPercent: number | null
  progressAvailable: boolean
  overdue: boolean
}
export const DEADLINE_PROGRESS_POLICY: Readonly<{warningFraction: number; warningMinutes: number}>
export function deadlineProgress(input?: DeadlineProgressInput): DeadlineProgressResult
