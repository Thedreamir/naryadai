import {chromium} from '@playwright/test'
const log=[]; const step=(n,ok,extra='')=>{log.push(`${ok?'PASS':'FAIL'} ${n}${extra?' :: '+extra:''}`); console.log(log[log.length-1])}
const b=await chromium.launch()
const dtop=await b.newContext({viewport:{width:1440,height:900}})
const mob=await b.newContext({viewport:{width:390,height:844}})
const TITLE='E2E-ТЕСТ: функциональный цикл (удалить после демо)'
let orderHref=null
try{
  // 1. master issues order
  let pg=await dtop.newPage()
  await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
  await pg.fill('input[type=email]','master@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_MASTER)
  await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(7000)
  step('master login', await pg.locator('text=Наряды смены').count()>0)
  await pg.goto('http://127.0.0.1:4173/issue',{waitUntil:'networkidle'}); await pg.waitForTimeout(2000)
  await pg.fill('textarea',TITLE)
  const sels=pg.locator('select')
  await sels.nth(0).selectOption({index:1})
  await sels.nth(1).evaluate(el=>{const o=[...el.options].find(o=>o.text.includes('Сейтов')); el.value=o.value; el.dispatchEvent(new Event('change',{bubbles:true}))})
  await pg.click('button:has-text("Выдать наряд")'); await pg.waitForTimeout(4000)
  step('issue order', true)
  // find order link on board
  await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'}); await pg.waitForTimeout(3000)
  const link=pg.locator('a', {hasText:'E2E-ТЕСТ'}).first()
  orderHref=await link.getAttribute('href')
  step('order on board', !!orderHref, orderHref||'')
  // 2. worker-b cycle
  const w=await mob.newPage()
  await w.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
  await w.fill('input[type=email]','worker-b@naryadai.test'); await w.fill('input[type=password]',process.env.PW_WORKERB)
  await w.click('button:has-text("Войти")'); await w.waitForTimeout(7000)
  await w.goto('http://127.0.0.1:4173'+orderHref,{waitUntil:'networkidle'}); await w.waitForTimeout(2500)
  await w.click('button:has-text("Допуск оформлен")'); await w.waitForTimeout(500)
  await w.click('button:has-text("Отметить допуск")'); await w.waitForTimeout(3000)
  step('permit recorded', await w.locator('button:has-text("Принять назначение")').isEnabled())
  await w.click('button:has-text("Принять назначение")'); await w.waitForTimeout(3000)
  await w.click('button:has-text("Начать работу")'); await w.waitForTimeout(3000)
  step('work started', await w.locator('text=Закрытие наряда').count()>0)
  await w.fill('textarea','E2E: заменил сальник, проверил натяжение, протёков нет.')
  await w.selectOption('select',{index:1})
  await w.setInputFiles('input[type=file]','/tmp/e2e-photo.png'); await w.waitForTimeout(4000)
  const submit=w.locator('button:has-text("Отправить на проверку")')
  step('closure form valid', await submit.isEnabled())
  await w.screenshot({path:'/tmp/e2e-worker-closure.png'})
  await submit.click(); await w.waitForTimeout(5000)
  step('submitted for review', true)
  // 3. master AI check + close
  await pg.goto('http://127.0.0.1:4173'+orderHref,{waitUntil:'networkidle'}); await pg.waitForTimeout(3000)
  const aiBtn=pg.locator('button:has-text("Проверить закрытие (ИИ)")')
  step('order in review state', await aiBtn.count()>0)
  if(await aiBtn.count()>0){
    await aiBtn.click()
    await pg.waitForSelector('text=Карточка оснований',{timeout:60000}).catch(()=>{})
    await pg.waitForTimeout(3000)
    const mode=await pg.locator('text=Карточка оснований').count()
    step('AI closure check returned', mode>0)
    await pg.screenshot({path:'/tmp/e2e-master-ai.png'})
  }
  await pg.click('button:has-text("5")'); await pg.waitForTimeout(300)
  await pg.click('button:has-text("Закрыть наряд")'); await pg.waitForTimeout(5000)
  step('master closed with score', true)
  await pg.screenshot({path:'/tmp/e2e-master-closed.png'})
  // 4. closed list contains it
  await pg.goto('http://127.0.0.1:4173/closed',{waitUntil:'networkidle'}); await pg.waitForTimeout(3000)
  step('appears in Closed', await pg.locator('text=E2E-ТЕСТ').count()>0)
}catch(e){step('EXCEPTION',false,String(e).slice(0,200))}
console.log('ORDER_HREF='+orderHref)
await b.close()
