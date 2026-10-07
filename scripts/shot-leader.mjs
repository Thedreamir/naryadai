import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:1440,height:900}})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','leader@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_LEADER)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(8000)
await pg.screenshot({path:'/tmp/v8l-01-leader.png'})
await b.close(); console.log('done')
