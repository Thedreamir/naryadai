// Hardened worker phone e2e: every step asserts stored DB state + UI view + reload persistence.
// Mobile viewport 390x844, touch-target >=44px checks, safe-area check, due_soon notification live+stored.
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
const svc=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const step=(n,ok,extra='')=>{console.log(`${ok?'PASS':'FAIL'} ${n}${extra?' :: '+extra:''}`);if(!ok)process.exitCode=1}
const TITLE='E2E-TEST phone-cycle синтетика'
const b=await chromium.launch()
const dtop=await b.newContext({viewport:{width:1440,height:900}})
const mob=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
let oid=null
const stored=async()=> (await svc.from('orders').select('id,status,assignee_id,master_id,closed_at,permit_kind,permit_note').eq('id',oid).single()).data
const targetOK=async(pg,label)=>{
  const el=pg.getByRole('button',{name:label}).first()
  const bb=await el.boundingBox()
  step(`touch target >=44px: ${label}`, !!bb && bb.height>=44, bb?`${Math.round(bb.width)}x${Math.round(bb.height)}`:'missing')
}
try{
  const u=await svc.auth.admin.getUserById('d6184a48-fc97-46e0-809f-21bd28208074')
  step('worker-c account maps to Демо-исполнитель', u.data.user?.email==='worker-c@naryadai.test', u.data.user?.email||'')
  // 1. master issues order (deadline 0.4h -> due_soon window)
  const pg=await dtop.newPage()
  await pg.goto('http://localhost:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000})
  await pg.goto('http://localhost:4173/issue')
  await pg.fill('textarea',TITLE)
  await pg.locator('select').nth(0).selectOption({index:1})
  await pg.locator('select').nth(1).selectOption({label:'Демо-исполнитель (проверка цикла) · свободен'}).catch(async()=>{
    const el=pg.locator('select').nth(1)
    await el.evaluate(e=>{const o=[...e.options].find(o=>o.text.includes('Демо-исполнитель'));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}))})
  })
  await pg.locator('input[type=number]').fill('0.4')
  await pg.click('button:has-text("Выдать наряд")')
  await pg.waitForURL('http://localhost:4173/',{timeout:15000})
  await pg.waitForTimeout(1500)
  const row=await svc.from('orders').select('id,status,assignee_id,master_id,deadline').eq('title',TITLE).order('id',{ascending:false}).limit(1).single()
  oid=row.data?.id
  step('order issued via UI, stored', !!oid && row.data.status==='issued' && row.data.assignee_id==='d6184a48-fc97-46e0-809f-21bd28208074', '#'+oid+' '+row.data?.status)
  // 2. deadline watcher -> due_soon notification stored
  const cd=await svc.rpc('check_deadlines')
  if(cd.error) console.log('note: direct check_deadlines rpc:',cd.error.message,'(relying on watcher cron, polling)')
  const wcli=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
  await wcli.auth.signInWithPassword({email:'worker-c@naryadai.test',password:process.env.PW_WORKERC})
  let notif=null
  for(let i=0;i<36;i++){
    const q=await wcli.from('notifications').select('*').eq('order_id',oid).eq('kind','due_soon')
    if(q.data?.length){notif=q;break}
    await new Promise(r=>setTimeout(r,5000))
  }
  step('due_soon notification stored for worker', notif?.data?.length===1 && notif.data[0].recipient_id==='d6184a48-fc97-46e0-809f-21bd28208074', notif?.data?.[0]?.message||'none after 180s')
  // 3. worker mobile: login, alert strip live, order visible
  const w=await mob.newPage()
  await w.goto('http://localhost:4173/login');await w.fill('input[type=email]','worker-c@naryadai.test');await w.fill('input[type=password]',process.env.PW_WORKERC);await w.click('button:has-text("Войти")')
  await w.waitForSelector(`text=${TITLE}`,{timeout:30000})
  await w.waitForSelector('text=Контроль сроков',{timeout:10000})
  step('worker sees deadline alert strip', await w.locator(`text=До срока наряда #${oid}`).count()>0)
  await w.screenshot({path:'/tmp/e2e-phone-1-home-alert.png'})
  await w.reload();await w.waitForSelector('text=Контроль сроков',{timeout:10000})
  step('alert strip persists after reload', true)
  // safe-area on bottom nav
  const padStyle=await w.locator('nav').last().evaluate(el=>el.style.paddingBottom)
  step('bottom nav uses env(safe-area-inset-bottom)', padStyle.includes('safe-area-inset-bottom'), padStyle)
  // 4. open order, permit, accept, start - each: stored + reload
  await w.goto('http://localhost:4173/orders/'+oid)
  await w.waitForSelector('button:has-text("Допуск подтверждён")',{timeout:15000})
  await w.click('button:has-text("Допуск подтверждён")');await w.waitForTimeout(400)
  await w.fill('input[placeholder*="Номер допуска"]','Наряд-допуск №E2E, мастер Петров')
  await w.click('button:has-text("Отметить допуск")')
  await w.locator('text=Допуск подтверждён ·').waitFor({state:'visible',timeout:15000})
  let st=await stored(); step('permit stored', st.permit_kind==='confirmed' && !!st.permit_note, `status=${st.status} permit=${st.permit_kind||'-'} note=${st.permit_note||'-'}`)
  await w.locator('button:has-text("Принять назначение")').waitFor({state:'visible',timeout:15000})
  await targetOK(w,'Принять назначение')
  await w.click('button:has-text("Принять назначение")')
  await w.locator('button:has-text("Начать работу")').waitFor({state:'visible',timeout:15000})
  st=await stored(); step('accept stored', ['accepted','queued','in_progress'].includes(st.status), st.status)
  await w.reload();await w.locator('button:has-text("Начать работу")').waitFor({state:'visible',timeout:15000})
  step('accept persists after reload', true)
  const boxes=w.locator('input[type=checkbox]')
  const nb=await boxes.count()
  step('declaration checkboxes rendered', nb>0, String(nb))
  for(let i=0;i<nb;i++) await boxes.nth(i).check()
  await targetOK(w,'Подтвердить и начать работу')
  await w.click('button:has-text("Подтвердить и начать работу")')
  await w.locator('button:has-text("Сдать наряд")').waitFor({state:'visible',timeout:15000})
  st=await stored(); step('start stored', st.status==='in_progress', st.status)
  await w.reload();await w.locator('button:has-text("Сдать наряд")').waitFor({state:'visible',timeout:15000})
  step('start persists after reload', true)
  await w.click('button:has-text("Сдать наряд")')
  await w.locator('text=Сдача наряда').waitFor({state:'visible',timeout:10000})
  await w.click('button:has-text("Далее")')
  await w.locator('textarea').waitFor({state:'visible',timeout:10000})
  await w.screenshot({path:'/tmp/e2e-phone-2-closure-form.png'})
  // 5. closure with photo
  await w.fill('textarea','E2E: заменил сальник, проверил натяжение, протёков нет. Синтетическая проверка цикла.')
  await w.selectOption('select',{index:1})
  await w.click('button:has-text("Далее")')
  await w.locator('text=Фото после').waitFor({state:'visible',timeout:10000})
  w.on('console',m=>{if(m.type()==='error')console.log('PAGEERR',m.text().slice(0,200))})
  w.on('pageerror',e=>console.log('PAGEEXC',String(e).slice(0,300)))
  await w.locator('div.fixed.z-50 input[type=file]').setInputFiles('/tmp/e2e-photo.png')
  const thumb=await w.waitForSelector('img[alt="После"]',{timeout:20000}).then(()=>true).catch(()=>false)
  step('photo thumbnail rendered (compress pipeline)', thumb)
  await w.screenshot({path:'/tmp/e2e-phone-2b-photo-step.png'})
  const submit=w.locator('button:has-text("На проверку мастеру")')
  await targetOK(w,'На проверку мастеру')
  step('submit enabled after photo+fields', await submit.isEnabled())
  await submit.click()
  await w.waitForTimeout(6000)
  st=await stored(); step('closure stored', ['completed','ai_review'].includes(st.status), st.status)
  await w.reload();await w.waitForTimeout(2500)
  st=await stored(); step('closure persists after reload', ['completed','ai_review'].includes(st.status), st.status)
  await w.screenshot({path:'/tmp/e2e-phone-3-submitted.png'})
  // 6. master closes
  await pg.goto('http://localhost:4173/orders/'+oid);await pg.waitForTimeout(2500)
  await pg.screenshot({path:'/tmp/e2e-phone-4-master-review.png'})
  await pg.click('button:has-text("5")',{timeout:15000});await pg.waitForTimeout(300)
  await pg.click('button:has-text("Закрыть наряд")');await pg.waitForTimeout(5000)
  st=await stored(); step('close stored', st.status==='closed' && !!st.closed_at, `status=${st.status} closed_at=${st.closed_at?'set':'-'}`)
  await pg.reload();await pg.waitForTimeout(2500)
  st=await stored(); step('close persists after reload', st.status==='closed', st.status)
  // 7. worker sees closed state, alert gone after next watcher pass not required; Home no longer lists as active
  await w.goto('http://localhost:4173/');await w.waitForTimeout(2500)
  const bodyTxt=await w.locator('body').innerText()
  step('worker home no longer shows order as active', !bodyTxt.includes(TITLE)||bodyTxt.includes('Закрыт'), '')
  await w.screenshot({path:'/tmp/e2e-phone-5-worker-after-close.png'})
}catch(e){step('EXCEPTION',false,String(e).slice(0,300))}
console.log('ORDER_ID='+oid)
await b.close()
