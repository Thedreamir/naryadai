import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Link} from 'react-router-dom'
import {ChevronRight} from 'lucide-react'
import type {Actor} from '../../App'
import {cn} from '../../lib/utils'
const PRIOR:Record<string,string>={emergency:'⚡ Аварийный',high:'⚡ Высокий',normal:'Обычный',planned:'Плановый',medium:'Средний',low:'Низкий'}
const stLabel:Record<string,string>={issued:'Выдан',queued:'Очередь',accepted:'Принят',in_progress:'В работе',paused:'Пауза',rework:'Доработка'}
export default function WorkerOrders({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState('')
  useEffect(()=>{H.state().then(setSt).catch(e=>setErr(e.message))},[])
  if(err) return <div className="tk-card p-4 text-tk-red">{err}</div>
  if(!st) return <div className="py-10 text-center" style={{color:'var(--tk-muted)'}}>Загрузка…</div>
  const mine=st.orders.filter((o:any)=>o.assignee_id===actor.id&&['issued','queued','accepted','in_progress','paused','rework'].includes(o.status))
  const active=mine.filter((o:any)=>['in_progress','rework'].includes(o.status))
  const queue=mine.filter((o:any)=>!['in_progress','rework'].includes(o.status))
  const eqName=(o:any)=>o.equipment||st.equipment.find((e:any)=>e.id===o.equipment_id)?.name||'—'
  const row=(o:any,hot:boolean)=><Link key={o.id} to={'/orders/'+o.id} className={cn('tk-card p-3 space-y-2 active:scale-[.99] transition block',hot&&'border-tk-amber')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-black text-xs leading-tight">{o.title}</h3>
        <p className="text-[11px] mt-0.5" style={{color:'var(--tk-muted)'}}>№ {o.id} · {eqName(o)}</p>
      </div>
      <span className="text-[10px] font-black whitespace-nowrap uppercase" style={{color:'var(--tk-muted)'}}>{stLabel[o.status]||o.status}</span>
    </div>
    <div className="flex items-center justify-between text-[10px]">
      <span className={cn('font-black uppercase',o.priority==='emergency'?'text-tk-red':o.priority==='high'?'text-tk-amber':'')} style={['emergency','high'].includes(o.priority)?undefined:{color:'var(--tk-muted)'}}>{PRIOR[o.priority]||o.priority}</span>
      <span className="font-bold" style={{color:'var(--tk-muted)'}}>⏱ {new Date(o.deadline).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
      <ChevronRight size={13} style={{color:'var(--tk-muted)'}}/>
    </div>
  </Link>
  return <div className="space-y-3">
    {mine.length===0&&<div className="tk-card p-6 text-center" style={{color:'var(--tk-muted)'}}>Нет активных нарядов</div>}
    {active.length>0&&<div className="space-y-2">
      <div className="text-[11px] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>В работе</div>
      {active.map(o=>row(o,true))}
    </div>}
    {queue.length>0&&<div className="space-y-2">
      <div className="text-[11px] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>Очередь</div>
      {queue.map(o=>row(o,false))}
    </div>}
  </div>
}
