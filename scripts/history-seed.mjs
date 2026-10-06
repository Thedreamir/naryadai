import pg from'pg';import{readFileSync}from'node:fs';import{faker}from'@faker-js/faker';
faker.seed(42);const c=new pg.Client({host:'127.0.0.1',port:5433,user:'postgres',password:readFileSync('.local/db-secret','utf8'),database:'naryadai'});await c.connect();
try{
await c.query('begin');
if((await c.query("select 1 from orders where title like 'СИНТЕТИКА%' limit 1")).rowCount){console.log('History seed already present');await c.query('rollback');process.exitCode=0}else{
await c.query('alter table orders disable trigger user');
for(let i=0;i<20;i++)await c.query('insert into equipment(section_id,name) values ($1,$2)',[i%4+1,`Тестовый агрегат ${i+6}`]);
for(let i=0;i<13;i++)await c.query("insert into employees(id,name,role,specialty) values($1,$2,'worker',$3) on conflict do nothing",[faker.string.uuid(),`Тестовый исполнитель ${i+3}`,i%2?'Электрик':'Механик']);
const workers=(await c.query("select id from employees where role='worker' order by name")).rows.map(x=>x.id);const master='00000000-0000-4000-8000-000000000001';const today=new Date();
let repeats=0,materialOutliers=0,ppFailures=0;
for(let i=0;i<520;i++){
 const day=i%90;const start=new Date(today.getTime()-(90-day)*86400000+(i%16)*1800000);const duration=45+(i%7)*20;const end=new Date(start.getTime()+duration*60000);const deadline=new Date(start.getTime()+120*60000);
 const repeated=i%19===0;const outlier=i%23===0;const postPP=i%31===0;repeats+=Number(repeated);materialOutliers+=Number(outlier);ppFailures+=Number(postPP);
 const equipment=repeated?1:postPP?3:(i%25)+1;const fault=repeated?'М-02':i%3===0?'Э-01':'Г-01';const works=i%3===0?'Проверена цепь питания и заменён кабель':'Выполнено обслуживание узла и проверены крепления';
 const closure={works,fault_code:fault,materials:[{name:'Смазка',quantity:outlier?12:0.4+(i%4)*0.1}],photos:[],synthetic:true};
 const r=await c.query("insert into orders(title,kind,equipment_id,assignee_id,master_id,priority,status,deadline,created_at,started_at,closed_at,closure,ai_result) values($1,$2,$3,$4,$5,'normal','closed',$6,$7,$7,$8,$9,$10) returning id",[`СИНТЕТИКА · обслуживание №${i+1}`,postPP?'unplanned':i%4===0?'planned':'unplanned',equipment,workers[i%workers.length],master,deadline,start,end,closure,{mode:'synthetic_seed',verdict:'needs_master',score:null,confidence:null,reasons:['Сгенерированная история. Это не оценка модели.']}]);
 await c.query("insert into order_events(order_id,actor_id,new_status,created_at) values($1,$2,'issued',$3),($1,$4,'closed',$5)",[r.rows[0].id,master,start,master,end]);
}
await c.query('alter table orders enable trigger user');await c.query('commit');console.log(JSON.stringify({seed:42,orders:520,workers:workers.length,equipment:25,synthetic:true,designed_patterns:{repeated_equipment_fault:repeats,material_outliers:materialOutliers,post_planned_failure_candidates:ppFailures},limitations:'Patterns are planted, not independently discovered. Ratings without actual human quality scores omit the quality component.'},null,2));
}
}catch(e){await c.query('rollback');throw e}finally{await c.end()}
