import {chromium} from 'playwright'
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
await pg.goto('http://127.0.0.1:4173/login'); await pg.fill('input[type=email]','worker-a@naryad.kz'); await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(7000)
console.log('url',pg.url())
await pg.screenshot({path:'/tmp/dbg-full.png'})
await b.close()
