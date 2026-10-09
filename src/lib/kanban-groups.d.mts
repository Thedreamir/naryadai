export type KanbanStatusGroup = 'issued' | 'queued' | 'accepted' | 'work' | 'review';
export type KanbanGroupKey = KanbanStatusGroup | 'overdue';
export interface KanbanOrder {
  id: string | number;
  status?: string | null;
  deadline?: string | number | Date | null;
  cancelled?: boolean | null;
}
export type KanbanExclusionReason = 'invalid_order' | 'terminal' | 'unknown_status';
export interface IncludedKanbanClassification {
  included: true;
  status: string;
  statusGroup: KanbanStatusGroup;
  displayGroup: KanbanGroupKey;
  deadlineState: 'unknown' | 'overdue' | 'not_overdue';
  overdue: boolean;
  labels: string[];
}
export type KanbanClassification = IncludedKanbanClassification | {
  included: false;
  reason: KanbanExclusionReason;
};
export const KANBAN_GROUPS: readonly Readonly<{key: KanbanGroupKey; label: string}>[];
export function classifyKanbanOrder(order: unknown, now?: number): KanbanClassification;
export function buildKanbanGroups<T extends KanbanOrder>(orders: readonly T[], now?: number): {
  groups: {key: KanbanGroupKey; label: string; count: number;
    cards: {order: T; classification: IncludedKanbanClassification}[]}[];
  total: number;
  statusCounts: Record<KanbanStatusGroup, number>;
  overdueCount: number;
  unknownDeadlineCount: number;
  excluded: {order: T; reason: KanbanExclusionReason}[];
};
