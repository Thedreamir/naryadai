import {chromium} from 'playwright'
const b=await chromium.launch(); const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage()
await pg.goto('http://127.0.0.1:4173/login')
await pg.fill('input[type=email]','worker-a@naryadai.test'); await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForSelector('.blink-closed',{timeout:20000})
await pg.waitForSelector('text=ОСТАЛОСЬ',{timeout:20000}).catch(()=>{})
const ct=()=>pg.evaluate(()=>{const a=document.querySelector('.blink-closed').getAnimations()[0];return a?a.currentTime%4800:-1})
const clip={x:158,y:726,width:74,height:84}
let i=0
// lead-in: open-eye frames
for(let k=0;k<8;k++){await pg.screenshot({path:`/tmp/blinkseq/s${String(i++).padStart(3,'0')}.png`,clip}); await pg.waitForTimeout(160)}
// wait for blink start (94% of 4.8s = 4512ms; aim 4460)
for(;;){const t=await ct(); if(t>=4460&&t<4700) break; await pg.waitForTimeout(15)}
for(let k=0;k<12;k++){await pg.screenshot({path:`/tmp/blinkseq/s${String(i++).padStart(3,'0')}.png`,clip}); await pg.waitForTimeout(45)}
for(let k=0;k<6;k++){await pg.screenshot({path:`/tmp/blinkseq/s${String(i++).padStart(3,'0')}.png`,clip}); await pg.waitForTimeout(160)}
await b.close(); console.log('caught',i,'frames')
