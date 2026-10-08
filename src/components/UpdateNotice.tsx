import {useEffect,useState} from 'react'
export default function UpdateNotice(){
 const [available,setAvailable]=useState(false)
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return
  const hadController=!!navigator.serviceWorker.controller
  let stopped=false,reg:ServiceWorkerRegistration|undefined
  const changed=()=>{if(hadController&&!stopped)setAvailable(true)}
  const check=()=>{if(reg?.waiting&&!stopped)setAvailable(true)}
  const found=()=>{const installing=reg?.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'&&hadController&&!stopped)setAvailable(true)})}
  navigator.serviceWorker.addEventListener('controllerchange',changed)
  navigator.serviceWorker.ready.then(r=>{if(stopped)return;reg=r;check();reg.addEventListener('updatefound',found)}).catch(()=>{})
  return()=>{stopped=true;navigator.serviceWorker.removeEventListener('controllerchange',changed);reg?.removeEventListener('updatefound',found)}
 },[])
 if(!available)return null
 return <aside className="app-update-notice" role="status"><div><strong>Есть обновление</strong><span>Сначала сохраните черновик, затем обновите приложение.</span></div><button onClick={()=>location.reload()}>Обновить</button><button aria-label="Закрыть уведомление об обновлении" onClick={()=>setAvailable(false)}>×</button></aside>
}
