import EmbeddedPostgres from 'embedded-postgres';import {randomBytes} from 'node:crypto';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const db=new EmbeddedPostgres({databaseDir:'/tmp/tekton-reliability-pg',user:'postgres',password:randomBytes(24).toString('hex'),port:55439,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1']});
let c;try{await db.initialise();await db.start();c=db.getPgClient();await c.connect();
await c.query(`create role anon;create role authenticated;
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
await c.query(readFileSync('supabase/migrations/059_rating_completion_time.sql','utf8'));
let r=(await c.query("select * from worker_rating('2026-10-08T00:00Z','2026-10-09T00:00Z')")).rows[0];assert.equal(r.on_time,'1');assert.equal(r.f_ontime,'100.0');
await c.query("insert into order_events(order_id,new_status,created_at) values(1,'completed','2026-10-08T12:05Z')");r=(await c.query("select * from worker_rating('2026-10-08T00:00Z','2026-10-09T00:00Z')")).rows[0];assert.equal(r.on_time,'0');
await c.query('truncate order_events');r=(await c.query("select * from worker_rating('2026-10-08T00:00Z','2026-10-09T00:00Z')")).rows[0];assert.equal(r.f_ontime,null);assert.match(r.explanation,/фактор срока исключён/);assert.equal(r.factors_available,4);
await c.query(readFileSync('supabase/migrations/057_deadline_payload.sql','utf8'));
await c.query("update orders set status='completed',is_overdue=true");await c.query("select check_deadlines('2026-10-08T15:00Z')");assert.equal((await c.query('select is_overdue from orders')).rows[0].is_overdue,false);assert.equal((await c.query('select count(*) from notifications')).rows[0].count,'0');
await c.query("update orders set status='in_progress'");await c.query("select check_deadlines('2026-10-08T15:00Z')");let messages=(await c.query('select message from notifications')).rows;assert.equal(messages.length,2);assert.match(messages[0].message,/Насос.*Тестовый участок.*Рабочий.*в работе.*180 мин.*Последний комментарий/);assert.equal((await c.query("select check_deadlines('2026-10-08T15:00Z') n")).rows[0].n,0);
// Exact thresholds in isolated schema:30min due,10min ordinary,3min emergency.
for(const [priority,age,deadline,expected] of [
 ['normal',599,'2026-10-08T20:00Z',0],['normal',600,'2026-10-08T20:00Z',2],
 ['emergency',179,'2026-10-08T20:00Z',0],['emergency',180,'2026-10-08T20:00Z',2],
 ['normal',0,'2026-10-08T15:30:01Z',0],['normal',0,'2026-10-08T15:30:00Z',1]]){
 await c.query('truncate notifications');await c.query("update orders set status='issued',priority=$1,created_at='2026-10-08T15:00Z'::timestamptz-($2::int*interval '1 second'),deadline=$3,is_overdue=false",[priority,age,deadline]);
 await c.query("select check_deadlines('2026-10-08T15:00Z')");assert.equal(Number((await c.query('select count(*) from notifications')).rows[0].count),expected);
}
console.log(JSON.stringify({scope:'isolated minimal local PostgreSQL, not live role/full schema',rating_master_wait:'PASS',latest_rework_submission:'PASS',unknown_completion_excluded:'PASS',completed_overdue_cleared:'PASS',rich_deadline_two_recipients:'PASS',duplicate_bucket:'PASS',exact_30_10_3_thresholds:'PASS'},null,2));
}finally{if(c)await c.end();await db.stop();}
