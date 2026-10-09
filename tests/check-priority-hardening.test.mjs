import test from 'node:test'
import assert from 'node:assert/strict'
import {checkPriority} from '../src/lib/check-priority.mjs'
const at=Date.parse('2026-10-08T18:30:00Z'),DAY=86400000
const row=(id,ago,extra={})=>({id,equipment_id:1,kind:'unplanned',status:'closed',created_at:new Date(at-ago*DAY).toISOString(),closed_at:new Date(at-(ago-1)*DAY).toISOString(),closure:{fault_code:'M-02'},...extra})
const run=rows=>checkPriority(rows,1,{},at)
test('timezone-less timestamps are ambiguous and must not manufacture evidence',()=>{const r=run([row(1,10),row(2,7,{created_at:'2026-10-01T18:30:00',closed_at:'2026-10-02T18:30:00'})]);assert.equal(r.pairCount,0);assert.equal(r.missingCount,1)})
test('same order ID on multiple equipment is globally ambiguous',()=>{const r=run([row(1,10),row(2,7),row(1,10,{equipment_id:2})]);assert.equal(r.pairCount,0);assert.equal(r.missingCount,1)})
test('pair evidence exposes closure timestamps and overlapping-work warning',()=>{const a=row(1,10,{closed_at:new Date(at-5*DAY).toISOString()}),b=row(2,7);const p=run([a,b]).pairs[0];assert.equal(p.firstClosedAt,a.closed_at);assert.equal(p.secondClosedAt,b.closed_at);assert.equal(p.overlappingWork,true)})
test('closure-before-next-opening evidence is distinguishable, without changing creation-gap count',()=>{const p=run([row(1,10),row(2,7)]).pairs[0];assert.equal(p.overlappingWork,false);assert.equal(p.gapDays,3)})
