import {useOrderState} from '../../lib/use-order-state'
import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
export default function Review({actor}:{actor:Actor}){
  const {st,error:stateError,refresh}=useOrderState()
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">Данные недоступны: {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const list=st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status))
  return <div className="space-y-4">
    <div><h1 className="text-[26px] font-bold">Очередь проверки</h1>
      <div className="text-[13px] text-muted">Наряды, ожидающие решения мастера · {list.length}</div></div>
    {list.length===0&&<Card className="border-dashed text-center text-muted py-10">Очередь пуста — все наряды проверены</Card>}
    <div className="space-y-3 max-w-3xl">{list.map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="space-y-1 hover:border-primary/40 transition">
      <div className="flex items-center justify-between"><span className="text-[12px] text-muted">#{o.id} · {o.assignee}</span>
        <Badge tone={o.status==='completed'?'teal':'primary'}>{o.status==='completed'?'Ждёт проверки':o.ai_result?.mode==='live'?'Проверка ИИ':o.ai_result?.mode==='cache'?'Проверка ИИ (кэш)':o.ai_result?.mode==='rules'?'Проверка по правилам':'Проверка'}</Badge></div>
      <div className="font-semibold text-[16px]">{o.title}</div>
      <div className="text-[12px] text-muted">{o.equipment} · {o.section}</div>
      {o.ai_result&&<div className="text-[13px]">{o.ai_result.mode==='rules'?(o.ai_result.verdict==='rework'?'Правила: требует доработки':o.ai_result.verdict==='accepted_with_notes'?'Правила: принято с замечаниями':'Правила: нужна проверка мастером'):(o.ai_result.verdict==='rework'?'ИИ: требует доработки':o.ai_result.verdict==='accepted_with_notes'?'ИИ: принято с замечаниями':'ИИ: нужна проверка мастером')} <span className="text-muted">({o.ai_result.mode==='live'?'модель':o.ai_result.mode==='cache'?'кэш модели':'правила, модель не участвовала'})</span></div>}
    </Card></Link>)}</div>
  </div>
}
