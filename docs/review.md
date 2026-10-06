First manual review:
- Database checklist: RLS policies and non-owner SET LOCAL ROLE tested, FK indexes, short transactions, pessimistic lock + optimistic version check, SQL parameters, least-privilege table grants.
- Silent-failure checklist: API errors displayed to user; DB transaction rollback; realtime reconnect error shown; no fabricated AI fallback score.
- Security checklist: local API binds loopback; demo account selection openly labeled; HttpOnly SameSite cookies; local secret excluded from source; no external credentials used.
Open work: production auth and app.actor_id -> auth.uid adapter, hardened model/closure fields, non-global notifications, photo validation/hash/storage, connection health, request limits, dependency audit findings, deadline worker and reminder idempotency.
Second review:
- All 10 states exercised in real PostgreSQL, including queue/reject/reissue/pause/rework.
- Worker review forgery blocked by BEFORE trigger; fault/material reference checks and positive quantities enforced; image type/size checks.
- Append-only audit enforced by no application update/delete grants.
- Deadline SQL adds recipient-scoped alerts for overdue/unaccepted/due-soon; half-hour dedupe tested. Local 30-second worker, not hosted pg_cron.
- 520 synthetic history orders, seed 42, 4 sections/25 equipment/15 workers. Designed patterns explicitly labeled.
- Reporting view uses security_invoker to preserve RLS. Preliminary rating excludes quality, complexity, refusals/repeats and says so.
- ExcelJS removed because of moderate transitive findings. npm audit now 0. Printable PDF path prepared; PDF actual output not yet inspected.
- Mobile role switch added (previous sidebar-only role switch inaccessible on mobile).
Third review:
- Cached production PWA reload offline verified; no blank screen; no promise of offline API writes.
- Human quality score 1..5 on API close, clearly separate from model score. Full rating unavailable unless all closed orders have quality scores. Unjustified refusals remain an unresolved classification, so no industrial-validity claim for rating.
- Kanban all ten statuses, section/worker/equipment text filters. Fixed horizontal body overflow; kanban itself scrolls.
- PDF report generated and visually inspected, one A4 page with all 15 rows; controls removed in print styling.
- 24 frozen field-rule cases yield expected outputs. Wrong-but-complete work, blurry/old/duplicate photo and excessive positive material amounts correctly remain needs_master, showing limits. Not an LLM accuracy evaluation.
- Edge source static check only; not deployed, model not called, cloud policies not verified.
Fourth review:
- Photo ingest validates JPEG/PNG/WebP signature, byte cap, SHA256 hash, server receipt time; duplicates compare only within actor-visible order_photos via RLS, not a cross-user leakage. Does not prove capture time or physical identity, clear label.
- Entire browser cycle now creates via master form instead of API setup. Accessible select label issue discovered by test and fixed with aria-label. Full UI issue-to-close passed.
- Latest local realtime observed 565ms includes creation form interaction and state re-fetch, not a physical network SLA. Previous API-created run 235ms; do not compare as identical benchmark.
- Repeated seeded test runs add history test records to scratch database only. Fresh installation seeds deterministically; archive carries script, not private database dump.
Fifth review:
- Equipment history UI and SQL readback exercised. Report date filter parameterized and readback verifies every returned row is in requested range.
- Report clearly states full formula/7-day repeats use all history while preliminary counters use chosen period. Complete period-specific formula remains a core gap, not concealed.
- UI creation now tested using the master modal. Realtime duration includes that flow; current measured local run 588ms.
- Two-layer scope: no showcase logic mixed into core. 7-day repeat appears only as required rating factor, not a claimed completed Proof of Repair innovation.
