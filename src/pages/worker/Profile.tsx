import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
export default function Profile({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{})},[])
  const mine = st?st.orders.filter((o:any)=>o.assignee_id===actor.id):[]
  const closed = mine.filter((o:any)=>o.status==='closed')
  const scored = closed.filter((o:any)=>o.ai_result?.human_score)
  const avg = scored.length?(scored.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/scored.length).toFixed(1):'—'
  const inTime = closed.filter((o:any)=>o.started_at&&o.closed_at&&new Date(o.closed_at)<=new Date(o.deadline)).length
  return <div className="space-y-4">
    <h1 className="text-[24px] font-bold pt-2">Профиль</h1>
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-ink grid place-items-center text-[20px] font-bold">{actor.name?.[0]||'?'}</div>
        <div><div className="font-bold text-[17px]">{actor.name}</div><div className="text-[13px] text-muted">Исполнитель · {actor.email}</div></div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="text-center"><div className="text-[24px] font-bold">{closed.length}</div><div className="text-[12px] text-muted">закрыто</div></div>
        <div className="text-center"><div className="text-[24px] font-bold">{closed.length?Math.round(inTime/closed.length*100)+'%':'—'}</div><div className="text-[12px] text-muted">в срок</div></div>
        <div className="text-center"><div className="text-[24px] font-bold">{avg}</div><div className="text-[12px] text-muted">оценка</div></div>
      </div>
    </Card>
    <Card className="text-[13px] text-muted">Статистика по доступной истории демо-базы, не аттестация.</Card>
    <Button size="big" variant="outline" className="w-full" onClick={async()=>{await H.logout();location.reload()}}>Выйти</Button>
    <div className="text-[12px] text-muted text-center">Синтетические данные · тестовый проект</div>
  </div>
}
