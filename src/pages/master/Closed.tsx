import {useDemoOrders} from '../../components/VisualBlocks'
import {useOrderState} from '../../lib/use-order-state'
import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
export default function Closed({actor}:{actor:Actor}){
  const {st,error:stateError,refresh}=useOrderState()
  const {visible,control}=useDemoOrders(st?.orders||[])
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">Данные недоступны: {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const list=visible.filter((o:any)=>o.status==='closed')
  return <div className="space-y-4">{control}
    <div><h1 className="text-[26px] font-bold">Закрытые наряды</h1>
      <div className="text-[13px] text-muted">{list.length} по доступной истории</div></div>
    <div className="space-y-2 max-w-3xl">{list.slice(0,50).map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="flex items-center gap-4 hover:border-primary/40 transition">
      <div className="flex-1 min-w-0"><div className="font-semibold truncate">{o.title}</div>
        <div className="text-[12px] text-muted">#{o.id} · {o.assignee} · {o.equipment}</div></div>
      <div className="text-right">
        {o.ai_result?.human_score?<Badge tone="primary">{o.ai_result.human_score} / 5</Badge>:<Badge tone="gray">без оценки</Badge>}
        <div className="text-[11px] text-muted mt-1">{o.closed_at?new Date(o.closed_at).toLocaleString('ru',{day:'numeric',month:'short'}):''}</div>
      </div></Card></Link>)}</div>
    {list.length>50&&<div className="text-[12px] text-muted">Показаны первые 50 из {list.length}</div>}
  </div>
}
