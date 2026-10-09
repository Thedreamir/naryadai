import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {encodeAttempts, PHOTO_INPUT_MAX_BYTES, PHOTO_OUTPUT_MAX_BYTES} from '../src/lib/photo-sanitize.ts'

test('encode ladder: first rung preserves original 1600px/0.72 behavior',()=>{
 const a=encodeAttempts()
 assert.deepEqual(a[0],{max:1600,quality:0.72})
})

test('encode ladder: bounded, valid and strictly decreasing effort',()=>{
 const a=encodeAttempts()
 assert.ok(a.length>=2&&a.length<=8,'2..8 rungs')
 for(const r of a){assert.ok(r.max>0&&r.max<=1600);assert.ok(r.quality>0&&r.quality<=1)}
 for(let i=1;i<a.length;i++){
  assert.ok(a[i].max<=a[i-1].max,'max non-increasing')
  assert.ok(a[i].quality<=a[i-1].quality,'quality non-increasing')
  assert.ok(a[i].max*a[i].max*a[i].quality<a[i-1].max*a[i-1].max*a[i-1].quality,'effort strictly decreasing')
 }
})

test('photo cap fits SQL base64 character limit with margin',()=>{
 assert.equal(PHOTO_INPUT_MAX_BYTES,12*1024*1024)
 assert.equal(PHOTO_OUTPUT_MAX_BYTES,290000);assert.ok(Math.ceil(PHOTO_OUTPUT_MAX_BYTES/3)*4+23<400000)
 const hosted=readFileSync(new URL('../src-legacy/hosted.ts',import.meta.url),'utf8')
 assert.ok(hosted.includes('bytes.length > 290000'),'server cap still 290000')
})
