import {useLocale} from '../lib/locale'
import {useEffect, useState} from 'react'
import * as H from '../lib/data'
function urlBase64ToUint8Array(base64String:string){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const rawData=window.atob(base64);const out=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;++i)out[i]=rawData.charCodeAt(i);return out}
type St='checking'|'unsupported'|'denied'|'subscribed'|'ready'|'error'
export default function PushButton(){
  const {t}=useLocale()
  const [st,setSt]=useState<St>('checking')
  const [errMsg,setErrMsg]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    if(typeof Notification==='undefined'||!('serviceWorker' in navigator)||!('PushManager' in window)){setSt('unsupported');return}
    if(Notification.permission==='denied'){setSt('denied');return}
    // granted or default: check for a live subscription so a failed past attempt is retryable
    navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>setSt(s?'subscribed':'ready')).catch(()=>setSt('ready'))
  },[])
  const enable=async()=>{setBusy(true);setErrMsg('')
    try{
      const p=await Notification.requestPermission()
      if(p==='denied'){setSt('denied');return}
      if(p!=='granted'){setSt('ready');return}
      const vapid=import.meta.env.VITE_VAPID_PUBLIC as string|undefined
      if(!vapid)throw new Error('нет VAPID-ключа в сборке')
      const reg=await navigator.serviceWorker.ready
      let sub
      try{sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapid)})}
      catch(e){throw new Error('браузер не выдал push-подписку: '+(e as Error).name)}
      try{await H.savePushSubscription(sub.toJSON() as {endpoint:string,keys:{p256dh:string,auth:string}})}
      catch(e){try{await sub.unsubscribe()}catch{};throw new Error('не сохранилась на сервере: '+(e as Error).message)}
      setSt('subscribed')
    }catch(e){setErrMsg((e as Error).message);setSt('error')}finally{setBusy(false)}}
  if(st==='checking')return null
  if(st==='unsupported')return <div className="text-[0.8125rem] text-muted">{t('Уведомления: этот браузер не поддерживает push.')}</div>
  if(st==='subscribed')return <div className="text-[0.8125rem] text-muted">{t('Уведомления включены на этом устройстве. Доставка зависит от браузера и ОС.')}</div>
  if(st==='denied')return <div className="text-[0.8125rem] text-muted">{t('Уведомления заблокированы браузером. Включить можно только в настройках сайта в браузере.')}</div>
  return <div className="space-y-1">
    <button onClick={enable} disabled={busy} className="w-full h-14 rounded-[14px] border border-border bg-surface font-semibold text-[0.9375rem]">{t(busy?'Включаю…':st==='error'?'Попробовать ещё раз':'Включить уведомления')}</button>
    {st==='error'&&<div className="text-[0.8125rem] text-danger">Не получилось включить: {errMsg}. Нажмите «Попробовать ещё раз».</div>}
    {st==='ready'&&Notification.permission==='granted'&&<div className="text-[0.75rem] text-muted">{t('Разрешение уже дано; нажмите кнопку, чтобы завершить подписку.')}</div>}
    <div className="text-[0.75rem] text-muted">{t('Push приходит о новых нарядах. Доставка зависит от браузера и ОС; не гарантируется.')}</div>
  </div>
}
