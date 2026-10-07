import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('CONSOLE',m.type(),m.text().slice(0,300))})
pg.on('pageerror',e=>console.log('PAGEERROR',String(e).slice(0,400)))
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForTimeout(6000)
const nav=await pg.locator('nav').count()
console.log('nav count:',nav)
if(nav){console.log('nav html:',(await pg.locator('nav').innerHTML()).slice(0,300))}
await b.close()
