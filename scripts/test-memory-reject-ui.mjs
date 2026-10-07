import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
const svc=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const SEYTOV='975bd63a-4d2b-43b5-b045-945a2f0cb1ca', PETROV='63e3cc37-620e-41df-a3b7-14d3b6cacdfc'
let mid, b
try {
  const f=await svc.from('repair_memory').insert({order_id:617,equipment_id:4,title:'TEST-REJECT-UI синтетика',body:'Синтетическая тестовая запись UI: проверка отклонения заметки мастером через интерфейс.',author_id:SEYTOV}).select('id').single()
  assert.ifError(f.error); mid=f.data.id
  b=await chromium.launch()
  const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
  await pg.goto('http://localhost:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000})
  await pg.goto('http://localhost:4173/memory');await pg.waitForSelector('text=TEST-REJECT-UI синтетика')
  const card=pg.locator('div.rounded-\\[22px\\]',{hasText:'TEST-REJECT-UI синтетика'}).first()
  await card.getByRole('button',{name:'Отклонить'}).click()
  await pg.waitForTimeout(1500)
  let row=(await svc.from('repair_memory').select('status,reviewed_by,reviewed_at').eq('id',mid).single()).data
  assert.equal(row.status,'rejected','stored status after UI reject')
  assert.equal(row.reviewed_by,PETROV,'reviewer identity is the acting master')
  assert.ok(row.reviewed_at,'reviewed_at stored')
  const ev=await svc.from('repair_memory_events').select('event,actor_id').eq('memory_id',mid).eq('event','rejected')
  assert.ifError(ev.error); assert.equal(ev.data.length,1,'exactly one rejected audit event')
  assert.equal(ev.data[0].actor_id,PETROV,'audit actor is master')
  await pg.reload();await pg.waitForSelector('text=TEST-REJECT-UI синтетика')
  await pg.waitForSelector('text=Отклонена')
  await pg.screenshot({path:'/tmp/memory-master-rejected.png'})
  // reject button no longer offered on a rejected note
  const card2=pg.locator('div.rounded-\\[22px\\]',{hasText:'TEST-REJECT-UI синтетика'}).first()
  assert.equal(await card2.getByRole('button',{name:'Отклонить'}).count(),0,'no reject button on rejected note')
  // error path: stale version shows an error banner, state unchanged
  const c2=await svc.from('repair_memory').insert({order_id:617,equipment_id:4,title:'TEST-REJECT-UI2 синтетика',body:'Вторая синтетическая запись: проверка ошибочного пути при устаревшей версии.',author_id:SEYTOV}).select('id,version').single()
  assert.ifError(c2.error)
  const mid2=c2.data.id
  await pg.reload();await pg.waitForSelector('text=TEST-REJECT-UI2 синтетика')
  const card3=pg.locator('div.rounded-\\[22px\\]',{hasText:'TEST-REJECT-UI2 синтетика'}).first()
  // author edits it in the background to make the UI version stale, then master rejects from UI
  const wrk=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
  const li=await wrk.auth.signInWithPassword({email:'worker-b@naryadai.test',password:process.env.PW_WORKERB})
  assert.ifError(li.error)
  const ed=await wrk.rpc('update_repair_memory',{p_id:mid2,p_title:'TEST-REJECT-UI2 синтетика (ред.)',p_body:'Отредактировано автором, пока мастер смотрел старую версию.'})
  assert.ifError(ed.error)
  const chk=(await svc.from('repair_memory').select('status,version').eq('id',mid2).single()).data
  assert.equal(chk.status,'candidate','still candidate after author edit')
  assert.equal(chk.version,c2.data.version+1,'version bumped by author edit')
  await card3.getByRole('button',{name:'Отклонить'}).click()
  await pg.waitForSelector('text=Запись изменилась. Обновите список перед решением.',{timeout:8000})
  const r2=(await svc.from('repair_memory').select('status,version').eq('id',mid2).single()).data
  assert.equal(r2.status,'candidate','stale-version reject did not change stored state')
  assert.equal(r2.version,c2.data.version+1,'version untouched by failed reject')
  await pg.screenshot({path:'/tmp/memory-master-stale-error.png'})
  // after refresh the master sees the current version and can act on what he actually read
  await pg.reload();await pg.waitForSelector('text=TEST-REJECT-UI2 синтетика (ред.)')
  await pg.screenshot({path:'/tmp/memory-master-stale-reread.png'})
  await svc.from('repair_memory').delete().eq('id',mid2)
  console.log('REJECT UI ALL PASS')
} finally {
  if(mid) await svc.from('repair_memory').delete().eq('id',mid)
  if(b) await b.close()
}
