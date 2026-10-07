import {chromium} from '@playwright/test'
const b=await chromium.launch()
const pg=await (await b.newContext()).newPage()
await pg.goto('http://127.0.0.1:4199/index.html',{waitUntil:'networkidle',timeout:60000})
console.log(await pg.evaluate(()=>{
  const out=[]
  for(const s of document.styleSheets){
    let n=-1,err=''
    try{n=s.cssRules.length}catch(e){err='blocked'}
    out.push(`${s.href?s.href.slice(0,60):'inline'} rules=${n}${err}`)
  }
  return out.join('\n')
}))
await b.close()
