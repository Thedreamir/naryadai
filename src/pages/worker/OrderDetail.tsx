import {useEffect, useState} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import * as H from '../../lib/data'
import {eventLabel} from '../../lib/status'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import {Badge} from '../../components/ui/badge'
import VoiceButton from './VoiceButton'
import type {Actor} from '../../App'
import {Camera} from 'lucide-react'
export default function OrderDetail({actor}:{actor:Actor}){
  const {id} = useParams(); const nav = useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [permitKind,setPermitKind]=useState(''); const [permitNote,setPermitNote]=useState('')
  const [works,setWorks]=useState(''); const [fault,setFault]=useState(''); const [photos,setPhotos]=useState<string[]>([])
  const load=()=>H.state().then(setSt).catch(e=>setErr(e.message))
  useEffect(()=>{load()},[id])
  if(err) return <Card className="text-danger">{err}</Card>
  if(!st) return <div className="text-muted py-10 text-center">Загрузка…</div>
  const o = st.orders.find((x:any)=>x.id===Number(id))
  if(!o || o.assignee_id!==actor.id) return <Card>Наряд не найден или назначен другому исполнителю.</Card>
  const go=async(status:string,reason?:string,closure?:any)=>{setBusy(true);setErr('')
    try{await H.transition(o.id,{status,version:o.version,reason,closure});await load();window.scrollTo(0,0)}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const doPermit=async()=>{setBusy(true);setErr('')
    try{await H.recordPermit(o.id,{kind:permitKind,note:permitNote,version:o.version});setPermitKind('');setPermitNote('');await load()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
  const addPhoto=async(f?:File|null)=>{if(!f)return
    const c=await imageCompression(f,{maxSizeMB:0.35,maxWidthOrHeight:1600})
    const r=new FileReader(); r.onload=()=>setPhotos(p=>[...p,String(r.result)]); r.readAsDataURL(c)}
  const needPhoto = o.kind==='unplanned'
  const complete=()=>go('completed',undefined,{works,fault_code:fault,materials:[],photos,comment:''})
  return <div className="space-y-4">
    <button className="text-muted text-[14px]" onClick={()=>nav(-1)}>← Назад</button>
    <div><div className="text-[12px] text-muted">НАРЯД #{o.id} · {o.kind==='planned'?'Плановый':'Внеплановый'} · {o.priority==='emergency'?'Аварийный':o.priority==='high'?'Высокий':'Обычный'}</div>
      <h1 className="text-[22px] font-bold leading-snug">{o.title}</h1>
      <div className="text-[14px] text-muted mt-1">{o.equipment} · {o.section} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
    {o.before_photos?.length>0&&<Card><div className="text-[13px] font-semibold mb-2">Фото до</div><div className="flex gap-2 overflow-x-auto">{o.before_photos.map((p:string,i:number)=><img key={i} src={p} className="h-32 rounded-[14px]" alt="Фото до"/>)}</div></Card>}
    {!o.permit_kind&&['issued','accepted','queued'].includes(o.status)&&<Card className="space-y-3">
      <div className="text-[15px] font-semibold">Допуск к работе</div>
      <div className="text-[13px] text-muted">Отметьте допуск перед началом работ — запись уходит в журнал.</div>
      <div className="grid grid-cols-2 gap-2">{[['permit','Допуск оформлен'],['briefing','Инструктаж пройден'],['loto','Блокировки LOTO'],['not_required','Не требуется']].map(([k,l])=>
        <button key={k} onClick={()=>setPermitKind(k)} className={"h-14 rounded-[14px] border text-[14px] font-semibold px-3 leading-tight "+(permitKind===k?'bg-primary text-primary-ink border-primary':'bg-surface border-border')}>{l}</button>)}</div>
      <input className="w-full h-12 px-3 rounded-[14px] border border-border bg-bg text-[15px]" placeholder="Примечание (необязательно)" value={permitNote} onChange={e=>setPermitNote(e.target.value)}/>
      <Button size="big" className="w-full" disabled={!permitKind||busy} onClick={doPermit}>Отметить допуск</Button>
    </Card>}
    {o.permit_kind&&<Card className="text-[13px] text-muted">Допуск: {o.permit_kind}{o.permit_note?' · '+o.permit_note:''}</Card>}
    {o.status==='issued'&&<div className="space-y-2">
      <Button size="big" className="w-full" disabled={busy||!o.permit_kind} onClick={()=>go('accepted')}>Принять назначение</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button size="big" variant="outline" disabled={busy} onClick={()=>go('queued','В очередь после текущего')}>В очередь</Button>
        <Button size="big" variant="outline" disabled={busy} onClick={()=>{const r=prompt('Причина отказа');if(r)go('rejected',r)}}>Не могу</Button>
      </div></div>}
    {o.status==='accepted'&&<Button size="big" className="w-full" disabled={busy} onClick={()=>go('in_progress')}>Начать работу</Button>}
    {o.status==='queued'&&<Button size="big" className="w-full" disabled={busy} onClick={()=>go('accepted')}>Принять из очереди</Button>}
    {o.status==='in_progress'&&<>
      <Button size="big" variant="outline" className="w-full" disabled={busy} onClick={()=>go('paused','Пауза')}>Пауза</Button>
      <Card className="space-y-3">
        <div className="text-[15px] font-semibold">Закрытие наряда</div>
        <div className="flex gap-2 items-start">
          <textarea className="flex-1 min-h-28 p-3 rounded-[14px] border border-border bg-bg text-[16px]" placeholder="Что сделано и как проверено (мин. 12 символов)" value={works} onChange={e=>setWorks(e.target.value)}/>
          <VoiceButton onText={t=>setWorks(w=>w?w+' '+t:t)}/>
        </div>
        <div className="text-[12px] text-muted">Голосовой ввод: браузерная распознавалка речи, работает на демо-устройстве; точность не измерялась.</div>
        <select className="w-full h-14 px-3 rounded-[14px] border border-border bg-bg text-[16px]" value={fault} onChange={e=>setFault(e.target.value)}>
          <option value="">Шифр неисправности…</option>
          {st.fault_codes.map((f:any)=><option key={f.code} value={f.code}>{f.code} · {f.name}</option>)}
        </select>
        <label className="flex items-center justify-center gap-2 h-16 rounded-[14px] border border-dashed border-border text-[15px] font-semibold text-primary">
          <Camera size={20}/>Фото после{needPhoto?' (обязательно)':''}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={e=>addPhoto(e.target.files?.[0])}/></label>
        <div className="flex gap-2 flex-wrap">{photos.map((p,i)=><img key={i} src={p} className="h-20 rounded-[10px]" alt="Фото после"/>)}</div>
        <Button size="big" className="w-full" disabled={busy||works.trim().length<12||!fault||(needPhoto&&!photos.length)} onClick={complete}>Отправить на проверку</Button>
        <div className="text-[12px] text-muted">Решение о закрытии принимает мастер.</div>
      </Card></>}
    {o.status==='paused'&&<Button size="big" className="w-full" disabled={busy} onClick={()=>go('in_progress')}>Продолжить</Button>}
    {['completed','ai_review'].includes(o.status)&&<Card className="text-center"><Badge tone="teal">На проверке у мастера</Badge></Card>}
    {o.status==='closed'&&<Card className="space-y-2"><Badge tone="gray">Закрыт</Badge>
      {o.ai_result?.human_score&&<div className="text-[14px]">Оценка мастера: {o.ai_result.human_score} / 5</div>}
      {o.closure?.works&&<div className="text-[13px] text-muted">{o.closure.works}</div>}</Card>}
    <Card><div className="text-[13px] font-semibold mb-2">Журнал</div>
      {st.events.filter((e:any)=>e.order_id===o.id).map((e:any)=><div key={e.id} className="text-[12px] text-muted py-1 border-t border-border first:border-0">{e.actor} · {eventLabel(e.new_status)} · {new Date(e.created_at).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}{e.reason?' · '+e.reason:''}</div>)}</Card>
  </div>
}
