import {useOrderState} from '../../lib/use-order-state'
import {withinInstant} from '../../lib/period'
import {isTechnicalTitle, savedPresentation, setPresentation as savePresentation} from '../../lib/presentation'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
import {statusOf, ACTIVE_STATUSES} from '../../lib/status'
export default function Handover({actor}:{actor:Actor}){
  const [presentation,setPresentation]=useState(savedPresentation)
  const [shift,setShift]=useState(()=>localStorage.getItem('naryadai.handover.shift')||'day');const [date,setDate]=useState(()=>localStorage.getItem('naryadai.handover.date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty'}).format(new Date()));const [section,setSection]=useState(()=>localStorage.getItem('naryadai.handover.section')||'')
  const {st,error:stateError,refresh}=useOrderState()
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">Данные недоступны: {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const now=Date.now()
  const start=new Date(date+'T'+(shift==='day'?'08:00:00':'20:00:00')+'+05:00');const end=new Date(start.getTime()+12*3600000);const inScope=st.orders.filter((o:any)=>!section||o.section===section);const hiddenN=inScope.filter((o:any)=>isTechnicalTitle(o.title)).length;const scoped=inScope.filter((o:any)=>!presentation||!isTechnicalTitle(o.title))
  const active=scoped.filter((o:any)=>ACTIVE_STATUSES.includes(o.status))
  const review=scoped.filter((o:any)=>['completed','ai_review'].includes(o.status))
  const overdue=active.filter((o:any)=>new Date(o.deadline).getTime()<now)
  const closed=scoped.filter((o:any)=>o.status==='closed'&&withinInstant(o.closed_at,start.getTime(),end.getTime())); const scored=closed.filter((o:any)=>o.ai_result?.human_score);
  const byW=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>({w,list:active.filter((o:any)=>o.assignee_id===w.id)})).filter((x:any)=>x.list.length)
  return <div className="space-y-4 max-w-3xl print:p-0">
    <div className="flex items-end justify-between">
      <div><h1 className="text-[26px] font-bold">Передача смены</h1>
        <div className="text-[13px] text-muted">Сформировано {new Date().toLocaleString('ru',{timeZone:'Asia/Almaty'})} · учебный набор данных</div></div>
      <Button className="print:hidden" variant="outline" onClick={()=>window.print()}>Печать</Button></div>
    <div className="flex gap-3 flex-wrap print:hidden"><label className="flex gap-2 items-center"><input type="checkbox" checked={presentation} onChange={e=>{setPresentation(e.target.checked);savePresentation(e.target.checked)}}/>Скрыть технические тесты</label><label>Дата начала <input aria-label="Дата смены" type="date" value={date} onChange={e=>{setDate(e.target.value);localStorage.setItem('naryadai.handover.date',e.target.value)}} className="border border-border rounded-lg p-2"/></label><label>Смена <select aria-label="Смена" value={shift} onChange={e=>{setShift(e.target.value);localStorage.setItem('naryadai.handover.shift',e.target.value)}} className="border border-border rounded-lg p-2"><option value="day">08:00-20:00</option><option value="night">20:00-08:00 (+1 день)</option></select></label><label>Участок <select aria-label="Участок передачи" value={section} onChange={e=>{setSection(e.target.value);localStorage.setItem('naryadai.handover.section',e.target.value)}} className="border border-border rounded-lg p-2"><option value="">Все доступные</option>{Array.from(new Set(st.orders.map((o:any)=>o.section))).map(x=><option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label></div>
    <p className="text-[12px] text-muted">Закрытия за выбранное окно; активные и проверка на сейчас. Время Алматы.</p><details className="visual-explain"><summary>Период и состав сводки</summary><div>{presentation&&`Фильтр презентации: скрыто технических нарядов: ${hiddenN}. Исходная история не удалена, доступна при выключенном фильтре. `}{st.orders.length>=600&&"Внимание: достигнут лимит 600 нарядов, история может быть неполной. "}Окно смены: {start.toLocaleString('ru',{timeZone:'Asia/Almaty'})} - {end.toLocaleString('ru',{timeZone:'Asia/Almaty'})} · Asia/Almaty · {section||'Все доступные участки'}. 12-часовые окна - настройки демонстрации, не подтверждённый график завода. Закрытия/оценки - за окно; незавершённые наряды - текущий срез, не восстановленная история прошлой смены.</div></details>
    <Card><h2 className="font-semibold">Закрыто за выбранную смену: {closed.length}</h2><p className="text-[13px]">Оценки мастера: {scored.length}{scored.length?' · средняя '+(scored.reduce((n:number,o:any)=>n+Number(o.ai_result.human_score),0)/scored.length).toFixed(1)+'/5':''}. Выводы модели не включены.</p>{closed.map((o:any)=><div key={o.id} className="text-[13px] border-t border-border py-1">#{o.id} · {o.title} · {o.assignee} · {new Date(o.closed_at).toLocaleString('ru',{timeZone:'Asia/Almaty'})} · оценка мастера {o.ai_result?.human_score??'нет'}</div>)}</Card>
    <div className="grid grid-cols-3 gap-3">
      <Card><div className="text-[13px] text-muted">Активные</div><div className="text-[32px] font-bold">{active.length}</div></Card>
      <Card><div className="text-[13px] text-muted">На проверке</div><div className="text-[32px] font-bold">{review.length}</div></Card>
      <Card><div className="text-[13px] text-muted">Просрочено</div><div className="text-[32px] font-bold text-danger">{overdue.length}</div></Card>
    </div>
    {overdue.length>0&&<Card className="border-warn/40"><div className="font-semibold text-[14px] mb-1">Просроченные</div>
      {overdue.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}, срок {new Date(o.deadline).toLocaleString('ru',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>)}</Card>}
    {byW.map(({w,list}:any)=><Card key={w.id}><div className="font-semibold text-[14px] mb-1">{w.name}</div>
      {list.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} · {statusOf(o.status).label}</div>)}</Card>)}
    <Card><div className="font-semibold text-[14px] mb-1">Ждут проверки мастером</div>
      {review.length?review.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}</div>):<div className="text-[13px] text-muted">Нет</div>}</Card>
    <div className="text-[12px] text-muted">Сводка из текущей базы нарядов; не официальный документ.</div>
  </div>
}
