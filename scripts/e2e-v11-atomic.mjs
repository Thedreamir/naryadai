import {chromium} from '@playwright/test'
const b=await chromium.launch()
const mk=()=>b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})
const login=async(pg,email,pw)=>{await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});await pg.fill('input[type=email]',email);await pg.fill('input[type=password]',pw);await pg.click('button:has-text("Войти")');await pg.waitForTimeout(7000)}
// HAPPY: worker-a starts #645 atomically
let pg=await (await mk()).newPage()
await login(pg,'worker-a@naryadai.test',process.env.PW_WORKERA)
// first close #532? No: worker-a has #532 in progress -> start would fail. Instead verify negative for worker-a too, then use worker-e2e? worker-e2e has #647 closed. Create fresh disposable order for worker-e2e? Simpler: pause is a transition... Instead: HAPPY via worker-e2e on a NEW order created by master.
await pg.goto('http://127.0.0.1:4173/orders/645'); await pg.waitForTimeout(4500)
await pg.screenshot({path:'/tmp/v11-03-gate-neutral.png'})
await pg.close()
// NEGATIVE: worker-b on #646 (has #527 in progress)
pg=await (await mk()).newPage()
await login(pg,'worker-b@naryadai.test',process.env.PW_WORKERB)
await pg.goto('http://127.0.0.1:4173/orders/646'); await pg.waitForTimeout(4500)
const cbs=pg.locator('input[type=checkbox]')
for(let i=0;i<await cbs.count();i++) await cbs.nth(i).click()
await pg.click('button:has-text("Подтвердить и начать работу")'); await pg.waitForTimeout(4000)
await pg.screenshot({path:'/tmp/v11-04-negative-atomic.png'})
await b.close(); console.log('done')
