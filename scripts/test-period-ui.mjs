import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const b=await chromium.launch()
try {
 const pg=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage()
 await pg.goto('http://127.0.0.1:4173/login');await pg.fill('input[type=email]','master@naryadai.test');await pg.fill('input[type=password]',process.env.PW_MASTER);await pg.click('button:has-text("Войти")');await pg.waitForSelector('a[href="/report"]',{timeout:30000});await pg.goto('http://127.0.0.1:4173/report')
 await pg.getByLabel('Период отчёта').selectOption('7');await pg.getByText('Закрытия за 7 дней',{exact:true}).waitFor();await pg.getByText('Аномалии и рекомендации (7 дней)',{exact:true}).waitFor();await pg.reload();assert.equal(await pg.getByLabel('Период отчёта').inputValue(),'7');console.log('ok - report period action + reload persistence')
 await pg.locator('table tbody tr').first().waitFor();await pg.screenshot({path:'/tmp/period-7-report.png'})
 await pg.getByLabel('Период отчёта').selectOption('90');await pg.getByText('Закрытия за 90 дней',{exact:true}).waitFor();console.log('ok - period changes all report headings')
 const requests=[];pg.on('request',r=>{if(r.url().includes('/rpc/worker_rating')||r.url().includes('/rpc/anomaly_report'))requests.push(r.postDataJSON())})
 await pg.getByLabel('Период отчёта').selectOption('30');await pg.getByText('Аномалии и рекомендации (30 дней)',{exact:true}).waitFor();await pg.waitForResponse(r=>r.url().includes('/rpc/anomaly_report'));assert.equal(requests.length,2);assert.equal(requests[0].since,requests[1].since);assert.equal(requests[0].until,requests[1].until);console.log('ok - rating/anomaly exact same source period')
 await pg.getByLabel('Период отчёта').selectOption('90')
} finally {await b.close()}
