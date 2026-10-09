import {useLocale} from '../../lib/locale'
import {Explain,RatingFactors} from '../../components/VisualBlocks'
import {savedPeriod,setPeriod,periodBounds,within,type PeriodDays} from '../../lib/period'
import {Button} from '../../components/ui/button'
import {useEffect, useMemo, useState} from 'react'
import * as H from '../../lib/data'
import {ACTIVE_STATUSES} from '../../lib/status'
import {Card} from '../../components/ui/card'
import type {Actor} from '../../App'
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell} from 'recharts'
import {closedOrdersDoc, ratingDoc} from '../../lib/report-docs.ts'
import {buildXlsx, sheetsFromDoc} from '../../lib/xlsx-writer.ts'
import {reportDocToPdf} from '../../lib/report-pdf.ts'
import {loadReportFonts} from '../../lib/report-font.ts'
import {downloadBytes, XLSX_MIME, PDF_MIME} from '../../lib/report-download.ts'
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
 return reportCsv(['Отчёт по учебному набору','Период от (включительно)','Период до (не включительно)','Наряд','Оборудование','Участок','Исполнитель','Дата закрытия','Оценка мастера'],selected.map(o=>['Не аттестация персонала',bounds.since,bounds.until,o.id,o.equipment,o.section,o.assignee,o.closed_at,o.ai_result?.human_score??'']))
}
function ratingCsv(rows:any[],bounds:{since:string,until:string}):string {
 return reportCsv(['Рейтинг по учебному набору','Период от (включительно)','Период до (не включительно)','Исполнитель','Балл','Доступно факторов','Качество','В срок','Без доработок','Объём','Без отказов'],rows.map(r=>['Не аттестация персонала',bounds.since,bounds.until,r.name,r.total,r.factors_available,r.f_quality,r.f_ontime,r.f_rework,r.f_volume,r.f_rejects]))
}

const GREEN='#16402F', ACC='#1F9D63', WARN='#C77E1F', RED='#D23B3B', MUT='#B9B9B2'
export default function Report({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

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
  const [richBusy,setRichBusy]=useState(''); const [richErr,setRichErr]=useState('')
  const downloadRich=async(kind:'orders'|'ratings',format:'xlsx'|'pdf')=>{
    if(loading||loadError||!st||(kind==='ratings'&&rt===null)||richBusy)return
    setRichBusy(kind+format); setRichErr('')
    try{
      const doc=kind==='orders'?closedOrdersDoc(reportOrders,bounds):ratingDoc(rt||[],bounds)
      const stamp=bounds.until.slice(0,10)
      if(format==='xlsx'){downloadBytes(`tekton-synthetic-${kind}-${stamp}.xlsx`,buildXlsx(sheetsFromDoc(doc)),XLSX_MIME)}
      else{const fonts=await loadReportFonts();downloadBytes(`tekton-synthetic-${kind}-${stamp}.pdf`,reportDocToPdf(doc,fonts),PDF_MIME)}
    }catch(e){setRichErr((e as Error).message||t('Экспорт не удался'))}
    finally{setRichBusy('')}
  }
  const data=useMemo(()=>{
    if(!st) return null
    const closed=reportOrders.filter((o:any)=>o.status==='closed'&&within(o.closed_at,bounds))
    const buckets: Record<string,number>={}
    for(let i=days;i>=0;i--){const d=new Date(Date.now()-i*86400000);buckets[d.toLocaleDateString(locale==='kz'?'kk-KZ':'ru-RU',{day:'numeric',month:'short'})]=0}
    closed.forEach((o:any)=>{const k=new Date(o.closed_at).toLocaleDateString(locale==='kz'?'kk-KZ':'ru-RU',{day:'numeric',month:'short'});if(k in buckets)buckets[k]++})
    const byDay=Object.entries(buckets).map(([d,n])=>({day:d,count:n}))
    const statuses=[['Закрытые',closed.length,GREEN],['Активные',st.orders.filter((o:any)=>ACTIVE_STATUSES.includes(o.status)).length,ACC],['На проверке',st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length,WARN]]
      .filter(x=>x[1] as number>0).map(([name,value,color])=>({name:t(String(name)),value,color}))
    const scored=closed.filter((o:any)=>o.ai_result?.human_score)
    const ratings=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>{
      const ws=scored.filter((o:any)=>o.assignee_id===w.id)
      const avg=ws.length?(ws.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/ws.length):null
      return {name:w.name,closed:closed.filter((o:any)=>o.assignee_id===w.id).length,avg}
    }).filter((r:any)=>r.closed>0)
    return {byDay,statuses,ratings,scoredCount:scored.length,closedCount:closed.length}
  },[st,reportOrders,bounds,days,locale])
  if(!st||!data) return <div role={loadError?'alert':'status'} className="text-muted py-10">{loadError||t("Загрузка…")}</div>
  return <div className="space-y-4">
    <div><h1 className="text-[26px] font-bold">{t("Отчёт и рейтинг")}</h1>
      <div className="text-[13px] text-muted">{t("Отчёт по учебному набору · не аттестация")}</div><label className="text-[13px] flex gap-2 items-center mt-2">{t("Период")} <select aria-label={t("Период отчёта")} value={days} onChange={e=>{const d=Number(e.target.value) as PeriodDays;setDays(d);setPeriod(d);setBounds(periodBounds(d))}} className="border border-border rounded-[10px] p-2">{[7,30,90].map(n=><option key={n} value={n}>{n} {t("дней")}</option>)}</select></label><Explain title={t("Границы периода и источники")}>{new Date(bounds.since).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')} - {new Date(bounds.until).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')} {t("· Asia/Almaty. Закрытия и оценки по дате закрытия; сигналы по дате выдачи. Очереди - текущий срез.")}</Explain></div>
    <div className="flex flex-wrap gap-2"><Button disabled={loading||!!loadError} onClick={()=>download('orders')}>{t("CSV закрытых нарядов")}</Button><Button variant="outline" disabled={loading||!!loadError||rt===null} onClick={()=>download('ratings')}>{t("CSV рейтинга")}</Button><Button variant="outline" disabled={loading||!!loadError||!!richBusy} onClick={()=>downloadRich('orders','xlsx')}>{t("XLSX закрытых нарядов")}</Button><Button variant="outline" disabled={loading||!!loadError||!!richBusy} onClick={()=>downloadRich('orders','pdf')}>{t("PDF закрытых нарядов")}</Button><Button variant="outline" disabled={loading||!!loadError||rt===null||!!richBusy} onClick={()=>downloadRich('ratings','xlsx')}>{t("XLSX рейтинга")}</Button><Button variant="outline" disabled={loading||!!loadError||rt===null||!!richBusy} onClick={()=>downloadRich('ratings','pdf')}>{t("PDF рейтинга")}</Button></div>
    <div className="text-[12px] text-muted">{t("CSV/XLSX/PDF за выбранный период, UTF-8, кириллица встроена в PDF. Только явные поля отчёта, без фото-ссылок, контактов и текста ремонта.")}</div>
    {richErr&&<p role="alert" className="text-[12px] text-danger">{richErr}</p>}
    {loading&&<p role="status" className="text-[13px] text-muted">{t("Обновление периода… экспорт временно отключён.")}</p>}
    {loadError&&<p role="alert" className="text-[13px] text-danger">{loadError} {t("· экспорт отключён: данные не обновлены.")}</p>}
    <div className="grid grid-cols-2 gap-4">
      <Card><div className="font-semibold text-[15px] mb-3">{t("Закрытия за")} {days} {t("дней (скользящее окно)")}</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.byDay}><XAxis dataKey="day" fontSize={11} tickLine={false}/><YAxis allowDecimals={false} fontSize={11} tickLine={false} width={24}/>
            <Tooltip/><Bar isAnimationActive={false} dataKey="count" fill={GREEN} radius={[6,6,0,0]}/></BarChart>
        </ResponsiveContainer></Card>
      <Card><div className="font-semibold text-[15px] mb-3">{t("Закрытия периода и текущие очереди")}</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart><Pie isAnimationActive={false} data={data.statuses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.statuses.map((s:any)=><Cell key={s.name} fill={s.color}/>)}</Pie><Tooltip/></PieChart>
        </ResponsiveContainer>
        <div className="mt-2 space-y-1.5">
          {data.statuses.map((s:any)=>(
            <div key={s.name} className="flex items-center gap-2 text-[13px] text-zinc-600">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{background:s.color}}/>
              <span>{t(s.name)}</span> · <b className="text-zinc-900">{s.value}</b>
            </div>
          ))}
          {data.statuses.length===0&&<div className="text-[13px] text-muted">{t("Нет нарядов в базе.")}</div>}
        </div></Card>
    </div>
    <Card><div className="font-semibold text-[15px] mb-2">{t("Рейтинг исполнителей (пять факторов)")}</div>
      <div className="visual-tag">{rt&&rt.length>0&&<b>{Math.min(...rt.map((r:any)=>r.factors_available))} {t('из 5 факторов доступны')} · </b>}{t("Только оценки мастера · нет данных = фактор исключён")}</div>
      <div className="visual-rating-list mt-4">{(rt||[]).map((r:any)=><article className="visual-rating-card" key={r.worker_id}><div className="visual-rating-head"><div><h3>{r.name}</h3><span className="visual-tag">{r.factors_available}{t("/5 факторов")}</span></div><div className="visual-rating-score">{r.total??'—'}<small className="block text-[10px] font-normal">{t("из 100")}</small></div></div><RatingFactors rating={r}/><Explain title={t("Почему такой балл")}><p>{r.explanation}</p><p>{t("Отказы: оправдано")} {r.rejects_justified} {t("· неоправдано")} {r.rejects_unjustified} {t("· требуют проверки")} {r.rejects_unclassified}.</p></Explain></article>)}</div>
      <Explain title={t("Веса пяти факторов")}>{t("Качество 30 · в срок 25 · без доработок 20 · объём 15 · без отказов 10. Объём - приближение, не замеренная трудоёмкость. Выводы ИИ не входят в оценку.")}</Explain>
      {rt===null&&<div className="text-[13px] text-muted py-2">{t("Рейтинг недоступен")}</div>}
      {rt&&rt.length===0&&<div className="text-[13px] text-muted py-2">{t("Закрытых нарядов за период нет")}</div>}
    </Card>
    {rt&&rt.length>0&&<Card><h2 className="font-semibold text-[15px] mb-2">{t("Рейтинг бригад")}</h2>
      <div className="text-[12px] text-muted mb-3">{t("Средний балл исполнителей бригады за период (те же пять факторов). Источник: учебный набор данных.")}</div>
      <div className="overflow-x-auto" role="region" aria-label={t("Таблица отчёта, прокрутка по горизонтали")}><table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">{t("Бригада")}</th><th>{t("Средний балл")}</th><th>{t("Исполнителей с рейтингом")}</th></tr></thead>
      <tbody>{Object.entries((rt||[]).reduce((acc:any,r:any)=>{const b=st.employees.find((x:any)=>x.id===r.worker_id)?.brigade||t('Без бригады');(acc[b]=acc[b]||[]).push(r.total);return acc},{})).map(([b,arr]:any)=>{
        const nums=(arr as any[]).filter((x:any)=>typeof x==='number')
        return <tr key={b as string} className="border-t border-border"><td className="py-2.5 font-medium">{b as string}</td>
          <td className="font-bold text-[16px]">{nums.length?Math.round((nums as number[]).reduce((a,c)=>a+c,0)/nums.length*10)/10:'—'}</td>
          <td className="text-[12px] text-muted">{(arr as any[]).length}</td></tr>})}</tbody></table></div>
    </Card>}
    <Card><h2 className="font-semibold text-[15px] mb-2">{t("Причины отказов: проверка мастером")}</h2>
      <p className="text-[12px] text-muted mb-3">{t("Исходная причина и автор события неизменны. Неизвестные причины исключают фактор отказов, пока мастер не подтвердит решение. Объём рейтинга - приближение относительно лучшего исполнителя за период, не норматив трудоёмкости.")}</p>
      {reviewError&&<p role="alert" className="text-danger text-[13px]">{reviewError}</p>}
      <div className="space-y-3">{refusals.filter(e=>within(e.created_at,bounds)&&e.reason && !['no_materials','no_permit','busy_emergency','wrong_specialty','unjustified'].includes(e.reason.split(':')[0])).map(e=><div key={e.id} data-refusal-event={e.id} className="border border-border rounded-[12px] p-3">
        <div className="text-[13px] font-medium">{t("Событие #")}{e.id} {t("· наряд #")}{e.order_id} · {st.employees.find((x:any)=>x.id===e.actor_id)?.name||e.actor_id}</div>
        <div className="text-[13px] mt-1">{t("Исходная причина:")} {e.reason}</div>
        <div className="text-[12px] text-muted">{new Date(e.created_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')} {t("· источник: журнал отказов")}</div>
        {e.review?<div className="text-[13px] mt-2">{t("Решение мастера:")} {e.review.classification==='justified'?t("Оправдан"):t("Неоправдан")} · {e.review.note}<div className="text-muted text-[12px]">{st.employees.find((x:any)=>x.id===e.review.reviewer_id)?.name||e.review.reviewer_id} · {new Date(e.review.reviewed_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')}</div></div>:
          actor.role==='master'||actor.role==='admin'?<div className="mt-2 space-y-2"><input aria-label={t("Основание решения")} className="w-full border border-border rounded-[10px] p-3" placeholder={t("Основание решения (не менее 3 символов)")} value={notes[e.id]||''} onChange={x=>setNotes({...notes,[e.id]:x.target.value})}/><div className="flex gap-2"><Button disabled={reviewBusy||(notes[e.id]||'').trim().length<3} onClick={()=>decide(e.id,'justified')}>{t("Подтвердить причину")}</Button><Button variant="outline" disabled={reviewBusy||(notes[e.id]||'').trim().length<3} onClick={()=>decide(e.id,'unjustified')}>{t("Отказ неоправдан")}</Button></div></div>:<div className="text-[12px] text-muted">{t("Ожидает решения мастера. Руководителю доступен только просмотр.")}</div>}
      </div>)}</div>
      {refusals.filter(e=>within(e.created_at,bounds)&&e.reason && !['no_materials','no_permit','busy_emergency','wrong_specialty','unjustified'].includes(e.reason.split(':')[0])).length===0&&<p className="text-muted text-[13px]">{t("Спорных причин нет.")}</p>}
    </Card>
    <Card><div className="font-semibold text-[15px] mb-2">{t("Аномалии и рекомендации (")}{days} {t("дней)")}</div>
      <div className="text-[12px] text-muted mb-3">{t("Правила и статистика по истории учебного набора, не вывод ИИ-модели. Каждый сигнал — повод для анализа, не доказанная закономерность; закономерности заложены в учебный набор данных для демонстрации.")}</div>
      <div className="space-y-2.5">
        {(an||[]).map((a:any,i:number)=><div key={i} className="border border-border rounded-[12px] p-3">
          <div className="text-[13px] font-semibold">{{top_equipment:t("Топ проблемного оборудования"),repeat_fault:t("Повторная неисправность"),post_pm_failure:t("Поломки после ППР"),material_outlier:t("Аномальный расход материала")}[a.kind as string]||a.kind} · {a.subject}</div>
          <div className="text-[12px] text-muted">{a.facts}</div>
          <div className="text-[12px] mt-0.5">{a.recommendation}</div>
        </div>)}
        {an&&an.length===0&&<div className="text-[13px] text-muted">{t("Сигналов за период не найдено")}</div>}
        {an===null&&<div className="text-[13px] text-muted">{t("Аналитика недоступна")}</div>}
      </div>
    </Card>
    <Card><div className="font-semibold text-[15px] mb-2">{t("Оценки мастера по исполнителям")}</div>
      <div className="text-[12px] text-muted mb-3">{t("Человеческие оценки, выставленные мастером при закрытии. Выводы модели в расчёт не входят.")}</div>
      <div className="overflow-x-auto" role="region" aria-label={t("Таблица отчёта, прокрутка по горизонтали")}><table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-muted"><th className="py-2">{t("Исполнитель")}</th><th>{t("Закрыто")}</th><th>{t("Средняя оценка")}</th></tr></thead>
        <tbody>{data.ratings.map((r:any)=><tr key={r.name} className="border-t border-border"><td className="py-2.5">{r.name}</td><td>{r.closed}</td>
          <td className="font-bold">{r.avg?r.avg.toFixed(1)+' / 5':'—'}</td></tr>)}</tbody></table></div>
      {data.ratings.length===0&&<div className="text-[13px] text-muted py-2">{t("Оценок пока нет")}</div>}
    </Card>
    <div className="text-[12px] text-muted">{t("Сумма дневных столбцов:")} {data.byDay.reduce((n,x)=>n+x.count,0)} {t("· закрыто в периоде:")} {data.closedCount}{t(". Закрыто с оценкой:")} {data.scoredCount} {t("из")} {data.closedCount}{t(". Графики строятся на учебном наборе данных.")}</div>
  </div>
}