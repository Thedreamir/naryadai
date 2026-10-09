import {useDemoOrders} from '../../components/VisualBlocks'
import {useOrderState} from '../../lib/use-order-state'
import type {Actor} from '../../App'
import {useLocale} from '../../lib/locale'
import WorkerTaskCard from './WorkerTaskCard'
import {workerOverview} from '../../lib/worker-overview.mjs'
export default function WorkerOrders({actor}:{actor:Actor}){
  const {st,error,refresh}=useOrderState();const {t}=useLocale()
  const {visible,control}=useDemoOrders(st?.orders||[])
  if(error)return <div role="alert" className="wo-overview"><div className="tk-card wo-notice">{t('Данные недоступны')}: {error}<button className="tk-touch tk-sub w-full mt-2" onClick={refresh}>{t('Повторить')}</button></div></div>
  if(!st)return <div role="status">{t('Загрузка нарядов…')}</div>
  // Presentation controls never hide already accepted or active work.
  const workerVisible=st.orders.filter((o:any)=>visible.includes(o)||['accepted','in_progress','paused','rework'].includes(o.status))
  const {mine}=workerOverview(workerVisible,actor.id)
  const active=mine.filter(o=>['in_progress','rework'].includes(o.status))
  const queue=mine.filter(o=>!['in_progress','rework'].includes(o.status))
  return <div className="wo-overview">{control}
    {st.offline&&<div role="status" className="tk-card wo-notice">{t('Офлайн. Данные могут быть устаревшими. Действия и допуски только онлайн.')}</div>}
    {mine.length===0&&<div className="tk-card wo-notice">{t('Нет нарядов в этом списке')}</div>}
    {[[t('В работе'),active],[t('Очередь и приостановленные'),queue]].map(([title,orders])=>(orders as any[]).length>0&&<section className="wo-section" key={title as string}><h2>{title as string} · {(orders as any[]).length}</h2>{(orders as any[]).map(o=><WorkerTaskCard key={o.id} order={o} equipment={st.equipment||[]}/>)}</section>)}
  </div>
}
