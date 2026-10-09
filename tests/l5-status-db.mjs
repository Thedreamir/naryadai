import EmbeddedPostgres from 'embedded-postgres';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const patched=process.argv.includes('--patched');
const embedded=new EmbeddedPostgres({databaseDir:'/tmp/tekton-l5-'+randomBytes(4).toString('hex'),user:'postgres',password:randomBytes(24).toString('hex'),port:55445,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1']});
const bin=process.env.PG_BIN_DIR;const dir='/tmp/tekton-l5-system-'+randomBytes(4).toString('hex');
const db=bin?{initialise:async()=>{mkdirSync(dir);execFileSync(bin+'/initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale']);},start:async()=>{execFileSync(bin+'/pg_ctl',['-D',dir,'-l',dir+'/log','-o','-p 55445 -h 127.0.0.1 -k '+dir,'-w','start']);},getPgClient:()=>new pg.Client({host:'127.0.0.1',port:55445,user:'postgres',database:'postgres'}),stop:async()=>{try{execFileSync(bin+'/pg_ctl',['-D',dir,'-m','fast','-w','stop']);}catch{}}}:embedded;
let c;const evidence=[];
try{
 await db.initialise();await db.start();c=db.getPgClient();await c.connect();
 await c.query(`create role authenticated;create role anon;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('app.actor_id',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select coalesce(nullif(current_setting('app.test_role',true),''),'authenticated')$$;`);
 for(const f of ['001_core.sql','002_integrity.sql','013_override_at_exempt.sql'])await c.query(readFileSync('supabase/migrations/'+f,'utf8').replace('create extension if not exists pgcrypto;','-- pg14 gen_random_uuid is built in; extension not installed for isolated test'));
 await c.query(`alter table orders add cancelled boolean not null default false,add is_overdue boolean not null default false,add permit_kind text,add permit_note text,add permit_by uuid,add permit_at timestamptz;
 alter table employees add is_active boolean not null default true;
 create function review_fallback(bigint,integer) returns void language sql as $$select$$;
 create table ai_reviews(order_id bigint,verdict text check(verdict in ('accepted','accepted_with_remarks','rework','needs_master_review')),score integer,confidence numeric,needs_master_review boolean,explanation text,layer1 jsonb,layer2 jsonb,reasons jsonb,model text,prompt_version text);`);
 for(const f of ['007_hosted_rpc.sql','050_restore_transition_guards.sql','056_one_active_order.sql','065_server_review_gate.sql'])await c.query(readFileSync('supabase/migrations/'+f,'utf8'));
 await c.query(`grant usage on schema auth to naryad_app;grant execute on all functions in schema auth to naryad_app;
 grant execute on function transition_order(bigint,text,integer,text,jsonb,integer,text) to naryad_app;
 insert into employees(id,name,role) values('00000000-0000-4000-8000-000000000001','Master','master'),('00000000-0000-4000-8000-000000000002','Worker','worker'),('00000000-0000-4000-8000-000000000003','Other worker','worker'),('00000000-0000-4000-8000-000000000004','Leader','leader');
 insert into sections(name) values('Test');insert into equipment(section_id,name) values(1,'Test');insert into fault_codes values('F01','Test');`);
 if(patched)await c.query(readFileSync('supabase/migrations/066_l5_transition_evidence.sql','utf8'));
 await c.query(`create or replace function current_actor_role() returns text language sql stable security definer set search_path=public,pg_temp as $$select role from employees where id=current_actor() and is_active$$;`);
 const who=n=>'00000000-0000-4000-8000-00000000000'+n;
 const actor=async(n,fn,service=false)=>{await c.query('begin');try{await c.query("select set_config('app.actor_id',$1,true),set_config('app.test_role',$2,true)",[who(n),service?'service_role':'authenticated']);if(!service)await c.query('set local role naryad_app');const r=await fn();await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}};
 const create=async()=>Number((await actor(1,()=>c.query("insert into orders(title,kind,equipment_id,assignee_id,master_id,priority,deadline,permit_kind) values('Test repair','planned',1,$1,$2,'normal',now()+interval '2 hours','not_required') returning id",[who(2),who(1)]))).rows[0].id);
 const move=async(id,status,n=2,reason='',score=null)=>{const old=(await c.query('select * from orders where id=$1',[id])).rows[0];return actor(n,()=>c.query('select transition_order($1,$2,$3,$4,$5,$6,$7)',[id,status,old.version,reason,status==='completed'?{works:'Performed synthetic test repair',fault_code:'F01',materials:[],photos:[]}:null,score,'Test']));};
 const review=async(id,verdict='accepted')=>{const old=(await c.query('select version from orders where id=$1',[id])).rows[0];return actor(1,()=>c.query('select commit_ai_review($1,$2,$3,$4)',[id,old.version,who(1),{verdict,score:4,confidence:0.5}]),true);};
 const ready=async()=>{let id=await create();await move(id,'accepted');await move(id,'in_progress');await move(id,'completed');return id;};
 const id=await create();
 await assert.rejects(()=>move(id,'closed',2),/invalid status transition|review result cannot be written by worker/);
 await assert.rejects(()=>move(id,'accepted',1),/assigned worker/);
 assert.equal((await actor(3,()=>c.query('select * from orders where id=$1',[id]))).rowCount,0);
 await assert.rejects(()=>actor(4,()=>c.query("select transition_order($1,'accepted',1,'',null,null,'')",[id])),/permission denied|order unavailable/);
 await move(id,'queued');await move(id,'rejected',2,'Нет материалов');await move(id,'issued',1);await move(id,'accepted');await move(id,'in_progress');await move(id,'paused',1,'Ожидание остановки');await move(id,'in_progress');await move(id,'completed');
 await assert.rejects(()=>move(id,'ai_review',1),/server handler/);
 await review(id);await move(id,'rework',1,'Уточнить ремонт');await move(id,'in_progress');await move(id,'completed');await review(id);await move(id,'closed',1,'',5);
 const rows=(await c.query('select * from order_events where order_id=$1 order by id',[id])).rows;
 assert.equal(new Set(rows.map(x=>x.new_status)).size,10);assert.ok(rows.every(x=>x.actor_id&&x.created_at));assert.ok(rows.filter(x=>['rejected','paused','rework'].includes(x.new_status)).every(x=>x.reason?.trim().length>=3));
 await assert.rejects(()=>actor(1,()=>c.query("select transition_order($1,'rework',1,'Test',null,null,'')",[id])),/stale order version/);
 const final=(await c.query('select * from orders where id=$1',[id])).rows[0];assert.equal(final.version,15);assert.ok(final.started_at&&final.closed_at);
 await assert.rejects(()=>actor(2,()=>c.query('delete from order_events where order_id=$1',[id])),/permission denied/);
 evidence.push({name:'10 statuses, role gates, audit author/time, 14 version increments, timestamps, immutable audit',pass:true});
 let missing=await ready();await review(missing);let missingBlocked=false;try{await actor(1,()=>c.query("update orders set status='closed' where id=$1",[missing]));}catch(e){missingBlocked=true;}
 evidence.push({name:'direct close without master rating',blocked:missingBlocked});assert.equal(missingBlocked,patched);
 let nullRating=await ready();await review(nullRating);await assert.rejects(()=>move(nullRating,'closed',1,'',null),/score/);
 evidence.push({name:'RPC null master rating already blocked in baseline',pass:true});
 let x=await create();let blocked=false;try{await move(x,'rejected',2,'   ');}catch(e){blocked=true;}
 evidence.push({name:'blank reason',blocked});assert.equal(blocked,patched);
 if(patched){for(const score of [0,6]){let x=await ready();await review(x);await assert.rejects(()=>move(x,'closed',1,'',score),/score/);}let x=await ready();await review(x,'rework');await assert.rejects(()=>move(x,'closed',1,'',5),/review/);}
 let inactive=await create();await c.query('update employees set is_active=false where id=$1',[who(2)]);await assert.rejects(()=>move(inactive,'accepted'),/actor required/);evidence.push({name:'inactive actor blocked and stale RPC rejected',pass:true});
 console.log(JSON.stringify({scope:'isolated local PostgreSQL using real selected current migration functions, not full hosted schema or live DB',patched,evidence},null,2));
}finally{if(c)await c.end();await db.stop();}
