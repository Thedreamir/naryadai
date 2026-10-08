import {test} from 'node:test';import assert from 'node:assert/strict';import{tourSteps}from'../src/lib/demo-tour-copy.mjs';
test('ten ordered steps exact endpoint titles',()=>{assert.equal(tourSteps.length,10);assert.equal(tourSteps[0].title,'Кто свободен. Что в работе');assert.equal(tourSteps[9].title,'Повторный ремонт видно в истории');assert.equal(new Set(tourSteps.map(s=>s.id)).size,10)});
test('copy no prototype claims or measured factory effect',()=>{for(const s of tourSteps)assert.doesNotMatch(s.title+s.body,/прототип|макет|синтетич|точность \d|экономия \d/i)});
