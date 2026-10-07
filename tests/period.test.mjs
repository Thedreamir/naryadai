import test from 'node:test'
import assert from 'node:assert/strict'
import {withinInstant} from '../src/lib/period.ts'
test('shift boundary [08:00,20:00) Asia/Almaty',()=>{
 const start=Date.parse('2026-10-07T08:00:00+05:00'),end=Date.parse('2026-10-07T20:00:00+05:00')
 assert.equal(withinInstant('2026-10-07T07:59:00+05:00',start,end),false)
 assert.equal(withinInstant('2026-10-07T08:00:00+05:00',start,end),true)
 assert.equal(withinInstant('2026-10-07T19:59:59+05:00',start,end),true)
 assert.equal(withinInstant('2026-10-07T20:00:00+05:00',start,end),false)
 assert.equal(withinInstant('2026-10-07T20:01:00+05:00',start,end),false)
 assert.equal(withinInstant('2026-10-07T03:00:00Z',start,end),true)
})
