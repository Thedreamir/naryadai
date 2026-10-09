import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {parse} from '@babel/parser'
const pages=['master/Board','master/Review','master/OrderDetail','master/Closed','master/Handover','master/Equipment','master/Memory','master/Knowledge','master/Report','leader/LeaderHome','leader/LeaderOverview','Login','worker/Profile']
const files=[...pages.map(p=>'src/pages/'+p+'.tsx'),'src/layouts/MasterShell.tsx']
const dictionary=JSON.parse(fs.readFileSync('src/lib/kz-ui.json','utf8'))
function walk(n,visit){if(!n||typeof n!=='object')return;visit(n);for(const [k,v]of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(c=>walk(c,visit));else if(v&&typeof v==='object')walk(v,visit)}}
for(const file of files)test(file+' explicitly subscribes to locale and wires all source JSX copy',()=>{
 const source=fs.readFileSync(file,'utf8');assert.match(source,/useLocale\(/)
 const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});const missing=[]
 walk(ast,n=>{if(n.type==='JSXText'&&/[А-Яа-яЁё]/.test(n.value))missing.push('raw JSX: '+n.value.trim());if(n.type==='JSXAttribute'&&['aria-label','placeholder','title','alt'].includes(n.name.name)&&n.value?.type==='StringLiteral'&&/[А-Яа-яЁё]/.test(n.value.value))missing.push('raw attribute: '+n.value.value);if(n.type==='CallExpression'&&n.callee?.name==='t'&&n.arguments[0]?.type==='StringLiteral'&&!Object.hasOwn(dictionary,n.arguments[0].value))missing.push('missing key: '+n.arguments[0].value)})
 assert.deepEqual(missing,[])
})
test('draft notice does not claim navigation-only or native-reviewed translation',()=>{for(const file of ['src/layouts/MasterShell.tsx','src/pages/leader/LeaderHome.tsx']){const s=fs.readFileSync(file,'utf8');assert.doesNotMatch(s,/только навигация|Мәтіндер RU/);assert.match(s,/Казахский перевод: черновик/)}})

test('metadata tables have exact keys, including composed badges',()=>{
 const sources=['src/lib/status.ts','src/lib/ai-review-display.mjs','src/pages/master/Board.tsx','src/pages/master/Memory.tsx','src/pages/leader/LeaderOverview.tsx','src/layouts/MasterShell.tsx']
 const missing=[]
 for(const file of sources){const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript','jsx']});walk(ast,n=>{if(n.type==='ObjectProperty'&&['label','verdictLabel','scoreLabel'].includes(n.key.name)&&n.value.type==='StringLiteral'&&/[А-Яа-яЁё]/.test(n.value.value)&&!Object.hasOwn(dictionary,n.value.value))missing.push(file+': '+n.value.value)})}
 assert.deepEqual(missing,[])
})
test('source data and user-authored content remain outside translation calls',()=>{
 const forbidden=/\bt\(\s*(?:o\.(?:title|section|equipment|assignee|closure|ai_result\.report_master)|(?:e|d)\.(?:body|title|reason|review_note|source_label)|(?:w|actor|r\.worker)\.name|s\.name|r\.explanation|a\.(?:facts|recommendation|subject))\s*\)/
 for(const file of files.filter(f=>!f.endsWith('/Report.tsx')))assert.doesNotMatch(fs.readFileSync(file,'utf8'),forbidden,file)
 const report=fs.readFileSync('src/pages/master/Report.tsx','utf8');assert.doesNotMatch(report,/\bt\((?:e\.reason|e\.review\.note|r\.explanation|a\.(?:subject|facts|recommendation))\)/)
})
test('composed source copy uses whole placeholder keys, not substring fallback',()=>{assert.match(fs.readFileSync('src/pages/master/Board.tsx','utf8'),/t\('очередь \{count\}'\)/);assert.match(fs.readFileSync('src/pages/worker/Profile.tsx','utf8'),/t\('закрыто · \{days\} дн'\)/);assert.match(fs.readFileSync('src/pages/master/Equipment.tsx','utf8'),/t\('QR карточки \{name\}'\)/)})

test('all composed source-owned review labels have exact dictionary keys',async()=>{
 const {reviewDisplay,reviewPresentation,reviewArchiveDisplay}=await import('../src/lib/ai-review-display.mjs');const labels=new Set()
 for(const verdict of ['accepted','accepted_with_remarks','accepted_with_notes','rework','needs_master_review','unknown'])for(const mode of ['live','cache','rules',null])for(const receipt of [null,{archived:true},{archived:false}]){const p=reviewPresentation({verdict,mode},receipt);for(const k of ['label','detail','verdictLabel','scoreLabel'])if(/[А-Яа-яЁё]/.test(p[k]))labels.add(p[k])}
 for(const language of [true,false])for(const cached of [true,false])for(const photo of [true,false]){const p=reviewDisplay({layer1:{},layer2:{work_match:language?{cached}:null,photo:photo?{}:null},verdict:'accepted'});labels.add(p.label);labels.add(p.detail)}
 for(const receipt of [null,{archived:true},{archived:false}])labels.add(reviewArchiveDisplay(receipt).label)
 assert.deepEqual([...labels].filter(s=>!Object.hasOwn(dictionary,s)),[])
})
