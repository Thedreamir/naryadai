import {useDemoOrders} from '../../components/VisualBlocks'
import {useOrderState} from '../../lib/use-order-state'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Link} from 'react-router-dom'
import {ChevronRight, Timer} from 'lucide-react'
import {PriorChip} from '../../components/PriorChip'
import type {Actor} from '../../App'
import {cn} from '../../lib/utils'
const stLabel:Record<string,string>={issued:'Выдан',queued:'Очередь',accepted:'Принят',in_progress:'В работе',paused:'Пауза',rework:'Доработка'}
export default function WorkerOrders({actor}:{actor:Actor}){
  const {st,error:stateError,refresh}=useOrderState(); const [err,setErr]=useState('')
  const {visible,control}=useDemoOrders(st?.orders||[])
  if(err) return <div className="tk-card p-4 text-tk-red">{err}</div>
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">Данные недоступны: {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="py-10 text-center" style={{color:'var(--tk-muted)'}}>Загрузка…</div>
  const mine=visible.filter((o:any)=>o.assignee_id===actor.id&&['issued','queued','accepted','in_progress','paused','rework'].includes(o.status))
  const active=mine.filter((o:any)=>['in_progress','rework'].includes(o.status))
  const queue=mine.filter((o:any)=>!['in_progress','rework'].includes(o.status))
  const eqName=(o:any)=>o.equipment||st.equipment.find((e:any)=>e.id===o.equipment_id)?.name||'—'
  const row=(o:any,hot:boolean)=><Link key={o.id} to={'/orders/'+o.id} className={cn('tk-card p-3 space-y-2 active:scale-[.99] transition block',hot&&'border-tk-amber')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-black text-xs leading-tight">{o.title}</h3>
        <p className="text-[0.6875rem] mt-0.5" style={{color:'var(--tk-muted)'}}>№ {o.id} · {eqName(o)}</p>
      </div>
      <span className="text-[0.625rem] font-black whitespace-nowrap uppercase" style={{color:'var(--tk-muted)'}}>{stLabel[o.status]||o.status}</span>
    </div>
    <div className="flex items-center justify-between text-[0.625rem]">
      <PriorChip p={o.priority} className="text-[0.625rem]"/>
      <span className="font-bold inline-flex items-center gap-1" style={{color:'var(--tk-muted)'}}><Timer size={19} strokeWidth={2.5}/>{new Date(o.deadline).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
      <ChevronRight size={19} style={{color:'var(--tk-muted)'}}/>
    </div>
  </Link>
  return <div className="space-y-3">{control}{st.offline&&<div role="status" className="tk-card p-3 text-xs text-tk-amber">Офлайн · личный снимок от {new Date(st.cachedAt).toLocaleString('ru')}. Данные могут быть устаревшими. Статусы/допуски онлайн; отчёт можно сохранить черновиком.</div>}
    {mine.length===0&&<div className="tk-card p-6 text-center" style={{color:'var(--tk-muted)'}}>Нет нарядов в этом списке</div>}
    {active.length>0&&<div className="space-y-2">
      <div className="text-[0.6875rem] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>В работе</div>
      {active.map((o:any)=>row(o,true))}
    </div>}
    {queue.length>0&&<div className="space-y-2">
      <div className="text-[0.6875rem] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>Очередь</div>
      {queue.map((o:any)=>row(o,false))}
    </div>}
  </div>
}
