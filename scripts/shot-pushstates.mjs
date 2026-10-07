import {chromium} from '@playwright/test'
const b=await chromium.launch({channel:'chrome',headless:false,args:['--no-sandbox']})
const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',permissions:['notifications']})
const pg=await ctx.newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-c@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERC)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(6000)
await pg.goto('http://127.0.0.1:4173/profile',{waitUntil:'networkidle'}); await pg.waitForTimeout(2500)
// state 1: permission granted but no subscription yet -> ready state with honest caption
await pg.screenshot({path:'/tmp/push-1-ready-granted.png'})
// click -> subscribe fails in this container -> real error/retry state
await pg.click('button:has-text("Включить уведомления")'); await pg.waitForTimeout(6000)
await pg.screenshot({path:'/tmp/push-2-error-retry.png'})
await b.close(); console.log('done')
