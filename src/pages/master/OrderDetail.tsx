import {useEffect, useState} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
import {statusOf, eventLabel} from '../../lib/status'
export default function MasterOrderDetail({actor}:{actor:Actor}){
  const {id}=useParams(); const nav=useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [score,setScore]=useState(4); const [compare,setCompare]=useState(false)
  const load=()=>H.state().then(setSt).catch(e=>setErr(e.message))
  useEffect(()=>{load()},[id])
  if(err) return <Card className="text-danger">{err}</Card>
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const o=st.orders.find((x:any)=>x.id===Number(id))
  if(!o) return <Card>Наряд не найден.</Card>
  const go=async(status:string,reason?:string,extra?:any)=>{setBusy(true);setErr('')
    try{await H.transition(o.id,{status,version:o.version,reason,...extra});await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const before:string[]=o.before_photos||[]; const after:string[]=(o.closure?.photos)||[]
  return <div className="space-y-4 max-w-3xl">
    <button className="text-muted text-[14px]" onClick={()=>nav(-1)}>← Назад</button>
    <div><div className="text-[12px] text-muted">НАРЯД #{o.id} · {o.section} · {o.assignee}</div>
      <h1 className="text-[24px] font-bold">{o.title}</h1>
      <div className="text-[14px] text-muted">{o.equipment} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · статус: {statusOf(o.status).label}</div></div>
    {(before.length>0||after.length>0)&&<Card className="space-y-3">
      <div className="flex items-center justify-between"><div className="font-semibold text-[15px]">Фото до / после</div>
        {before.length>0&&after.length>0&&<Button variant="outline" onClick={()=>setCompare(c=>!c)}>{compare?'Обычный вид':'Сравнить до/после'}</Button>}</div>
      {compare&&before.length>0&&after.length>0?
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-[12px] text-muted mb-1">До</div>{before.map((p,i)=><img key={i} src={p} className="rounded-[14px] w-full" alt="Фото до"/>)}</div>
          <div><div className="text-[12px] text-muted mb-1">После</div>{after.map((p,i)=><img key={i} src={p} className="rounded-[14px] w-full" alt="Фото после"/>)}</div>
        </div>:
        <div className="flex gap-3 flex-wrap">{before.length===0&&after.length>0&&<div className="text-[13px] text-muted self-center">Фото до отсутствует — сравнение недоступно.</div>}{before.map((p,i)=><div key={'b'+i}><div className="text-[12px] text-muted mb-1">До</div><img src={p} className="h-36 rounded-[14px]" alt="Фото до"/></div>)}
        {after.map((p,i)=><div key={'a'+i}><div className="text-[12px] text-muted mb-1">После</div><img src={p} className="h-36 rounded-[14px]" alt="Фото после"/></div>)}</div>}
      {o.closure?.photo_evidence?.map((p:any)=><div key={p.sha256} className="text-[12px] text-muted">Фото получено сервером: {new Date(p.server_received_at).toLocaleString('ru')} · {Math.round(p.byte_size/1024)} КБ.{p.duplicate_order_id?` Совпадает с фото наряда #${p.duplicate_order_id}.`:''} Время съёмки не подтверждено.</div>)}
    </Card>}
    {o.closure?.works&&<Card><div className="font-semibold text-[15px] mb-1">Выполненные работы</div>
      <div className="text-[14px]">{o.closure.works}</div>
      {o.closure.fault_code&&<div className="text-[13px] text-muted mt-1">Шифр: {o.closure.fault_code}</div>}</Card>}
    {o.status==='completed'&&<Card className="space-y-3 border-primary/40">
      <div className="font-semibold text-[15px]">Проверка закрытия</div>
      <Button size="big" className="w-full" disabled={busy} onClick={()=>go('ai_review')}>Проверить закрытие (ИИ)</Button>
      <div className="text-[12px] text-muted">Ответ языковой модели — не решение; при сбое сработает проверка по правилам. Решение принимает мастер.</div>
    </Card>}
    {o.ai_result&&<Card className="space-y-2">
      <div className="flex items-center gap-2"><span className="font-semibold text-[15px]">Карточка оснований</span>
        {(o.ai_result.mode==='live'||o.ai_result.mode==='cache')?<Badge tone="teal">Вывод ИИ · не решение</Badge>:<Badge tone="gray">Проверка по правилам · не решение</Badge>}</div>
      {o.ai_result.mode==='live'&&<div className="font-semibold">Модель считает: {o.ai_result.verdict==='rework'?'«Требует доработки»':o.ai_result.verdict==='accepted_with_notes'?'«Принято с замечаниями»':'«Нужна проверка мастером»'}</div>}
      {o.ai_result.mode==='cache'&&<div className="font-semibold">Модель считала ранее (ответ из кэша проверок): {o.ai_result.verdict==='rework'?'«Требует доработки»':o.ai_result.verdict==='accepted_with_notes'?'«Принято с замечаниями»':'«Нужна проверка мастером»'}</div>}
      {o.ai_result.mode!=='live'&&o.ai_result.mode!=='cache'&&<div className="font-semibold">Формальная проверка по правилам: {o.ai_result.verdict==='rework'?'«Требует доработки»':o.ai_result.verdict==='accepted_with_notes'?'«Принято с замечаниями»':'«Нужна проверка мастером»'}</div>}
      <div className="text-[12px] text-muted">{o.ai_result.mode==='live'?'Утверждения ниже — вывод модели по описанию и фото, не подтверждённый осмотром':o.ai_result.mode==='cache'?'Утверждения ниже — кэшированный вывод модели от более ранней идентичной проверки, не повторный ответ модели':'Основания ниже — результат формальной проверки полей закрытия по правилам. Модель не участвовала.'}{o.ai_result.model&&(o.ai_result.mode==='live'||o.ai_result.mode==='cache')?' · '+o.ai_result.model:''}</div>
      <ul className="list-disc pl-5 text-[14px] space-y-0.5">{o.ai_result.reasons.map((r:string)=><li key={r}>{r}</li>)}</ul>
      <div className="text-[12px] text-muted">{o.ai_result.mode==='live'?'Ответ языковой модели. Физический ремонт не подтверждён, оценка не калибрована.':o.ai_result.mode==='cache'?'Повторный ответ из кэша проверок. Физический ремонт не подтверждён.':'Проверка по правилам, модель не участвовала.'}{o.ai_result.fallback_reason?' '+o.ai_result.fallback_reason:''}</div>
    </Card>}
    {['ai_review','completed'].includes(o.status)&&<Card className="space-y-3">
      <div className="font-semibold text-[15px]">Решение мастера</div>
      <div className="flex items-center gap-3"><span className="text-[14px]">Оценка:</span>
        <div className="flex gap-1">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setScore(n)} className={"h-12 w-12 rounded-[12px] font-bold "+(score===n?'bg-primary text-primary-ink':'bg-surface border border-border')}>{n}</button>)}</div></div>
      <Button size="big" className="w-full" disabled={busy} onClick={()=>go('closed',undefined,{human_score:score})}>Закрыть наряд</Button>
      <Button size="big" variant="outline" className="w-full" disabled={busy} onClick={()=>{const r=prompt('Причина возврата на доработку');if(r)go('in_progress',r)}}>Вернуть на доработку</Button>
    </Card>}
    <Card><div className="font-semibold text-[14px] mb-2">Журнал действий</div>
      {st.events.filter((e:any)=>e.order_id===o.id).map((e:any)=><div key={e.id} className="text-[12px] text-muted py-1 border-t border-border first:border-0">{e.actor} · {eventLabel(e.new_status)} · {new Date(e.created_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{e.reason?' · '+e.reason:''}</div>)}</Card>
  </div>
}
