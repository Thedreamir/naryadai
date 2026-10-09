/** Local durable draft outbox. No endpoint, timer, credentials, or background replay. */
export const OUTBOX_SCHEMA_VERSION = 1;
export const AUTO_REPLAY_KINDS = Object.freeze(['draft.save']);
const STORE = 'operations';
const MAX_PAYLOAD_BYTES = 64 * 1024;
const forbidden = /^(?:__proto__|constructor|prototype|password|access[_-]?token|refresh[_-]?token|authorization|cookie|api[_-]?key|secret)$/i;
const copy = value => structuredClone(value);
function text(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\u0000-\u001f]/.test(value)) throw new TypeError(`Invalid ${field}`);
  return value;
}
function canonical(value, depth = 0) {
  if (depth > 16) throw new TypeError('Payload too deep');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + Array.from(value, v => canonical(v, depth + 1)).join(',') + ']';
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => {
      if (forbidden.test(k)) throw new TypeError('Forbidden payload field');
      return JSON.stringify(k) + ':' + canonical(value[k], depth + 1);
    }).join(',') + '}';
  }
  throw new TypeError('Payload must be finite plain JSON');
}
function normalize(input, now) {
  const actorId = text(input.actorId, 'actorId'), workspaceId = text(input.workspaceId, 'workspaceId');
  const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey');
  const resourceId = text(input.resourceId, 'resourceId'), kind = text(input.kind, 'kind');
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw new TypeError('Expected version required');
  const payloadJson = canonical(input.payload);
  if (new TextEncoder().encode(payloadJson).length > MAX_PAYLOAD_BYTES) throw new RangeError('Payload exceeds 64 KiB');
  const identity = JSON.stringify([actorId, workspaceId, idempotencyKey]);
  return { id: identity, actorId, workspaceId, idempotencyKey, resourceId, kind, expectedVersion: input.expectedVersion,
    payload: JSON.parse(payloadJson), fingerprint: JSON.stringify([resourceId, kind, input.expectedVersion, payloadJson]),
    schemaVersion: OUTBOX_SCHEMA_VERSION, state: AUTO_REPLAY_KINDS.includes(kind) ? 'pending' : 'requires_review',
    reason: AUTO_REPLAY_KINDS.includes(kind) ? null : 'explicit_action_review_required', createdAt: now, updatedAt: now, attempts: 0 };
}
function clock(now) {
  const n = now();
  if (!Number.isSafeInteger(n) || n < 0) throw new TypeError('Invalid clock');
  return n;
}
/** In-memory adapter for synthetic tests only, not a durable fallback. */
export function createMemoryOutboxStore() {
  const rows = new Map();
  return {
    durable: false,
    async mutate(fn) {
      const draft = new Map([...rows].map(([k, v]) => [k, copy(v)]));
      const result = fn(draft);
      if (result && typeof result.then === 'function') throw new TypeError('Transaction callback must be synchronous');
      rows.clear(); for (const [k, v] of draft) rows.set(k, copy(v));
      return copy(result);
    },
    async close() {},
  };
}
/** Resolves only after transaction commit; fails closed on absent/blocked IndexedDB. */
export function openIndexedDBOutbox({ indexedDB = globalThis.indexedDB, name = 'tekton-offline-draft-outbox-v1' } = {}) {
  text(name, 'database name');
  if (!indexedDB?.open) return Promise.reject(new Error('IndexedDB unavailable; no durable fallback'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, OUTBOX_SCHEMA_VERSION);
    let abandoned = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    request.onblocked = () => { abandoned = true; reject(new Error('IndexedDB upgrade blocked')); };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve({ durable: true,
        mutate(fn) {
          return new Promise((ok, fail) => {
            let result, callbackError;
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE), read = store.getAll();
            tx.oncomplete = () => ok(copy(result));
            tx.onabort = () => fail(callbackError || tx.error || new Error('IndexedDB transaction aborted'));
            tx.onerror = () => {}; // onabort is the definitive failure signal.
            read.onsuccess = () => {
              try {
                const initial = new Map(read.result.map(r => [r.id, r]));
                const rows = new Map([...initial].map(([k, v]) => [k, copy(v)]));
                result = fn(rows);
                if (result && typeof result.then === 'function') throw new TypeError('Transaction callback must be synchronous');
                for (const k of initial.keys()) if (!rows.has(k)) store.delete(k);
                for (const [k, v] of rows) if (JSON.stringify(initial.get(k)) !== JSON.stringify(v)) store.put(v);
              } catch (e) { callbackError = e; tx.abort(); }
            };
          });
        },
        async close() { db.close(); },
      });
    };
  });
}
export function createOfflineOutbox({ store, now = Date.now, maxEntries = 500 } = {}) {
  if (!store?.mutate || !Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 10000) throw new TypeError('Store and capacity 1..10000 required');
  const scopeMatches = (r, scope) => r.actorId === scope.actorId && r.workspaceId === scope.workspaceId;
  function scopeCheck(scope) { text(scope?.actorId, 'actorId'); text(scope?.workspaceId, 'workspaceId'); }
  function quarantine(r, reason, at) { r.state = 'quarantined'; r.reason = reason; r.updatedAt = at; }
  return {
    durable: store.durable === true,
    async enqueue(input) {
      const r = normalize(input, clock(now));
      return store.mutate(rows => {
        const existing = rows.get(r.id);
        if (existing) {
          if (existing.fingerprint !== r.fingerprint) {
            // Keep immutable original; never replace an in-flight/acknowledged payload.
            if (existing.state !== 'acknowledged') quarantine(existing, 'idempotency_collision', r.updatedAt);
            return { accepted: false, duplicate: false, reason: 'idempotency_collision', entry: existing };
          }
          return { accepted: true, duplicate: true, entry: existing };
        }
        if (rows.size >= maxEntries) throw new RangeError('Outbox full; no entries silently evicted');
        r.sequence = Math.max(0, ...[...rows.values()].map(x => x.sequence || 0)) + 1;
        rows.set(r.id, r); return { accepted: true, duplicate: false, entry: r };
      });
    },
    async list(scope) {
      scopeCheck(scope);
      return store.mutate(rows => [...rows.values()].filter(r => scopeMatches(r, scope)).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || a.id.localeCompare(b.id)));
    },
    /** Caller must know old runs have stopped. No timed lease expiry or automatic resend. */
    async recoverInterrupted(scope) {
      scopeCheck(scope); const at = clock(now);
      return store.mutate(rows => {
        let count = 0;
        for (const r of rows.values()) if (scopeMatches(r, scope) && r.state === 'inflight') { quarantine(r, 'delivery_unknown', at); count++; }
        return count;
      });
    },
    /** One explicitly invoked drain step. Only local draft saves may reach the adapter. */
    async replayNext({ actorId, workspaceId, validate, transport } = {}) {
      const scope = { actorId, workspaceId }; scopeCheck(scope);
      if (typeof validate !== 'function' || typeof transport !== 'function') throw new TypeError('Current validation and transport required');
      const claimedAt = clock(now);
      const claim = await store.mutate(rows => {
        const ordered = [...rows.values()].filter(r => scopeMatches(r, scope)).sort((a, b) => (a.sequence || 0) - (b.sequence || 0) || a.id.localeCompare(b.id));
        const r = ordered.find((item, i) => item.state === 'pending' && !ordered.slice(0, i).some(older => older.resourceId === item.resourceId && older.state !== 'acknowledged'));
        if (!r) return null;
        if (r.schemaVersion !== OUTBOX_SCHEMA_VERSION || !AUTO_REPLAY_KINDS.includes(r.kind)) { quarantine(r, 'unsupported_operation', claimedAt); return null; }
        r.state = 'inflight'; r.reason = null; r.attempts++; r.updatedAt = claimedAt;
        return r;
      });
      if (!claim) return { status: 'idle' };
      async function settle(state, reason) {
        return store.mutate(rows => {
          const current = rows.get(claim.id);
          // Another tab's recovery/collision must not be overwritten by late response.
          if (current?.state !== 'inflight' || current.attempts !== claim.attempts || current.fingerprint !== claim.fingerprint) return { status: 'quarantined', reason: 'claim_changed', entry: current };
          current.state = state; current.reason = reason; current.updatedAt = clock(now);
          return { status: state, reason, entry: current };
        });
      }
      let validation;
      try { validation = await validate(copy(claim)); }
      catch { return settle('pending', 'validation_unavailable'); }
      if (!validation || validation.authorized !== true || validation.actorId !== actorId || validation.workspaceId !== workspaceId)
        return settle('quarantined', 'authorization_changed');
      if (validation.currentVersion !== claim.expectedVersion) return settle('quarantined', 'version_conflict');
      // Re-read the durable claim before invoking transport.
      const stillClaimed = await store.mutate(rows => {
        const r = rows.get(claim.id); return r?.state === 'inflight' && r.attempts === claim.attempts && r.fingerprint === claim.fingerprint;
      });
      if (!stillClaimed) return { status: 'quarantined', reason: 'claim_changed' };
      let response;
      try { response = await transport(copy(claim)); }
      catch { return settle('quarantined', 'delivery_unknown'); }
      if (response?.status === 'conflict') return settle('quarantined', 'version_conflict');
      if (response?.status === 'denied') return settle('quarantined', 'authorization_changed');
      const bound = response?.idempotencyKey === claim.idempotencyKey && response?.actorId === actorId && response?.workspaceId === workspaceId && response?.resourceId === claim.resourceId;
      if (bound && response.status === 'applied' && Number.isSafeInteger(response.version) && response.version > claim.expectedVersion)
        return settle('acknowledged', null);
      if (bound && response.status === 'not_applied' && response.retryable === true) return settle('pending', 'definitive_not_applied');
      return settle('quarantined', 'delivery_unknown');
    },
    async close() { await store.close(); },
  };
}
