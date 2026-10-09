import {currentSummary} from '../../lib/manager-summary.mjs'
import {shiftAdvisory} from '../../lib/shift-advisory.mjs'
import {equipmentDowntime} from '../../lib/equipment-downtime.mjs'
import {useLocale} from '../../lib/locale'
import {useOrderState} from '../../lib/use-order-state'
import {withinInstant} from '../../lib/period'
import {isTechnicalTitle, savedPresentation, setPresentation as savePresentation} from '../../lib/presentation'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
import {statusOf, ACTIVE_STATUSES} from '../../lib/status'
import {shiftDoc} from '../../lib/report-docs.ts'
import {buildXlsx, sheetsFromDoc} from '../../lib/xlsx-writer.ts'
import {reportDocToPdf} from '../../lib/report-pdf.ts'
import {loadReportFonts} from '../../lib/report-font.ts'
import {downloadBytes, XLSX_MIME, PDF_MIME} from '../../lib/report-download.ts'
export default function Handover({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

  const [presentation,setPresentation]=useState(savedPresentation)
  const [shift,setShift]=useState(()=>localStorage.getItem('naryadai.handover.shift')||'day');const [date,setDate]=useState(()=>localStorage.getItem('naryadai.handover.date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty'}).format(new Date()));const [section,setSection]=useState(()=>localStorage.getItem('naryadai.handover.section')||'')
  const [exportBusy,setExportBusy]=useState(''),[exportError,setExportError]=useState('')
  const {st,error:stateError,refresh}=useOrderState()
  if(stateError)return <div role="alert" className="p-4 border rounded-xl">{t("Данные недоступны:")} {stateError}<button className="min-h-12 block mt-2 border rounded-xl px-4" onClick={refresh}>{t("Повторить")}</button></div>
  if(!st) return <div className="text-muted py-10">{t("Загрузка…")}</div>
  const now=Date.now()
  const exportShift=async(format:'xlsx'|'pdf')=>{
    if(exportBusy)return
    setExportBusy(format);setExportError('')
    try{
      const doc=shiftDoc(st,{date,shift,section,presentation})
      const stamp=date+'-'+(shift==='day'?'08-20':'20-08')
      if(format==='xlsx')downloadBytes(`tekton-synthetic-shift-${stamp}.xlsx`,buildXlsx(sheetsFromDoc(doc)),XLSX_MIME)
      else{const fonts=await loadReportFonts();downloadBytes(`tekton-synthetic-shift-${stamp}.pdf`,reportDocToPdf(doc,fonts),PDF_MIME)}
    }catch(error){setExportError((error as Error).message||t('Экспорт не удался'))}finally{setExportBusy('')}
  }
  const start=new Date(date+'T'+(shift==='day'?'08:00:00':'20:00:00')+'+05:00');const end=new Date(start.getTime()+12*3600000);const inScope=st.orders.filter((o:any)=>!section||o.section===section);const hiddenN=inScope.filter((o:any)=>isTechnicalTitle(o.title)).length;const scoped=inScope.filter((o:any)=>!presentation||!isTechnicalTitle(o.title))
  const downtime=equipmentDowntime(st.equipment_state_events??null,{since:start.getTime(),until:Math.min(end.getTime(),Date.now()),equipmentIds:st.equipment.filter((e:any)=>!section||e.section===section).map((e:any)=>e.id)})
  const advisory=shiftAdvisory(scoped,now)
  const current=currentSummary(scoped,now)
  const {active,review,overdue}=current
  const closed=scoped.filter((o:any)=>o.status==='closed'&&withinInstant(o.closed_at,start.getTime(),end.getTime())); const scored=closed.filter((o:any)=>o.ai_result?.human_score);
  const byW=st.employees.filter((e:any)=>e.role==='worker').map((w:any)=>({w,list:active.filter((o:any)=>o.assignee_id===w.id)})).filter((x:any)=>x.list.length)
  return <div className="space-y-4 max-w-3xl print:p-0">
    <div className="flex items-end justify-between">
      <div><h1 className="text-[26px] font-bold">{t("Передача смены")}</h1>
        <div className="text-[13px] text-muted">{t("Сформировано")} {new Date().toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'})} {t("· учебный набор данных")}</div></div>
      <div className="flex gap-2 print:hidden"><Button variant="outline" onClick={()=>window.print()}>{t("Печать")}</Button><Button variant="outline" disabled={!!exportBusy} onClick={()=>exportShift('xlsx')}>XLSX</Button><Button variant="outline" disabled={!!exportBusy} onClick={()=>exportShift('pdf')}>PDF</Button></div></div>
    {exportError&&<p role="alert">{exportError}</p>}
    <div className="flex gap-3 flex-wrap print:hidden"><label className="flex gap-2 items-center"><input type="checkbox" checked={presentation} onChange={e=>{setPresentation(e.target.checked);savePresentation(e.target.checked)}}/>{t("Скрыть технические тесты")}</label><label>{t("Дата начала")} <input aria-label={t("Дата смены")} type="date" value={date} onChange={e=>{setDate(e.target.value);localStorage.setItem('naryadai.handover.date',e.target.value)}} className="border border-border rounded-lg p-2"/></label><label>{t("Смена")} <select aria-label={t("Смена")} value={shift} onChange={e=>{setShift(e.target.value);localStorage.setItem('naryadai.handover.shift',e.target.value)}} className="border border-border rounded-lg p-2"><option value="day">08:00-20:00</option><option value="night">{t("20:00-08:00 (+1 день)")}</option></select></label><label>{t("Участок")} <select aria-label={t("Участок передачи")} value={section} onChange={e=>{setSection(e.target.value);localStorage.setItem('naryadai.handover.section',e.target.value)}} className="border border-border rounded-lg p-2"><option value="">{t("Все доступные")}</option>{Array.from(new Set(st.orders.map((o:any)=>o.section))).map(x=><option key={String(x)} value={String(x)}>{String(x)}</option>)}</select></label></div>
    <p className="text-[12px] text-muted">{t("Закрытия за выбранное окно; активные и проверка на сейчас. Время Алматы.")}</p><details className="visual-explain"><summary>{t("Период и состав сводки")}</summary><div>{presentation&&t("Фильтр презентации: скрыто технических нарядов: {v0}. Исходная история не удалена, доступна при выключенном фильтре. ").replace("{v0}",()=>String(hiddenN))}{st.orders.length>=600&&t("Внимание: достигнут лимит 600 нарядов, история может быть неполной. ")}{t("Окно смены:")} {start.toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'})} - {end.toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'})} · Asia/Almaty · {section||t("Все доступные участки")}{t(". 12-часовые окна - настройки демонстрации, не подтверждённый график завода. Закрытия/оценки - за окно; незавершённые наряды - текущий срез, не восстановленная история прошлой смены.")}</div></details>
    <Card><h2 className="font-semibold">{t("Сводка для передачи смены")}</h2><p>{advisory.text}</p>{advisory.actions.map((x:string)=><p key={x}>{x}</p>)}<p className="text-xs text-muted">{advisory.limitations}</p></Card>
    <Card><h2 className="font-semibold">{t("Простой оборудования")}</h2><p>{downtime.minutes===null?'Недостаточно событий состояния':downtime.minutes+' мин за окно'}</p><p className="text-xs text-muted">{t("По отдельным событиям остановки/работы оборудования. Паузы исполнителя и длительность наряда не используются. Охват:")} {downtime.covered}/{downtime.rows.length} {t("узлов.")}</p></Card>
    <Card><h2 className="font-semibold">{t("Закрыто за выбранную смену:")} {closed.length}</h2><p className="text-[13px]">{t("Оценки мастера:")} {scored.length}{scored.length?t(" · средняя ")+(scored.reduce((n:number,o:any)=>n+Number(o.ai_result.human_score),0)/scored.length).toFixed(1)+'/5':''}{t(". Выводы модели не включены.")}</p>{closed.map((o:any)=><div key={o.id} className="text-[13px] border-t border-border py-1">#{o.id} · {o.title} · {o.assignee} · {new Date(o.closed_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'})} {t("· оценка мастера")} {o.ai_result?.human_score??t("нет")}</div>)}</Card>
    <div className="grid grid-cols-3 gap-3">
      <Card><div className="text-[13px] text-muted">{t("Активные")}</div><div className="text-[32px] font-bold">{active.length}</div></Card>
      <Card><div className="text-[13px] text-muted">{t("На проверке")}</div><div className="text-[32px] font-bold">{review.length}</div></Card>
      <Card><div className="text-[13px] text-muted">{t("Просрочено")}</div><div className="text-[32px] font-bold text-danger">{overdue.length}</div></Card>
    </div>
    {overdue.length>0&&<Card className="border-warn/40"><div className="font-semibold text-[14px] mb-1">{t("Просроченные")}</div>
      {overdue.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}{t(", срок")} {new Date(o.deadline).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>)}</Card>}
    {byW.map(({w,list}:any)=><Card key={w.id}><div className="font-semibold text-[14px] mb-1">{w.name}</div>
      {list.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} · {t(statusOf(o.status).label)}</div>)}</Card>)}
    <Card><div className="font-semibold text-[14px] mb-1">{t("Ждут проверки мастером")}</div>
      {review.length?review.map((o:any)=><div key={o.id} className="text-[13px] py-1 border-t border-border first:border-0">#{o.id} · {o.title} — {o.assignee}</div>):<div className="text-[13px] text-muted">{t("Нет")}</div>}</Card>
    <div className="text-[12px] text-muted">{t("Сводка из текущей базы нарядов; не официальный документ.")}</div>
  </div>
}
