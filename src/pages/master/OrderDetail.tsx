import EvidencePassport from '../../components/EvidencePassport'
import {useOrderState} from '../../lib/use-order-state'
import {useLocale} from '../../lib/locale'
import MasterVoiceHint from '../../components/MasterVoiceHint'
import PhotoCompare from '../../components/PhotoCompare'
import {reviewDisplay,reviewArchiveDisplay,reviewPresentation} from '../../lib/ai-review-display.mjs'
import {useEffect, useState} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
import {statusOf, eventLabel} from '../../lib/status'
export default function MasterOrderDetail({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

  const {id}=useParams(); const nav=useNavigate()
  const {st,error:stateError,refresh}=useOrderState(); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [assignee,setAssignee]=useState(''); const [priority,setPriority]=useState('normal'); const [manageReason,setManageReason]=useState('')
  const [archiveReceipt,setArchiveReceipt]=useState<any>(null); const [reworkReason,setReworkReason]=useState(''); const [confirmCancel,setConfirmCancel]=useState(false)
  const [manualOpen,setManualOpen]=useState(false);const [manualFailure,setManualFailure]=useState('');const [manualReason,setManualReason]=useState('');const [manualDecision,setManualDecision]=useState<'close'|'rework'>('close');const [score,setScore]=useState(4); const [compare,setCompare]=useState(false)
  const load=async()=>{refresh()}
  useEffect(()=>{if(stateError)setErr(stateError)},[stateError])
  if(err&&!st) return <Card className="text-danger">{err}</Card>
  if(!st) return <div className="text-muted py-10">{t("Загрузка…")}</div>
  const o=st.orders.find((x:any)=>x.id===Number(id))
  if(!o) return <Card>{t("Наряд не найден.")}</Card>
  const go=async(status:string,reason?:string,extra?:any)=>{setBusy(true);setErr('')
    try{const response=await H.transition(o.id,{status,version:o.version,reason,...extra});if(status==='ai_review')setArchiveReceipt(response);await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const manage=async(action:'reassign'|'priority'|'cancel')=>{if(action==='cancel'&&!confirmCancel){setConfirmCancel(true);return};setBusy(true);setErr('');try{await H.manageOrder(o.id,action,{assignee,priority,reason:manageReason});if(action==='cancel')nav('/');else await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const receipt=archiveReceipt?.version===o.version?archiveReceipt:H.reviewArchiveReceipt(actor.id,o.id,o.version)
  const presentation=reviewPresentation(o.ai_result,receipt)
  const before:string[]=[...(o.before_photos||[]),...(o.intake_photos||[]).filter((p:any)=>p.phase==='before_intake'&&p.url).map((p:any)=>p.url)]; const after:string[]=(o.closure?.photos)||[]
  return <div className="space-y-4 max-w-3xl">{err&&<Card role="alert" className="text-danger">{err}</Card>}
    <button className="text-muted text-[14px]" onClick={()=>nav(-1)}>{t("← Назад")}</button>
    <div><div className="text-[12px] text-muted">{t("НАРЯД #")}{o.id} · {o.section} · {o.assignee}</div>
      <h1 className="text-[24px] font-bold">{o.title}</h1>
      <div className="text-[14px] text-muted">{o.equipment} {t("· срок")} {new Date(o.deadline).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} {t("· статус:")} {t(statusOf(o.status).label)}</div></div>
    <EvidencePassport order={o} events={st.events||[]}/>
    {!['closed','completed','ai_review'].includes(o.status)&&<Card className="space-y-3"><h2 className="font-semibold text-[15px]">{t("Управление нарядом")}</h2><label className="block text-[13px]">{t("Основание")}<input aria-label={t("Основание управления")} className="mt-1 border border-border rounded-[10px] p-3 w-full" value={manageReason} onChange={e=>setManageReason(e.target.value)} placeholder={t("Причина изменения")}/></label>
      {['issued','queued','rejected'].includes(o.status)?<div className="flex gap-2"><select aria-label={t("Новый исполнитель")} className="border border-border rounded-[10px] p-3 flex-1 min-w-0" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">{t("Выберите исполнителя")}</option>{st.employees.filter((e:any)=>e.role==='worker'&&e.is_active&&e.id!==o.assignee_id).map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}</select><Button disabled={busy||!assignee||manageReason.trim().length<3} onClick={()=>manage('reassign')}>{t("Переназначить")}</Button></div>:<p className="text-[12px] text-muted">{t("Переназначение недоступно после принятия: активная работа не передаётся молча.")}</p>}
      <div className="flex gap-2"><select aria-label={t("Новый приоритет")} value={priority} onChange={e=>setPriority(e.target.value)} className="border border-border rounded-[10px] p-3 flex-1">{[['normal',t("Обычный")],['high',t("Высокий")],['emergency',t("Аварийный")],['planned',t("Плановый")]].map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select><Button disabled={busy||priority===o.priority||manageReason.trim().length<3} onClick={()=>manage('priority')}>{t("Изменить приоритет")}</Button></div>
      {confirmCancel&&<p role="alert" className="text-[13px] text-danger">{t("Дальнейшие действия по наряду будут заблокированы. Это не подтверждает остановку физических работ. Нажмите ещё раз для отмены.")}</p>}<Button variant="outline" disabled={busy||manageReason.trim().length<3} onClick={()=>manage('cancel')}>{confirmCancel?t("Подтвердить отмену"):t("Отменить наряд")}</Button><p className="text-[12px] text-muted">{t("Изменения записываются в журнал. Отмена убирает наряд из очередей и блокирует переходы, но не означает физическую остановку работ.")}</p></Card>}
    {o.status==='closed'&&<Card className="final-master-decision space-y-2 border-primary/40"><h2 className="text-xl font-bold">{t("Окончательное решение мастера: закрыт")}</h2><p className="text-lg font-bold">{t("Оценка мастера:")} {o.ai_result?.human_score??t("нет")} / 5</p><p>{t("Дата решения:")} {o.closed_at?new Date(o.closed_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty'}):t("нет")}</p><p>{o.ai_result?.human_comment||t("Основание в журнале действий")}</p><p className="text-xs text-muted">{t("Это решение человека. Предварительная проверка ниже не является текущим статусом.")}</p></Card>}
    {(before.length>0||after.length>0)&&<Card className="space-y-3">
      <div className="flex items-center justify-between"><div className="font-semibold text-[15px]">{t("Фото до / после")}</div>
        {before.length>0&&after.length>0&&<Button variant="outline" onClick={()=>setCompare(c=>!c)}>{compare?t("Обычный вид"):t("Сравнить до/после")}</Button>}</div>
      {compare&&before.length>0&&after.length>0?
        <PhotoCompare before={before[0]} after={after[0]}/>:
        <div className="photo-compare-grid flex gap-3 flex-wrap">{before.length===0&&after.length>0&&<div className="text-[13px] text-muted self-center">{t("Фото до отсутствует — сравнение недоступно.")}</div>}{before.map((p,i)=><div key={'b'+i}><div className="text-[12px] text-muted mb-1">{t("До")}</div><img src={p} className="h-36 rounded-[14px]" alt={t("Фото до")}/></div>)}
        {after.map((p,i)=><div key={'a'+i}><div className="text-[12px] text-muted mb-1">{t("После")}</div><img src={p} className="h-36 rounded-[14px]" alt={t("Фото после")}/></div>)}</div>}
      {o.closure?.photo_evidence?.map((p:any)=><div key={p.sha256} className="text-[12px] text-muted">{t("Фото получено сервером:")} {new Date(p.server_received_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')} · {Math.round(p.byte_size/1024)} {t("КБ.")}{p.duplicate_order_id?t(" Совпадает с фото наряда #{v0}.").replace("{v0}",()=>String(p.duplicate_order_id)):''} {t("Время съёмки не подтверждено.")}</div>)}
    </Card>}
    {o.closure?.works&&<Card><div className="font-semibold text-[15px] mb-1">{t("Выполненные работы")}</div>
      <div className="text-[14px]">{o.closure.works}</div>
      {o.closure.fault_code&&<div className="text-[13px] text-muted mt-1">{t("Шифр:")} {o.closure.fault_code}</div>}</Card>}
    {['completed','ai_review'].includes(o.status)&&<MasterVoiceHint order={o}/>}
    {o.status==='completed'&&<Card className="master-review-card space-y-3 border-primary/40">
      <div className="font-semibold text-[15px]">{t("Проверка закрытия")}</div>
      <Button size="big" className="w-full" disabled={busy} onClick={()=>go('ai_review')}>{t("Проверить отчёт")}</Button>
      <div className="text-[12px] text-muted">{t("Проверка по правилам. При ошибке обновите наряд, автоматического повтора нет. Решение принимает мастер.")}</div><details className="manual-master-form"><summary>{t("Решить без проверки")}</summary><p>{t("Только решение мастера. Автоматическая проверка не выполнена.")}</p><label>{t("Сбой проверки")}<input aria-label={t("Сбой проверки")} className="tk-input w-full p-3" value={manualFailure} onChange={e=>{setManualFailure(e.target.value);setManualOpen(false)}}/></label><label>{t("Основание решения")}<textarea aria-label={t("Основание решения")} className="tk-input w-full p-3" value={manualReason} onChange={e=>{setManualReason(e.target.value);setManualOpen(false)}}/></label><fieldset aria-label={t("Решение мастера")} className="manual-decision-options">{(['close','rework'] as const).map(choice=><button key={choice} type="button" aria-pressed={manualDecision===choice} onClick={()=>{setManualDecision(choice);setManualOpen(false)}}>{t(choice==='close'?"Закрыть":"На доработку")}</button>)}</fieldset>{manualDecision==='close'&&<input aria-label={t("Оценка мастера")} type="number" min="1" max="5" value={score} onChange={e=>{setScore(Number(e.target.value));setManualOpen(false)}}/>}{!manualOpen&&<Button disabled={busy||manualFailure.trim().length<3||manualReason.trim().length<3||(manualDecision==='close'&&(!Number.isInteger(score)||score<1||score>5))} onClick={()=>setManualOpen(true)}>{t("Проверить решение")}</Button>}{manualOpen&&<div role="alert"><p>{t("Подтвердите решение. Оно будет записано в журнал.")}</p><p>{t(manualDecision==='close'?"Закрыть":"Вернуть на доработку")} {manualDecision==='close'?`· ${score} / 5`:null}</p><p>{manualReason}</p><button className="manual-edit" onClick={()=>setManualOpen(false)}>{t("Назад")}</button><Button disabled={busy} onClick={async()=>{setBusy(true);try{await H.manualMasterDecision(o.id,o.version,manualDecision,manualDecision==='close'?score:null,manualReason,manualFailure);setManualOpen(false);setErr('');await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>{t("Подтвердить решение мастера")}</Button></div>}</details>
    </Card>}
    {o.ai_result&&<Card className="space-y-2">
      {o.status==='closed'&&<p className="text-sm font-bold">{t("Предварительная карточка: заменена окончательным решением мастера")}</p>}
      <div className="flex items-center gap-2"><span className="font-semibold text-[15px]">{t("Карточка оснований")}</span><Badge tone="gray">{t("Проверка отчёта")}</Badge></div>
      <div role="status" className="text-[12px] text-muted">{t(reviewArchiveDisplay(archiveReceipt?.version===o.version?archiveReceipt:H.reviewArchiveReceipt(actor.id,o.id,o.version)).label)}</div>
      <div className="font-semibold">{t(presentation.verdictLabel)}</div>
      {o.ai_result.document_rules&&<div className="document-rule-verdict rounded-xl border border-border p-3 space-y-2"><h3 className="font-bold">{t("Оценка полноты документа по правилам:")} {o.ai_result.document_rules.score} / 5</h3><p>{t(o.ai_result.document_rules.verdict==='rework'?"Документ требует доработки":"Документ заполнен, нужна проверка мастера")}</p><ul className="text-sm list-disc pl-4">{o.ai_result.document_rules.reasons.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul><p className="text-xs text-muted">{t("Не оценка ремонта. Наличие фото не подтверждает его содержимое. Решение принимает мастер.")}</p></div>}
      <div className="text-[14px]">{t("Оценка проверки:")} {t(presentation.scoreLabel)}</div>
      {o.ai_result.report_master&&<details><summary className="min-h-12 flex items-center text-[13px] cursor-pointer">{t("Подробный отчёт мастеру")}</summary><p className="whitespace-pre-line text-[13px]">{o.ai_result.report_master}</p></details>}
      <div className="text-[12px] text-muted">{t(reviewDisplay(o.ai_result).detail)}</div>
      <ul className="list-disc pl-5 text-[14px] space-y-0.5">{(o.ai_result.reasons||[]).map((r:string,i:number)=><li key={i}>{r}</li>)}</ul>
      <div className="text-[12px] text-muted">{t("Физическое выполнение ремонта не подтверждено. Решение принимает мастер. Оценка не калибрована на данных предприятия.")}</div>
      {(o.ai_result.limitations||[]).map((x:string,i:number)=><div className="text-[12px] text-muted" key={i}>{x}</div>)}
    </Card>}
    {o.status==='ai_review'&&<Card className="space-y-3">
      <div className="font-semibold text-[15px]">{t("Решение мастера")}</div>
      <div className="flex items-center gap-3"><span className="text-[14px]">{t("Оценка:")}</span>
        <div className="flex gap-1">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setScore(n)} className={"h-12 w-12 rounded-[12px] font-bold "+(score===n?'bg-primary text-primary-ink':'bg-surface border border-border')}>{n}</button>)}</div></div>
      <Button size="big" className="w-full" disabled={busy} onClick={()=>go('closed',undefined,{human_score:score})}>{t("Закрыть наряд")}</Button>
      <label className="block text-[13px]">{t("Причина возврата (обязательна)")}<textarea aria-label={t("Причина возврата на доработку")} className="mt-1 w-full min-h-20 p-3 border border-border rounded-[12px] bg-surface text-[16px]" value={reworkReason} onChange={e=>setReworkReason(e.target.value)} placeholder={t("Что исправить")}/></label><Button size="big" variant="outline" className="w-full" disabled={busy||reworkReason.trim().length<3} onClick={()=>go('rework',reworkReason.trim())}>{t("Вернуть на доработку")}</Button>
    </Card>}
    <Card><div className="font-semibold text-[14px] mb-2">{t("Журнал действий")}</div>
      {st.events.filter((e:any)=>e.order_id===o.id).map((e:any)=><div key={e.id} className="text-[12px] text-muted py-1 border-t border-border first:border-0">{e.actor} · {t(eventLabel(e.new_status))} · {new Date(e.created_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{e.reason?' · '+e.reason:''}</div>)}</Card>
  </div>
}
