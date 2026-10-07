import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const b=await chromium.launch()
try {
 const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
 await pg.goto('http://127.0.0.1:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/handover"]',{timeout:30000});await pg.goto('http://127.0.0.1:4173/handover')
 await pg.getByLabel('Дата смены').fill('2026-10-07');await pg.getByLabel('Смена',{exact:true}).selectOption('night');await pg.reload();assert.equal(await pg.getByLabel('Дата смены').inputValue(),'2026-10-07');assert.equal(await pg.getByLabel('Смена',{exact:true}).inputValue(),'night');console.log('ok - shift/date reload persistence')
 assert.match(await pg.locator('body').innerText(),/08\.10\.2026, 08:00/);console.log('ok - night shift crosses next day')
 await pg.getByLabel('Смена',{exact:true}).selectOption('day');await pg.screenshot({path:'/tmp/handover-shift.png'})
 await pg.emulateMedia({media:'print'});await pg.screenshot({path:'/tmp/handover-print.png',fullPage:true});await pg.pdf({path:'/tmp/handover-print.pdf',format:'A4',printBackground:true});console.log('ok - print PDF generated; visual inspection required')
} finally {await b.close()}
