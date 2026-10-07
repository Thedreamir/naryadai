import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
const svc=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const SEYTOV='975bd63a-4d2b-43b5-b045-945a2f0cb1ca', PETROV='63e3cc37-620e-41df-a3b7-14d3b6cacdfc'
let mid, b
try {
  const f=await svc.from('repair_memory').insert({order_id:617,equipment_id:4,title:'TEST-MEMORY-UI синтетика',body:'Синтетическая тестовая запись UI: проверка полного цикла утверждения и отзыва через интерфейс мастера.',author_id:SEYTOV}).select('id').single()
  assert.ifError(f.error); mid=f.data.id
  b=await chromium.launch()
  const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
  await pg.goto('http://localhost:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000})
  await pg.goto('http://localhost:4173/memory');await pg.waitForSelector('text=TEST-MEMORY-UI синтетика')
  await pg.screenshot({path:'/tmp/memory-master-list.png'})
  const card=pg.locator('div:has-text("TEST-MEMORY-UI синтетика")').last()
  await pg.getByRole('button',{name:'Утвердить в базу знаний'}).first().click()
  await pg.waitForTimeout(1500)
  let row=(await svc.from('repair_memory').select('status,reviewed_by,reviewed_at').eq('id',mid).single()).data
  assert.equal(row.status,'approved','stored status after UI approve')
  assert.equal(row.reviewed_by,PETROV,'reviewer identity is the acting master')
  assert.ok(row.reviewed_at,'reviewed_at stored')
  await pg.reload();await pg.waitForSelector('text=TEST-MEMORY-UI синтетика')
  await pg.waitForSelector('text=Утверждена');await pg.screenshot({path:'/tmp/memory-master-approved.png'})
  await pg.getByRole('button',{name:'Отозвать из базы знаний'}).first().click()
  await pg.waitForTimeout(1500)
  row=(await svc.from('repair_memory').select('status').eq('id',mid).single()).data
  assert.equal(row.status,'revoked','stored status after UI revoke')
  await pg.reload();await pg.waitForSelector('text=TEST-MEMORY-UI синтетика');await pg.waitForSelector('text=Отозвана')
  // leader read-only
  const pg2=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
  await pg2.goto('http://localhost:4173/login');await pg2.fill('input[type=email]','leader@naryadai.test');await pg2.fill('input[type=password]',process.env.PW_LEADER);await pg2.click('button:has-text("Войти")');await pg2.waitForSelector('a[href="/report"]',{timeout:30000})
  await pg2.goto('http://localhost:4173/memory');await pg2.waitForSelector('text=Память ремонтов')
  assert.equal(await pg2.getByRole('button',{name:'Утвердить в базу знаний'}).count(),0,'leader has no approve button')
  assert.equal(await pg2.getByRole('button',{name:'Отозвать из базы знаний'}).count(),0,'leader has no revoke button')
  await pg2.waitForSelector('text=Режим чтения')
  await pg2.screenshot({path:'/tmp/memory-leader-readonly.png'})
  console.log('MEMORY UI ALL PASS')
} finally {
  if(mid) await svc.from('repair_memory').delete().eq('id',mid)
  if(b) await b.close()
}
