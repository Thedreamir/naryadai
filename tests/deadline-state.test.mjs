import{test}from'node:test';import assert from'node:assert/strict';import{awaitingWorkOverdue}from'../src/lib/deadline-state.mjs';
for(const status of ['completed','ai_review','closed','rejected'])test(status+' never awaiting-work overdue',()=>assert.equal(awaitingWorkOverdue({status,deadline:'2026-10-07'},Date.parse('2026-10-08')),false));
test('in progress overdue',()=>assert.equal(awaitingWorkOverdue({status:'in_progress',deadline:'2026-10-07'},Date.parse('2026-10-08')),true));
