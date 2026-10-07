import {chromium} from 'playwright'
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
await pg.goto('http://127.0.0.1:4173/login'); await pg.fill('input[type=email]','worker-a@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(8000)
console.log('url',pg.url())
for(let i=0;i<100;i++){await pg.screenshot({path:`/tmp/blink/f${String(i).padStart(3,'0')}.png`,clip:{x:140,y:690,width:110,height:120}}); await pg.waitForTimeout(90)}
await b.close(); console.log('burst done')
