export type OutboxState = 'pending' | 'requires_review' | 'inflight' | 'quarantined' | 'acknowledged';
export type JsonValue = null | boolean | string | number | JsonValue[] | { [key: string]: JsonValue };
export interface OutboxScope { actorId: string; workspaceId: string }
export interface OutboxInput extends OutboxScope { idempotencyKey: string; resourceId: string; kind: string; expectedVersion: number; payload: JsonValue }
export interface OutboxEntry extends OutboxInput { id: string; fingerprint: string; schemaVersion: number; state: OutboxState; reason: string | null; createdAt: number; updatedAt: number; attempts: number; sequence: number }
export interface OutboxStore { durable: boolean; mutate<T>(fn: (rows: Map<string, OutboxEntry>) => T): Promise<T>; close(): Promise<void> }
export interface ReplayValidation extends OutboxScope { authorized: boolean; currentVersion: number }
export interface ReplayResponse extends Partial<OutboxScope> { status: 'applied' | 'not_applied' | 'conflict' | 'denied'; idempotencyKey?: string; resourceId?: string; version?: number; retryable?: boolean }
export interface ReplayResult { status: OutboxState | 'idle'; reason?: string | null; entry?: OutboxEntry }
export interface OfflineOutbox {
  durable: boolean;
  enqueue(input: OutboxInput): Promise<{ accepted: boolean; duplicate: boolean; reason?: string; entry: OutboxEntry }>;
  list(scope: OutboxScope): Promise<OutboxEntry[]>;
  recoverInterrupted(scope: OutboxScope): Promise<number>;
  replayNext(options: OutboxScope & { validate: (entry: OutboxEntry) => Promise<ReplayValidation>; transport: (entry: OutboxEntry) => Promise<ReplayResponse> }): Promise<ReplayResult>;
  close(): Promise<void>;
}
export const OUTBOX_SCHEMA_VERSION: 1;
export const AUTO_REPLAY_KINDS: readonly string[];
export function createMemoryOutboxStore(): OutboxStore;
export function openIndexedDBOutbox(options?: { indexedDB?: IDBFactory; name?: string }): Promise<OutboxStore>;
export function createOfflineOutbox(options: { store: OutboxStore; now?: () => number; maxEntries?: number }): OfflineOutbox;
