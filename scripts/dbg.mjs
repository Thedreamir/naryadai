import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.fill('input[type=email]','worker-a@naryadai.test')
await pg.fill('input[type=password]',process.env.PW_WORKERA)
await pg.click('button:has-text("Войти")'); await pg.waitForTimeout(7000)
const info=await pg.evaluate(()=>{
  const out=[]
  document.querySelectorAll('nav a').forEach(a=>{
    const svg=a.querySelector('svg'); const path=svg?.querySelector('path')
    out.push({label:a.textContent.trim(), aColor:getComputedStyle(a).color, spanColor:getComputedStyle(a.querySelector('span')).color, svgColor:getComputedStyle(svg).color, svgFill:getComputedStyle(svg).fill, svgStroke:getComputedStyle(svg).stroke, pathFill:path?getComputedStyle(path).fill:null, pathStroke:path?getComputedStyle(path).stroke:null, outer:svg?.outerHTML.slice(0,180)})
  })
  return out
})
console.log(JSON.stringify(info,null,1))
await b.close()
