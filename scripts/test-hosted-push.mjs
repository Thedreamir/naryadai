import {chromium} from '@playwright/test'
const R={}
const SU=process.env.SUPABASE_URL, SK=process.env.SB_SERVICE
const WC_UID='d6184a48-fc97-46e0-809f-21bd28208074'
const rest=async(p,opt={})=>{const r=await fetch(SU+'/rest/v1/'+p,{...opt,headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json',...(opt.headers||{})}});return r}
const b=await chromium.launch({headless:false,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--no-sandbox']})
const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'allow',permissions:['notifications','microphone']})
const pg=await ctx.newPage()
const logs=[]; pg.on('console',m=>logs.push(m.type()+': '+m.text().slice(0,140)))
await pg.goto('https://naryadai-app-demo.surge.sh/',{waitUntil:'networkidle',timeout:45000})
await pg.locator('input').first().click({clickCount:3})
await pg.locator('input').first().fill('worker-c@naryadai.test')
await pg.locator('input[type=password]').fill(process.env.PW_WORKERC)
await pg.getByRole('button',{name:'Войти'}).click()
try{await pg.waitForSelector('text=Демо-исполнитель',{timeout:15000}); R.login='worker-c OK'}catch(e){R.login='FAILED: '+(await pg.locator('body').innerText()).slice(0,120)}
R.permissionAfterGrant=await pg.evaluate(()=>Notification.permission)
const btn=pg.getByRole('button',{name:/Включить уведомления/})
R.notifButtonVisible=await btn.isVisible().catch(()=>false)
if(R.notifButtonVisible){
  await btn.click()
  await pg.waitForTimeout(5000)
  R.permissionAfterClick=await pg.evaluate(()=>Notification.permission)
  R.notifButtonAfter=await pg.getByRole('button',{name:/Включить уведомления/}).isVisible().catch(()=>false)
  R.subInPage=await pg.evaluate(async()=>{try{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();return s?('endpoint: '+s.endpoint.slice(0,50)):'no subscription in browser'}catch(e){return 'err: '+e.message}})
  await pg.screenshot({path:'/tmp/hosted-push-subscribed.png'})
}
const db=await rest('push_subscriptions?user_id=eq.'+WC_UID+'&select=id,endpoint,created_at')
R.dbRows=await db.json()
R.speech=await pg.evaluate(async()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!SR)return 'absent'
  return await new Promise(res=>{
    const r=new SR(); r.lang='ru-RU'; const out={}
    r.onresult=e=>{out.result=e.results[0][0].transcript}
    r.onerror=e=>{out.error=e.error}
    r.onend=()=>res(out)
    try{r.start(); out.started=true}catch(e){res({throw:e.message})}
    setTimeout(()=>{try{r.stop()}catch{}; if(!out.error&&!out.result)res({...out,note:'no result/error within 8s (fake tone input)'})},8000)
  })
})
R.cleanup=await pg.evaluate(async()=>{try{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();if(s){await s.unsubscribe();return 'unsubscribed'}return 'nothing to unsubscribe'}catch(e){return 'err: '+e.message}})
if(Array.isArray(R.dbRows)&&R.dbRows.length){const del=await rest('push_subscriptions?user_id=eq.'+WC_UID,{method:'DELETE'});R.dbCleanup=del.status}
R.consoleTail=logs.slice(-8)
await b.close()
console.log(JSON.stringify(R,null,2))
