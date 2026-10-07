import {savedPeriod,setPeriod,periodBounds,within,type PeriodDays} from '../../lib/period'
import {Button} from '../../components/ui/button'
import {useEffect, useMemo, useState} from 'react'
import * as H from '../../lib/data'
import {ACTIVE_STATUSES} from '../../lib/status'
import {Card} from '../../components/ui/card'
import type {Actor} from '../../App'
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell} from 'recharts'
const GREEN='#16402F', ACC='#1F9D63', WARN='#C77E1F', RED='#D23B3B', MUT='#B9B9B2'
export default function Report({actor}:{actor:Actor}){
  const [days,setDays]=useState<PeriodDays>(savedPeriod); const [bounds,setBounds]=useState(()=>periodBounds(savedPeriod()))
  const [refusals,setRefusals]=useState<any[]>([]); const [reviewError,setReviewError]=useState(''); const [reviewBusy,setReviewBusy]=useState(false); const [notes,setNotes]=useState<Record<number,string>>({})
  const refreshRefusals=()=>H.refusalReviews().then(setRefusals).catch(e=>setReviewError(e.message))
  const decide=async(eventId:number,classification:'justified'|'unjustified')=>{setReviewBusy(true);setReviewError('');try{await H.reviewRefusal(eventId,classification,notes[eventId]||'');await refreshRefusals();setBounds(periodBounds(days))}catch(e){setReviewError((e as Error).message);await refreshRefusals()}finally{setReviewBusy(false)}}
  const [st,setSt]=useState<any>(null); const [rt,setRt]=useState<any[]|null>(null); const [an,setAn]=useState<any[]|null>(null)
  useEffect(()=>{refreshRefusals();H.state().then(setSt).catch(()=>{});H.ratings(bounds.since,bounds.until).then(setRt).catch(()=>setRt(null));H.anomalies(bounds.since,bounds.until).then(setAn).catch(()=>setAn(null))},[bounds])
  const data=useMemo(()=>{
    if(!st) return null
    const closed=st.orders.filter((o:any)=>o.status==='closed'&&within(o.closed_at,bounds))
    const buckets: Record<string,number>={}
    for(let i=days-1;i>=0;i--){const d=new Date(Date.now()-i*86400000);buckets[d.toLocaleDateString('ru',{day:'numeric',month:'short'})]=0}
    closed.forEach((o:any)=>{const k=new Date(o.closed_at).toLocaleDateString('ru',{day:'numeric',month:'short'});if(k in buckets)buckets[k]++})
    const byDay=Object.entries(buckets).map(([d,n])=>({day:d,count:n}))
    const statuses=[['Закрытые',closed.length,GREEN],['Активные',st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status)).length,ACC],['На проверке',st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length,WARN]]
      .filter(x=>x[1] as number>0).map(([name,value,color])=>({name,value,color}))
    const scored=closed.filter((o:any)=>o.ai_result?.human_score)
    const ratings=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>{
      const ws=scored.filter((o:any)=>o.assignee_id===w.id)
      const avg=ws.length?(ws.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/ws.length):null
      return {name:w.name,closed:closed.filter((o:any)=>o.assignee_id===w.id).length,avg}
    }).filter((r:any)=>r.closed>0)
    return {byDay,statuses,ratings,scoredCount:scored.length,closedCount:closed.length}
  },[st,bounds,days])
  if(!st||!data) return <div className="text-muted py-10">Загрузка…</div>
  return <div className="space-y-4">
    <div><h1 className="text-[26px] font-bold">Отчёт и рейтинг</h1>
      <div className="text-[13px] text-muted">Выбранный период · все доступные участки · не аттестация персонала</div><label className="text-[13px] flex gap-2 items-center mt-2">Период <select aria-label="Период отчёта" value={days} onChange={e=>{const d=Number(e.target.value) as PeriodDays;setDays(d);setPeriod(d);setBounds(periodBounds(d))}} className="border border-border rounded-[10px] p-2">{[7,30,90].map(n=><option key={n} value={n}>{n} дней</option>)}</select></label><div className="text-[12px] text-muted mt-1">{new Date(bounds.since).toLocaleString('ru')} - {new Date(bounds.until).toLocaleString('ru')} · Asia/Almaty. Закрытия/оценки по дате закрытия; сигналы по дате выдачи. Активные и проверка - текущий срез, не события периода.</div></div>
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="font-semibold text-[15px] mb-3">Закрытия за {days} дней</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.byDay}><XAxis dataKey="day" fontSize={11} tickLine={false}/><YAxis allowDecimals={false} fontSize={11} tickLine={false} width={24}/>
            <Tooltip/><Bar isAnimationActive={false} dataKey="count" fill={GREEN} radius={[6,6,0,0]}/></BarChart>
        </ResponsiveContainer></Card>
      <Card><div className="font-semibold text-[15px] mb-3">Закрытия периода и текущие очереди</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart><Pie isAnimationActive={false} data={data.statuses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
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
    <Card><div className="font-semibold text-[15px] mb-2">Рейтинг исполнителей (пять факторов)</div>
      <div className="text-[12px] text-muted mb-3">Веса команды: качество 30 · в срок 25 · без доработок 20 · объём и сложность 15 · без отказов 10. Качество — только оценки мастера; выводы ИИ в балл не входят. Фактор без данных исключается, веса перенормируются — видно в пояснении.</div>
      <table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">Исполнитель</th><th className="min-w-[65px]">Балл</th><th className="min-w-[65px]">Полнота<br/>факторов</th><th>Составляющие</th></tr></thead>
        <tbody>{(rt||[]).map((r:any)=><tr key={r.worker_id} className="border-t border-border align-top"><td className="py-2.5 font-medium">{r.name}</td>
          <td className="font-bold text-[16px]">{r.total??"Нет закрытой работы"}</td><td>{r.factors_available}/5</td>
          <td className="text-[12px] text-muted py-2.5">{r.explanation}<div>Отказы: оправдано {r.rejects_justified} · без причины/неоправдано {r.rejects_unjustified} · требуют проверки {r.rejects_unclassified}. {r.f_rejects===null?"Фактор отказов исключён: данные неполные.":""}</div></td></tr>)}</tbody></table>
      {rt===null&&<div className="text-[13px] text-muted py-2">Рейтинг недоступен</div>}
      {rt&&rt.length===0&&<div className="text-[13px] text-muted py-2">Закрытых нарядов за период нет</div>}
    </Card>
    <Card><h2 className="font-semibold text-[15px] mb-2">Причины отказов: проверка мастером</h2>
      <p className="text-[12px] text-muted mb-3">Исходная причина и автор события неизменны. Неизвестные причины исключают фактор отказов, пока мастер не подтвердит решение. Объём рейтинга - приближение относительно лучшего исполнителя за период, не норматив трудоёмкости.</p>
      {reviewError&&<p role="alert" className="text-danger text-[13px]">{reviewError}</p>}
      <div className="space-y-3">{refusals.filter(e=>within(e.created_at,bounds)&&e.reason && !['no_materials','no_permit','busy_emergency','wrong_specialty','unjustified'].includes(e.reason.split(':')[0])).map(e=><div key={e.id} data-refusal-event={e.id} className="border border-border rounded-[12px] p-3">
        <div className="text-[13px] font-medium">Событие #{e.id} · наряд #{e.order_id} · {st.employees.find((x:any)=>x.id===e.actor_id)?.name||e.actor_id}</div>
        <div className="text-[13px] mt-1">Исходная причина: {e.reason}</div>
        <div className="text-[12px] text-muted">{new Date(e.created_at).toLocaleString('ru')} · источник: журнал отказов</div>
        {e.review?<div className="text-[13px] mt-2">Решение мастера: {e.review.classification==='justified'?'Оправдан':'Неоправдан'} · {e.review.note}<div className="text-muted text-[12px]">{st.employees.find((x:any)=>x.id===e.review.reviewer_id)?.name||e.review.reviewer_id} · {new Date(e.review.reviewed_at).toLocaleString('ru')}</div></div>:
          actor.role==='master'||actor.role==='admin'?<div className="mt-2 space-y-2"><input aria-label="Основание решения" className="w-full border border-border rounded-[10px] p-3" placeholder="Основание решения (не менее 3 символов)" value={notes[e.id]||''} onChange={x=>setNotes({...notes,[e.id]:x.target.value})}/><div className="flex gap-2"><Button disabled={reviewBusy||(notes[e.id]||'').trim().length<3} onClick={()=>decide(e.id,'justified')}>Подтвердить причину</Button><Button variant="outline" disabled={reviewBusy||(notes[e.id]||'').trim().length<3} onClick={()=>decide(e.id,'unjustified')}>Отказ неоправдан</Button></div></div>:<div className="text-[12px] text-muted">Ожидает решения мастера. Руководителю доступен только просмотр.</div>}
      </div>)}</div>
      {refusals.filter(e=>within(e.created_at,bounds)&&e.reason && !['no_materials','no_permit','busy_emergency','wrong_specialty','unjustified'].includes(e.reason.split(':')[0])).length===0&&<p className="text-muted text-[13px]">Спорных причин нет.</p>}
    </Card>
    <Card><div className="font-semibold text-[15px] mb-2">Аномалии и рекомендации ({days} дней)</div>
      <div className="text-[12px] text-muted mb-3">Правила и статистика по демо-истории, не вывод ИИ-модели. Каждый сигнал — повод для анализа, не доказанная закономерность; закономерности заложены в синтетические данные для демонстрации.</div>
      <div className="space-y-2.5">
        {(an||[]).map((a:any,i:number)=><div key={i} className="border border-border rounded-[12px] p-3">
          <div className="text-[13px] font-semibold">{{top_equipment:'Топ проблемного оборудования',repeat_fault:'Повторная неисправность',post_pm_failure:'Поломки после ППР',material_outlier:'Аномальный расход материала'}[a.kind as string]||a.kind} · {a.subject}</div>
          <div className="text-[12px] text-muted">{a.facts}</div>
          <div className="text-[12px] mt-0.5">{a.recommendation}</div>
        </div>)}
        {an&&an.length===0&&<div className="text-[13px] text-muted">Сигналов за период не найдено</div>}
        {an===null&&<div className="text-[13px] text-muted">Аналитика недоступна</div>}
      </div>
    </Card>
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
