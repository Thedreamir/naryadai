import {useEffect, useMemo, useState} from 'react'
import * as H from '../../lib/data'
import {ACTIVE_STATUSES} from '../../lib/status'
import {Card} from '../../components/ui/card'
import type {Actor} from '../../App'
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell} from 'recharts'
const GREEN='#16402F', ACC='#1F9D63', WARN='#C77E1F', RED='#D23B3B', MUT='#B9B9B2'
export default function Report({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{})},[])
  const data=useMemo(()=>{
    if(!st) return null
    const closed=st.orders.filter((o:any)=>o.status==='closed'&&o.closed_at)
    const days: Record<string,number>={}
    for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*86400000);days[d.toLocaleDateString('ru',{day:'numeric',month:'short'})]=0}
    closed.forEach((o:any)=>{const k=new Date(o.closed_at).toLocaleDateString('ru',{day:'numeric',month:'short'});if(k in days)days[k]++})
    const byDay=Object.entries(days).map(([d,n])=>({day:d,count:n}))
    const statuses=[['Закрытые',closed.length,GREEN],['Активные',st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status)).length,ACC],['На проверке',st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length,WARN]]
      .filter(x=>x[1] as number>0).map(([name,value,color])=>({name,value,color}))
    const scored=closed.filter((o:any)=>o.ai_result?.human_score)
    const ratings=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>{
      const ws=scored.filter((o:any)=>o.assignee_id===w.id)
      const avg=ws.length?(ws.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/ws.length):null
      return {name:w.name,closed:closed.filter((o:any)=>o.assignee_id===w.id).length,avg}
    }).filter((r:any)=>r.closed>0)
    return {byDay,statuses,ratings,scoredCount:scored.length,closedCount:closed.length}
  },[st])
  if(!st||!data) return <div className="text-muted py-10">Загрузка…</div>
  return <div className="space-y-4">
    <div><h1 className="text-[26px] font-bold">Отчёт и рейтинг</h1>
      <div className="text-[13px] text-muted">По доступной истории демо-базы · не аттестация персонала</div></div>
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="font-semibold text-[15px] mb-3">Закрытия за 7 дней</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.byDay}><XAxis dataKey="day" fontSize={11} tickLine={false}/><YAxis allowDecimals={false} fontSize={11} tickLine={false} width={24}/>
            <Tooltip/><Bar dataKey="count" fill={GREEN} radius={[6,6,0,0]}/></BarChart>
        </ResponsiveContainer></Card>
      <Card><div className="font-semibold text-[15px] mb-3">Статусы нарядов</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart><Pie data={data.statuses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.statuses.map((s:any)=><Cell key={s.name} fill={s.color}/>)}</Pie><Tooltip/></PieChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1.5">
          {data.statuses.map((s:any)=>(
            <div key={s.name} className="flex items-center gap-2 text-[13px] text-zinc-600">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{background:s.color}}/>
              <span>{s.name}</span> · <b className="text-zinc-900">{s.value}</b>
            </div>
          ))}
          {data.statuses.length===0&&<div className="text-[13px] text-muted">Нет нарядов в базе.</div>}
        </div></Card>
    </div>
    <Card><div className="font-semibold text-[15px] mb-2">Оценки мастера по исполнителям</div>
      <div className="text-[12px] text-muted mb-3">Человеческие оценки, выставленные мастером при закрытии. Выводы модели в расчёт не входят.</div>
      <table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">Исполнитель</th><th>Закрыто</th><th>Средняя оценка</th></tr></thead>
        <tbody>{data.ratings.map((r:any)=><tr key={r.name} className="border-t border-border"><td className="py-2.5">{r.name}</td><td>{r.closed}</td>
          <td className="font-bold">{r.avg?r.avg.toFixed(1)+' / 5':'—'}</td></tr>)}</tbody></table>
      {data.ratings.length===0&&<div className="text-[13px] text-muted py-2">Оценок пока нет</div>}
    </Card>
    <div className="text-[12px] text-muted">Закрыто с оценкой: {data.scoredCount} из {data.closedCount}. Графики строятся на синтетических данных.</div>
  </div>
}
