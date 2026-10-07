import {chromium} from '@playwright/test'
const PW = process.env.PW_WORKERA
const b = await chromium.launch()
const ctx = await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true})
const pg = await ctx.newPage()
const shot = (n)=>pg.screenshot({path:'/tmp/v9-'+n+'.png'})
await pg.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',PW)
await pg.click('button:has-text("Войти")')
await pg.waitForTimeout(7000)
await shot('01-dark-home')
await pg.goto('http://127.0.0.1:4173/orders'); await pg.waitForTimeout(2000); await shot('02-dark-orders')
// order detail: open order #532 (in progress)
await pg.goto('http://127.0.0.1:4173/orders/532'); await pg.waitForTimeout(2000); await shot('03-dark-order')
// wizard step 1
const btnClose = pg.locator('button:has-text("Закрыть наряд")').first()
if(await btnClose.count()){
  await btnClose.click(); await pg.waitForTimeout(700); await shot('12-wizard-step1')
  // check all declaration checkboxes
  const cbs = pg.locator('.fixed input[type=checkbox]')
  const n = await cbs.count()
  for(let i=0;i<n;i++) await cbs.nth(i).click()
  await pg.waitForTimeout(300)
  await pg.click('button:has-text("Далее")'); await pg.waitForTimeout(400); await shot('13-wizard-step2')
  // fill report
  await pg.click('button:has-text("Шаблон 1")'); await pg.waitForTimeout(200)
  const sel = pg.locator('.fixed select')
  await sel.selectOption({index:1}); await pg.waitForTimeout(200)
  await pg.click('button:has-text("Далее")'); await pg.waitForTimeout(400); await shot('14-wizard-step3')
  await pg.click('.fixed button:has-text("Отмена")').catch(()=>{})
  await pg.keyboard.press('Escape').catch(()=>{})
  await pg.locator('.fixed button').first().click().catch(()=>{})
  await pg.waitForTimeout(300)
}
await pg.goto('http://127.0.0.1:4173/assistant'); await pg.waitForTimeout(1500); await shot('04-dark-assistant')
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(1200); await shot('05-dark-settings')
await pg.goto('http://127.0.0.1:4173/profile'); await pg.waitForTimeout(1500); await shot('06-dark-profile')
// voice HUD
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(1500)
await pg.locator('header button:has-text("AI")').first().click(); await pg.waitForTimeout(800); await shot('15-voice-hud')
await pg.keyboard.press('Escape'); 
await pg.locator('button').filter({has: pg.locator('svg')}).last().click().catch(()=>{})
// light theme
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Светлая")'); await pg.waitForTimeout(600); await shot('07-light-settings')
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('08-light-home')
await pg.goto('http://127.0.0.1:4173/orders/532'); await pg.waitForTimeout(1500); await shot('16-light-order')
// glove
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Тёмная")'); await pg.click('button:has-text("Вкл")'); await pg.waitForTimeout(400)
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('10-glove-home')
// scale 160
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Огромный")'); await pg.waitForTimeout(400)
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('11-scale160-home')
await pg.goto('http://127.0.0.1:4173/orders/532'); await pg.waitForTimeout(1500); await shot('17-scale160-order')
await b.close(); console.log('done')
