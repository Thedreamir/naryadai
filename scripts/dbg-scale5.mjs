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
  const main=document.querySelector('main');const root=document.getElementById('root');const shell=root.firstElementChild
  const g=(el)=>el?Math.round(el.getBoundingClientRect().width):null
  const mcs=getComputedStyle(main)
  return {html:document.documentElement.clientWidth, body:g(document.body), root:g(root), shell:g(shell), main:g(main), mainMaxW:mcs.maxWidth, mainW:mcs.width, innerW:innerWidth}})
console.log(JSON.stringify(i))
await b.close()
