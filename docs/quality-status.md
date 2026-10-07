# Проверка качества: состояние 8 октября

Локальный verify: static-quality, TypeScript, 7 unit, 24 frozen-field self-check, production build PASS. Не общий PASS: lint нет; сравнение config с git-base, commit metadata, full DB/RLS и DB-backed e2e NOT RUN. Нельзя ослаблять config для зелёного результата.

Playwright config добавлен, Pixel 7 Chromium. Два login/страничных smoke-теста требуют выделенных synthetic env; accept/photo/master cycle пока явно skip, не рабочий end-to-end тест.

PIN: migration 054 + Edge gate подготовлены, атомарный row lock на account и salted-IP bucket. Crypt regression не запущен: локальный embedded Postgres не содержит pgcrypto. Перед deployment нужна проверка доверенного x-forwarded-for ingress и salt через vault, не чат. No live changes.

Live read-only pg_policies подтвердил intake_read SELECT true и отсутствие DELETE policy на storage/order_photos. Migration 055 scope draft, 4 minimal-schema tests прошли (с воспроизведением исходного broad read); actual storage bytes не проверены. Actual photo bytes регулирует отдельная storage read policy; metadata доступ не равен доступу к bytes. Cleanup leak до RPC и ограниченная delete authority ещё не исправлены полностью. Простая owner DELETE опасна: нельзя удалить уже закреплённые доказательства.

Review-order external free-text/photo branch отключён в staged source, not deployed. Новое assistant-chat rules-only staged. Live model/privacy не менялись. Cleanup errors surfaced, но отсутствие delete authority не устраняется сообщением об ошибке.

Source read: https://supabase.com/dashboard/project/pyqkstbcdxvpmtksziod/sql/735b50c0-cc6e-4999-850e-aea1e1fa030d

One-active invariant: migration 056 unique partial index staged; preflight fails on existing duplicates, no silent cancellation. Two local connections test verified second start gets 23505, one active remains. Minimal schema, not final live trigger parity.
