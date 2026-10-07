import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {savedPeriod, periodBounds} from '../../lib/period'
import {ACTIVE_STATUSES} from '../../lib/status'
import type {Actor} from '../../App'
export default function LeaderOverview({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [an,setAn]=useState<any[]|null>(null)
  const [bounds]=useState(()=>periodBounds(savedPeriod()))
  useEffect(()=>{H.state().then(setSt).catch(()=>{});H.anomalies(bounds.since,bounds.until).then(setAn).catch(()=>setAn(null))},[bounds])
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const active=st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status))
  const review=st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status))
  const inWork=st.orders.filter((o:any)=>o.status==='in_progress')
  const overdue=active.filter((o:any)=>new Date(o.deadline).getTime()<Date.now())
  const top=(an||[]).slice(0,4)
  return <div className="space-y-[18px]">
    <div className="flex items-end justify-between">
      <div><h1 className="text-[38px] font-bold tracking-[-1.8px] leading-[1.1]">Картина производства.</h1>
        <p className="text-[15px] text-muted mt-2">Сначала отклонения. Затем причины и действия.</p></div>
    </div>
    <div className="grid grid-cols-3 gap-[18px]">
      <Card><div className="text-[12px] text-muted">Активные наряды</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{active.length}</div><div className="text-[12px] text-muted">По доступной истории</div></Card>
      <Card><div className="text-[12px] text-muted">В работе</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{inWork.length}</div><div className="text-[12px] text-muted">Часть активных нарядов</div></Card>
      <Card><div className="text-[12px] text-muted">На проверке</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{review.length}</div><div className="text-[12px] text-muted">Ожидают решения мастера</div></Card>
    </div>
    <div className="grid grid-cols-[1.44fr_1fr] gap-[18px]">
      <Card>
        <div className="flex items-center justify-between mb-4"><h2 className="text-[20px] font-bold tracking-[-0.6px]">Оборудование · сигналы</h2><span className="text-[11px] px-2 py-1 rounded-[7px] bg-[#f1f2f1] text-[#6a736e]">Не диагноз</span></div>
        {top.map((a:any,i:number)=><div key={i} className="py-3 border-t border-border first:border-0">
          <div className="flex items-center gap-2 text-[12px] text-[#67766b]"><span className="h-2 w-2 rounded-full bg-[#c08c41]"/>Нужна проверка причины</div>
          <div className="text-[14px] font-semibold mt-1">{a.subject}</div>
          <div className="text-[12px] text-muted mt-0.5">{a.facts}</div></div>)}
        {top.length===0&&<div className="text-[13px] text-muted">Сигналов за период не найдено.</div>}
        <div className="mt-4 p-3 rounded-[13px] bg-[#f5f7f4] text-[12px] leading-[1.7] text-[#576b5b]">Сигналы помогают выбрать объект для проверки. Подтверждённая причина и простой показываются только с основанием.</div>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-3"><h2 className="text-[20px] font-bold tracking-[-0.6px]">Требуют внимания</h2><span className="text-[11px] px-2 py-1 rounded-[7px] bg-[#fff1de] text-[#935d17]">Сроки</span></div>
        {overdue.slice(0,5).map((o:any)=><div key={o.id} className="p-3 border-l-[3px] border-[#d79639] bg-[#fff8ee] rounded-[10px] mb-2">
          <div className="text-[14px] font-semibold">Наряд #{o.id} · срок пропущен</div>
          <div className="text-[12px] text-muted mt-1">{o.title}<br/>{new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</div></div>)}
        {overdue.length===0&&<div className="text-[13px] text-muted">Просроченных нарядов нет.</div>}
        <div className="text-[12px] text-[#6e7a72] leading-[1.6]">Просрочка и повторная поломка — разные сигналы. Причину устанавливает мастер.</div>
      </Card>
    </div>
    <div className="text-[11px] text-muted">Синтетические данные · тестовое облако · не оперативные данные</div>
  </div>
}
