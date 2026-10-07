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
const wide=await pg.evaluate(()=>{
  const out=[]
  document.querySelectorAll('main *').forEach(el=>{const w=el.getBoundingClientRect().width; if(w>392)out.push({tag:el.tagName,cls:String(el.className).slice(0,80),w:Math.round(w),text:(el.textContent||'').slice(0,40)})})
  return out.slice(0,12)})
console.log(JSON.stringify(wide,null,1))
await b.close()
