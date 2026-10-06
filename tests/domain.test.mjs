import test from 'node:test';import assert from 'node:assert/strict';import{statuses,transitions,checkClosure}from'../server/domain.mjs';
test('case lifecycle has exactly ten states',()=>assert.equal(Object.keys(statuses).length,10));
test('worker cannot jump from issued to closed',()=>assert.ok(!transitions.issued.includes('closed')));
test('missing evidence requests rework',()=>assert.equal(checkClosure({}).verdict,'rework'));
test('complete fields do not manufacture AI acceptance',()=>{const x=checkClosure({works:'Заменили подшипник, проверили крепление',fault_code:'М-02',photos:['photo']});assert.equal(x.verdict,'needs_master');assert.equal(x.confidence,null)});
test('negative material amount rejected',()=>assert.equal(checkClosure({works:'Заменили подшипник',fault_code:'М-02',photos:['x'],materials:[{name:'подшипник',quantity:-1}]}).verdict,'rework'));
