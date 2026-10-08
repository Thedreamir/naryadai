# Telegram and Mini App, staged

This is local code, not an active bot or a delivery proof.

Sources checked: https://core.telegram.org/bots/api and https://core.telegram.org/bots/webapps

1. Existing Tekton login remains required. Pairing begins from an authenticated Tekton account with an opaque 32-byte token, SHA-256 stored server-side, TTL ten minutes. A private /start consumes it once. The session owner sees the numeric Telegram chat ID and confirms it inside Tekton. Group chats, bot senders and mismatched sender/chat IDs are rejected. Never derive a role from Telegram display name or incoming text.
2. The Telegram Mini App opens the existing HTTPS PWA, not a new public endpoint. No JWT/PIN/session in its URL. It uses the same Supabase session and RLS. No automatic Telegram-based login or extra data access. Future initData-based sign-in would require signed server validation and a separate review.
3. Webhook authentication requires X-Telegram-Bot-Api-Secret-Token. Secrets are server-side only. Incoming content creates pending pairing state only, not an outgoing reply, assignment or role change.
4. Delivery is disabled by default. It requires a confirmed, not-revoked connection, an active employee and a current role/recipient/order check. A worker must still be the order's assignee; a master must still be its master. Unique notification/employee receipt claims prevent duplicate attempts. Timeout means unknown, not automatic retry. Telegram API acceptance is not proof of phone delivery.
5. Future fanout must start from existing server-created notifications, never a client-supplied recipient/text. New order notification insertion must be confirmed in live schema. Deadline messages use existing rich notification content. No raw free-text instructions trigger unrelated actions.
6. Needed release checks: exact SQL snapshot and rollback; complete-role/RLS and concurrency tests; source and deployed Edge Function match; free-tier limits and current bot identity; secure token fill; webhook registration; approved test recipient and final message; server receipt plus actual worker phone evidence. Mini App menu registration is a separate bot configuration step.

Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_DISPATCH_SECRET. PWA_ORIGIN names the existing PWA. TELEGRAM_DELIVERY_ENABLED must remain absent/false until the scoped send grant and test review are complete. Do not place secret values in this document, source or build output.

## Independent review of the later PWA/TMA proposal

Priority 0: repair and verify the current server notification pipeline, secure pairing and a reviewed real notification. Order #859 proved assigned-worker UI visibility after login; the worker notification counter remained zero. Two delivery channels cannot repair a missing server event.

Priority 1: one frontend, layout-only Telegram SDK detection, safeAreaInset/contentSafeAreaInset and viewportStableHeight. Server-side initData HMAC verification with freshness, strict parsing and replay protection. A signature establishes a Telegram identity only. Session issuance still requires an existing confirmed binding and an active Tekton account; role and RLS remain authoritative. Existing naryadai.vercel.app and @TektonOSdreamlabs_bot, no new domain/account/bot.

Priority 2: inline Accept only after current assignee, active role, exact order status/version, idempotency and actor attribution checks. Reuse the normal authorized status RPC. Acceptance is not a permit or start-work action. Initially use Open order as a navigation action. Clarify T-3: three minutes before deadline is different from the case's three-minute emergency nonacceptance threshold.

Priority 3: full RU/KZ across both surfaces, visual mock-SDK checks followed by actual Telegram Android/iOS tests. Language drafts and equipment content do not yet constitute complete localization.

Priority 4: voice-based master commands produce a draft only. The master reviews equipment, worker, deadline and content before creation. Free/open STT licensing does not establish a free, available runtime. No toolchain installation or paid inference.

Rejected claims: 100% delivery, zero delay, two-second order creation, HMAC alone preventing all role escalation, preexisting short sessions/rotation. Duplicated PWA/Telegram alerts need independent receipts, deduplication, revocation, bounded handling of uncertain sends, and device evidence. No implicit FCM, SMS, passkey or custom JWT implementation.

Current sources: https://core.telegram.org/bots/webapps and https://core.telegram.org/bots/api#callbackquery
