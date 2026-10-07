import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage()
await pg.goto('http://127.0.0.1:4199/index.html',{waitUntil:'networkidle',timeout:60000})
await pg.waitForTimeout(2000)
console.log(await pg.evaluate(()=>{
  const sheets=[...document.styleSheets].filter(s=>!s.href)
  const custom=sheets[sheets.length-1]
  const rules=[...custom.cssRules].map(r=>r.selectorText||r.cssText.slice(0,40)).join(', ')
  const v=document.querySelector('#app-viewport')
  const cs=getComputedStyle(v)
  const bs=getComputedStyle(document.body)
  return 'CUSTOM: '+rules+'\nVIEWPORT: w='+v.offsetWidth+' maxW='+cs.maxWidth+' width='+cs.width+' mw='+cs.minWidth+'\nBODY: bg='+bs.backgroundColor+' display='+bs.display+' fontSize='+bs.fontSize
}))
await b.close()
