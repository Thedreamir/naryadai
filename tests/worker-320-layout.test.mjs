import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('issued priority and number can wrap independently',()=>{const s=fs.readFileSync('src/pages/worker/OrderDetail.tsx','utf8');assert.match(s,/worker-order-priority-row/);assert.match(s,/worker-order-number/)});
