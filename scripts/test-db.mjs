import {spawnSync} from 'node:child_process';
// Isolated local schemas, sequential to avoid ports/RAM contention. Never connects
// to hosted accounts or runs migrations on the user's live database.
const harnesses=[['tests/full-schema-db.mjs'],['tests/reliability-db.mjs'],['tests/telegram-binding-db.mjs'],['tests/v2-db-check.mjs'],['tests/notification-queue-db.mjs'],['tests/employee-acl-db-check.mjs'],['tests/server-review-gate-db-check.mjs'],['tests/l5-status-db.mjs','--patched'],['qa/l6/persistence-scope-check.mjs'],['qa/l7-security/rls-negative-test.mjs'],['--test','tests/pin-runtime-db.mjs']];
let failures=0;for(const args of harnesses){console.log('\nDB HARNESS '+args.join(' '));const result=spawnSync(process.execPath,args,{stdio:'inherit',timeout:90000});if(result.status!==0){console.error('FAILED',args[0],result.error?.message||result.signal||result.status);failures++}}
console.log(JSON.stringify({scope:'full migration + repeated hosted chain with stubbed Supabase infrastructure; additional isolated fixtures, no live database',harnesses:harnesses.length,failed:failures}));if(failures)process.exit(1);
