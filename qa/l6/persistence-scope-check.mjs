// Run from repo root with @electric-sql/pglite installed in scratch (not app dependency).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const read=p=>readFileSync(p,'utf8');
const ids={master:'00000000-0000-4000-8000-000000000001',worker:'00000000-0000-4000-8000-000000000002',other:'00000000-0000-4000-8000-000000000003',inactive:'00000000-0000-4000-8000-000000000004',leader:'00000000-0000-4000-8000-000000000005'};
const checks=[];
async function actor(id,query){await db.exec('reset role');await db.query("select set_config('app.actor_id',$1,false)",[ids[id]]);await db.exec('set role authenticated');return db.query(query)}
try {
 await db.exec('create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting(\'app.actor_id\',true),\'\')::uuid$$;grant usage on schema auth to authenticated;');
 // Core is unchanged except optional pgcrypto install: WASM lacks extension binaries.
 await db.exec(read('supabase/migrations/001_core.sql').replace('create extension if not exists pgcrypto;',''));
 await db.exec('grant naryad_app to authenticated;alter table employees add column is_active boolean not null default true;create or replace function current_actor_role()returns text language sql stable security definer set search_path=public,pg_temp as $$select role from employees where id=current_actor() and is_active$$;');
 await db.exec(read('supabase/migrations/032_declarations.sql'));
 await db.exec(`insert into employees(id,name,role,is_active) values('${ids.master}','Master','master',true),('${ids.worker}','Worker','worker',true),('${ids.other}','Other','worker',true),('${ids.inactive}','Disabled','worker',false),('${ids.leader}','Leader','leader',true);insert into equipment(id,name) overriding system value values(1,'Pump');alter table orders disable trigger user;insert into orders(id,title,kind,equipment_id,assignee_id,master_id,priority,status,deadline) overriding system value values(1,'Own work','planned',1,'${ids.worker}','${ids.master}','normal','accepted',now()+interval '1 day'),(2,'Other work','planned',1,'${ids.other}','${ids.master}','normal','accepted',now()+interval '1 day'),(3,'Disabled work','planned',1,'${ids.inactive}','${ids.master}','normal','accepted',now()+interval '1 day');alter table orders enable trigger user;insert into order_declarations(order_id,declared_by,phase,text)values(1,'${ids.worker}','pre_work','Own safety evidence'),(2,'${ids.other}','pre_work','Other safety evidence');grant usage on schema public to service_role;grant select on orders,order_declarations to service_role;`);
 assert.equal((await actor('worker','select * from order_declarations')).rows.length,2);
 assert.equal((await actor('inactive','select * from orders')).rows.length,1);
 checks.push('baseline defects reproduced: cross-worker declarations + inactive own-order read');
 await db.exec('reset role');await db.exec(read('supabase/migrations/067_l6_persistence_scope.sql'));
 await db.exec(read('supabase/migrations/067_l6_persistence_scope.sql'));
 checks.push('migration reapply succeeds');
 assert.deepEqual((await actor('worker','select id from orders order by id')).rows.map(r=>r.id),[1]);
 assert.equal((await actor('worker','select * from order_declarations')).rows.length,1);
 assert.equal((await actor('other','select * from order_declarations')).rows[0].order_id,2);
 checks.push('active worker sees only assigned order and its declarations');
 for(const role of ['master','leader']){assert.equal((await actor(role,'select * from orders')).rows.length,3);assert.equal((await actor(role,'select * from order_declarations')).rows.length,2)}
 checks.push('master/leader existing authorized read preserved');
 assert.equal((await actor('inactive','select * from orders')).rows.length,0);
 assert.equal((await actor('inactive','select * from order_declarations')).rows.length,0);
 checks.push('inactive worker reads no orders/declarations');
 await actor('worker',`insert into order_declarations(order_id,declared_by,phase,text)values(1,'${ids.worker}','pre_work','Valid own declaration')`);
 await assert.rejects(actor('worker',`insert into order_declarations(order_id,declared_by,phase,text)values(2,'${ids.worker}','pre_work','Not my order')`),/row-level security/);
 await assert.rejects(actor('inactive',`insert into order_declarations(order_id,declared_by,phase,text)values(3,'${ids.inactive}','pre_work','Disabled account')`),/row-level security/);
 checks.push('own declaration insert preserved, other-order/inactive inserts denied');
 await db.exec('reset role;set role service_role');assert.equal((await db.query('select * from orders')).rows.length,3);checks.push('BYPASSRLS service fixture read preserved');
 await db.exec('reset role');await db.exec(read('qa/l6/rollback.sql'));assert.equal((await actor('inactive','select * from orders')).rows.length,1);checks.push('rollback restores baseline (wider access)');
 console.log(JSON.stringify({scope:'isolated PostgreSQL WASM, core + declarations + active-role adapter; NOT full migration chain or live Supabase',checks,passed:checks.length},null,2));
} finally {await db.close()}
