import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
const svc=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE), master=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
await master.auth.signInWithPassword({email:'master@naryadai.test',password:process.env.PW_MASTER})
const mid=(await master.auth.getUser()).data.user.id
const workers=(await svc.from('employees').select('id').eq('role','worker').eq('is_active',true).limit(2)).data
const eq=(await master.from('equipment').select('id').limit(1)).data[0].id
let oid,b
try {
 const o=await master.from('orders').insert({master_id:mid,assignee_id:workers[0].id,equipment_id:eq,title:'TEST-MANAGE-UI synthetic',kind:'unplanned',priority:'normal',deadline:new Date(Date.now()+3600000).toISOString(),status:'issued'}).select('id').single();assert.ifError(o.error);oid=o.data.id
 b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
 await pg.goto('http://127.0.0.1:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000});await pg.goto('http://127.0.0.1:4173/orders/'+oid)
 await pg.getByLabel('Основание управления').fill('Синтетический тест управления')
 await pg.getByLabel('Новый исполнитель').selectOption(workers[1].id);await pg.getByRole('button',{name:'Переназначить',exact:true}).click();await pg.waitForResponse(r=>r.url().includes('/rest/v1/orders'))
 await pg.reload();await pg.getByLabel('Основание управления').waitFor();assert.equal((await svc.from('orders').select('assignee_id').eq('id',oid).single()).data.assignee_id,workers[1].id);console.log('ok - UI reassignment stored and reload persisted')
 await pg.getByLabel('Основание управления').fill('Синтетический тест приоритета');await pg.getByLabel('Новый приоритет').selectOption('high');await pg.getByRole('button',{name:'Изменить приоритет',exact:true}).click();await pg.getByText('Приоритет изменён мастером на high',{exact:false}).waitFor();assert.equal((await svc.from('orders').select('priority').eq('id',oid).single()).data.priority,'high');console.log('ok - UI priority stored with audit event')
 await pg.screenshot({path:'/tmp/manage-ui.png'})
 pg.on('dialog',d=>d.accept());await pg.getByRole('button',{name:'Отменить наряд',exact:true}).click();await pg.waitForURL('http://127.0.0.1:4173/');assert.equal((await svc.from('orders').select('cancelled').eq('id',oid).single()).data.cancelled,true);await pg.reload();await pg.getByText('Текущая смена',{exact:false}).waitFor({timeout:15000}).catch(()=>{});assert(!((await pg.locator('body').innerText()).includes('TEST-MANAGE-UI synthetic')));console.log('ok - UI cancellation stored, absent from board after reload')
} finally {
 if(b)await b.close();if(oid){await svc.from('order_events').delete().eq('order_id',oid);const d=await svc.from('orders').delete().eq('id',oid);assert.ifError(d.error)}await master.auth.signOut();console.log('ok - manage UI fixture cleaned')
}
