import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
const url=process.env.SUPABASE_URL,key=process.env.SB_ANON
const svc=createClient(url,process.env.SB_SERVICE), master=createClient(url,key), worker=createClient(url,key)
await master.auth.signInWithPassword({email:'master@naryadai.test',password:process.env.PW_MASTER})
await worker.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
const mid=(await master.auth.getUser()).data.user.id,wid=(await worker.auth.getUser()).data.user.id
const eq=(await master.from('equipment').select('id').limit(1)).data[0].id
let oid,eid,b
try {
 const o=await master.from('orders').insert({master_id:mid,assignee_id:wid,equipment_id:eq,title:'TEST-REFUSAL-UI synthetic',kind:'unplanned',priority:'normal',deadline:new Date(Date.now()+3600000).toISOString(),status:'issued'}).select('id').single();assert.ifError(o.error);oid=o.data.id
 const e=await svc.from('order_events').insert({order_id:oid,actor_id:wid,new_status:'rejected',reason:'other: Синтетическая спорная причина UI'}).select('id').single();assert.ifError(e.error);eid=e.data.id
 b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
 await pg.goto('http://127.0.0.1:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000});await pg.goto('http://127.0.0.1:4173/report')
 const card=pg.locator(`[data-refusal-event="${eid}"]`);await card.waitFor();await card.scrollIntoViewIfNeeded();await card.locator('input').fill('Синтетическая проверка: подтверждены ограничения допуска');await card.getByRole('button',{name:'Подтвердить причину'}).click();await card.getByText('Решение мастера: Оправдан',{exact:false}).waitFor({timeout:30000});await pg.reload();await card.waitFor();assert.match(await card.innerText(),/Решение мастера: Оправдан/);await card.scrollIntoViewIfNeeded();await pg.screenshot({path:'/tmp/refusal-ui-persisted.png'});console.log('ok - master UI original source, decision, reload persistence')
 const review=await svc.from('refusal_reviews').select('*').eq('event_id',eid).single();assert.ifError(review.error);assert.equal(review.data.reviewer_id,mid);console.log('ok - UI decision stored with master identity')
 const before=await worker.rpc('worker_rating',{since:new Date(Date.now()-90*86400000).toISOString(),until:new Date().toISOString()});assert.ifError(before.error);assert.equal(before.data.length,1);console.log('ok - connected worker rating readback')
 await pg.evaluate(()=>window.scrollTo(0,0));await pg.screenshot({path:'/tmp/refusal-report-top.png'})
} finally {
 if(b)await b.close()
 if(eid)await svc.from('refusal_reviews').delete().eq('event_id',eid)
 if(oid){await svc.from('order_events').delete().eq('order_id',oid);const d=await svc.from('orders').delete().eq('id',oid);assert.ifError(d.error)}
 await master.auth.signOut();await worker.auth.signOut();console.log('ok - UI test fixture cleaned')
}
