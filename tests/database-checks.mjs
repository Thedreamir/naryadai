import pg from 'pg';import {readFileSync}from'node:fs';import assert from'node:assert/strict';
const c=new pg.Client({host:'127.0.0.1',port:5433,user:'postgres',password:readFileSync('.local/db-secret','utf8'),database:'naryadai'});await c.connect();
const master='00000000-0000-4000-8000-000000000001',worker='00000000-0000-4000-8000-000000000002';let id,version=1;const outcomes=[];
async function actor(who,sql,args=[]){await c.query('begin');try{await c.query('set local role naryad_app');await c.query("select set_config('app.actor_id',$1,true),set_config('app.reason','Тест причины',true)",[who]);const r=await c.query(sql,args);await c.query('commit');return r}catch(e){await c.query('rollback');throw e}}
async function move(s,who=worker){const r=await actor(who,'update orders set status=$1 where id=$2 returning version,status',[s,id]);version=r.rows[0].version;outcomes.push(s)}
try{
id=(await actor(master,"insert into orders(title,kind,equipment_id,assignee_id,master_id,priority,deadline) values ('Проверка всех ветвей','planned',1,$1,$2,'normal',now()+interval '2 hours') returning id",[worker,master])).rows[0].id;
await move('queued');await move('rejected');await move('issued',master);await move('accepted');await move('in_progress');await move('paused');await move('in_progress');
await assert.rejects(()=>actor(worker,"update orders set status='paused',ai_result='{\"verdict\":\"accepted\"}' where id=$1",[id]),/review result/);
const closure={works:'Выполнено обслуживание привода, проверены крепления',fault_code:'М-02',materials:[],photos:[]};
await actor(worker,"update orders set status='completed',closure=$1 where id=$2",[closure,id]);outcomes.push('completed');
await actor(master,"update orders set status='ai_review',ai_result=$1 where id=$2",[{mode:'rules',verdict:'needs_master',confidence:null},id]);outcomes.push('ai_review');
await move('rework',master);await move('in_progress');await actor(worker,"update orders set status='completed',closure=$1 where id=$2",[closure,id]);await actor(master,"update orders set status='ai_review',ai_result=$1 where id=$2",[{mode:'rules',verdict:'needs_master',confidence:null},id]);await move('closed',master);
await assert.rejects(()=>actor(worker,"delete from order_events where order_id=$1",[id]),/permission denied/);
assert.equal(new Set(['issued',...outcomes]).size,10);
const first=(await c.query("select check_deadlines(now()+interval '3 hours') n")).rows[0].n;const second=(await c.query("select check_deadlines(now()+interval '3 hours') n")).rows[0].n;assert.equal(second,0);assert.ok(first>=0);
console.log(JSON.stringify({ten_states:outcomes,worker_forged_review:'blocked',audit_delete:'blocked',deadline_duplicate_count:second},null,2));
}finally{await c.end()}
