import {test} from 'node:test';import assert from 'node:assert/strict';
import {classifyProviderResult as classify,retryDelay} from '../supabase/functions/_shared/notification-retry.mjs';
test('known success only; malformed success uncertain',()=>{
 assert.equal(classify({provider:'telegram',httpStatus:200,body:{ok:true},messageId:1}),'sent');
 assert.equal(classify({provider:'telegram',httpStatus:200,body:{ok:true}}),'uncertain');
});
test('timeout, generic 5xx, unsupported provider never auto-retry',()=>{
 for(const x of [{transportError:true},{httpStatus:502},{httpStatus:500,body:{ok:false,error_code:500}},{provider:'push',httpStatus:201}])assert.equal(classify({provider:'telegram',...x}),'uncertain');
});
test('only confirmed Telegram rate-limit refusal retried',()=>{
 assert.equal(classify({provider:'telegram',httpStatus:429,body:{ok:false,error_code:429}}),'transient_rejected');
 assert.equal(classify({provider:'telegram',httpStatus:429}),'uncertain');
 for(const s of [400,401,403,404])assert.equal(classify({provider:'telegram',httpStatus:s,body:{ok:false,error_code:s}}),'permanent_rejected');
});
test('bounded backoff, retry-after minimum',()=>{
 assert.deepEqual([1,2,3,4,5].map(x=>retryDelay(x)),[30,60,120,240,480]);
 assert.equal(retryDelay(1,600),600);assert.equal(retryDelay(1,999999),null);assert.throws(()=>retryDelay(0));
});
