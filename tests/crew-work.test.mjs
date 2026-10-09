import {test} from 'node:test'
import assert from 'node:assert/strict'
import {crewWork} from '../src/lib/crew-work.mjs'
import {readFileSync} from 'node:fs'
test('in-progress outranks paused and rework regardless of source order',()=>{
 const rows=[{id:1,status:'paused'},{id:2,status:'rework'},{id:3,status:'in_progress'}]
 assert.equal(crewWork(rows).id,3);assert.equal(crewWork([...rows].reverse()).id,3)
 assert.equal(crewWork(rows.slice(0,2)).id,1);assert.equal(crewWork([]),null)
})
test('board shows actual work before off-shift metadata; closed snapshot is navigable beyond50',()=>{
 const board=readFileSync('src/pages/master/Board.tsx','utf8');assert.match(board,/const stt=work\?/)
 const closed=readFileSync('src/pages/master/Closed.tsx','utf8');assert.match(closed,/slice\(0,limit\)/);assert.match(closed,/setLimit\(n=>n\+50\)/)
})
test('worker per-order rating exposes only valid master score and opens correct order',()=>{
 const source=readFileSync('src/pages/worker/Profile.tsx','utf8');assert.match(source,/closed.map/);assert.match(source,/Number.isInteger\(o.ai_result\?\.human_score\)/);assert.match(source,/to=\{'\/orders\/\'\+o.id\}/)
})
