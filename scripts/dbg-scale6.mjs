import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForTimeout(5000)
await pg.evaluate(()=>{localStorage.setItem('tk-prefs',JSON.stringify({theme:'dark',scale:'160',glove:false}))})
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'}); await pg.waitForTimeout(2500)
const i=await pg.evaluate(()=>{
  const chain=[];let el=document.querySelector('main')
  while(el){const cs=getComputedStyle(el);if(cs.transform!=='none'||cs.zoom!=='normal'||cs.scale!=='none'||cs.willChange!=='auto')chain.push({tag:el.tagName,cls:String(el.className).slice(0,50),transform:cs.transform,zoom:cs.zoom,scale:cs.scale,willChange:cs.willChange});el=el.parentElement}
  return {chain, htmlZoom:getComputedStyle(document.documentElement).zoom, bodyZoom:getComputedStyle(document.body).zoom}})
console.log(JSON.stringify(i))
await b.close()
