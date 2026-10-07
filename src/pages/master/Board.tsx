import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Badge} from '../../components/ui/badge'
import {cn} from '../../lib/utils'
import {statusOf, ACTIVE_STATUSES} from '../../lib/status'
import {NumberTicker} from '../../components/ui/number-ticker'
import type {Actor} from '../../App'
const T: Record<string,{tone:any,label:string}> = {
  issued:{tone:'teal',label:'Выдан'},queued:{tone:'amber',label:'В очереди'},accepted:{tone:'primary',label:'Принят'},
  in_progress:{tone:'primary',label:'В работе'},paused:{tone:'amber',label:'Пауза'},completed:{tone:'teal',label:'На проверке'},
  ai_review:{tone:'teal',label:'Проверка ИИ'},closed:{tone:'gray',label:'Закрыт'}}
const FILTERS=[['all','Все'],['active','Активные'],['review','Проверка'],['closed','Закрытые']] as const
export default function Board({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [f,setF]=useState<string>('all'); const [rep,setRep]=useState<any[]|null>(null); const [view,setView]=useState<'list'|'kanban'>('list')
  useEffect(()=>{H.state().then(setSt).catch(()=>{})
    H.repeatTop(new Date(Date.now()-90*86400000).toISOString(),new Date().toISOString()).then(setRep).catch(()=>setRep([]))},[])
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const now=Date.now()
  const list = st.orders.filter((o:any)=>f==='all'?o.status!=='closed':f==='active'?ACTIVE_STATUSES.includes(o.status):f==='review'?['completed','ai_review'].includes(o.status):o.status==='closed')
  const overdue = st.orders.filter((o:any)=>o.status!=='closed'&&new Date(o.deadline).getTime()<now)
  const counts={active:st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status)).length,
    work:st.orders.filter((o:any)=>o.status==='in_progress').length,
    review:st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length,
    closed:st.orders.filter((o:any)=>o.status==='closed').length}
  const crew=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>{
    const mine=st.orders.filter((o:any)=>o.assignee_id===w.id&&o.status!=='closed'&&o.status!=='rejected')
    const work=mine.find((o:any)=>['in_progress','paused','rework'].includes(o.status))
    const q=mine.filter((o:any)=>['issued','queued','accepted'].includes(o.status)).length
    const stt=!w.on_shift?{tone:'gray',label:'не на смене'}:work?{tone:'amber',label:(work.status==='paused'?'пауза':'в работе')+' #'+work.id}:q?{tone:'primary',label:'очередь '+q}:{tone:'teal',label:'свободен'}
    return {...w,stt,active:mine.length}})
  const KCOLS:[string,string,(o:any)=>boolean][]=[
    ['issued','Выданные',(o:any)=>o.status==='issued'],
    ['queued','В очереди',(o:any)=>o.status==='queued'],
    ['accepted','Принятые',(o:any)=>o.status==='accepted'],
    ['work','В работе',(o:any)=>['in_progress','paused','rework'].includes(o.status)],
    ['review','Выполненные',(o:any)=>['completed','ai_review'].includes(o.status)],
    ['overdue','Просроченные',(o:any)=>o.status!=='closed'&&o.status!=='rejected'&&new Date(o.deadline).getTime()<now],
  ]
  return <div className="space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold">Наряды смены</h1>
      <div className="text-[13px] text-muted">Каждый переход фиксируется в журнале.</div></div>
      <Link to="/issue" className="bg-primary text-primary-ink h-11 px-5 rounded-[14px] font-semibold inline-flex items-center">+ Выдать наряд</Link></div>
    {overdue.length>0&&<Card className="border-warn/40 bg-warn/5 space-y-1">
      <div className="font-semibold text-[14px]">Контроль сроков</div>
      {overdue.slice(0,5).map((o:any)=><div key={o.id} className="text-[13px] text-warn flex justify-between"><span>Просрочен наряд #{o.id}: {o.title}</span><span>{new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>)}
    </Card>}
    {rep&&rep.length>0&&<Card className="border-primary/40 bg-primary/5 space-y-1.5">
      <div className="flex items-center justify-between"><div className="font-semibold text-[14px]">Контроль повторов: частые повторные закрытия</div>
        <span className="text-[11px] text-muted">индикаторы для анализа причин, не доказанные закономерности</span></div>
      {rep.slice(0,3).map((r:any)=><div key={r.equipment+r.fault_code} className="text-[13px] flex justify-between gap-3">
        <span className="truncate">{r.equipment} · шифр {r.fault_code}</span>
        <span className="text-muted shrink-0">закрыто за 90 дн: {r.closed_count} · пар закрытий в окне повтора: {r.pairs_within_window}</span></div>)}
      <div className="text-[11px] text-muted">Пара = два закрытых наряда на том же оборудовании с тем же шифром в пределах окна повтора (по шифру, по умолчанию 7 дн). Закономерности заложены в синтетические данные для демонстрации. Это сигнал для анализа причин, не оценка исполнителей.</div>
    </Card>}
    <div className="grid grid-cols-4 gap-3">
      {[['Активные',counts.active],['В работе',counts.work],['На проверке',counts.review],['Закрыто',counts.closed]].map(([l,v])=>
        <Card key={l}><div className="text-[13px] text-muted">{l}</div><div className="text-[36px] font-bold leading-tight"><NumberTicker value={v as number}/></div></Card>)}
    </div>
    <div className="text-[12px] text-muted">Счётчики по доступной истории, не по текущей смене</div>
    <Card className="space-y-2">
      <div className="flex items-center justify-between"><div className="font-semibold text-[14px]">Исполнители смены</div>
        <span className="text-[11px] text-muted">зелёный — свободен · жёлтый — в работе · синий — есть очередь · серый — не на смене</span></div>
      <div className="grid grid-cols-3 gap-2">
        {crew.map((w:any)=><div key={w.id} className="flex items-center gap-2 border border-border rounded-[12px] px-3 py-2">
          <span className={cn('w-2.5 h-2.5 rounded-full shrink-0',w.stt.tone==='teal'?'bg-tk-green':w.stt.tone==='amber'?'bg-amber-500':w.stt.tone==='primary'?'bg-sky-500':'bg-gray-400')}/>
          <span className="text-[13px] font-medium truncate">{w.name}</span>
          <span className="text-[11px] text-muted ml-auto shrink-0">{w.stt.label}</span></div>)}
      </div>
    </Card>
    <div className="flex gap-2 items-center flex-wrap">{FILTERS.map(([k,l])=><button key={k} onClick={()=>setF(k)} className={cn('h-10 px-4 rounded-full text-[14px] font-semibold',f===k?'bg-primary text-primary-ink':'bg-surface border border-border')}>{l}</button>)}
      <button onClick={()=>setView(view==='list'?'kanban':'list')} className="h-10 px-4 rounded-full text-[14px] font-semibold bg-surface border border-border ml-auto">{view==='list'?'Канбан':'Список'}</button></div>
    {view==='list'?<div className="grid grid-cols-2 gap-3">
      {list.map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="space-y-1 hover:border-primary/40 transition">
        <div className="flex items-center justify-between"><span className="text-[12px] text-muted">#{o.id} · {o.section}</span><Badge tone={statusOf(o.status).tone as any}>{statusOf(o.status).label}</Badge></div>
        <div className="font-semibold text-[15px]">{o.title}</div>
        <div className="text-[12px] text-muted">{o.equipment} · {o.assignee} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{new Date(o.deadline).getTime()<now&&o.status!=='closed'?' · просрочен':''}</div>
      </Card></Link>)}
    </div>:<div className="grid grid-cols-3 gap-3 items-start">
      {KCOLS.map(([k,label,match])=>{const col=st.orders.filter((o:any)=>{if(o.status==='closed'||o.status==='rejected')return false;const isOD=new Date(o.deadline).getTime()<now;return k==='overdue'?isOD:(!isOD&&match(o))})
        return <div key={k} className="space-y-2">
        <div className={cn('text-[12px] font-semibold uppercase tracking-wide',k==='overdue'?'text-warn':'text-muted')}>{label} · {col.length}</div>
        {col.slice(0,12).map((o:any)=><Link to={'/orders/'+o.id} key={k+o.id}><Card className={cn('space-y-1 !p-3 hover:border-primary/40 transition mb-2',k==='overdue'&&'border-warn/50')}>
          <div className="flex items-center justify-between"><span className="text-[11px] text-muted">#{o.id}</span><Badge tone={statusOf(o.status).tone as any}>{statusOf(o.status).label}</Badge></div>
          <div className="font-semibold text-[13px] leading-snug">{o.title}</div>
          <div className="text-[11px] text-muted">{o.assignee} · {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
        </Card></Link>)}
        {col.length>12&&<div className="text-[11px] text-muted">ещё {col.length-12} — см. список</div>}
      </div>})}
    </div>}
  </div>
}
