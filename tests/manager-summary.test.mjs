import {test} from 'node:test'
import assert from 'node:assert/strict'
import {currentSummary,workerLoad,repeatRows} from '../src/lib/manager-summary.mjs'
const now=Date.parse('2026-10-08T20:00:00+05:00')
test('snapshot distinguishes review, active, overdue and invalid deadlines',()=>{
 const r=currentSummary([{status:'closed',deadline:'2020-01-01'},{status:'completed',deadline:'2020-01-01'},{status:'queued',deadline:'2020-01-01'},{status:'paused',deadline:'invalid'}],now)
 assert.equal(r.active.length,2);assert.equal(r.review.length,1);assert.equal(r.overdue.length,1);assert.equal(r.inWork.length,0)
})
test('load preserves off-shift conflicts, unknown shift, queue and zero load',()=>{
 const employees=[{id:1,name:'A',role:'worker',on_shift:false},{id:2,name:'B',role:'worker',on_shift:true},{id:3,name:'C',role:'worker'},{id:4,name:'D',role:'worker',on_shift:true},{id:5,name:'E',role:'worker',is_active:false}]
 const orders=[{assignee_id:'1',status:'in_progress',deadline:'2020-01-01'},{assignee_id:2,status:'queued'},{assignee_id:2,status:'ai_review'}]
 const r=workerLoad(employees,orders,now)
 assert.equal(r.length,4);assert.equal(r.find(x=>x.worker.id===1).availability,'off');assert.equal(r.find(x=>x.worker.id===1).assigned.length,1)
 assert.equal(r.find(x=>x.worker.id===2).availability,'queue');assert.equal(r.find(x=>x.worker.id===2).reviewing,1)
 assert.equal(r.find(x=>x.worker.id===3).availability,'unknown');assert.equal(r.find(x=>x.worker.id===4).availability,'free')
})
test('repeat rows keep per-code counts without merging overlapping pairs or inventing diagnosis',()=>{
 const rows=[{equipment_id:'1',fault_code:'A',closed_count:'4',pairs_within_window:'2'},{equipment_id:1,fault_code:'B',closed_count:'3',pairs_within_window:'1'},{equipment_id:2,fault_code:'C',closed_count:9,pairs_within_window:9}]
 const r=repeatRows(rows,[{id:1,section:'One'},{id:2,section:'Two'}],'One')
 assert.equal(r.length,2);assert.equal(r[0].fault_code,'A');assert.equal(r[0].pairs_within_window,2);assert.equal(repeatRows(rows,[]).length,3)
})
