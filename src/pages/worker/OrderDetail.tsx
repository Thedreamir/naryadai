import {useEffect, useState} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import * as H from '../../lib/data'
import {eventLabel} from '../../lib/status'
import VoiceButton from './VoiceButton'
import type {Actor} from '../../App'
import {Camera, TriangleAlert, X, Check, ArrowLeft, ArrowRight, Package} from 'lucide-react'
import {cn} from '../../lib/utils'
const DECLS=[
  'Подтверждаю лично: оборудование обесточено и заземлено согласно наряду-допуску',
  'Подтверждаю лично: блокировки и предупреждающие плакаты (LOTO) вывешены'
]
const DECL_POST='Подтверждаю лично: после работ выполнен контрольный запуск / осмотр'
const TEMPLATES=['Узел осмотрен, заменена изношенная деталь, крепёж протянут по инструкции. Контрольный запуск выполнен — посторонних шумов нет.','Загрязнение устранено, смазка узла обновлена, работа восстановлена.','Причина — износ. Деталь заменена, люфтов и вибрации не выявлено.']
function compress(f:File){return imageCompression(f,{maxSizeMB:0.35,maxWidthOrHeight:1600})}
function read(f:Blob){return new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.readAsDataURL(f)})}
export default function OrderDetail({actor}:{actor:Actor}){
  const {id}=useParams(); const nav=useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [permitKind,setPermitKind]=useState(''); const [permitNote,setPermitNote]=useState('')
  const [wiz,setWiz]=useState(false); const [step,setStep]=useState(0)
  const [decl,setDecl]=useState<boolean[]>([false,false]); const [declPost,setDeclPost]=useState(false)
  const [works,setWorks]=useState(''); const [fault,setFault]=useState(''); const [materials,setMaterials]=useState('')
  const [after,setAfter]=useState<string[]>([])
  const [intakeBusy,setIntakeBusy]=useState(false)
  const load=()=>H.state().then(setSt).catch(e=>setErr(e.message))
  useEffect(()=>{load()},[id])
  const openWiz=()=>{setWiz(true);setStep(0);setDecl([false,false]);setDeclPost(false);setWorks('');setFault('');setMaterials('');setAfter([])}
  const go=async(status:string,reason?:string,closure?:any)=>{setBusy(true);setErr('')
    try{await H.transition(o.id,{status,version:o.version,reason,closure});setWiz(false);await load();window.scrollTo(0,0)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
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
    try{const url=await read(await compress(f));await H.recordIntakePhoto(o.id,url);await load()}catch(e){setErr((e as Error).message)}finally{setIntakeBusy(false)}}
  const doPermit=async()=>{setBusy(true);setErr('')
    try{await H.recordPermit(o.id,{kind:permitKind,note:permitNote,version:o.version});setPermitKind('');setPermitNote('');await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const allDecl=decl.every(Boolean)
  const canSend=works.trim().length>=12&&!!fault&&(!needPhoto||after.length>0)
  const complete=()=>go('completed',undefined,{works,fault_code:fault,materials:materials?[{name:materials,quantity:1}]:[],photos:after,safety_declarations:[...DECLS.map((d,i)=>({phase:'pre_work',text:d,confirmed:decl[i]})),{phase:'post_work',text:DECL_POST,confirmed:declPost}]})
  const addPh=async(f:File|null|undefined)=>{if(!f)return;const url=await read(await compress(f));setAfter(p=>[...p,url])}
  const steps=['Безопасность','Отчёт','Фото']
  const stepOk=[allDecl,works.trim().length>=12&&!!fault,(!needPhoto||after.length>0)]
  return <div className="space-y-3">
    <button className="text-xs font-bold" style={{color:'var(--tk-muted)'}} onClick={()=>nav(-1)}>← Назад</button>
    <div className="tk-card p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={"text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider "+(o.priority==='emergency'?'bg-tk-red text-white':o.priority==='high'?'bg-tk-amber text-black':'tk-sub')}>
          {o.priority==='emergency'?'⚡ Аварийный':o.priority==='high'?'⚡ Высокий':'Обычный'} · {o.kind==='planned'?'Плановый':'Внеплановый'}
        </span>
        <span className="text-xs font-mono font-bold" style={{color:'var(--tk-muted)'}}>№ {o.id}</span>
      </div>
      <h1 className="text-base font-black leading-snug">{o.title}</h1>
      <div className="text-xs" style={{color:'var(--tk-muted)'}}>{o.equipment} · {o.section} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      {err&&<div className="text-xs text-tk-red font-bold">{err}</div>}
    </div>
    <div className="tk-card p-3 space-y-2">
      <div className="text-[11px] font-black uppercase tracking-wider" style={{color:'var(--tk-muted)'}}>Фото до (приёмка)</div>
      {masterBefore.length>0&&<div className="flex gap-2 overflow-x-auto no-scrollbar">{masterBefore.map((p,i)=><img key={i} src={p} className="h-32 rounded-lg" alt="Фото до"/>)}</div>}
      {masterBefore.length===0&&<div className="text-[11px] font-bold" style={{color:'var(--tk-muted)'}}>Фото до отсутствует.</div>}
      {intakeAllowed&&<div>
        <label className={cn("tk-sub w-full h-12 flex items-center justify-center gap-2 cursor-pointer text-xs font-black uppercase",intakeBusy&&'opacity-50')}>
          <Camera size={15}/>{intakeBusy?'Загрузка…':o.status==='accepted'?'Снять фото приёмки (до начала работ)':'Снять фото состояния (работы уже начаты)'}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={intakeBusy} onChange={e=>{doIntake(e.target.files?.[0]);e.target.value=''}}/></label>
        <div className="text-[10px] mt-1" style={{color:'var(--tk-muted)'}}>{o.status==='accepted'
          ?'Фиксируется с отметкой времени сервера как фото до начала работ; после сдачи наряда добавить нельзя.'
          :'Работы уже начаты: снимок будет помечен «после начала работ» и НЕ считается фото до.'} Время съёмки сервером не подтверждается.</div>
      </div>}
      {intake.length>0&&<div className="text-[10px] space-y-0.5" style={{color:'var(--tk-muted)'}}>{intake.map((p:any,i:number)=><div key={i}>
        {p.phase==='before_intake'?'Фото до (приёмка)':'Снято после начала работ (статус: '+(p.status_at_upload||'?')+')'} · получено сервером {new Date(p.server_received_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
      </div>)}</div>}
      {intakeLate.length>0&&<div className="flex gap-2 overflow-x-auto no-scrollbar">{intakeLate.map((p:any,i:number)=>p.url&&<img key={i} src={p.url} className="h-24 rounded-lg opacity-80" alt="Снято после начала работ"/>)}</div>}
    </div>
    {!o.permit_kind&&['issued','accepted','queued'].includes(o.status)&&<div className="tk-card p-3.5 space-y-2.5">
      <div className="text-[13px] font-black uppercase tracking-wide">Допуск к работе</div>
      <div className="text-[11px]" style={{color:'var(--tk-muted)'}}>Отметьте допуск перед началом — запись уходит в журнал.</div>
      <div className="grid grid-cols-2 gap-2">{[['confirmed','Допуск подтверждён'],['not_required','Не требуется']].map(([k,l])=>
        <button key={k} onClick={()=>setPermitKind(k)} className={cn("tk-touch border",permitKind===k?'bg-tk-amber text-black border-amber-600':'tk-sub')}>{l}</button>)}</div>
      {permitKind==='confirmed'&&<>
        <input className="tk-input w-full h-12 px-3 text-sm" placeholder="Номер допуска и кто подтвердил" value={permitNote} onChange={e=>setPermitNote(e.target.value)}/>
        <div className="text-[10px]" style={{color:'var(--tk-muted)'}}>Нужны номер (цифры) и фамилия — проверяется на сервере.</div></>}
      <button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40" disabled={!permitKind||busy||(permitKind==='confirmed'&&permitNote.trim().length<8)} onClick={doPermit}>Отметить допуск</button>
    </div>}
    {o.permit_kind&&<div className="tk-card p-3 text-xs font-bold"><span className="text-tk-green">{o.permit_kind==='not_required'?'Допуск не требуется':'Допуск подтверждён'}</span><span style={{color:'var(--tk-muted)'}}>{o.permit_note?' · '+o.permit_note:''}</span></div>}
    {o.status==='issued'&&<div className="space-y-2">
      <button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40" disabled={busy||!o.permit_kind} onClick={()=>go('accepted')}>Принять назначение</button>
      <div className="grid grid-cols-2 gap-2">
        <button className="tk-touch tk-sub uppercase" disabled={busy} onClick={()=>go('queued','В очередь после текущего')}>В очередь</button>
        <button className="tk-touch tk-sub text-tk-red uppercase" disabled={busy} onClick={()=>{const r=prompt('Причина отказа');if(r)go('rejected',r)}}>Не могу</button>
      </div></div>}
    {o.status==='accepted'&&<button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40" disabled={busy} onClick={()=>go('in_progress')}>Начать работу</button>}
    {o.status==='queued'&&<button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase disabled:opacity-40" disabled={busy} onClick={()=>go('accepted')}>Принять из очереди</button>}
    {o.status==='in_progress'&&<>
      <button className="tk-touch tk-sub uppercase" disabled={busy} onClick={()=>go('paused','Пауза')}>Пауза</button>
      <button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase text-base" onClick={openWiz}>Сдать наряд №{o.id} на проверку</button></>}
    {o.status==='paused'&&<button className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase" disabled={busy} onClick={()=>go('in_progress')}>Продолжить</button>}
    {['completed','ai_review'].includes(o.status)&&<div className="tk-card p-4 text-center font-black text-tk-blue text-sm">На проверке у мастера</div>}
    {o.status==='rework'&&<div className="tk-card p-4 space-y-1.5 border-tk-red">
      <div className="font-black text-tk-red text-sm flex items-center gap-2"><TriangleAlert size={15}/>На доработке</div>
      {o.ai_result?.reason&&<div className="text-xs" style={{color:'var(--tk-muted)'}}>Проверка ИИ: {o.ai_result.reason}</div>}
      <button className="tk-touch bg-tk-amber text-black w-full border border-amber-600 uppercase" onClick={openWiz}>Сдать повторно</button></div>}
    {o.status==='closed'&&<div className="tk-card p-3.5 space-y-1.5">
      <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase tk-sub">Закрыт</span>
      {o.ai_result?.human_score&&<div className="text-sm font-bold">Оценка мастера: {o.ai_result.human_score} / 5</div>}
      {o.closure?.works&&<div className="text-xs" style={{color:'var(--tk-muted)'}}>{o.closure.works}</div>}</div>}
    <div className="tk-card p-3"><div className="text-[11px] font-black uppercase tracking-wider mb-1" style={{color:'var(--tk-muted)'}}>Журнал</div>
      {st.events.filter((e:any)=>e.order_id===o.id).map((e:any)=><div key={e.id} className="text-[11px] py-1 border-t first:border-0" style={{color:'var(--tk-muted)',borderColor:'var(--tk-border)'}}>{e.actor} · {eventLabel(e.new_status)} · {new Date(e.created_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{e.reason?' · '+e.reason:''}</div>)}</div>
    {wiz&&<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:'rgba(0,0,0,0.8)'}}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border flex flex-col max-h-[92dvh]" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
        <div className="p-3.5 border-b space-y-2.5" style={{borderColor:'var(--tk-border)'}}>
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-wide text-tk-amber">Сдача наряда №{o.id} на проверку</h3>
            <button onClick={()=>setWiz(false)} className="w-8 h-8 tk-sub flex items-center justify-center rounded-lg"><X size={15}/></button>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s,i)=><div key={s} className="flex-1 text-center">
              <div className={cn("h-1.5 rounded-full mb-1",i<=step?'bg-tk-amber':'')} style={i<=step?undefined:{background:'var(--tk-border)'}}/>
              <span className={cn("text-[9px] font-black uppercase",i===step?'text-tk-amber':'')} style={i===step?undefined:{color:'var(--tk-muted)'}}>{s}</span>
            </div>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {step===0&&<div className="space-y-2.5">
            <div className="bg-tk-red/10 border border-tk-red/40 rounded-lg p-2.5 text-[11px] flex gap-2">
              <TriangleAlert size={14} className="text-tk-red shrink-0 mt-0.5"/>
              <span>Личные подтверждения исполнителя. Это декларация работника, а не проверка электросостояния системой.</span>
            </div>
            {DECLS.map((d,i)=><label key={i} className={cn("tk-card p-3 flex items-start gap-2.5 cursor-pointer transition",decl[i]&&'border-tk-green')}>
              <input type="checkbox" checked={decl[i]} onChange={()=>setDecl(p=>p.map((v,j)=>j===i?!v:v))} className="mt-0.5 w-5 h-5 accent-tk-green shrink-0"/>
              <span className="text-xs font-bold leading-snug">{d}</span>
            </label>)}
          </div>}
          {step===1&&<div className="space-y-2.5">
            <div>
              <div className="text-[11px] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Что сделано и как проверено (мин. 12 символов)</div>
              <div className="flex gap-2 items-start">
                <textarea className="tk-input flex-1 min-h-24 p-3 text-sm" value={works} onChange={e=>setWorks(e.target.value)} placeholder="Например: узел осмотрен, заменена деталь…"/>
                <VoiceButton onText={t=>setWorks(w=>w?w+' '+t:t)}/>
              </div>
              <div className="text-[10px] mt-1" style={{color:'var(--tk-muted)'}}>Голос заполняет только текст отчёта (браузерная распознавалка). Подтверждения безопасности ставятся вручную.</div>
              <div className="flex gap-1.5 flex-wrap mt-1.5">{TEMPLATES.map((t,i)=><button key={i} onClick={()=>setWorks(t)} className="text-[10px] font-bold tk-sub px-2 py-1 rounded-lg">Шаблон {i+1}</button>)}</div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Шифр неисправности</div>
              <select className="tk-input w-full h-12 px-3 text-sm" value={fault} onChange={e=>setFault(e.target.value)}>
                <option value="">Выберите…</option>
                {st.fault_codes.map((f:any)=><option key={f.code} value={f.code}>{f.code} · {f.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase mb-1 flex items-center gap-1" style={{color:'var(--tk-muted)'}}><Package size={12}/>Материалы (необязательно)</div>
              <input className="tk-input w-full h-12 px-3 text-sm" value={materials} onChange={e=>setMaterials(e.target.value)} placeholder="Например: подшипник 6204 — 1 шт"/>
            </div>
            <label className={cn("tk-card p-3 flex items-start gap-2.5 cursor-pointer transition",declPost&&'border-tk-green')}>
              <input type="checkbox" checked={declPost} onChange={()=>setDeclPost(v=>!v)} className="mt-0.5 w-5 h-5 accent-tk-green shrink-0"/>
              <span className="text-xs font-bold leading-snug">{DECL_POST} <span className="font-normal" style={{color:'var(--tk-muted)'}}>(если применимо к этой работе — не для всех нарядов требуется)</span></span>
            </label>
          </div>}
          {step===2&&<div className="space-y-3">
            {masterBefore.length>0?<div>
              <div className="text-[11px] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Фото до (зафиксировано до начала работ)</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">{masterBefore.map((p,i)=><img key={i} src={p} className="h-24 rounded-lg" alt="До"/>)}</div>
            </div>:<div className="tk-sub p-2.5 text-[11px] font-bold" style={{color:'var(--tk-muted)'}}>Фото до отсутствует — приёмочное фото снимается до начала работ, здесь его добавить нельзя.</div>}
            <div>
              <div className="text-[11px] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>Фото после{needPhoto?' (обязательно — внеплановый наряд)':''}</div>
              <div className="flex gap-2 flex-wrap items-center">
                {after.map((p,i)=><img key={i} src={p} className="h-24 rounded-lg border-2 border-tk-green" alt="После"/>)}
                <label className="h-24 w-24 border-2 border-dashed border-tk-green rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-[10px] font-bold text-tk-green">
                  <Camera size={18}/>Снять<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>addPh(e.target.files?.[0])}/></label>
              </div>
            </div>
            {masterBefore.length>0&&after.length>0&&<div className="grid grid-cols-2 gap-2">
              <div className="text-center"><div className="text-[9px] font-black uppercase mb-1" style={{color:'var(--tk-muted)'}}>До</div><img src={masterBefore[0]} className="w-full h-28 object-cover rounded-lg border" style={{borderColor:'var(--tk-border)'}} alt="До"/></div>
              <div className="text-center"><div className="text-[9px] font-black uppercase mb-1 text-tk-green">После</div><img src={after[0]} className="w-full h-28 object-cover rounded-lg border-2 border-tk-green" alt="После"/></div>
            </div>}
          </div>}
        </div>
        <div className="p-3.5 border-t grid grid-cols-2 gap-2" style={{borderColor:'var(--tk-border)',background:'var(--tk-card)'}}>
          {step>0?<button onClick={()=>setStep(s=>s-1)} className="tk-touch tk-sub uppercase text-xs"><ArrowLeft size={14} className="inline mr-1"/>Назад</button>
            :<button onClick={()=>setWiz(false)} className="tk-touch tk-sub uppercase text-xs">Отмена</button>}
          {step<2?<button onClick={()=>setStep(s=>s+1)} disabled={!stepOk[step]} className="tk-touch bg-tk-amber text-black border border-amber-600 uppercase text-xs disabled:opacity-40">Далее<ArrowRight size={14} className="inline ml-1"/></button>
            :<button onClick={complete} disabled={busy||!canSend} className="tk-touch bg-tk-green text-white border border-emerald-600 uppercase text-xs disabled:opacity-40"><Check size={14} className="inline mr-1"/>{busy?'Отправка…':'На проверку мастеру'}</button>}
        </div>
      </div>
    </div>}
  </div>
}
