import test from 'node:test';import assert from 'node:assert/strict';
import {almatyDeadline,completionTiming} from '../supabase/functions/_shared/order-time.mjs';
test('UTC noon is17:00Almaty, not12:00',()=>assert.match(almatyDeadline('2026-10-08T12:00:00Z'),/17:00/));
test('no invented date for missing or invalid input',()=>{assert.equal(almatyDeadline(null),null);assert.equal(almatyDeadline('bad'),null)});
test('completion before deadline ignores later master wait',()=>assert.deepEqual(completionTiming('2026-10-08T11:00:00Z','2026-10-08T11:50:00Z','2026-10-08T12:00:00Z'),{completed_at:'2026-10-08T11:50:00.000Z',elapsed_minutes:50,overdue_minutes:0}));
test('late completion floors full minutes',()=>assert.equal(completionTiming(null,'2026-10-08T12:03:59Z','2026-10-08T12:00:00Z').overdue_minutes,3));
test('missing completion does not become review time',()=>assert.equal(completionTiming(null,null,'2026-10-08T12:00:00Z').overdue_minutes,null));
