import {chromium} from 'playwright'
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:'/tmp/vid',size:{width:390,height:844}}})
const pg=await ctx.newPage()
await pg.goto('http://127.0.0.1:4173/login')
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForSelector('text=ОСТАЛОСЬ',{timeout:20000}).catch(()=>{})
await pg.waitForTimeout(2000)
for(let i=0;i<70;i++){await pg.screenshot({path:`/tmp/blink/f${String(i).padStart(3,'0')}.png`,clip:{x:140,y:700,width:110,height:110}}); await pg.waitForTimeout(90)}
await ctx.close(); await b.close()
console.log('video+burst done')
