import {useOrderState} from '../../lib/use-order-state'
import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Badge} from '../../components/ui/badge'
import {cn} from '../../lib/utils'
import {statusOf, ACTIVE_STATUSES} from '../../lib/status'
import {isTechnicalTitle, savedPresentation, setPresentation} from '../../lib/presentation'
import {NumberTicker} from '../../components/ui/number-ticker'
import type {Actor} from '../../App'
const T: Record<string,{tone:any,label:string}> = {
  issued:{tone:'teal',label:'Выдан'},queued:{tone:'amber',label:'В очереди'},accepted:{tone:'primary',label:'Принят'},
  in_progress:{tone:'primary',label:'В работе'},paused:{tone:'amber',label:'Пауза'},completed:{tone:'teal',label:'На проверке'},
  ai_review:{tone:'teal',label:'Проверка ИИ'},closed:{tone:'gray',label:'Закрыт'}}
const FILTERS=[['all','Все'],['active','Активные'],['review','Проверка'],['closed','Закрытые']] as const
export default function Board({actor}:{actor:Actor}){
  const [filterOpen,setFilterOpen]=useState(false); const [section,setSection]=useState('all'); const [priority,setPriority]=useState('all')
  const {st,error:stateError,refresh}=useOrderState(); const [f,setF]=useState<string>('all'); const [rep,setRep]=useState<any[]|null>(null); const [view,setView]=useState<'list'|'kanban'>('list'); const [pres,setPres]=useState(savedPresentation())
  useEffect(()=>{H.repeatTop(new Date(Date.now()-90*86400000).toISOString(),new Date().toISOString()).then(setRep).catch(()=>setRep([]))},[])
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">Данные недоступны: {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const now=Date.now()
  const visible=pres?st.orders.filter((o:any)=>!isTechnicalTitle(o.title)):st.orders
  const hiddenN=st.orders.length-visible.length
  const scoped=visible.filter((o:any)=>(section==='all'||o.section===section)&&(priority==='all'||o.priority===priority))
  const list = scoped.filter((o:any)=>f==='all'?o.status!=='closed':f==='active'?ACTIVE_STATUSES.includes(o.status):f==='review'?['completed','ai_review'].includes(o.status):o.status==='closed')
  const overdue = visible.filter((o:any)=>o.status!=='closed'&&new Date(o.deadline).getTime()<now)
  const counts={active:visible.filter((o:any)=>ACTIVE_STATUSES.includes(o.status)).length,
    work:visible.filter((o:any)=>o.status==='in_progress').length,
    review:visible.filter((o:any)=>['completed','ai_review'].includes(o.status)).length,
    closed:visible.filter((o:any)=>o.status==='closed').length}
  const crew=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>{
    const mine=visible.filter((o:any)=>o.assignee_id===w.id&&o.status!=='closed'&&o.status!=='rejected')
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
  return <div className="board space-y-5">
    <div className="flex items-end justify-between"><div><h1 className="text-[26px] font-bold">Наряды смены</h1>
      <div className="text-[13px] text-muted">Каждый переход фиксируется в журнале.</div></div>
      <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть технические{pres&&hiddenN>0?` (${hiddenN})`:''}</label><Link to="/issue" className="bg-primary text-primary-ink h-11 px-5 rounded-[13px] font-semibold inline-flex items-center">+ Выдать наряд</Link></div></div>
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
    <div className="flex gap-2 flex-wrap">{st.equipment.map((eq:any)=><Link key={eq.id} to={'/equipment/'+eq.id} className="min-h-11 inline-flex items-center text-[12px] px-3 border border-border rounded-full">{eq.name} · QR</Link>)}</div>
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
    <button className="mobile-filter-button" onClick={()=>setFilterOpen(true)}>Фильтры · {FILTERS.find(x=>x[0]===f)?.[1]} · {list.length}</button>
    {filterOpen&&<div className="workspace-sheet-backdrop" onClick={()=>setFilterOpen(false)}><section className="workspace-sheet" role="dialog" aria-modal="true" aria-label="Фильтры нарядов" onClick={e=>e.stopPropagation()}><h2>Фильтры нарядов</h2><button autoFocus className="sheet-close" onClick={()=>setFilterOpen(false)}>Закрыть</button><label>Статус<select aria-label="Статус" value={f} onChange={e=>setF(e.target.value)}>{FILTERS.map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label>Участок<select aria-label="Участок" value={section} onChange={e=>setSection(e.target.value)}><option value="all">Все участки</option>{[...new Set(visible.map((o:any)=>String(o.section)))].map((x:any)=><option value={x} key={x}>{x}</option>)}</select></label><label>Приоритет<select aria-label="Приоритет" value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">Все</option><option value="normal">Обычный</option><option value="urgent">Срочный</option><option value="emergency">Аварийный</option></select></label><button onClick={()=>{setF('all');setSection('all');setPriority('all')}}>Сбросить</button><button className="filter-apply" onClick={()=>setFilterOpen(false)}>Показать {list.length} нарядов</button></section></div>}
    <div className="board-filter-tabs flex gap-2 items-center flex-wrap">{FILTERS.map(([k,l])=><button key={k} onClick={()=>setF(k)} className={cn('h-10 px-4 rounded-full text-[14px] font-semibold',f===k?'bg-primary text-primary-ink':'bg-surface border border-border')}>{l}</button>)}
      <button onClick={()=>setView(view==='list'?'kanban':'list')} className="h-10 px-4 rounded-full text-[14px] font-semibold bg-surface border border-border ml-auto">{view==='list'?'Канбан':'Список'}</button></div>
    {view==='list'?<div className="grid grid-cols-2 gap-3">
      {list.map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="space-y-1 hover:border-primary/40 transition">
        <div className="flex items-center justify-between"><span className="text-[12px] text-muted">#{o.id} · {o.section}</span><Badge tone={statusOf(o.status).tone as any}>{statusOf(o.status).label}</Badge></div>
        <div className="font-semibold text-[15px]">{o.title}</div>
        <div className="text-[12px] text-muted">{o.equipment} · {o.assignee} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{new Date(o.deadline).getTime()<now&&o.status!=='closed'?' · просрочен':''}</div>
      </Card></Link>)}
    </div>:<div className="grid grid-cols-3 gap-3 items-start">
      {KCOLS.map(([k,label,match])=>{const col=scoped.filter((o:any)=>{if(o.status==='closed'||o.status==='rejected')return false;const isOD=new Date(o.deadline).getTime()<now;return k==='overdue'?isOD:(!isOD&&match(o))})
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
