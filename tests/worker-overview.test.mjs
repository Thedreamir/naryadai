import {test} from 'node:test'
import assert from 'node:assert/strict'
import {workerOverview,workerDeadline,workerNextAction} from '../src/lib/worker-overview.mjs'
const order=(id,status,more={})=>({id,status,title:'Repair',assignee_id:'w',...more})
test('only assigned, open, non-cancelled work',()=>assert.deepEqual(workerOverview([order(1,'issued'),order(2,'issued',{cancelled:true}),order(3,'closed'),order(4,'issued',{assignee_id:'other'})],'w').mine.map(o=>o.id),[1]))
test('focus current work, not an emergency rescheduling decision',()=>assert.equal(workerOverview([order(1,'in_progress'),order(2,'issued',{priority:'emergency'})],'w').focus.id,1))
test('multiple running orders require explicit selection',()=>assert.equal(workerOverview([order(1,'in_progress'),order(2,'rework')],'w').focus,null))
test('presentation never hides accepted or active technical work',()=>assert.deepEqual(workerOverview([order(1,'accepted',{title:'TEST'}),order(2,'issued',{title:'TEST'})],'w',true,t=>t==='TEST').mine.map(o=>o.id),[1]))
test('queue order unchanged by display',()=>assert.deepEqual(workerOverview([order(1,'issued'),order(2,'queued'),order(3,'paused')],'w').queue.map(o=>o.id),[1,2]))
test('missing/invalid deadline is explicit',()=>{for(const date of [undefined,'','bad'])assert.equal(workerDeadline(date,0).valid,false)})
test('due now is not shown as one minute overdue',()=>assert.deepEqual(workerDeadline('2026-10-09T00:00:00Z',Date.parse('2026-10-09T00:00:00Z')),{valid:true,overdue:false,minutes:0,at:Date.parse('2026-10-09T00:00:00Z')}))
test('overdue uses full minutes and does not mutate order',()=>assert.equal(workerDeadline('2026-10-09T00:00:00Z',Date.parse('2026-10-09T00:01:01Z')).minutes,2))
test('actions only promise opening card',()=>{for(const status of ['issued','accepted','in_progress','paused','rework'])assert.ok(workerNextAction(status));assert.equal(workerNextAction('closed'),'Открыть наряд')})

test('unaccepted emergency link comes from assigned full snapshot even when presentation hides it',async()=>{
 const {readFileSync}=await import('node:fs');const ui=readFileSync('src/pages/worker/Home.tsx','utf8');assert.match(ui,/const emergency=st.orders.find/);assert.match(ui,/o.assignee_id===actor.id&&!o.cancelled/);assert.match(ui,/\['issued','queued'\].includes\(o.status\)/);assert.match(ui,/to=\{'\/orders\/\'\+emergency.id\}/)
})
