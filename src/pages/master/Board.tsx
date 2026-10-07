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
  const [st,setSt]=useState<any>(null); const [f,setF]=useState<string>('all'); const [rep,setRep]=useState<any[]|null>(null)
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
    <div className="flex gap-2">{FILTERS.map(([k,l])=><button key={k} onClick={()=>setF(k)} className={cn('h-10 px-4 rounded-full text-[14px] font-semibold',f===k?'bg-primary text-primary-ink':'bg-surface border border-border')}>{l}</button>)}</div>
    <div className="grid grid-cols-2 gap-3">
      {list.map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="space-y-1 hover:border-primary/40 transition">
        <div className="flex items-center justify-between"><span className="text-[12px] text-muted">#{o.id} · {o.section}</span><Badge tone={statusOf(o.status).tone as any}>{statusOf(o.status).label}</Badge></div>
        <div className="font-semibold text-[15px]">{o.title}</div>
        <div className="text-[12px] text-muted">{o.equipment} · {o.assignee} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{new Date(o.deadline).getTime()<now&&o.status!=='closed'?' · просрочен':''}</div>
      </Card></Link>)}
    </div>
  </div>
}
