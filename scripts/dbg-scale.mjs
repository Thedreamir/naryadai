import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
await pg.evaluate(()=>document.body.classList.add('scale-160'))
const info=await pg.evaluate(()=>{
  const el=document.createElement('div');el.className='text-sm p-3';el.textContent='x';document.body.appendChild(el)
  const cs=getComputedStyle(el)
  return {fontSize:cs.fontSize,padding:cs.padding,htmlFont:getComputedStyle(document.documentElement).fontSize,bodyFont:getComputedStyle(document.body).fontSize}})
console.log(JSON.stringify(info))
await b.close()
