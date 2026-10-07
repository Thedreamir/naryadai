import test from 'node:test'
import assert from 'node:assert/strict'
// Date parsing rather than lexical comparison: provider ISO values may use +00:00 or Z.
const within=(value,start,end)=>Date.parse(value)>=Date.parse(start)&&Date.parse(value)<Date.parse(end)
test('shift boundary [08:00,20:00) Asia/Almaty',()=>{
 const start='2026-10-07T08:00:00+05:00',end='2026-10-07T20:00:00+05:00'
 assert.equal(within('2026-10-07T07:59:00+05:00',start,end),false)
 assert.equal(within('2026-10-07T08:00:00+05:00',start,end),true)
 assert.equal(within('2026-10-07T19:59:59+05:00',start,end),true)
 assert.equal(within('2026-10-07T20:00:00+05:00',start,end),false)
 assert.equal(within('2026-10-07T20:01:00+05:00',start,end),false)
 assert.equal(within('2026-10-07T03:00:00Z',start,end),true)
})
