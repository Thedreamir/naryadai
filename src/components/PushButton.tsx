import {useEffect, useState} from 'react'
import * as H from '../lib/data'
function urlBase64ToUint8Array(base64String:string){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const rawData=window.atob(base64);const out=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;++i)out[i]=rawData.charCodeAt(i);return out}
export default function PushButton(){
  const [st,setSt]=useState<'default'|'granted'|'denied'|'subscribed'|'unsupported'|'error'>('default')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    if(typeof Notification==='undefined'||!('serviceWorker' in navigator)||!('PushManager' in window)){setSt('unsupported');return}
    setSt(Notification.permission==='granted'?'granted':Notification.permission==='denied'?'denied':'default')
    navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>{if(s)setSt('subscribed')}).catch(()=>{})
  },[])
  const enable=async()=>{setBusy(true)
    try{
      const p=await Notification.requestPermission(); setSt(p==='granted'?'granted':p)
      if(p!=='granted')return
      const vapid=import.meta.env.VITE_VAPID_PUBLIC as string|undefined
      if(!vapid){setSt('error');return}
      const reg=await navigator.serviceWorker.ready
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapid)})
      await H.savePushSubscription(sub.toJSON() as {endpoint:string,keys:{p256dh:string,auth:string}})
      setSt('subscribed')
    }catch{setSt('error')}finally{setBusy(false)}}
  if(st==='unsupported')return <div className="text-[13px] text-muted">Уведомления: браузер не поддерживает push.</div>
  if(st==='subscribed')return <div className="text-[13px] text-muted">Уведомления включены на этом устройстве. Доставка зависит от браузера и ОС.</div>
  if(st==='denied')return <div className="text-[13px] text-muted">Уведомления запрещены в настройках браузера.</div>
  return <div className="space-y-1">
    <button onClick={enable} disabled={busy} className="w-full h-14 rounded-[14px] border border-border bg-surface font-semibold text-[15px]">{busy?'Включаю…':'Включить уведомления'}</button>
    {st==='error'&&<div className="text-[13px] text-danger">Подписка не сохранилась — попробуйте ещё раз.</div>}
    {st==='granted'&&<div className="text-[13px] text-muted">Разрешение есть, завершаю подписку…</div>}
    <div className="text-[12px] text-muted">Push приходит о новых нарядах. Доставка зависит от браузера и ОС; в демо не гарантируется.</div>
  </div>
}
