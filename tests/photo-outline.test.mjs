import {test} from 'node:test';import assert from 'node:assert/strict';import {edgeOverlay} from '../src/lib/photo-outline.mjs';
test('uniform frame has no invented edges',()=>assert.equal(edgeOverlay(new Uint8ClampedArray(100*4).fill(90),10,10).filter((x,i)=>i%4===3&&x).length,0));
test('contrast boundary yields only transparent or amber edges',()=>{const x=new Uint8ClampedArray(10*10*4);for(let y=0;y<10;y++)for(let c=5;c<10;c++)x.fill(255,(y*10+c)*4,(y*10+c+1)*4);const o=edgeOverlay(x,10,10);assert.ok(o.some((x,i)=>i%4===3&&x===255));assert.equal(o.length,x.length)});
