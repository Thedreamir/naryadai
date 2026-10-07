# Проверка качества: состояние 8 октября

Локальный verify: static-quality, TypeScript, 7 unit, 24 frozen-field self-check, production build PASS. Не общий PASS: lint нет; сравнение config с git-base, commit metadata, full DB/RLS и DB-backed e2e NOT RUN. Нельзя ослаблять config для зелёного результата.

Playwright config добавлен, Pixel 7 Chromium. Два login/страничных smoke-теста требуют выделенных synthetic env; accept/photo/master cycle пока явно skip, не рабочий end-to-end тест.

PIN: migration 054 + Edge gate подготовлены, атомарный row lock на account и salted-IP bucket. Crypt regression не запущен: локальный embedded Postgres не содержит pgcrypto. Перед deployment нужна проверка доверенного x-forwarded-for ingress и salt через vault, не чат. No live changes.

Live read-only pg_policies подтвердил intake_read SELECT true и отсутствие DELETE policy на storage/order_photos. Migration 055 scope draft, 4 minimal-schema tests прошли (с воспроизведением исходного broad read); actual storage bytes не проверены. Actual photo bytes регулирует отдельная storage read policy; metadata доступ не равен доступу к bytes. Cleanup leak до RPC и ограниченная delete authority ещё не исправлены полностью. Простая owner DELETE опасна: нельзя удалить уже закреплённые доказательства.

Review-order external free-text/photo branch отключён в staged source, not deployed. Новое assistant-chat rules-only staged. Live model/privacy не менялись. Cleanup errors surfaced, но отсутствие delete authority не устраняется сообщением об ошибке.

Source read: https://supabase.com/dashboard/project/pyqkstbcdxvpmtksziod/sql/735b50c0-cc6e-4999-850e-aea1e1fa030d

One-active invariant: migration 056 unique partial index staged; preflight fails on existing duplicates, no silent cancellation. Two local connections test verified second start gets 23505, one active remains. Minimal schema, not final live trigger parity.

F3: client catch boundary now covers upload/insert/RPC and tracks paths immediately plus exact inserted row IDs. No hash-based deletion of older evidence. F2 remains open: automatic delete intentionally not allowed until a transaction-safe server cleanup protocol protects committed/uncertain evidence. Failures surface an orphan-warning, not a successful-cleanup claim.

Photo EXIF gate: decode/re-encode pixels at hosted dataURL upload boundary, fail closed; original fallback removed. Synthetic APP1 Exif+GPS/device marker Chromium test passed, invalid type rejected; object URL/bitmap released in finally. Not a comprehensive image-security corpus and not deployed. No temp files are created in this browser path.

F5/F6: shared read-only state refresh hook on core master/worker lists, order subscription + online invalidation + unsubscribe + generation guard. Fixture forced error and retry passed; cross-session Supabase propagation not tested. Voice dialog labelled/focus trap/Escape/abort, reduced-motion CSS; Chromium keyboard test passed, speech/device untested. Knowledge lazy import, no latency gain claim.
