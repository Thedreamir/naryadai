import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
await pg.goto('http://127.0.0.1:4199/index.html',{waitUntil:'networkidle',timeout:60000})
await pg.waitForTimeout(6000)
console.log(await pg.evaluate(()=>{
  const v=document.querySelector('#app-viewport')
  const h=document.querySelector('header')
  const card=document.querySelector('.app-card')
  const cs=getComputedStyle(v)
  return JSON.stringify({
    viewportW: v.offsetWidth, display: cs.display, flexDir: cs.flexDirection,
    headerDisplay: getComputedStyle(h).display,
    cardBg: card?getComputedStyle(card).backgroundColor:'none',
    bodyBg: getComputedStyle(document.body).backgroundColor
  })
}))
await pg.screenshot({path:'/tmp/dbg-tekton.png'})
await b.close()
