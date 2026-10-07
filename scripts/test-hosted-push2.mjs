import {chromium} from '@playwright/test'
const R={}
const SU=process.env.SUPABASE_URL, SK=process.env.SB_SERVICE, ANON=process.env.SB_ANON, VAPID=process.env.VAPID_PUBLIC
const WC_UID='d6184a48-fc97-46e0-809f-21bd28208074'
const svc=async(p,opt={})=>{const r=await fetch(SU+'/rest/v1/'+p,{...opt,headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json',...(opt.headers||{})}});return r}
const b=await chromium.launch({channel:'chrome',headless:false,args:['--no-sandbox']})
const ctx=await b.newContext({viewport:{width:1280,height:800},serviceWorkers:'allow',permissions:['notifications']})
const pg=await ctx.newPage()
await pg.goto('https://naryadai-app-demo.surge.sh/',{waitUntil:'networkidle',timeout:45000})
await pg.locator('input').first().click({clickCount:3})
await pg.locator('input').first().fill('worker-c@naryadai.test')
await pg.locator('input[type=password]').fill(process.env.PW_WORKERC)
await pg.getByRole('button',{name:'Войти'}).click()
await pg.waitForSelector('text=Демо-исполнитель',{timeout:15000})
R.login='worker-c OK'; R.permission=await pg.evaluate(()=>Notification.permission)
// replicate the app's exact subscribe path (button handler logic) with the user session
R.subscribe=await pg.evaluate(async({SU,ANON,VAPID})=>{
  try{
    if(await Notification.requestPermission()!=='granted')return 'permission not granted'
    const reg=await navigator.serviceWorker.ready
    const key=(s=>{const p='='.repeat((4-s.length%4)%4);const b2=(s+p).replace(/-/g,'+').replace(/_/g,'/');const r=atob(b2);const o=new Uint8Array(r.length);for(let i=0;i<r.length;++i)o[i]=r.charCodeAt(i);return o})(VAPID)
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})
    const j=sub.toJSON()
    // user JWT from supabase auth storage
    const k=Object.keys(localStorage).find(x=>x.startsWith('sb-')&&x.endsWith('-auth-token'))
    const tok=JSON.parse(localStorage.getItem(k)).access_token
    // same write the app does: upsert own push_subscriptions row via REST+RLS
    const r=await fetch(SU+'/rest/v1/push_subscriptions',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+tok,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth})})
    return 'subscribed; REST upsert status '+r.status+'; endpoint '+j.endpoint.slice(0,55)
  }catch(e){return 'FAILED: '+e.name+' '+e.message}
},{SU,ANON,VAPID})
await pg.waitForTimeout(1000)
const db=await svc('push_subscriptions?user_id=eq.'+WC_UID+'&select=id,endpoint,created_at')
R.dbRows=await db.json()
await pg.screenshot({path:'/tmp/hosted-push-subscribed.png'})
// cleanup my own test artifacts
R.unsub=await pg.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();return s?(await s.unsubscribe()?'unsubscribed':'unsub-failed'):'none'})
R.dbDelete=(await svc('push_subscriptions?user_id=eq.'+WC_UID,{method:'DELETE'})).status
await b.close()
console.log(JSON.stringify(R,null,2))
