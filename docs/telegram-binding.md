# Telegram: preparation only
No Telegram API calls, webhook changes or messages made.

1. Authenticated Tekton actor asks server for link. Read current employee role and is_active, never accept role/actor from request body.
2. Server makes32random bytes, stores SHA256 digest +actor id +10min expiry. Return only opaque base64url token to the owner. One active request per actor, rate-limit5/hour.
3. Telegram private /start update enters webhook. Verify Telegram secret header, update dedup id and sender/chat private invariant. No group binding and no username-based identity.
4. /start consumes token atomically under lock, checks expiry/employee active/unique user+actor, binds pending actor to observed chat+user. Reject replacing existing binding without owner reauth.
5. Show Telegram account identifier inside authenticated Tekton and ask owner to confirm matching account. Link is a bearer secret: until confirmation, no order delivery. Consume token even for pending state.
6. Outbox delivery reads confirmed active binding +actor permissions for each notification. Enforce unique(notification_id,channel). Minimal preview text; deep link opens authenticated order. No token in URL/log/source/client.
7. Persist attempted/sent/delivery-state separately. Telegram HTTP200 only means accepted, not read or phone sound. On timeout ambiguous status, do not blindly resend. Backoff429, honor retry_after;403disables binding. Durable status needs design/testing.
8. Revoke in profile deletes or deactivates binding, revokes pending tokens and cancels unsent outbox. Rebind requires login reauth and old-binding cancellation. Key rotation only server-side vault field.

First test gate: owner approves recipient(chat id verified by binding) AND final literal message together. No real worker alerts in isolated demo. Free hosting only; no Mini App needed for this notification path.

Token check after separately approved server configuration: getMe returns bot id/username only. Confirms current validity/identity, not prior-token revocation. Need owner confirmation of /revoke. Old exposed token must never be tested.
