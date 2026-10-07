import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext()).newPage()
await pg.goto('http://127.0.0.1:4199/index.html',{waitUntil:'domcontentloaded',timeout:60000})
console.log(await pg.evaluate(()=>{
  const sheets=[...document.styleSheets].filter(s=>!s.href)
  return sheets.map(s=>[...s.cssRules].map(r=>r.cssText.slice(0,60)).join('\n')).join('\n---\n')
}))
await b.close()
