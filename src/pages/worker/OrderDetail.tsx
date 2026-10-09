import DeadlineProgress from '../../components/DeadlineProgress'
import {workerFeedback} from '../../lib/worker-feedback.mjs'
import PhotoCapture from '../../components/PhotoCapture'
import {loadDraft,saveDraft,clearDraft} from '../../lib/report-draft'
import {useEffect, useState, useRef} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import {sanitizePhoto} from '../../lib/photo-sanitize'
import * as H from '../../lib/data'
import {eventLabel} from '../../lib/status'
import VoiceButton from './VoiceButton'
import type {Actor} from '../../App'
import {Camera, TriangleAlert, X, Check, ArrowLeft, ArrowRight, Package, Ban, Clock, Play, Pause, SendHorizontal, ShieldCheck, ShieldOff, History, FileText} from 'lucide-react'
import {PriorChip} from '../../components/PriorChip'
import {cn} from '../../lib/utils'
const DECLS=[
  'Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)',
  'Подтверждаю лично: использую средства защиты, зона работ безопасна'
]
const SHORT_DECLS=['Процедура безопасности выполнена','Средства защиты и зона работ проверены']
const DECL_POST='Подтверждаю лично: после работ выполнен контрольный запуск / осмотр'
function compress(f:File){return sanitizePhoto(f)}
function read(f:Blob){return new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.readAsDataURL(f)})}
export default function OrderDetail({actor}:{actor:Actor}){const {id}=useParams();return <OrderDetailForOrder key={actor.id+':'+id} actor={actor}/>}
function OrderDetailForOrder({actor}:{actor:Actor}){
  const {id}=useParams(); const nav=useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false); const [reasonFor,setReasonFor]=useState<null|'rejected'|'paused'>(null)
  const [otherReason,setOtherReason]=useState('')
  const [permitKind,setPermitKind]=useState(''); const [permitNote,setPermitNote]=useState('')
  const closeMode=useRef(false)
  const [closeDraft,setCloseDraft]=useState(false)
  const [acceptOpen,setAcceptOpen]=useState(false);const [titleExpanded,setTitleExpanded]=useState(false)
  const [wizardHelp,setWizardHelp]=useState(false);const [faultSheet,setFaultSheet]=useState(false)
  const [wiz,setWiz]=useState(false); const [step,setStep]=useState(0)
  const [decl,setDecl]=useState<boolean[]>([false,false]); const [declPost,setDeclPost]=useState(false)
  const [normWorkType,setNormWorkType]=useState('');const [works,setWorks]=useState(''); const [fault,setFault]=useState(''); const [,setMaterials]=useState('')
  const [materialRows,setMaterialRows]=useState<{name:string,quantity:number,unit:string}[]>([]);const [draftNote,setDraftNote]=useState('');const [online,setOnline]=useState(navigator.onLine);useEffect(()=>{const f=()=>setOnline(navigator.onLine);window.addEventListener('online',f);window.addEventListener('offline',f);return()=>{window.removeEventListener('online',f);window.removeEventListener('offline',f)}},[]);const [after,setAfter]=useState<string[]>([])
  const [captureOpen,setCaptureOpen]=useState(false)
  const [intakeBusy,setIntakeBusy]=useState(false)
  const [startDecl,setStartDecl]=useState<boolean[]>([false,false]); const [startBusy,setStartBusy]=useState(false)
  const loadGeneration=useRef(0)
  const load=()=>{const generation=++loadGeneration.current;return H.state().then(value=>{if(generation===loadGeneration.current){setSt(value);setErr('')}}).catch(e=>{if(generation===loadGeneration.current)setErr(e.message)})}
  useEffect(()=>{load();const refresh=()=>{setOnline(true);load()};const foreground=()=>{if(document.visibilityState==='visible')load()};const timer=setInterval(foreground,30000);window.addEventListener('focus',foreground);document.addEventListener('visibilitychange',foreground);window.addEventListener('online',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',foreground);document.removeEventListener('visibilitychange',foreground);loadGeneration.current++;window.removeEventListener('online',refresh)}},[id])
  useEffect(()=>{if(!wiz||closeMode.current)return;const timer=setTimeout(()=>{try{saveDraft(actor.id,Number(id),{works,fault,normWorkType,materials:materialRows,after});setDraftNote('Сохранено на этом устройстве')}catch(e){setDraftNote('Не сохранено: '+(e as Error).message)}},700);return()=>clearTimeout(timer)},[wiz,works,fault,normWorkType,materialRows,after,actor.id,id])
  const closeReport=()=>{if(works.trim()||fault||materialRows.length||after.length)setCloseDraft(true);else setWiz(false)}
  const openWiz=()=>{closeMode.current=false;setCloseDraft(false);setErr('');setDraftNote('');setWiz(true);setStep(0);setDecl([false,false]);setDeclPost(false);setWorks('');setFault('');setNormWorkType('');setMaterials('');setMaterialRows([]);setAfter([]);const d=loadDraft(actor.id,Number(id));if(d){setWorks(d.works);setFault(d.fault);setNormWorkType(d.normWorkType||'');setMaterialRows(d.materials);setAfter(d.after);setDraftNote('Черновик восстановлен. Подтверждения безопасности заново, версия и статус проверяются сервером при отправке.')}}
  const go=async(status:string,reason?:string,closure?:any)=>{setBusy(true);setErr('')
    try{if(!navigator.onLine||st?.offline)throw Error('Нет связи: сохраните черновик. Статус не изменён.');await H.transition(o.id,{status,version:o.version,reason,closure});if(status==='completed'){closeMode.current=true;clearDraft(actor.id,o.id)}setWiz(false);await load();window.scrollTo(0,0)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  if(err&&!st) return <div className="tk-card p-4 text-tk-red">{err}</div>
  if(!st) return <div className="py-10 text-center" style={{color:'var(--tk-muted)'}}>Загрузка…</div>
  const o=st.orders.find((x:any)=>x.id===Number(id))
  if(!o||o.assignee_id!==actor.id) return <div className="tk-card p-4">Наряд не найден или назначен другому исполнителю.</div>
  const needPhoto=o.kind==='unplanned'
  const intake:any[]=Array.isArray(o.intake_photos)?o.intake_photos:[]
  const intakeBefore=intake.filter((p:any)=>p.phase==='before_intake')
  const intakeLate=intake.filter((p:any)=>p.phase!=='before_intake')
  const masterBefore:string[]=[...(o.before_photos||[]),...intakeBefore.map((p:any)=>p.url).filter(Boolean)]
  const intakeAllowed=['accepted','in_progress','rework','paused'].includes(o.status)
  const doIntake=async(f:File|null|undefined)=>{if(!f||intakeBusy)return;setIntakeBusy(true);setErr('')
    try{if(!navigator.onLine||st?.offline)throw Error('Нет связи: фото не отправлено.');const url=await read(await compress(f));await H.recordIntakePhoto(o.id,url);await load()}catch(e){setErr((e as Error).message)}finally{setIntakeBusy(false)}}
  const doPermit=async()=>{setBusy(true);setErr('')
    try{if(!navigator.onLine||st?.offline)throw Error('Нет связи: допуск не изменён.');await H.recordPermit(o.id,{kind:permitKind,note:permitNote,version:o.version});setPermitKind('');setPermitNote('');await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const recordedPre:any[]=(o.declarations||[]).filter((d:any)=>(d.phase==='pre_work'||d.phase==='pre_work_late')&&!d.excluded_from_evidence)
  const excludedPre:any[]=(o.declarations||[]).filter((d:any)=>(d.phase==='pre_work'||d.phase==='pre_work_late')&&d.excluded_from_evidence)
  const allDecl=recordedPre.length>=DECLS.length?true:decl.slice(0,DECLS.length).every(Boolean)
  const canSend=works.trim().length>=12&&!!fault&&(!needPhoto||after.length>0)&&materialRows.every(m=>!!m.name&&m.quantity>0)
  const complete=async()=>{
    if(!navigator.onLine){setErr('Нет связи: сохраните черновик, статус не изменён.');return}

    const preDecls=recordedPre.length>=DECLS.length?recordedPre.map((d:any)=>({phase:'pre_work',text:d.text,confirmed:true,recorded_at:d.declared_at})):DECLS.map((d,i)=>({phase:'pre_work_at_surrender',text:d,confirmed:decl[i]}))
    if(recordedPre.length<DECLS.length){try{await H.recordDeclarations(o.id,'pre_work_at_surrender',DECLS)}catch(e){setErr('Подтверждения не записаны: '+(e as Error).message);return}}
    go('completed',undefined,{works,fault_code:fault,norm_work_type:normWorkType||null,materials:materialRows,photos:after,safety_declarations:[...preDecls,{phase:'post_work',text:DECL_POST,confirmed:declPost}]})}
  const addPh=async(f:File|null|undefined)=>{if(!f)return
    try{const clean=await sanitizePhoto(f);const url=await read(clean);setAfter(p=>[...p,url])}catch(e){setErr('Фото не отправлено: '+(e as Error).message)}}
  const steps=['Безопасность','Отчёт','Фото']
  const stepOk=[allDecl,works.trim().length>=12&&!!fault,(!needPhoto||after.length>0)]
  const feedback=workerFeedback(o,st.events||[],st.work_norms||[])
  return <div className="worker-order-detail space-y-3">{o.evidence_unavailable&&<p role="alert" className="tk-card p-3 text-sm">Доказательства недоступны. Это не означает, что фото или подтверждений нет. Обновите данные.</p>}{captureOpen&&<PhotoCapture reference={masterBefore[0]} onClose={()=>setCaptureOpen(false)} onCapture={async f=>{const clean=await sanitizePhoto(f);const url=await read(clean);setAfter([url])}}/>}{st.offline&&<div role="status" className="tk-card p-3 text-xs text-tk-amber">Офлайн · личный снимок от {new Date(st.cachedAt).toLocaleString('ru')}. Данные могут быть устаревшими. Статусы/допуски онлайн; отчёт можно сохранить черновиком.<button className="tk-touch tk-sub w-full mt-2" onClick={load}>Обновить данные</button></div>}
    <button className="text-xs font-bold inline-flex items-center gap-1" style={{color:'var(--tk-muted)'}} onClick={()=>nav(-1)}><ArrowLeft size={19}/>Назад</button>
    <div className="tk-card p-3.5 space-y-2.5">
      <div className="worker-order-priority-row flex items-center justify-between">
        <span className={"text-[0.625rem] font-black px-2 py-0.5 rounded uppercase tracking-wider "+(o.priority==='emergency'?'bg-tk-red text-white':o.priority==='high'?'bg-tk-amber text-black':'tk-sub')}>
          <PriorChip p={o.priority} inherit/>
        </span>
        <span className="worker-order-number text-xs font-mono font-bold" style={{color:'var(--tk-muted)'}}>№ {o.id}</span>
      </div>
      <button className="order-expand-title text-left w-full" aria-expanded={titleExpanded} onClick={()=>setTitleExpanded(v=>!v)}><h1 className={titleExpanded?"":"order-title-clamped"}>{o.title}</h1></button>
      <div className="text-xs" style={{color:'var(--tk-muted)'}}>{o.kind==='planned'?'Плановый':'Внеплановый'} · {o.section}</div>
      {err&&!wiz&&<div role="alert" className="text-xs text-tk-red font-bold">{err}</div>}
    </div>
    {['closed','rejected'].includes(o.status)||o.cancelled?<div className="tk-card p-3"><span>{o.status==='closed'?'Наряд закрыт':'Наряд завершён без исполнения'}</span><p className="text-sm">{o.closed_at?'Закрытие: '+new Date(o.closed_at).toLocaleString('ru',{timeZone:'Asia/Almaty'}):'Время закрытия не записано.'}</p><p className="text-xs">Плановый срок: {new Date(o.deadline).toLocaleString('ru',{timeZone:'Asia/Almaty'})}</p></div>:<div className="order-deadline-tile tk-card p-3"><DeadlineProgress deadline={o.deadline} issuedAt={o.created_at} status={o.status} cancelled={o.cancelled} now={Date.now()}/></div>}<div className="order-equipment-chip"><Package size={20}/>{o.equipment}</div>
    {o.status==='issued'&&<button className="incoming-primary tk-touch w-full bg-tk-amber" disabled={!online||st.offline||busy} onClick={()=>go('accepted')}>{o.status==='issued'?'Принять назначение':'Записать допуск'}</button>}
    <details className="order-before-row tk-card p-3 space-y-2"><summary><span className="flex items-center gap-2"><Camera size={20}/>Фото до / приёмка</span><span>{masterBefore.length?'Открыть':intakeAllowed?'Добавить':'Нет фото'}</span></summary>
      {masterBefore.length>0&&<div className="flex gap-2 overflow-x-auto no-scrollbar">{masterBefore.map((p,i)=><img key={i} src={p} className="h-32 rounded-lg" alt="Фото до"/>)}</div>}
      {masterBefore.length===0&&<div className="text-[0.6875rem] font-bold" style={{color:'var(--tk-muted)'}}>Фото до отсутствует.</div>}
      {intakeAllowed&&<div>
        <label className={cn("tk-sub w-full h-12 flex items-center justify-center gap-2 cursor-pointer text-xs font-black uppercase",intakeBusy&&'opacity-50')}>
          <Camera size={19}/>{intakeBusy?'Загрузка…':o.status==='accepted'?'Снять фото приёмки (до начала работ)':'Снять фото состояния (работы уже начаты)'}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={intakeBusy} onChange={e=>{doIntake(e.target.files?.[0]);e.target.value=''}}/></label>
        <div className="text-[0.625rem] mt-1" style={{color:'var(--tk-muted)'}}>{o.status==='accepted'
          ?'Фото, полученное до начала работ по процессу (загружено при статусе «принят»); после сдачи наряда добавить нельзя.'
          :'Работы уже начаты: снимок будет помечен «после начала работ» и НЕ считается фото до.'} Время съёмки сервером не подтверждается.</div>
      </div>}
      {intake.length>0&&<div className="text-[0.625rem] space-y-0.5" style={{color:'var(--tk-muted)'}}>{intake.map((p:any,i:number)=><div key={i}>
        {p.phase==='before_intake'?'Фото до (приёмка)':'Снято после начала работ (статус: '+(p.status_at_upload||'?')+')'} · получено сервером {new Date(p.server_received_at).toLocaleString('ru',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
      </div>)}</div>}
      {intakeLate.length>0&&<div className="flex gap-2 overflow-x-auto no-scrollbar">{intakeLate.map((p:any,i:number)=>p.url&&<img key={i} src={p.url} className="h-24 rounded-lg opacity-80" alt="Снято после начала работ"/>)}</div>}
    </details>
    {o.permit_kind&&<div className="tk-card p-3 text-xs font-bold"><span className="text-tk-green">{o.permit_kind==='not_required'?'Допуск не требуется':'Допуск подтверждён'}</span><span style={{color:'var(--tk-muted)'}}>{o.permit_note?' · '+o.permit_note:''}</span></div>}
    {reasonFor&&<div className="tk-card p-3.5 space-y-2 border-tk-amber"><label className="block text-sm">Причина своими словами<textarea className="tk-input w-full p-3" value={otherReason} onChange={e=>setOtherReason(e.target.value)} placeholder="Для варианта Другая причина"/></label><VoiceButton onText={text=>setOtherReason(previous=>previous?previous+' '+text:text)}/>
      <div className="text-[0.8125rem] font-black uppercase tracking-wide">{reasonFor==='rejected'?'Причина отказа':'Причина паузы'}</div>
      <div className="grid grid-cols-1 gap-1.5">
        {(reasonFor==='rejected'?[['no_materials','Нет материалов / запчастей'],['no_permit','Нет допуска'],['busy_emergency','Занят аварийным нарядом'],['wrong_specialty','Не моя специальность'],['other','Другая причина']]:[['wait_parts','Ждёт запчасти'],['wait_stop','Ждёт остановки оборудования'],['other','Другая причина']]).map(([code,label])=>
          <button key={code} className="tk-touch tk-sub text-left px-3.5 normal-case font-bold" disabled={!online||st.offline||busy} onClick={async()=>{
            let note=''
            if(code==='other'){note=otherReason;if(!note.trim()){setErr('Укажите причину в поле ниже');return}}
            setReasonFor(null); await go(reasonFor, code+': '+label+(note?' — '+note:''))
          }}>{label}</button>)}
      </div>
      <button className="text-[0.6875rem] font-bold uppercase" style={{color:'var(--tk-muted)'}} onClick={()=>setReasonFor(null)}>Отмена</button>
    </div>}
    {o.status==='issued'&&<details className="order-more-actions"><summary>Подробности</summary>
      
      <div className="grid grid-cols-2 gap-2">
        <button className="tk-touch tk-sub uppercase inline-flex items-center justify-center gap-1.5" disabled={!online||st.offline||busy} onClick={()=>go('queued','В очередь после текущего')}><Clock size={19}/>В очередь</button>
        <button className="tk-touch tk-sub text-tk-red uppercase inline-flex items-center justify-center gap-1.5" disabled={!online||st.offline||busy} onClick={()=>setReasonFor('rejected')}><Ban size={19}/>Не могу</button>
      </div></details>}
    {(o.status==='accepted'||(o.status==='in_progress'&&recordedPre.length<DECLS.length))&&<div className="tk-card p-3.5 space-y-2.5">
      <div className="text-[0.8125rem] font-black uppercase tracking-wide">Перед началом работ</div>
      <div className="bg-tk-red/10 border border-tk-red/40 rounded-lg p-2.5 text-[0.6875rem] flex gap-2">
        <TriangleAlert size={22} className="text-tk-red shrink-0 mt-0.5"/>
        <span>{o.status==='in_progress'?'Работы уже начаты: подтверждения фиксируются сейчас и будут помечены как сделанные после начала работ.':'Личные подтверждения исполнителя — фиксируются сейчас, до начала работ, с отметкой времени сервера.'} Это декларация работника, а не проверка электросостояния системой. Конкретные требования определяются утверждённой процедурой для этой задачи.</span>
      </div>
      {DECLS.map((d,i)=><label key={i} className={cn("tk-sub p-3 flex items-start gap-2.5 cursor-pointer transition",startDecl[i]&&'border-tk-green')}>
        <input type="checkbox" checked={startDecl[i]} onChange={()=>setStartDecl(p=>p.map((v,j)=>j===i?!v:v))} className="mt-0.5 w-5 h-5 accent-tk-green shrink-0"/>
        <span className="text-xs font-bold leading-snug">{SHORT_DECLS[i]}</span>
      </label>)}

      <button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2" disabled={!online||st.offline||busy||startBusy||!startDecl.slice(0,DECLS.length).every(Boolean)} onClick={async()=>{
        setStartBusy(true);setErr('')
        try{
          if(o.status==='accepted'){
            if(!o.permit_kind){setAcceptOpen(true);return}await H.startWork(o.id,o.version,DECLS)
            await load();window.scrollTo(0,0)
          }else{
            await H.recordDeclarations(o.id,'pre_work_late',DECLS);await load()
          }
        }catch(e){setErr((e as Error).message)}finally{setStartBusy(false)}
      }}><Play size={22}/>{startBusy?'Фиксация…':o.status==='accepted'?'Подтвердить и начать работу':'Зафиксировать (после начала)'}</button>
    </div>}
    {o.status==='queued'&&<button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40 inline-flex items-center justify-center gap-2" disabled={!online||st.offline||busy} onClick={()=>go('accepted')}><Check size={22}/>Принять из очереди</button>}
    {o.status==='in_progress'&&<>
      <button className="tk-touch tk-sub uppercase inline-flex items-center justify-center gap-1.5" disabled={!online||st.offline||busy} onClick={()=>setReasonFor('paused')}><Pause size={19}/>Пауза</button>
      <button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase text-base inline-flex items-center justify-center gap-2" onClick={openWiz}><SendHorizontal size={19}/>Сдать наряд №{o.id} на проверку</button></>}
    {o.status==='paused'&&<button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase inline-flex items-center justify-center gap-2" disabled={!online||st.offline||busy} onClick={()=>go('in_progress')}><Play size={22}/>Продолжить</button>}
    {['completed','ai_review'].includes(o.status)&&<div className="tk-card p-4 text-center font-black text-tk-blue text-sm">На проверке у мастера</div>}
    {o.status==='rework'&&<div className="tk-card p-4 space-y-1.5 border-tk-red">
      <div className="font-black text-tk-red text-sm flex items-center gap-2"><TriangleAlert size={19}/>На доработке</div>
      {o.ai_result?.reason&&<div className="text-xs" style={{color:'var(--tk-muted)'}}>Проверка ИИ: {o.ai_result.reason}</div>}
      <button className="tk-touch bg-tk-amber text-black w-full border border-amber-600 uppercase inline-flex items-center justify-center gap-2" onClick={openWiz}><SendHorizontal size={22}/>Сдать повторно</button></div>}
    {o.status==='closed'&&<div className="tk-card p-3.5 space-y-1.5">
      <span className="text-[0.625rem] font-black px-2 py-0.5 rounded uppercase tk-sub">Закрыт</span>
      {o.ai_result?.human_score&&<div className="text-sm font-bold">Оценка мастера: {o.ai_result.human_score} / 5</div>}
      {o.closure?.works&&<div className="text-xs" style={{color:'var(--tk-muted)'}}>{o.closure.works}</div>}<section aria-label="Отчёт исполнителю" className="space-y-2"><h3 className="font-bold">Отчёт исполнителю</h3><p className="text-xs">Сводка по записанным фактам · правила, не языковая модель</p><h4>Что подтверждено</h4>{feedback.good.map((s,i)=><p className="text-xs" key={i}>{s}</p>)}<h4>Что проверить или улучшить</h4>{feedback.improve.map((s,i)=><p className="text-xs" key={i}>{s}</p>)}<p className="text-xs">{feedback.timeText}</p><p className="text-xs">{feedback.normText}</p></section></div>}
    <div className="tk-card p-3"><div className="text-[0.6875rem] font-black uppercase tracking-wider mb-1 inline-flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><History size={22}/>Журнал</div>
      {st.events.filter((e:any)=>e.order_id===o.id).map((e:any)=><div key={e.id} className="text-[0.6875rem] py-1 border-t first:border-0" style={{color:'var(--tk-muted)',borderColor:'var(--tk-border)'}}>{e.actor} · {eventLabel(e.new_status)} · {new Date(e.created_at).toLocaleString('ru',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{e.reason?' · '+e.reason:''}</div>)}</div>
    {acceptOpen&&<div className="worker-report-wizard permit-accept-sheet fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,.5)'}}><div className="w-full max-w-md p-4 space-y-4"><div className="sheet-drag-handle"/><div className="flex items-center justify-between"><h3>Допуск</h3><button className="wizard-help" onClick={()=>setAcceptOpen(false)} aria-label="Закрыть допуск"><X size={20}/></button></div>    {!o.permit_kind&&<div className="tk-card p-3.5 space-y-2.5">
      
      <div className="text-[0.6875rem]" style={{color:'var(--tk-muted)'}}>Отметьте допуск перед началом — запись уходит в журнал.</div>
      <fieldset aria-label="Вариант допуска" className="permit-segments grid grid-cols-2 gap-2">{[['confirmed','Допуск есть',ShieldCheck],['not_required','Не нужен',ShieldOff]].map(([k,l,I]:any)=>
        <button key={k} onClick={()=>setPermitKind(k)} className={cn("tk-touch border inline-flex items-center justify-center gap-1.5",permitKind===k?'bg-tk-amber text-black border-amber-600':'tk-sub')}>{permitKind===k&&<Check size={18}/>}<span>{l}</span></button>)}</fieldset>
      {permitKind==='confirmed'&&<>
        <input className="tk-input w-full h-12 px-3 text-sm" placeholder="Номер допуска и кто подтвердил" value={permitNote} onChange={e=>setPermitNote(e.target.value)}/>
        <div className="text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Нужны номер (цифры) и фамилия — проверяется на сервере.</div></>}

    </div>}
<button className="tk-touch w-full bg-tk-amber" disabled={(!o.permit_kind&&(!permitKind||(permitKind==='confirmed'&&permitNote.trim().length<8)))||busy||!online||st.offline} onClick={async()=>{setBusy(true);setErr('');try{if(!o.permit_kind)await H.recordPermit(o.id,{kind:permitKind,note:permitNote,version:o.version});if(o.status==='accepted')await H.startWork(o.id,o.version,DECLS);await load();setAcceptOpen(false)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}}>Начать работу</button>{!o.permit_kind&&!permitKind&&<p className="wizard-disabled-reason">Выберите допуск</p>}{permitKind==='confirmed'&&permitNote.trim().length<8&&<p className="wizard-disabled-reason">Укажите номер и фамилию</p>}<p className="permit-disclaimer">Запись не заменяет разрешение мастера.</p></div></div>}
    {closeDraft&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-5" role="dialog" aria-modal="true" aria-label="Сохранить отчёт"><div className="tk-card p-5 space-y-4 w-full max-w-md"><h2>Сохранить отчёт перед закрытием?</h2><button className="tk-touch tk-sub w-full" onClick={()=>{try{saveDraft(actor.id,o.id,{works,fault,normWorkType,materials:materialRows,after});closeMode.current=true;setWiz(false);setCloseDraft(false)}catch(e){setErr((e as Error).message)}}}>Сохранить и закрыть</button><button className="tk-touch tk-sub w-full" onClick={()=>{closeMode.current=true;clearDraft(actor.id,o.id);setWiz(false);setCloseDraft(false)}}>Удалить черновик</button><button className="tk-touch tk-sub w-full" onClick={()=>setCloseDraft(false)}>Продолжить отчёт</button></div></div>}{wiz&&<div className="worker-report-wizard fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:'rgba(0,0,0,0.8)'}}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border flex flex-col max-h-[92dvh]" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
        <div className="sheet-drag-handle"/><div className="p-3.5 border-b space-y-2.5" style={{borderColor:'var(--tk-border)'}}>
          <div className="flex justify-between items-center">
            <h3 className="wizard-title">Отчёт №{o.id}</h3>
            <button onClick={closeReport} aria-label="Закрыть отчёт" className="w-12 h-12 tk-sub flex items-center justify-center rounded-lg"><X size={19}/></button>
          </div>
          <div className="wizard-step-label">Шаг {step+1} из 3 · {steps[step]}</div><div className="flex gap-1.5 wizard-step-bars">
            {steps.map((s,i)=><div key={s} className="flex-1 text-center">
              <div className={cn("h-1.5 rounded-full mb-1",i<=step?'bg-tk-amber':'')} style={i<=step?undefined:{background:'var(--tk-border)'}}/>
              <span className={cn("text-[0.5625rem] font-black uppercase",i===step?'text-tk-amber':'')} style={i===step?undefined:{color:'var(--tk-muted)'}}>{s}</span>
            </div>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">{err&&<div role="alert" className="text-xs text-tk-red font-bold">{err}</div>}<div className="wizard-save-status" role="status">{!online&&'Офлайн · черновик на устройстве'}</div>
          {step===0&&recordedPre.length>=DECLS.length&&<div className="space-y-2.5">
            <div className="bg-tk-green/10 border border-tk-green/40 rounded-lg p-2.5 text-[0.6875rem] flex gap-2">
              <Check size={22} className="text-tk-green shrink-0 mt-0.5"/>
              <span>Подтверждения безопасности {recordedPre[0].phase==='pre_work_late'?'зафиксированы после начала работ':'зафиксированы при начале работ'}: {new Date(recordedPre[0].declared_at).toLocaleString('ru',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} (время сервера).</span>
            </div>
            {recordedPre.map((d:any,i:number)=><div key={i} className="tk-card p-3 flex items-start gap-2.5 border-tk-green">
              <Check size={22} className="text-tk-green shrink-0 mt-0.5"/>
              <span className="text-xs font-bold leading-snug">{SHORT_DECLS[i]||'Подтверждение записано'}<details className="wizard-safety-details"><summary>i · Запись</summary><p>{d.text}</p></details></span>
            </div>)}
          </div>}
          {step===0&&excludedPre.length>0&&<div className="tk-sub p-2.5 text-[0.6875rem] font-bold" style={{color:'var(--tk-muted)'}}>Отметки из неудачных попыток старта ({excludedPre.length}) сохранены в журнале, но не учитываются как свидетельство перед началом работ.</div>}
          {step===0&&recordedPre.length<DECLS.length&&<div className="space-y-2.5"><div className="wizard-help-row"><span>Подтвердите лично</span><button className="wizard-help" aria-label="Полные условия безопасности" onClick={()=>setWizardHelp(v=>!v)}>?</button></div>{wizardHelp&&<div className="wizard-help-copy">{DECLS.map(d=><p key={d}>{d}</p>)}<p>Подтверждения не являются автоматической проверкой. Черновик хранится 24 часа на этом устройстве. Не используйте общий телефон с реальными данными.</p></div>}
            <div className="bg-tk-amber/10 border border-tk-amber/40 rounded-lg p-2.5 text-[0.6875rem] flex gap-2">
              <TriangleAlert size={22} className="text-tk-amber shrink-0 mt-0.5"/>
              <span>Декларации записываются сейчас, не при старте.</span>
            </div>
            {DECLS.map((d,i)=><label key={i} className={cn("tk-card p-3 flex items-start gap-2.5 cursor-pointer transition",decl[i]&&'border-tk-green')}>
              <input type="checkbox" checked={decl[i]} onChange={()=>setDecl(p=>p.map((v,j)=>j===i?!v:v))} className="mt-0.5 w-5 h-5 accent-tk-green shrink-0"/>
              <span className="text-xs font-bold leading-snug">{SHORT_DECLS[i]}</span>
            </label>)}
          </div>}
          {step===1&&<div className="space-y-2.5"><label className="block">Учебный норматив (необязательно)<select aria-label="Учебный норматив" className="tk-input w-full" value={normWorkType} onChange={e=>setNormWorkType(e.target.value)}><option value="">Не выбран, сравнение недоступно</option>{(st.work_norms||[]).map((n:any)=><option key={n.work_type} value={n.work_type}>{n.work_type} · {n.norm_minutes} мин · учебный</option>)}</select></label>
            <div>
              <div className="text-[0.6875rem] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Что сделано и как проверено</div>
              <div className="report-work-field">
                <textarea className="tk-input flex-1 min-h-24 p-3 text-sm" value={works} onChange={e=>setWorks(e.target.value)} placeholder="Что сделали? Как проверили? Что осталось?"/>
              <VoiceButton onText={t=>setWorks(w=>w?w+' '+t:t)}/>
              </div>
              

            </div>
            <div>
              <div className="text-[0.6875rem] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Шифр неисправности</div>
              <div className="fault-recent-chips">{st.fault_codes.slice(0,2).map((f:any)=><button type="button" aria-pressed={fault===f.code} onClick={()=>setFault(f.code)} key={f.code}>{f.code} · {f.name}</button>)}<button type="button" onClick={()=>setFaultSheet(v=>!v)}>Все коды</button></div>{faultSheet&&<div className="fault-code-sheet" role="dialog" aria-label="Шифр неисправности">{st.fault_codes.map((f:any)=><button type="button" key={f.code} onClick={()=>{setFault(f.code);setFaultSheet(false)}}>{f.code} · {f.name}</button>)}</div>}
            </div>
            <details className="report-materials"><summary>Материалы ({materialRows.length}) +</summary>
              <div className="text-[0.6875rem] font-black uppercase mb-1 flex items-center gap-1" style={{color:'var(--tk-muted)'}}><Package size={22}/>Материалы (необязательно)</div>
              {materialRows.map((m,i)=><div key={i} className="grid grid-cols-[1fr_80px] gap-2 mb-2"><select aria-label={'Материал '+(i+1)} className="tk-input min-h-12 px-2 text-sm" value={m.name} onChange={e=>{const item=st.materials.find((x:any)=>x.name===e.target.value);setMaterialRows(r=>r.map((x,j)=>j===i?{...x,name:e.target.value,unit:item?.unit||''}:x))}}><option value="">Выберите материал</option>{st.materials.map((x:any)=><option key={x.id} value={x.name}>{x.name} · {x.unit}</option>)}</select><input aria-label={'Количество '+(i+1)} className="tk-input min-h-12 px-2" type="number" min="0.01" step="0.01" value={m.quantity} onChange={e=>setMaterialRows(r=>r.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x))}/><span className="text-xs">Единица: {m.unit||'выберите материал'}</span><button className="min-h-12 text-xs" onClick={()=>setMaterialRows(r=>r.filter((_,j)=>j!==i))}>Удалить</button></div>)}<button className="tk-touch tk-sub w-full text-sm" onClick={()=>setMaterialRows(r=>[...r,{name:'',quantity:1,unit:''}])}>Добавить материал</button>
            </details>
            <label className={cn("tk-card p-3 flex items-start gap-2.5 cursor-pointer transition",declPost&&'border-tk-green')}>
              <input type="checkbox" checked={declPost} onChange={()=>setDeclPost(v=>!v)} className="mt-0.5 w-5 h-5 accent-tk-green shrink-0"/>
              <span className="text-xs font-bold leading-snug">Контроль после работ выполнен <span className="font-normal" style={{color:'var(--tk-muted)'}}>(если требуется)</span></span>
            </label>
          </div>}
          {step===2&&<div className="space-y-3">
            {masterBefore.length>0?<div>
              <div className="text-[0.6875rem] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Фото до (получено до начала работ)</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">{masterBefore.map((p,i)=><img key={i} src={p} className="h-24 rounded-lg" alt="До"/>)}</div>
            </div>:<div className="tk-sub p-2.5 text-[0.6875rem] font-bold" style={{color:'var(--tk-muted)'}}>Фото до отсутствует — приёмочное фото снимается до начала работ, здесь его добавить нельзя.</div>}
            <div>
              <div className="photo-after-heading text-[0.6875rem] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Фото после{needPhoto&&<span className="photo-required-tag">Обязательно</span>}</div>
              <div className="flex gap-2 flex-wrap items-center">
                {after.map((p,i)=><div key={i}><img src={p} className="h-24 rounded-lg border-2 border-tk-green" alt="После"/><button className="min-h-12 px-3 tk-sub" onClick={()=>setAfter(xs=>xs.filter((_,n)=>n!==i))}>Удалить фото {i+1}</button></div>)}
                <button type="button" className={"tk-sub photo-capture-action min-h-16 w-full rounded-xl flex items-center justify-center gap-2 font-bold "+(after.length?"photo-retake":"")} onClick={()=>setCaptureOpen(true)}><Camera size={22}/>{after.length?'Переснять':'Снять фото после'}</button>
              </div>
            </div>
            {masterBefore.length>0&&after.length>0&&<div className="grid grid-cols-2 gap-2">
              <div className="text-center"><div className="text-[0.5625rem] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>До</div><img src={masterBefore[0]} className="w-full h-28 object-cover rounded-lg border" style={{borderColor:'var(--tk-border)'}} alt="До"/></div>
              <div className="text-center"><div className="text-[0.5625rem] font-black uppercase mb-1 text-tk-green">После</div><img src={after[0]} className="w-full h-28 object-cover rounded-lg border-2 border-tk-green" alt="После"/></div>
            </div>}
          </div>}
        </div>
        <div className={"wizard-footer p-3.5 border-t "+(step===2?"photo-footer":"grid grid-cols-2 gap-2")} style={{borderColor:'var(--tk-border)',background:'var(--tk-card)'}}>
          {step>0?<button onClick={()=>setStep(s=>s-1)} className="tk-touch tk-sub uppercase text-xs"><ArrowLeft size={22} className="inline mr-1"/>Назад</button>
            :<button onClick={closeReport} className="tk-touch tk-sub uppercase text-xs">Отмена</button>}
          {step<2?<button onClick={()=>setStep(s=>s+1)} disabled={!stepOk[step]} className="tk-touch bg-tk-amber text-black border border-amber-600 uppercase text-xs disabled:opacity-40">Далее<ArrowRight size={22} className="inline ml-1"/></button>
            :<><button onClick={complete} disabled={!online||st.offline||busy||!canSend} className="tk-touch bg-tk-green text-white border border-emerald-600 uppercase text-xs disabled:opacity-40"><Check size={22} className="inline mr-1"/>{busy?'Отправка…':'Отправить мастеру'}</button></>}
        {step===2&&!canSend&&<p className="wizard-disabled-reason">{needPhoto&&!after.length?'Нужно фото после':'Проверьте отчёт'}</p>}{step<2&&!stepOk[step]&&<p className="wizard-disabled-reason">{step===0?'Подтвердите оба условия':works.trim().length<12?'Опишите работу':'Выберите шифр'}</p>}</div>
      </div>
    </div>}
  </div>
        }