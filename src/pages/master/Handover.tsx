import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
import {statusOf, ACTIVE_STATUSES} from '../../lib/status'
export default function Handover({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{})},[])
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const now=Date.now()
  const active=st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status))
  const review=st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status))
  const overdue=active.filter((o:any)=>new Date(o.deadline).getTime()<now)
  const byW=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>({w,list:active.filter((o:any)=>o.assignee_id===w.id)})).filter((x:any)=>x.list.length)
  return <div className="space-y-4 max-w-3xl print:p-0">
    <div className="flex items-end justify-between">
      <div><h1 className="text-[26px] font-bold">Передача смены</h1>
        <div className="text-[13px] text-muted">Сформировано {new Date().toLocaleString('ru')} · синтетические данные</div></div>
      <Button variant="outline" onClick={()=>window.print()}>Печать</Button></div>
    <div className="grid grid-cols-3 gap-3">
      <Card><div className="text-[13px] text-muted">Активные</div><div className="text-[32px] font-bold">{active.length}</div></Card>
      <Card><div className="text-[13px] text-muted">На проверке</div><div className="text-[32px] font-bold">{review.length}</div></Card>
      <Card><div className="text-[13px] text-muted">Просрочено</div><div className="text-[32px] font-bold text-danger">{overdue.length}</div></Card>
    </div>
    {overdue.length>0&&<Card className="border-warn/40"><div className="font-semibold text-[14px] mb-1">Просроченные</div>
      {overdue.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}, срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>)}</Card>}
    {byW.map(({w,list}:any)=><Card key={w.id}><div className="font-semibold text-[14px] mb-1">{w.name}</div>
      {list.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} · {statusOf(o.status).label}</div>)}</Card>)}
    <Card><div className="font-semibold text-[14px] mb-1">Ждут проверки мастером</div>
      {review.length?review.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}</div>):<div className="text-[13px] text-muted">Нет</div>}</Card>
    <div className="text-[12px] text-muted">Сводка из текущего состояния демо-базы; не официальный документ.</div>
  </div>
}
