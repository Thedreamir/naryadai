# Knowledge and reference seeds (local only)

Generated with `node scripts/seed-knowledge.mjs` (also included in `npm run seed`). This script has no network client, credentials or database writes. Existing history generation remains unchanged.

- `reference-catalog.json`: 4 sections, 25 equipment entries with section/type/training inventory number/criticality, 2 masters, 17 workers with specialty/grade/shift/status, 3 brigades, 20 fault codes across М/Э/Г/П/С, 40 material entries with units, 20 time norms linked to fault codes. Names and time norms reuse the existing deterministic history, not Faker. All values are synthetic, not company records.
- `knowledge-approved.local.json`: 130 extractive documents. 18 case/operation notes (including 2 explicitly drafted KZ translations), 4 section notes, 25 equipment notes, 20 fault-code notes, 40 material notes, 20 time-norm notes, 3 brigade notes. Used in local grounding tests, not automatically added to production.
- `knowledge-import.draft.json`: same content prepared for an integration step. Knowledge rows remain drafts at version 1 with no reviewer or author. Synthetic actor strings and local IDs are NOT valid Supabase Auth identities. Extra `seed_key` and `provenance` fields are manifest metadata, not columns to blindly insert. Equipment IDs also require mapping against target references.

## Provenance and review boundaries

Case PDF SHA256: `43c660afb3ec272a417cc369735a4797b27676c554a2a630e1f38aa6060af751`.
Only paraphrased case requirements are retained, not the original PDF or partner text/logo. Relevant sections are recorded on every item. Section 4 diagram on page 3 was visually inspected for all ten status labels. In-app `ai_review` wording differs from the diagram; the knowledge note explains this mapping rather than claiming new behavior.

Local approved fixture rows carry version 2, synthetic reviewer strings, reviewed timestamp and an explicit local-only approval note. These are test fixtures, NOT evidence that a real master approved them. When importing later, resolve Auth identities and reference IDs, submit drafts through the existing governance workflow, inspect all content, and use master/admin approval. No auto-approval, import SQL migration or permission bypass was added. Do not convert local fixtures into approved production rows.

## Scope

The content explains workflow and references, not repair procedures. Invented machine ratings, torque values, chemical specifications, prices, warehouse balances and failure probabilities are absent. Time norms are invented demonstration values, not measured industrial standards. Material compatibility and actual staff availability require verification. Safety questions refer to the master and approved plant documents, never operational instructions. No real plant facts or real employee records are present.

RU knowledge is not silently translated by the UI layer. Two separate KZ workflow notes are draft translations, not complete KZ localization. The current assistant reads `knowledge_docs` via its existing RLS query; until a separately authorized import/approval is executed, this bundle does NOT populate the hosted chat. No model connection or live deployment was performed.

## Checks

`node --test tests/knowledge-seed.test.mjs`: exact minima, relationship integrity, all history materials/norms represented, provenance, draft exclusion, RU/KZ extractive answers, citations, unknown-answer abstention and safety refusal.

`node scripts/check-seed.mjs`: existing history check, unchanged.
