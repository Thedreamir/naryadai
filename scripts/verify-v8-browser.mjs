import {chromium} from '@playwright/test'
const R={}
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',permissions:['notifications']})
const pg=await ctx.newPage()
await pg.addInitScript((v)=>{window.__VAPID=v}, process.env.VAPID_PUBLIC||'')
await pg.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'})
// 1. SW registration
try{
  await pg.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(Error('timeout')),10000))])})
  R.sw='registered'
}catch(e){R.sw='FAILED: '+e.message}
R.manifest=await pg.evaluate(async()=>{const l=document.querySelector('link[rel=manifest]');if(!l)return 'missing';const r=await fetch(l.href);const m=await r.json();return `ok: name="${m.name}", icons=${(m.icons||[]).length}, display=${m.display}`})
// 2. notification permission + push subscribe attempt
R.notifPermission=await pg.evaluate(()=>typeof Notification!=='undefined'?Notification.permission:'unsupported')
R.pushAttempt=await pg.evaluate(async()=>{
  try{
    const reg=await navigator.serviceWorker.ready
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:(function(s){const p='='.repeat((4-s.length%4)%4);const b=(s+p).replace(/-/g,'+').replace(/_/g,'/');const r=atob(b);const o=new Uint8Array(r.length);for(let i=0;i<r.length;++i)o[i]=r.charCodeAt(i);return o})(window.__VAPID||'')})
    return 'subscribed: '+sub.endpoint.slice(0,60)
  }catch(e){return 'subscribe failed: '+e.name+' '+e.message}
})
// 3. voice API presence
R.speechAPI=await pg.evaluate(()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!SR)return 'SpeechRecognition API absent in this browser'
  try{const r=new SR();r.start();return 'constructed+started without immediate error'}catch(e){return 'present, start() threw: '+e.name+' '+e.message}
})
// 4. offline shell
await pg.reload(); await pg.waitForTimeout(800)
await ctx.setOffline(true)
await pg.reload()
try{await pg.waitForSelector('text=НарядAI',{timeout:8000}); R.offline='shell renders offline (login screen from SW cache)'}
catch(e){R.offline='FAILED: '+e.message}
R.offlineBody=(await pg.locator('body').innerText()).slice(0,80).replace(/\n/g,' | ')
await pg.screenshot({path:'/tmp/v8-offline.png'})
await b.close()
console.log(JSON.stringify(R,null,2))
