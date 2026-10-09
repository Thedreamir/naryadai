import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferenceCatalog,createKnowledgeSeed,createImportPayload} from '../scripts/seed-knowledge.mjs';
import {generate} from '../scripts/seed-history.mjs';
import {groundedAnswer,NO_DATA} from '../supabase/functions/_shared/assistant-grounding.mjs';
const refs=createReferenceCatalog(),docs=createKnowledgeSeed(),payload=createImportPayload();
test('case 5.4/8 reference minimums and complete relationships',()=>{
 assert.equal(refs.sections.length,4);assert.equal(refs.equipment.length,25);assert.equal(refs.materials.length,40);assert.equal(refs.fault_codes.length,20);assert.equal(refs.work_norms.length,20);assert.equal(refs.brigades.length,3);
 assert.equal(refs.employees.filter(x=>x.role==='master').length,2);assert.ok(refs.employees.filter(x=>x.role==='worker').length>=15);
 for(const e of refs.equipment)assert.ok(refs.sections.some(s=>s.id===e.section_id)&&e.inventory_number&&e.type&&e.criticality);
 for(const e of refs.employees)assert.ok(e.specialty&&e.grade&&e.shift&&e.current_status&&e.synthetic);
 assert.deepEqual(new Set(refs.fault_codes.map(x=>x.code[0])),new Set(['М','Э','Г','П','С']));
});
test('history reference names and units are covered by populated catalogs',()=>{
 for(const o of generate().orders){assert.ok(refs.equipment.some(e=>e.name===o.equipment));for(const m of o.closure?.materials||[])assert.ok(refs.materials.some(r=>r.name===m.name&&r.unit===m.unit));assert.ok(refs.work_norms.some(n=>n.fault_code===o.fault_code&&n.norm_minutes===o.norm_minutes));}
});
test('knowledge has source/version/review provenance without real plant claims',()=>{
 assert.ok(docs.length>=100&&docs.length<200);assert.equal(new Set(docs.map(d=>d.id)).size,docs.length);
 for(const d of docs){assert.equal(d.synthetic,true);assert.equal(d.version,2);assert.equal(d.status,'approved');assert.equal(d.equipment_id,null);assert.ok(d.reviewed_by&&d.reviewed_at&&d.source_label&&d.provenance.source_sha256);assert.equal(d.provenance.scope,'local_fixture_only');assert.ok(d.body.length>=20&&d.body.length<=1200);assert.ok(d.body.includes('Учебный'));assert.ok(!/Костанайские|Костанайских|Минералы|Минералов/i.test(JSON.stringify(d)));}
});
test('import rows remain drafts and do not impersonate real approval',()=>{
 for(const d of payload.knowledge_docs){assert.equal(d.status,'draft');assert.equal(d.version,1);assert.equal(d.reviewed_by,null);assert.equal(d.reviewed_at,null);assert.equal(d.equipment_id,null);}
 assert.equal(groundedAnswer({message:'эскалация принят аварийный',docs:payload.knowledge_docs}).answer,NO_DATA);
});
test('RU case answers are extractive and cited, safety remains master-only',()=>{
 const a=groundedAnswer({message:'эскалация принят аварийный',docs});assert.ok(a.knowledge_used&&a.answer.includes('3 минуты')&&a.citations[0].version===2);
 const b=groundedAnswer({message:'форма закрытия фото после',docs});assert.ok(b.knowledge_used&&b.answer.includes('внеплановых'));
 const c=groundedAnswer({message:'рейтинг факторы качества',docs});assert.ok(c.knowledge_used&&c.answer.includes('7 дней'));
 const d=groundedAnswer({message:'Подать напряжение на двигатель',docs});assert.ok(!d.knowledge_used&&d.answer.includes('мастер'));
});
test('KZ operational queries use explicit translations and unknown facts abstain',()=>{
 const a=groundedAnswer({message:'қабылдау мерзімі авариялық',docs});assert.ok(a.knowledge_used&&a.answer.includes('3 минут'));
 assert.equal(groundedAnswer({message:'реальная прибыль завода миллион',docs}).answer,NO_DATA);
});
