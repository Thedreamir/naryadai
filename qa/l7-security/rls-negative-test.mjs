import EmbeddedPostgres from 'embedded-postgres';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db = new EmbeddedPostgres({databaseDir:'/tmp/l7-rls-'+Date.now(),user:'postgres',password:randomBytes(24).toString('hex'),port:55471,persistent:false,postgresFlags:['-c','listen_addresses=127.0.0.1']});
let c;
const ids={master:'00000000-0000-4000-8000-000000000001',a:'00000000-0000-4000-8000-000000000002',b:'00000000-0000-4000-8000-000000000003',leader:'00000000-0000-4000-8000-000000000004',unknown:'00000000-0000-4000-8000-000000000005'};
try {
 await db.initialise();await db.start();c=db.getPgClient();await c.connect();
 await c.query(`create role authenticated; create role anon; create role service_role; create schema auth; create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`);
 await c.query(readFileSync('supabase/migrations/001_core.sql','utf8'));
 await c.query(`grant naryad_app to authenticated;grant usage on schema public to authenticated;alter table employees add column is_active boolean default true;create or replace function current_actor()returns uuid language sql stable as $$select auth.uid()$$;create or replace function current_actor_role()returns text language sql stable security definer set search_path=public,pg_temp as $$select role from employees where id=current_actor() and is_active$$;`);
 await c.query(`insert into employees(id,name,role)values($1,'Master','master'),($2,'A','worker'),($3,'B','worker'),($4,'Leader','leader')`,[ids.master,ids.a,ids.b,ids.leader]);
 await c.query(`insert into equipment(id,name) overriding system value values(1,'Pump')`);await c.query("select set_config('request.jwt.claim.sub',$1,false)",[ids.master]);
 await c.query(`insert into orders(id,title,kind,equipment_id,assignee_id,master_id,priority,deadline) overriding system value values(1,'A order','planned',1,$1,$3,'normal',now()),(2,'B order','planned',1,$2,$3,'normal',now())`,[ids.a,ids.b,ids.master]);
 await c.query(readFileSync('supabase/migrations/032_declarations.sql','utf8'));
 await c.query(`create table notifications(id bigint,recipient_id uuid);alter table notifications enable row level security;create policy read_notifications on notifications for select to naryad_app using(recipient_id=current_actor());grant select on notifications to naryad_app;create table employee_permits(employee_id uuid,permit text);alter table employee_permits enable row level security;create policy employee_permits_read on employee_permits for select to authenticated using(true);grant select on employee_permits to authenticated;`);await c.query('insert into notifications values(1,$1),(2,$2)',[ids.a,ids.b]);await c.query("insert into employee_permits values($1,'A permit'),($2,'B permit')",[ids.a,ids.b]);await c.query(`insert into order_declarations(order_id,declared_by,phase,text)values(1,$1,'pre_work','A declaration'),(2,$2,'pre_work','B declaration')`,[ids.a,ids.b]);
 const actor=async id=>{await c.query('reset role');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await c.query('set role authenticated')};
 const count=async table=>Number((await c.query('select count(*) n from '+table)).rows[0].n);
 await actor(ids.a);assert.equal(await count('orders'),1);assert.equal(await count('order_declarations'),2);assert.equal(await count('employee_permits'),2);
 await actor(ids.unknown);assert.equal(await count('order_declarations'),2);
 await c.query('reset role');await c.query('update employees set is_active=false where id=$1',[ids.a]);
 await actor(ids.a);assert.equal(await count('orders'),1);assert.equal(await count('notifications'),1);assert.equal(await count('order_declarations'),2);
 console.log('BASE REPRO: foreign declarations/permits and unknown-account declarations visible; inactive assigned worker reads order+notification.');
 await c.query('reset role');await c.query(readFileSync('qa/l7-security/proposed-rls.sql','utf8'));
 for(const id of [ids.a,ids.unknown]){await actor(id);for(const table of ['orders','order_events','notifications','order_declarations','employee_permits'])assert.equal(await count(table),0,table+' blocked for '+id)}
 await c.query('reset role');await c.query('update employees set is_active=true where id=$1',[ids.a]);
 await actor(ids.a);for(const table of ['orders','order_events','notifications','order_declarations','employee_permits'])assert.equal(await count(table),1,table+' own only');
 await assert.rejects(c.query('insert into order_declarations(order_id,declared_by,phase,text) values(2,$1,\'pre_work\',\'foreign\')',[ids.a]),/row-level security/);
 await actor(ids.leader);assert.equal(await count('orders'),2);assert.equal(await count('order_declarations'),2);assert.equal(await count('employee_permits'),2);assert.equal((await c.query("update orders set title='not allowed' where id=1")).rowCount,0);
 await actor(ids.master);assert.equal(await count('orders'),2);assert.equal(await count('order_declarations'),2);assert.equal(await count('employee_permits'),2);
 console.log('PATCH PASS: inactive/unknown deny; active worker own-only; foreign insertion deny; leader reads/no updates; master reads. Isolated PostgreSQL fixture, NOT live Supabase proof.');
}finally{await c?.end();await db.stop()}
