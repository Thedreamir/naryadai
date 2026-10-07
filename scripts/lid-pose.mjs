import {chromium} from 'playwright'
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
await pg.goto('http://127.0.0.1:4173/login')
await pg.fill('input[type=email]','worker-a@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForSelector('.blink-flap',{timeout:20000})
const clip={x:158,y:726,width:74,height:84}
const poses=[['open',1000],['descend',4490],['closed',4580],['hold',4620],['reopen',4700]]
for(const [name,t] of poses){
  await pg.evaluate((t)=>{document.getAnimations().filter(a=>a.animationName==='tk-lid').forEach(a=>{a.currentTime=t;a.pause()})},t)
  await pg.waitForTimeout(120)
  await pg.screenshot({path:`/tmp/pose-${name}.png`,clip})
}
await b.close(); console.log('posed')
