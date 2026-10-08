import {Explain,RatingFactors} from '../../components/VisualBlocks'
import {savedPeriod,setPeriod,periodBounds,within,type PeriodDays} from '../../lib/period'
import {Button} from '../../components/ui/button'
import {useEffect, useMemo, useState} from 'react'
import * as H from '../../lib/data'
import {ACTIVE_STATUSES} from '../../lib/status'
import {Card} from '../../components/ui/card'
import type {Actor} from '../../App'
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell} from 'recharts'
// Explicit allowlist only. No emails, credentials, photo URLs or free-text closure.
function csvCell(value:unknown):string {
 let s=value===null||value===undefined?'':String(value)
 if(/^[\s]*[=+@-]/.test(s))s="'"+s
 return '"'+s.replaceAll('"','""')+'"'
}
function reportCsv(headers:string[],rows:unknown[][]):string {
 return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'
}
function closedOrderCsv(orders:any[],bounds:{since:string,until:string}):string {
 const lo=Date.parse(bounds.since),hi=Date.parse(bounds.until)
 const selected=orders.filter(o=>o.status==='closed'&&Date.parse(o.closed_at)>=lo&&Date.parse(o.closed_at)<hi).sort((a,b)=>Number(a.id)-Number(b.id))
 return reportCsv(['Синтетический отчёт','Период от (включительно)','Период до (не включительно)','Наряд','Оборудование','Участок','Исполнитель','Дата закрытия','Оценка мастера'],selected.map(o=>['Не аттестация персонала',bounds.since,bounds.until,o.id,o.equipment,o.section,o.assignee,o.closed_at,o.ai_result?.human_score??'']))
}
function ratingCsv(rows:any[],bounds:{since:string,until:string}):string {
 return reportCsv(['Синтетический рейтинг','Период от (включительно)','Период до (не включительно)','Исполнитель','Балл','Доступно факторов','Качество','В срок','Без доработок','Объём','Без отказов'],rows.map(r=>['Не аттестация персонала',bounds.since,bounds.until,r.name,r.total,r.factors_available,r.f_quality,r.f_ontime,r.f_rework,r.f_volume,r.f_rejects]))
}

const GREEN='#16402F', ACC='#1F9D63', WARN='#C77E1F', RED='#D23B3B', MUT='#B9B9B2'
export default function Report({actor}:{actor:Actor}){
  const [days,setDays]=useState<PeriodDays>(savedPeriod); const [bounds,setBounds]=useState(()=>periodBounds(savedPeriod()))
  const [refusals,setRefusals]=useState<any[]>([]); const [reviewError,setReviewError]=useState(''); const [reviewBusy,setReviewBusy]=useState(false); const [notes,setNotes]=useState<Record<number,string>>({})
  const refreshRefusals=()=>H.refusalReviews().then(setRefusals).catch(e=>setReviewError(e.message))
  const decide=async(eventId:number,classification:'justified'|'unjustified')=>{setReviewBusy(true);setReviewError('');try{await H.reviewRefusal(eventId,classification,notes[eventId]||'');await refreshRefusals();setBounds(periodBounds(days))}catch(e){setReviewError((e as Error).message);await refreshRefusals()}finally{setReviewBusy(false)}}
  const [st,setSt]=useState<any>(null); const [rt,setRt]=useState<any[]|null>(null); const [an,setAn]=useState<any[]|null>(null)
  const [reportOrders,setReportOrders]=useState<any[]>([]);const [loadError,setLoadError]=useState('');const [loading,setLoading]=useState(true)
  useEffect(()=>{let active=true;setLoading(true);setLoadError('');setRt(null);setAn(null);setRefusals([]);
    Promise.all([H.state(),H.closedReportOrders(bounds.since,bounds.until),H.ratings(bounds.since,bounds.until).catch(()=>null),H.anomalies(bounds.since,bounds.until).catch(()=>null),H.refusalReviews().catch(()=>[])])
      .then(([state,orders,rating,anomaly,refusal])=>{if(active){setReportOrders(orders);setSt(state);setRt(rating);setAn(anomaly);setRefusals(refusal)}}).catch(e=>{if(active)setLoadError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false}
  },[bounds])
  const download=(kind:'orders'|'ratings')=>{if(loading||loadError||!st||(kind==='ratings'&&rt===null))return;const text=kind==='orders'?closedOrderCsv(reportOrders,bounds):ratingCsv(rt||[],bounds);const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='tekton-synthetic-'+kind+'-'+bounds.until.slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  const data=useMemo(()=>{
    if(!st) return null
    const closed=reportOrders.filter((o:any)=>o.status==='closed'&&within(o.closed_at,bounds))
    const buckets: Record<string,number>={}
    for(let i=days;i>=0;i--){const d=new Date(Date.now()-i*86400000);buckets[d.toLocaleDateString('ru',{day:'numeric',month:'short'})]=0}
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
  },[st,reportOrders,bounds,days])
  if(!st||!data) return <div role={loadError?'alert':'status'} className="text-muted py-10">{loadError||'Загрузка…'}</div>
  return <div className="space-y-4">
    <div><h1 className="text-[26px] font-bold">Отчёт и рейтинг</h1>
      <div className="text-[13px] text-muted">Синтетический отчёт · не аттестация</div><label className="text-[13px] flex gap-2 items-center mt-2">Период <select aria-label="Период отчёта" value={days} onChange={e=>{const d=Number(e.target.value) as PeriodDays;setDays(d);setPeriod(d);setBounds(periodBounds(d))}} className="border border-border rounded-[10px] p-2">{[7,30,90].map(n=><option key={n} value={n}>{n} дней</option>)}</select></label><Explain title="Границы периода и источники">{new Date(bounds.since).toLocaleString('ru')} - {new Date(bounds.until).toLocaleString('ru')} · Asia/Almaty. Закрытия и оценки по дате закрытия; сигналы по дате выдачи. Очереди - текущий срез.</Explain></div>
    <div className="flex flex-wrap gap-2"><Button disabled={loading||!!loadError} onClick={()=>download('orders')}>CSV закрытых нарядов</Button><Button variant="outline" disabled={loading||!!loadError||rt===null} onClick={()=>download('ratings')}>CSV рейтинга</Button></div>
    <div className="text-[12px] text-muted">CSV для Excel: выбранный период, UTF-8. Не XLSX/PDF. Только явные поля отчёта, без фото-ссылок, контактов и текста ремонта.</div>
    {loading&&<p role="status" className="text-[13px] text-muted">Обновление периода… экспорт временно отключён.</p>}
    {loadError&&<p role="alert" className="text-[13px] text-danger">{loadError} · экспорт отключён: данные не обновлены.</p>}
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="font-semibold text-[15px] mb-3">Закрытия за {days} дней (скользящее окно)</div>
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
      <div className="visual-tag">Только оценки мастера · нет данных = фактор исключён</div>
      <div className="visual-rating-list mt-4">{(rt||[]).map((r:any)=><article className="visual-rating-card" key={r.worker_id}><div className="visual-rating-head"><div><h3>{r.name}</h3><span className="visual-tag">{r.factors_available}/5 факторов</span></div><div className="visual-rating-score">{r.total??'—'}<small className="block text-[10px] font-normal">из 100</small></div></div><RatingFactors rating={r}/><Explain title="Почему такой балл"><p>{r.explanation}</p><p>Отказы: оправдано {r.rejects_justified} · неоправдано {r.rejects_unjustified} · требуют проверки {r.rejects_unclassified}.</p></Explain></article>)}</div>
      <Explain title="Веса пяти факторов">Качество 30 · в срок 25 · без доработок 20 · объём 15 · без отказов 10. Объём - приближение, не замеренная трудоёмкость. Выводы ИИ не входят в оценку.</Explain>
      {rt===null&&<div className="text-[13px] text-muted py-2">Рейтинг недоступен</div>}
      {rt&&rt.length===0&&<div className="text-[13px] text-muted py-2">Закрытых нарядов за период нет</div>}
    </Card>
    {rt&&rt.length>0&&<Card><h2 className="font-semibold text-[15px] mb-2">Рейтинг бригад</h2>
      <div className="text-[12px] text-muted mb-3">Средний балл исполнителей бригады за период (те же пять факторов). Синтетические демо-данные.</div>
      <div className="overflow-x-auto" role="region" aria-label="Таблица отчёта, прокрутка по горизонтали"><table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">Бригада</th><th>Средний балл</th><th>Исполнителей с рейтингом</th></tr></thead>
      <tbody>{Object.entries((rt||[]).reduce((acc:any,r:any)=>{const b=st.employees.find((x:any)=>x.id===r.worker_id)?.brigade||'Без бригады';(acc[b]=acc[b]||[]).push(r.total);return acc},{})).map(([b,arr]:any)=>{
        const nums=(arr as any[]).filter((x:any)=>typeof x==='number')
        return <tr key={b as string} className="border-t border-border"><td className="py-2.5 font-medium">{b as string}</td>
          <td className="font-bold text-[16px]">{nums.length?Math.round((nums as number[]).reduce((a,c)=>a+c,0)/nums.length*10)/10:'—'}</td>
          <td className="text-[12px] text-muted">{(arr as any[]).length}</td></tr>})}</tbody></table></div>
    </Card>}
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
      <div className="overflow-x-auto" role="region" aria-label="Таблица отчёта, прокрутка по горизонтали"><table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">Исполнитель</th><th>Закрыто</th><th>Средняя оценка</th></tr></thead>
        <tbody>{data.ratings.map((r:any)=><tr key={r.name} className="border-t border-border"><td className="py-2.5">{r.name}</td><td>{r.closed}</td>
          <td className="font-bold">{r.avg?r.avg.toFixed(1)+' / 5':'—'}</td></tr>)}</tbody></table></div>
      {data.ratings.length===0&&<div className="text-[13px] text-muted py-2">Оценок пока нет</div>}
    </Card>
    <div className="text-[12px] text-muted">Сумма дневных столбцов: {data.byDay.reduce((n,x)=>n+x.count,0)} · закрыто в периоде: {data.closedCount}. Закрыто с оценкой: {data.scoredCount} из {data.closedCount}. Графики строятся на синтетических данных.</div>
  </div>
}
