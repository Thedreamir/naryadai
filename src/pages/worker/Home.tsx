import {isTechnicalTitle,savedPresentation} from '../../lib/presentation'
import {useOrderState} from '../../lib/use-order-state'
import {useEffect,useState} from 'react'
import * as H from '../../lib/data'
import {Link} from 'react-router-dom'
import {TriangleAlert} from 'lucide-react'
import type {Actor} from '../../App'
import {useLocale} from '../../lib/locale'
import {workerOverview} from '../../lib/worker-overview.mjs'
import WorkerTaskCard from './WorkerTaskCard'
export default function WorkerHome({actor}:{actor:Actor}){
  const {st,error,refresh}=useOrderState();const {t}=useLocale();const[live,setLive]=useState<any[]>([])
  const[presentation,setPresentation]=useState(savedPresentation)
  useEffect(()=>{const update=()=>setPresentation(savedPresentation());window.addEventListener('naryadai:presentation',update);return()=>window.removeEventListener('naryadai:presentation',update)},[])
  useEffect(()=>H.watchNotifications((n:any)=>setLive(a=>[n,...a].slice(0,20))),[])
  if(error)return <div role="alert" className="wo-overview"><div className="tk-card wo-notice">{t('Данные недоступны')}: {error}<button className="tk-touch tk-sub w-full mt-2" onClick={refresh}>{t('Повторить')}</button></div></div>
  if(!st)return <div role="status">{t('Загрузка нарядов…')}</div>
  const {mine,focus,queue}=workerOverview(st.orders,actor.id,presentation,isTechnicalTitle)
  const alerts=[...live,...(st.notifications||[])].filter((n:any,i:number,a:any[])=>a.findIndex((x:any)=>x.id===n.id)===i)
  const equipment=st.equipment||[]; const emergency=st.orders.find((o:any)=>o.assignee_id===actor.id&&!o.cancelled&&o.priority==='emergency'&&['issued','queued'].includes(o.status))
  return <div className="wo-overview">
    {st.offline&&<div role="status" className="tk-card wo-notice">{t('Офлайн. Данные могут быть устаревшими. Действия и допуски только онлайн.')}</div>}
    {emergency&&<Link to={'/orders/'+emergency.id} className="wo-emergency wo-priority wo-emergency-pinned"><TriangleAlert size={22} aria-hidden="true"/>{t('Аварийный наряд №{id}').replace('{id}',String(emergency.id))}</Link>}
    {focus?<WorkerTaskCard order={focus} equipment={equipment} focus/>:mine.length===0?<section className="tk-card wo-card">
      <h2 className="wo-task-title">{t(mine.length?'Выберите наряд':'Нарядов пока нет')}</h2>
      <p className="wo-next-note">{t(mine.length?'Порядок работы и допуск подтверждает мастер.':'Новые назначения появятся здесь.')}</p>
      {mine.length>0&&<Link to="/orders" className="wo-primary tk-touch">{t('Выбрать наряд')}</Link>}
    </section>:null}
    {queue.length>0&&<section className="wo-section" aria-label={t('Другие наряды')}><h2>{t(focus?'Другие наряды':'Ваши наряды')} · {queue.length}</h2>{queue.map((o:any)=><WorkerTaskCard key={o.id} order={o} equipment={equipment}/>)}</section>}
    <details className="worker-alerts tk-card"><summary><TriangleAlert size={20} aria-hidden="true"/><strong>{t('Уведомления')}</strong><span>{alerts.length}</span></summary><div>{alerts.length?alerts.slice(0,5).map((n:any)=><div key={n.id}><p>{n.message}</p><small>{new Date(n.created_at).toLocaleTimeString('ru',{timeZone:'Asia/Almaty',hour:'2-digit',minute:'2-digit'})}</small></div>):<p>{t('Новых уведомлений нет')}</p>}</div></details>
  </div>
}
