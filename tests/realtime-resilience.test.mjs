import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const hook=fs.readFileSync('src/lib/use-order-state.ts','utf8');
const hosted=fs.readFileSync('src-legacy/hosted.ts','utf8');
test('state hook refreshes when the phone wakes the page (visibilitychange)',()=>{assert.match(hook,/visibilitychange/)});
test('realtime channel reports status so the UI can fall back to polling',()=>{const w=hosted.slice(hosted.indexOf('export function watch('),hosted.indexOf('export function watchNotifications'));assert.match(w,/subscribe\(\s*\(?\w*\)?\s*=>/)});
test('realtime refresh is debounced (burst of events must not cause a burst of full reloads)',()=>{assert.match(hook+hosted,/debounce|setTimeout\(\s*\w+\s*,\s*\d{2,3}\s*\)/)});
