# Незакреплённые фото: безопасный cleanup ещё не готов

Current live policies do not authorize DELETE. Blanket owner DELETE can erase accepted evidence. Client timeout does not prove an RPC failed to commit.

Staged client: track each path immediately after upload, exact inserted row ID, catch failures through upload/insert/RPC. No deleting older rows by hash. Surface 'pending cleanup, check order state', not success. Intake path still needs the same protocol.

Proposed design, NOT IMPLEMENTED:
1. Authenticated upload-intent keyed by owner/order/path, bounded expiry, staged vs attached state.
2. Transition transaction locks order and intent, attaches exactly the photo paths/IDs in accepted closure atomically. Client cannot forge attached state.
3. Server cleanup reserves only expired unattached intents under lock, rechecks all order/intake/evidence references and pending transitions. Storage deletion after reservation, retry/idempotence; no removal of committed evidence. Prevent attaching reserved-for-delete intents.
4. Test upload success+insert fail, later-photo fail, invalid later data, RPC rejection, RPC committed but response lost, cleanup storage failure, retry, old identical-hash evidence, race attach-vs-cleanup.

No live mutation. Cannot claim no orphans until implemented and tested on synthetic Supabase.
