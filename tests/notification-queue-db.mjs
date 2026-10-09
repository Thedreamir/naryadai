import EmbeddedPostgres from 'embedded-postgres';import {randomBytes} from 'node:crypto';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const db=new EmbeddedPostgres({databaseDir:'/tmp/l10-pg-'+process.pid,user:'postgres',password:randomBytes(24).toString('hex'),port:55440,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1']});
let c;
try {
 await db.initialise();await db.start();c=db.getPgClient();await c.connect();
 await c.query(`create role anon;create role authenticated;create role service_role;
 create table notifications(id bigint primary key);insert into notifications values(1),(2),(3),(4),(5),(6);`);
 await c.query(readFileSync('lane10/notification-queue.staged.sql','utf8'));
 const enqueue=async(n,d='binding-v1')=>(await c.query("select notification_enqueue($1,'telegram',$2) id",[n,d])).rows[0].id;
 const claim=async()=>(await c.query('select * from notification_claim(1)')).rows[0];
 const finish=async(j,outcome)=>(await c.query('select notification_finish($1,$2,$3) ok',[j.id,j.lease_token,outcome])).rows[0].ok;
 const begin=async(j)=>(await c.query('select notification_begin_send($1,$2) ok',[j.id,j.lease_token])).rows[0].ok;
 const state=async(id)=>(await c.query('select state from notification_jobs where id=$1',[id])).rows[0].state;
 const id=await enqueue(1);assert.equal(await enqueue(1),id);assert.equal((await c.query('select count(*) n from notification_job_events')).rows[0].n,'1');
 let j=await claim();assert.equal(j.attempts,1);assert.equal(await claim(),undefined);assert.equal(await begin({...j,lease_token:randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5')}),false);
 assert.equal(await begin(j),true);assert.equal(await finish(j,'sent'),true);assert.equal(await finish(j,'sent'),false);assert.equal(await state(id),'sent');
 const id2=await enqueue(2);j=await claim();assert.equal(await finish(j,'preflight_failed'),true);assert.equal(await state(id2),'pending');assert.equal(await claim(),undefined);
 await c.query("update notification_jobs set available_at=now()-interval '1 second' where id=$1",[id2]);j=await claim();assert.equal(j.attempts,2);await begin(j);await finish(j,'transient_rejected');
 await c.query("update notification_jobs set available_at=now()-interval '1 second',attempts=4 where id=$1",[id2]);j=await claim();await begin(j);await finish(j,'transient_rejected');assert.equal(await state(id2),'dead');
 const id3=await enqueue(3);j=await claim();await begin(j);await c.query("update notification_jobs set lease_until=now()-interval '1 second' where id=$1",[id3]);assert.equal(await finish(j,'sent'),false);await claim();assert.equal(await state(id3),'unknown');
 const id4=await enqueue(4);j=await claim();const old=j;await c.query("update notification_jobs set lease_until=now()-interval '1 second' where id=$1",[id4]);j=await claim();assert.equal(j.id,id4);assert.equal(j.attempts,2);assert.notEqual(old.lease_token,j.lease_token);assert.equal(await begin(old),false);await finish(j,'cancelled');assert.equal(await state(id4),'cancelled');
 const id5=await enqueue(5);j=await claim();await begin(j);await finish(j,'uncertain');assert.equal(await state(id5),'unknown');
 const id6=await enqueue(6);j=await claim();await begin(j);await finish(j,'permanent_rejected');assert.equal(await state(id6),'dead');
 assert.equal((await c.query("select has_function_privilege('authenticated','notification_claim(integer)','EXECUTE') v")).rows[0].v,false);
 assert.equal((await c.query("select has_table_privilege('service_role','notification_jobs','UPDATE') v")).rows[0].v,false);
 assert.equal((await c.query("select has_function_privilege('service_role','notification_claim(integer)','EXECUTE') v")).rows[0].v,true);
 // Locked ready rows are skipped by a different connection/worker.
 const parallel=db.getPgClient();await parallel.connect();
 const concurrentId=await enqueue(2,'parallel');
 await c.query('begin');await c.query('select id from notification_jobs where id=$1 for update',[concurrentId]);
 assert.equal((await parallel.query('select * from notification_claim(1)')).rows.length,0);
 await c.query('commit');await parallel.end();
 assert.equal((await claim()).id,concurrentId);
 await c.query('set role authenticated');
 await assert.rejects(()=>c.query('select * from notification_claim(1)'),/permission denied/);
 await assert.rejects(()=>c.query('select * from notification_jobs'),/permission denied/);
 await c.query('reset role');
 // A second destination/subscription is a separate job, never aggregated into a single receipt.
 assert.notEqual(await enqueue(1,'binding-v2'),id);
 console.log('PASS local SQL: dedupe; leases; fencing; sent receipts; preflight retries; retry cap; uncertain expiry; cancellation; permanent failures; channel destination key; service-only grants.');
} finally {if(c)await c.end();await db.stop();}
