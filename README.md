# НарядAI: private prototype

Synthetic data only. No production deployment yet.

## First vertical slice
Node 22.23.3 / npm 10.9.9. Install with `npm ci`.

1. `npm run db:start` (isolated PostgreSQL 5433, local generated secret never committed).
2. `npm run seed` in another terminal.
3. `npm run server` (loopback API 3001).
4. `npm run dev` (loopback Vite 5173).
5. Choose a test role. This is a LOCAL DEMO ACCOUNT CHOOSER, not production login.

`npm test` runs domain checks. `npm run build` creates the PWA.
`node scripts/verify-slice.mjs` starts the services, uses system Chrome, verifies browser/API/RLS and stops services. Browser contexts are isolated; not physical devices.

Database statuses: Выдан, Принят в работу, В очереди, Отклонён, В работе, Приостановлен, Исполнено, Проверка ИИ, На доработку, Закрыт.

## Verified so far
See docs/vertical-slice-results.json and docs/installed-packages.json.
Real local PostgreSQL RLS; authoritative transition trigger; append-only event audit; optimistic versions; updates via PostgreSQL LISTEN/NOTIFY bridged to SSE; synthetic photo compression; human approval; rules-only evidence card.

## Not implemented or not validated yet
Hosted Supabase Auth/Realtime/Storage, Gemini, push/Telegram, hosted timed reminders/push, complete production rating factors, cloud/physical-device E2E, offline action queue, physical Android and HTTPS camera checks.
Do not present these as working. Rules-only review never invents AI confidence/score or claims to evaluate photo quality. Photo used in tests is a synthetic test image, not repair evidence.

## Dependencies / review
Package lock records exact versions. No Prisma, yt-dlp, agent frameworks. ECC checklists used manually: database-reviewer, silent-failure-hunter, security-reviewer, not hooks or native agent execution. ExcelJS was removed after moderate audit findings through uuid. Current npm audit: 0. PDF report used instead. Private local secret and database files excluded by .gitignore.

## Added core work
All ten states and pause/queue/reject/reissue/rework SQL branches tested. Deadline alerts dedupe tested. Seed: 520 orders over 90 days, 4 sections, 25 equipment, 15 workers; planted synthetic patterns, not plant measurements. SQL reports, preliminary transparent rating and full formula with missing-quality guard. Kanban/filters, human score, print/PDF report. Production SW offline-shell check passed. 24 frozen mandatory-field rule cases passed, not AI accuracy. Supabase adapter source remains NOT DEPLOYED.
