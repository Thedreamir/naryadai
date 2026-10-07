import {chromium} from '@playwright/test'
const PW = process.env.PW_WORKERA
const b = await chromium.launch()
const pg = await (await b.newContext({viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true})).newPage()
const shot = (n)=>pg.screenshot({path:'/tmp/v8-'+n+'.png'})
await pg.goto('http://127.0.0.1:4173/', {waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',PW)
await pg.click('button:has-text("Войти")')
await pg.waitForTimeout(6000)
await shot('01-home')
await pg.goto('http://127.0.0.1:4173/orders', {waitUntil:'networkidle'}); await pg.waitForTimeout(1500); 
// open first active order
await b.close()
console.log('shots done')
