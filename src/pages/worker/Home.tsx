import {isTechnicalTitle,savedPresentation,setPresentation} from '../../lib/presentation'
import {useOrderState} from '../../lib/use-order-state'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Link, useNavigate} from 'react-router-dom'
import {MapPin, Phone, ChevronRight, TriangleAlert, Lightbulb, Zap, Clock, ClipboardCheck, ShieldCheck, Timer} from 'lucide-react'
import {PriorChip} from '../../components/PriorChip'
import type {Actor} from '../../App'
function Countdown({deadline}:{deadline:string}){
  const [,tick]=useState(0)
  useEffect(()=>{const t=setInterval(()=>tick(x=>x+1),1000);return()=>clearInterval(t)},[])
  const ms=new Date(deadline).getTime()-Date.now()
  const over=ms<0; const s=Math.abs(Math.floor(ms/1000))
  const hh=String(Math.floor(s/3600)).padStart(2,'0'), mm=String(Math.floor(s%3600/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0')
  return <><div className={"deadline-digits "+(over?'text-tk-red':'text-tk-amber')}>{hh}<span>:</span>{mm}<span>:</span>{ss}</div><div className="deadline-caption">{over?'Срок пропущен на':'Осталось до срока'}</div></>
}
export default function WorkerHome({actor}:{actor:Actor}){
  const {st,error:stateError,refresh}=useOrderState(); const [err,setErr]=useState('')
  const [pres,setPres]=useState(savedPresentation())
  const [note,setNote]=useState<any>(null)
  const [dismissed,setDismissed]=useState<number[]>(()=>{try{return JSON.parse(sessionStorage.getItem('tk-em-dismissed')||'[]')}catch{return[]}})
  const nav=useNavigate()
  const [liveAlerts,setLiveAlerts]=useState<any[]>([])
  useEffect(()=>H.watchNotifications((n:any)=>setLiveAlerts(a=>[n,...a].slice(0,3))),[])
  const mine=st?st.orders.filter((o:any)=>o.assignee_id===actor.id&&(!pres||!isTechnicalTitle(o.title))):[]
  const current=mine.find((o:any)=>o.status==='in_progress')
  const queue=mine.filter((o:any)=>['issued','queued','accepted','paused'].includes(o.status))
  const emergency=mine.find((o:any)=>o.priority==='emergency'&&o.status==='issued'&&!dismissed.includes(o.id))
  useEffect(()=>{ // real shift note: last closure note for current order's equipment
    if(!current){setNote(null);return}
    H.equipmentHistory(current.equipment_id).then((h:any)=>{
      const last=(h.orders||[]).find((x:any)=>x.closure?.works)
      setNote(last?{works:last.closure.works,when:last.closed_at||last.updated_at}:null)
    }).catch(()=>setNote(null))
  },[current?.id])
  const dismiss=(id:number)=>{const d=[...dismissed,id];setDismissed(d);sessionStorage.setItem('tk-em-dismissed',JSON.stringify(d))}
  if(err) return <div className="tk-card p-4 text-tk-red">{err}</div>
  if(stateError)return <div role="alert" className="tk-card p-4">Данные недоступны: {stateError}<button className="tk-touch tk-sub w-full mt-2" onClick={refresh}>Повторить</button></div>
  if(!st) return <div className="py-10 text-center" style={{color:'var(--tk-muted)'}}>Загрузка нарядов…</div>
  const eqName=(o:any)=>o.equipment||st.equipment.find((e:any)=>e.id===o.equipment_id)?.name||'—'
  const alerts=[...liveAlerts,...(st.notifications||[])].filter((n:any,i:number,arr:any[])=>arr.findIndex((x:any)=>x.id===n.id)===i).filter((n:any)=>!pres||!/(?:#|№)\s*(\d+)/.test(n.message)||!st.orders.some((o:any)=>isTechnicalTitle(o.title)&&new RegExp('(?:#|№)\\s*'+o.id+'\\b').test(n.message))).slice(0,3)
  return <div className="space-y-3">{st.offline&&<div role="status" className="tk-card p-3 text-xs text-tk-amber">Офлайн · личный снимок от {new Date(st.cachedAt).toLocaleString('ru')}. Данные могут быть устаревшими. Статусы/допуски онлайн; отчёт можно сохранить черновиком.</div>}
    {current&&<section className="worker-deadline-panel" aria-label="Срок текущего наряда"><div className="deadline-top"><Timer size={22}/><strong>Срок наряда №{current.id}</strong></div><Countdown deadline={current.deadline}/><div className="deadline-date">Срок: {new Date(current.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></section>}
    {current?<div className="tk-card p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className={"text-[0.625rem] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 "+(current.priority==='emergency'?'bg-tk-red text-white':current.priority==='high'?'bg-tk-amber text-black':'tk-sub')}>
          {current.priority==='emergency'?<><TriangleAlert size={19} strokeWidth={2.5}/>Аварийный</>:current.priority==='high'?<><Zap size={19} strokeWidth={2.5}/>Высокий приоритет</>:'Обычный'}
        </span>
        <span className="text-xs font-mono font-bold" style={{color:'var(--tk-muted)'}}>№ {current.id}</span>
      </div>
      <h2 className="text-base font-black leading-snug">{current.title}</h2>
      <div className="tk-sub p-2.5 flex items-center justify-between text-xs">
        <div className="font-bold flex items-center gap-1.5"><MapPin size={19} className="text-tk-amber"/><span>{eqName(current)}{current.section?' ('+current.section+')':''}</span></div>
      </div>
      {note&&<div className="bg-tk-amber/10 border border-tk-amber/40 rounded-lg p-2 text-xs flex items-center gap-2">
        <Lightbulb size={19} className="text-tk-amber shrink-0"/>
        <div className="text-[0.6875rem] leading-tight">
          <strong className="text-tk-amber block">Последняя запись по этому узлу:</strong>
          «{note.works}»
        </div>
      </div>}
      <div className="text-xs font-bold">
        <div className="tk-sub p-2 rounded-lg border-l-4 border-l-tk-green">
          <span className="text-[0.625rem] block" style={{color:'var(--tk-muted)'}}>ДОПУСК{current.permit_kind?'':' · неизвестен'}</span>
          <span className={current.permit_kind?"text-tk-green font-black":"text-tk-amber font-black"}>{current.permit_kind?(current.permit_kind==='not_required'?'Не требуется':'Подтверждён'):'Не отмечен'}</span>
        </div>

      </div>
      <Link to={'/orders/'+current.id} className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase text-sm inline-flex items-center justify-center gap-2"><ClipboardCheck size={19}/>Сдать на проверку №{current.id}</Link>
    </div>:<div className="tk-card p-3.5 space-y-2">
      <div className="text-[0.6875rem] font-black tracking-wider uppercase" style={{color:'var(--tk-muted)'}}>Свободен</div>
      <div className="text-[0.9375rem] font-bold">Нет наряда в работе{queue.length?' — следующий ждёт в «Нарядах»':''}</div>
    </div>}
    <details className="worker-alerts tk-card"><summary><TriangleAlert size={19}/><strong>{emergency?"Аварийный наряд · откройте":"Уведомления"}</strong><span>{alerts.length+(emergency?1:0)}</span></summary><div>{alerts.length>0&&<div className="tk-card p-3 space-y-1.5" style={{borderLeft:'4px solid var(--color-tk-amber)'}}>
      <div className="text-[0.625rem] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style={{color:'var(--tk-muted)'}}><TriangleAlert size={14} className="text-tk-amber"/>Последние уведомления</div>
      {alerts.map((n:any)=><div key={n.id} className="text-xs font-bold flex items-center justify-between gap-2"><span className="min-w-0">{n.message}</span><span className="font-mono text-[0.625rem] shrink-0" style={{color:'var(--tk-muted)'}}>{new Date(n.created_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</span></div>)}
    </div>}{emergency&&<div className="bg-tk-red text-white rounded-xl p-3 border border-red-400 shadow-xl space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0"><TriangleAlert size={22}/></div>
        <div>
          <div className="text-[0.5625rem] uppercase font-black tracking-wider text-red-100">Аварийный наряд</div>
          <div className="font-black text-xs leading-tight">#{emergency.id} · {emergency.title}</div>
          <p className="text-[0.6875rem] text-red-100 mt-0.5">{eqName(emergency)}{emergency.section?' · '+emergency.section:''}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={()=>nav('/orders/'+emergency.id)} className="bg-white text-tk-red font-black text-xs py-2 px-1 rounded-lg active:scale-95 uppercase leading-tight min-w-0 inline-flex items-center justify-center gap-1"><Zap size={19} strokeWidth={2.5}/>Открыть наряд</button>
        <button onClick={()=>dismiss(emergency.id)} className="bg-red-950 text-white font-bold text-xs py-2 px-1 rounded-lg border border-red-500/40 active:scale-95 uppercase leading-tight min-w-0 inline-flex items-center justify-center gap-1"><Clock size={19}/>Позже</button>
      </div>
    </div>}</div></details>
    <button onClick={()=>window.dispatchEvent(new CustomEvent('naryadai:open-hud'))} className="tk-card p-3 w-full cursor-pointer transition flex items-center justify-between text-left">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-tk-amber/20 text-tk-amber flex items-center justify-center border border-tk-amber/40"><Phone size={19}/></div>
        <div>
          <div className="font-black text-xs">Голосовой ввод · черновик</div>
          <div className="text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Это не телефонный звонок. Распознавание зависит от браузера.</div>
        </div>
      </div>
      <ChevronRight size={22} style={{color:'var(--tk-muted)'}}/>
    </button>
    {queue.length>0&&<div className="space-y-2">
      <div className="text-[0.6875rem] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>В очереди · {queue.length}</div>
      {queue.slice(0,3).map((o:any)=><Link to={'/orders/'+o.id} key={o.id} className="tk-card p-3 flex items-center justify-between active:scale-[.99] transition">
        <div className="min-w-0"><div className="font-bold text-xs truncate">{o.title}</div>
          <div className="text-[0.6875rem]" style={{color:'var(--tk-muted)'}}>№ {o.id} · {eqName(o)}</div></div>
        <span className="text-[0.625rem] font-black uppercase shrink-0" style={{color:'var(--tk-muted)'}}>{o.status==='issued'?'Выдан':o.status==='queued'?'Очередь':o.status==='accepted'?'Принят':'Пауза'}</span>
      </Link>)}
    </div>}
    <label className="presentation-choice"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть тестовые наряды</label>
    <div className="text-center text-[0.625rem] font-bold pt-1" style={{color:'var(--tk-muted)'}}>Синтетические данные · решение о закрытии принимает мастер</div>
  </div>
}
