import {chromium} from 'playwright'
const b=await chromium.launch()
const ctx=async(w,h,dsk=2)=>await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dsk})
// ---- LOGIN ----
let pg=await (await ctx(390,844)).newPage()
await pg.goto('http://127.0.0.1:4173/login'); await pg.waitForTimeout(2000)
await pg.screenshot({path:'/tmp/e10-00-login.png'})
// ---- WORKER dark ----
await pg.fill('input[type=email]','worker-a@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForSelector('text=ОСТАЛОСЬ',{timeout:20000}).catch(()=>{}); await pg.waitForTimeout(2200)
await pg.screenshot({path:'/tmp/e10-01-wrk-home-dark.png'})
await pg.goto('http://127.0.0.1:4173/orders'); await pg.waitForTimeout(2500)
await pg.screenshot({path:'/tmp/e10-02-wrk-orders-dark.png'})
const link=pg.locator('a[href^="/orders/"]').first()
if(await link.count()){await link.click(); await pg.waitForTimeout(2500); await pg.screenshot({path:'/tmp/e10-03-wrk-orderdetail-dark.png'})}
await pg.goto('http://127.0.0.1:4173/assistant'); await pg.waitForTimeout(2500)
await pg.screenshot({path:'/tmp/e10-04-wrk-assistant-dark.png'})
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(2000)
await pg.screenshot({path:'/tmp/e10-05-wrk-settings-dark.png'})
await pg.goto('http://127.0.0.1:4173/profile'); await pg.waitForTimeout(2500)
await pg.screenshot({path:'/tmp/e10-06-wrk-profile-dark.png'})
// ---- WORKER light home ----
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(1500)
await pg.click('button:has-text("Светлая")'); await pg.waitForTimeout(1200)
await pg.goto('http://127.0.0.1:4173/'); await pg.waitForSelector('text=ОСТАЛОСЬ',{timeout:20000}).catch(()=>{}); await pg.waitForTimeout(2000)
await pg.screenshot({path:'/tmp/e10-07-wrk-home-light.png'})
await pg.goto('http://127.0.0.1:4173/settings'); await pg.waitForTimeout(1500)
await pg.click('button:has-text("Тёмная")').catch(()=>{}); await pg.waitForTimeout(800)
await pg.context().close()
// ---- MASTER ----
pg=await (await ctx(1440,900,1)).newPage()
await pg.goto('http://127.0.0.1:4173/login')
await pg.fill('input[type=email]','master@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_MASTER)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(5000)
await pg.screenshot({path:'/tmp/e10-10-mst-board.png'})
for(const [path,name] of [['/review','11-mst-review'],['/issue','12-mst-issue'],['/closed','13-mst-closed'],['/handover','14-mst-handover'],['/report','15-mst-report']]){
  await pg.goto('http://127.0.0.1:4173'+path); await pg.waitForTimeout(2500)
  await pg.screenshot({path:`/tmp/e10-${name}.png`})
}
const ml=pg.locator('a[href^="/orders/"]').first()
if(await ml.count()){await ml.click(); await pg.waitForTimeout(2500); await pg.screenshot({path:'/tmp/e10-16-mst-orderdetail.png'})}
await pg.context().close()
// ---- LEADER ----
pg=await (await ctx(1440,900,1)).newPage()
await pg.goto('http://127.0.0.1:4173/login')
await pg.fill('input[type=email]','leader@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_LEADER)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(5000)
await pg.screenshot({path:'/tmp/e10-20-leader.png'})
await b.close(); console.log('all shots done')
