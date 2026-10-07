import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import type {Actor} from '../../App'
import {LogOut} from 'lucide-react'
export default function Profile({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [rt,setRt]=useState<any|null>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{});H.ratings(new Date(Date.now()-90*86400000).toISOString(),new Date().toISOString()).then(rs=>setRt((rs||[]).find((r:any)=>r.worker_id===actor.id)||null)).catch(()=>{})},[])
  const mine=st?st.orders.filter((o:any)=>o.assignee_id===actor.id):[]
  const closed=mine.filter((o:any)=>o.status==='closed')
  const scored=closed.filter((o:any)=>o.ai_result?.human_score)
  const avg=scored.length?(scored.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/scored.length).toFixed(1):'—'
  const inTime=closed.filter((o:any)=>o.started_at&&o.closed_at&&new Date(o.closed_at)<=new Date(o.deadline)).length
  return <div className="space-y-3">
    <div className="tk-card p-3.5 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-tk-slate text-white flex items-center justify-center text-lg font-black">{actor.name?.[0]||'?'}</div>
      <div><div className="font-black text-sm">{actor.name}</div><div className="text-[0.6875rem]" style={{color:'var(--tk-muted)'}}>Исполнитель · {actor.email}</div></div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[[closed.length,'закрыто'],[closed.length?Math.round(inTime/closed.length*100)+'%':'—','в срок'],[avg,'оценка мастера']].map(([v,l])=>
        <div key={String(l)} className="tk-card p-3 text-center"><div className="text-xl font-black text-tk-amber">{v}</div><div className="text-[0.625rem] font-bold uppercase" style={{color:'var(--tk-muted)'}}>{l}</div></div>)}
    </div>
    {rt&&<div className="tk-card p-3.5 space-y-1">
      <div className="flex items-baseline justify-between"><span className="text-[0.625rem] font-bold uppercase" style={{color:'var(--tk-muted)'}}>Мой рейтинг (пять факторов)</span>
        <span className="text-xl font-black text-tk-amber">{rt.total}</span></div>
      <div className="text-[0.6875rem]" style={{color:'var(--tk-muted)'}}>{rt.explanation}</div>
      <div className="text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Веса: качество 30 · в срок 25 · без доработок 20 · объём и сложность 15 · без отказов 10.</div>
    </div>}
    <div className="tk-card p-3 text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Статистика по доступной истории демо-базы — не аттестация и не рейтинг персонала.</div>
    <button onClick={async()=>{await H.logout();location.reload()}} className="tk-touch tk-sub w-full text-tk-red uppercase text-sm"><LogOut size={19} className="inline mr-1.5"/>Выйти</button>
  </div>
}
