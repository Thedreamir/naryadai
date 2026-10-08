import EmbeddedPostgres from 'embedded-postgres';import {randomBytes} from 'node:crypto';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const db=new EmbeddedPostgres({databaseDir:'/tmp/tekton-manual-package-pg',user:'postgres',password:randomBytes(24).toString('hex'),port:55449,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1']});
let c;try{await db.initialise();await db.start();c=db.getPgClient();await c.connect();
await c.query(`create role anon;create role authenticated;create role service_role;
create function current_actor_role() returns text language sql as $$select 'master'::text$$;
create function current_actor() returns uuid language sql as $$select '00000000-0000-4000-8000-000000000001'::uuid$$;
create function is_repeat_asof(bigint,bigint,text,text,timestamptz,timestamptz,timestamptz) returns boolean language sql as $$select false$$;
create function refusal_class(text) returns text language sql as $$select 'unknown'::text$$;
create table employees(id uuid primary key,name text,role text,is_active boolean,on_shift boolean,specialty text);
create table sections(id bigint primary key,name text);create table equipment(id bigint primary key,name text,section_id bigint);
create table orders(id bigint primary key,title text,kind text,status text,priority text,deadline timestamptz,created_at timestamptz,closed_at timestamptz,equipment_id bigint,assignee_id uuid,master_id uuid,cancelled boolean default false,is_overdue boolean default false,closure jsonb,ai_result jsonb);
create table order_events(id bigint generated always as identity,order_id bigint,actor_id uuid,new_status text,created_at timestamptz,reason text);
create table refusal_reviews(event_id bigint,classification text,reviewed_at timestamptz);
create table notifications(order_id bigint,recipient_id uuid,kind text,message text,bucket bigint,unique(order_id,recipient_id,kind,bucket));
insert into employees values('00000000-0000-4000-8000-000000000001','Мастер (Т)','master',true,true,null),('00000000-0000-4000-8000-000000000002','Рабочий (Т)','worker',true,true,'слесарь');
insert into sections values(1,'Тестовый участок');insert into equipment values(1,'Насос (Т)',1);
insert into orders(id,title,kind,status,priority,deadline,created_at,closed_at,equipment_id,assignee_id,master_id,closure,ai_result) values(1,'Проверка (Т)','planned','closed','normal','2026-10-08T12:00Z','2026-10-08T10:00Z','2026-10-08T14:00Z',1,'00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','{}','{"human_score":5}');
insert into order_events(order_id,new_status,created_at) values(1,'completed','2026-10-08T11:50Z');`);
await c.query(readFileSync('/tmp/reliability-release-snapshot/check_deadlines-exact.sql','utf8'));
await c.query('alter table notifications add column id bigint generated always as identity primary key');
const before=(await c.query("select pg_get_functiondef('check_deadlines(timestamptz)'::regprocedure) d")).rows[0].d;
for(const f of ['01-structure.sql','02-indexes-rls.sql','03-functions-trigger.sql']) await c.query(readFileSync('/downloads/tekton-three-chunks/'+f,'utf8'));
await c.query("insert into orders(id,title,status,assignee_id,cancelled) values(9001,'(Т) Test','issued','00000000-0000-4000-8000-000000000002',false)");
assert.equal((await c.query("select count(*) from notifications where kind='new_order'")).rows[0].count,'1');
await c.query(readFileSync('/downloads/tekton-three-chunks/rollback.sql','utf8'));
assert.equal((await c.query("select pg_get_functiondef('check_deadlines(timestamptz)'::regprocedure) d")).rows[0].d,before);
assert.equal((await c.query("select count(*) from notifications where kind='new_order'")).rows[0].count,'1');
for(const n of [1,2]){
 for(const f of ['01-structure.sql','02-indexes-rls.sql'].slice(0,n))await c.query(readFileSync('/downloads/tekton-three-chunks/'+f,'utf8'));
 await c.query(readFileSync('/downloads/tekton-three-chunks/rollback.sql','utf8'));
 assert.equal((await c.query("select to_regclass('telegram_connections') d")).rows[0].d,null);
}
console.log('Partial phase 1 and 2 rollback PASS.');
await c.query("create function unknown_notify() returns trigger language plpgsql as $$begin return new;end$$;create trigger unknown_pipeline after insert on orders for each row execute function unknown_notify()");
await assert.rejects(c.query(readFileSync('/downloads/tekton-three-chunks/01-structure.sql','utf8')),/Unknown INSERT trigger/);await c.query('rollback');
assert.equal((await c.query("select to_regclass('tekton_notify_release_backup') d")).rows[0].d,null);
console.log('THREE CHUNKS ISOLATED PASS: install, durable recipient, rollback exact function, existing notifications retained, unknown pipeline aborted before change. Not live role/full schema proof.');
}finally{await c?.end();await db.stop();}
