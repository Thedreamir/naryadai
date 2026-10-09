# Local canonical photo ingest

Decoder core plus connected local HTTP/private-filesystem/evidence path. See tested scope and remaining hosted gaps below.

Run python3 server/photo-ingest/test_canonical.py (Pillow required). Decoder verifies actual JPEG/PNG/WebP, pixel/input bounds, EXIF strip, re-encode JPEG, output cap and actual byte hash.

## Stage2 local connected path

routes.mjs now implements POST /api/canonical-photo/:id with binary input and X-Order-Version. A trusted server authentication callback supplies identity. It locks the order, checks active assigned worker/status/version, invokes bounded Pillow decoder, writes private0700directory/0600JPEG, reads object back, computes real hash and writes canonical_photo_evidence in transaction. Duplicate retry of identical content reuses prior evidence. Wrong caller, stale order, nonimage and forged client evidence are rejected. Unknown commit leaves object for reconciliation, never blanket deletes.

service.mjs is a standalone local-only database service (LOCAL_PHOTO_DATABASE_URL must resolve to loopback). Bearer is checked against configured Supabase /auth/v1/user. Explicit PHOTO_PWA_ORIGIN restricts CORS. VITE_CANONICAL_INGEST_URL enables the frontend adapter; it uses canonical server response instead of inserting client attestation. No environment values or keys are included in the archive. The full-schema harness runs real HTTP -> decoder -> private filesystem -> evidence -> transition_order, with isolated local PostgreSQL and synthetic session verifier. This proves the ingest path, not production Auth/Storage or actual deployment. The legacy demo server mounts the same route for its local synthetic session flow.

Still unavailable: capture-time attestation, multimodal repair acceptance, Supabase hosted storage, production deployment/auth parity, phone upload10sec measurements, managed orphan cleanup after unknown commit. Do not enable a hosted release based only on these local tests.
