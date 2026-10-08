import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewDisplay} from '../src/lib/ai-review-display.mjs';
for (const [verdict,label] of Object.entries({accepted:'Принято',accepted_with_notes:'Принято с замечаниями',accepted_with_remarks:'Принято с замечаниями',rework:'Требует доработки',needs_master_review:'Нужна проверка мастером'})) test(verdict,()=>assert.equal(reviewDisplay({verdict}).verdict,label));
test('new core rules',()=>assert.equal(reviewDisplay({layer2:{work_match:null,photo:null}}).modelParticipated,false));
test('new core model does not imply fresh call',()=>{const x=reviewDisplay({layer2:{work_match:{score:.9},photo:null}});assert.equal(x.modelParticipated,true);assert.match(x.detail,/Текст отчёта проверен/)});
test('new schema overrides stale mode',()=>assert.equal(reviewDisplay({mode:'live',layer2:{work_match:null,photo:null}}).modelParticipated,false));
test('photo result is not authenticated',()=>assert.match(reviewDisplay({layer2:{work_match:null,photo:{score:.9}}}).detail,/не подтверждён/));
test('legacy cache',()=>assert.equal(reviewDisplay({mode:'cache'}).label,'Кэш ответа модели'));
test('unknown does not imply rules',()=>assert.equal(reviewDisplay({}).label,'Источник проверки не указан'));

test('new cache recorded',()=>assert.equal(reviewDisplay({layer2:{work_match:{cached:true},photo:null}}).label,'Правила и кэш языковой модели'));
import {reviewArchiveDisplay} from '../src/lib/ai-review-display.mjs';
test('archive saved',()=>assert.equal(reviewArchiveDisplay({archived:true}).state,'saved'));
test('archive failed never generic success',()=>assert.equal(reviewArchiveDisplay({archived:false}).state,'failed'));
test('missing archive unknown',()=>assert.equal(reviewArchiveDisplay({result:{}}).state,'unknown'));

import {reviewPresentation} from '../src/lib/ai-review-display.mjs';
test('archive false positive verdict is provisional and score withheld',()=>{const x=reviewPresentation({verdict:'accepted',score:5},{archived:false});assert.equal(x.provisional,true);assert.match(x.verdictLabel,/Предварительный/);assert.doesNotMatch(x.scoreLabel,/5/)});
