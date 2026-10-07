import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-e2e@naryadai.test')
await pg.fill('input[type=password]','E2eWorker-2026!')
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(7000)
await pg.goto('http://127.0.0.1:4173/orders/648'); await pg.waitForTimeout(4500)
if(await pg.locator('button:has-text("Не требуется")').count()){
  await pg.click('button:has-text("Не требуется")'); await pg.waitForTimeout(600)
  await pg.click('button:has-text("Отметить допуск")'); await pg.waitForTimeout(2500)
}
if(await pg.locator('button:has-text("Принять назначение")').count()){
  await pg.click('button:has-text("Принять назначение")'); await pg.waitForTimeout(3000)
}
await pg.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await pg.waitForTimeout(600)
const cbs=pg.locator('input[type=checkbox]')
for(let i=0;i<await cbs.count();i++) await cbs.nth(i).click()
await pg.screenshot({path:'/tmp/v11-05-gate-648.png'})
await pg.click('button:has-text("Подтвердить и начать работу")'); await pg.waitForTimeout(4000)
await pg.screenshot({path:'/tmp/v11-06-started-648.png',fullPage:false})
await pg.evaluate(()=>window.scrollTo(0,0)); await pg.waitForTimeout(400)
await pg.screenshot({path:'/tmp/v11-06b-started-top.png'})
await b.close(); console.log('done')
