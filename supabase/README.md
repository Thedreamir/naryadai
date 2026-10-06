# Supabase adapter: NOT YET DEPLOYED

Local migrations 001-003 are exercised by tests. Hosted adapter below is prepared source until verified on a test project. Do not run hosted.sql in the local test database.

Before deployment:
- Free test project, only synthetic data. Project URL and anon/publishable key are not server secrets; service-role key and Gemini key are.
- Supabase Auth test accounts (master, worker, leader). Employee IDs must equal their Auth user UUIDs; do not use the local demo UUID accounts for hosted auth.
- Run 001-003, then hosted.sql in the test project. Seed reference data with server admin privileges. Add employees for actual test Auth IDs.
- Deploy review-order with GEMINI_API_KEY, GEMINI_MODEL set to an explicitly selected free model. No default model is assumed. Validate current model quota in AI Studio. Never use real plant data.
- Build client with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Neither is a service-role key.
- Verify two authenticated sessions: assigned-worker only visibility, leader read-only, transitions, photo upload, edge review, realtime. Until done, no hosted claim.

Realtime has to be enabled for public.orders in the project. Photo bucket is private. Local code stores synthetic image data inline only for first-slice tests; hosted path must upload to the private bucket. Deadline scheduling through pg_cron has not been deployed or tested. No internal ping is claimed to defeat Free project pause.
