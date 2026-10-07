import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")')
await pg.waitForTimeout(6000)
await pg.evaluate(()=>{localStorage.setItem('tk-prefs',JSON.stringify({theme:'dark',scale:'160',glove:false}))})
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'}); await pg.waitForTimeout(3000)
const info=await pg.evaluate(()=>{
  const main=document.querySelector('main'); const h2=document.querySelector('h2'); const btn=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('ЗАКРЫТЬ'))
  return {mainW:main?.getBoundingClientRect().width, docW:document.documentElement.clientWidth, scrollW:document.documentElement.scrollWidth,
    h2Font:h2?getComputedStyle(h2).fontSize:null, btnFont:btn?getComputedStyle(btn).fontSize:null,
    bodyClass:document.body.className, htmlFont:getComputedStyle(document.documentElement).fontSize, mainScrollTop:main?.scrollTop}})
console.log(JSON.stringify(info))
await pg.screenshot({path:'/tmp/dbg-scale160.png'})
await b.close()
