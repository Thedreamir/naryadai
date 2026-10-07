import test from 'node:test';import assert from 'node:assert/strict';import {completionElapsed} from '../supabase/functions/_shared/review-timing.mjs';
test('actual review timing helper excludes later review wait',()=>{assert.equal(completionElapsed('2026-10-07T01:00:00Z','2026-10-07T01:12:00Z'),12)});
test('actual review timing helper rejects missing and reversed event',()=>{assert.throws(()=>completionElapsed('invalid','2026-10-07T01:12:00Z'));assert.throws(()=>completionElapsed('2026-10-07T01:12:00Z','2026-10-07T01:00:00Z'))});
// Helper tested, not Edge DB lookup parity.
