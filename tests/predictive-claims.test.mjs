import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('uncalibrated probability model claim dropped from manager UI',()=>{const s=fs.readFileSync('src/pages/leader/LeaderOverview.tsx','utf8');assert.doesNotMatch(s,/predictiveRisk|\.probability|82,13%|82,40%/);assert.match(s,/CheckPriorityPanel/)});
test('evaluation placeholder cannot be treated as metrics',()=>{const r=JSON.parse(fs.readFileSync('docs/predictive-eval.json','utf8'));assert.equal(r.status,'unverified');assert.equal(r.metrics,null);assert.equal(r.calibrated,false)});
