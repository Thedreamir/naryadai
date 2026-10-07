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
// open an in-progress order (worker-a accepted #638 earlier? open first order link)
const link = pg.locator('a[href^="/orders/"]').first()
if(await link.count()){await link.click(); await pg.waitForTimeout(2000); await shot('03-dark-order')}
await pg.goto('http://127.0.0.1:4173/assistant'); await pg.waitForTimeout(1500); await shot('04-dark-assistant')
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(1200); await shot('05-dark-settings')
await pg.goto('http://127.0.0.1:4173/profile'); await pg.waitForTimeout(1500); await shot('06-dark-profile')
// light theme
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Светлая")'); await pg.waitForTimeout(600); await shot('07-light-settings')
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('08-light-home')
await pg.goto('http://127.0.0.1:4173/assistant'); await pg.waitForTimeout(1200); await shot('09-light-assistant')
// glove mode
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Тёмная")'); await pg.click('button:has-text("Вкл")'); await pg.waitForTimeout(400)
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('10-glove-home')
// scale 160
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(800)
await pg.click('button:has-text("Огромный")'); await pg.waitForTimeout(400)
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForTimeout(2000); await shot('11-scale160-home')
await b.close(); console.log('v9 shots done')
