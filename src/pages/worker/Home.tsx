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
  return <span className={"font-mono font-black "+(over?'text-tk-red':'text-tk-amber')}>{over?'-':''}{hh}:{mm}:{ss}</span>
}
export default function WorkerHome({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState('')
  const [note,setNote]=useState<any>(null)
  const [dismissed,setDismissed]=useState<number[]>(()=>{try{return JSON.parse(sessionStorage.getItem('tk-em-dismissed')||'[]')}catch{return[]}})
  const nav=useNavigate()
  useEffect(()=>{H.state().then(setSt).catch(e=>setErr(e.message))},[])
  const mine=st?st.orders.filter((o:any)=>o.assignee_id===actor.id):[]
  const current=mine.find((o:any)=>o.status==='in_progress')
  const queue=mine.filter((o:any)=>['issued','queued','accepted','paused'].includes(o.status))
  const emergency=mine.find((o:any)=>o.priority==='emergency'&&o.status==='issued'&&!dismissed.includes(o.id))
  useEffect(()=>{ // real shift note: last closure note for current order's equipment
    if(!current){setNote(null);return}
    H.equipmentHistory(current.equipment_id).then((h:any)=>{
      const last=(h||[]).find((x:any)=>x.closure?.works)
      setNote(last?{works:last.closure.works,when:last.closed_at||last.updated_at}:null)
    }).catch(()=>setNote(null))
  },[current?.id])
  const dismiss=(id:number)=>{const d=[...dismissed,id];setDismissed(d);sessionStorage.setItem('tk-em-dismissed',JSON.stringify(d))}
  if(err) return <div className="tk-card p-4 text-tk-red">{err}</div>
  if(!st) return <div className="py-10 text-center" style={{color:'var(--tk-muted)'}}>Загрузка нарядов…</div>
  const eqName=(o:any)=>o.equipment||st.equipment.find((e:any)=>e.id===o.equipment_id)?.name||'—'
  return <div className="space-y-3">
    {emergency&&<div className="bg-tk-red text-white rounded-xl p-3 border border-red-400 shadow-xl space-y-2.5">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0"><TriangleAlert size={18}/></div>
        <div>
          <div className="text-[9px] uppercase font-black tracking-wider text-red-100">Аварийный наряд</div>
          <div className="font-black text-xs leading-tight">#{emergency.id} · {emergency.title}</div>
          <p className="text-[11px] text-red-100 mt-0.5">{eqName(emergency)}{emergency.section?' · '+emergency.section:''}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={()=>nav('/orders/'+emergency.id)} className="bg-white text-tk-red font-black text-xs py-2 px-1 rounded-lg active:scale-95 uppercase leading-tight min-w-0 inline-flex items-center justify-center gap-1"><Zap size={13} strokeWidth={2.5}/>Принять срочно</button>
        <button onClick={()=>dismiss(emergency.id)} className="bg-red-950 text-white font-bold text-xs py-2 px-1 rounded-lg border border-red-500/40 active:scale-95 uppercase leading-tight min-w-0 inline-flex items-center justify-center gap-1"><Clock size={13}/>Позже</button>
      </div>
    </div>}
    {current?<div className="tk-card p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className={"text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1 "+(current.priority==='emergency'?'bg-tk-red text-white':current.priority==='high'?'bg-tk-amber text-black':'tk-sub')}>
          {current.priority==='emergency'?<><TriangleAlert size={11} strokeWidth={2.5}/>Аварийный</>:current.priority==='high'?<><Zap size={11} strokeWidth={2.5}/>Высокий приоритет</>:'Обычный'}
        </span>
        <span className="text-xs font-mono font-bold" style={{color:'var(--tk-muted)'}}>№ {current.id}</span>
      </div>
      <h2 className="text-base font-black leading-snug">{current.title}</h2>
      <div className="tk-sub p-2.5 flex items-center justify-between text-xs">
        <div className="font-bold flex items-center gap-1.5"><MapPin size={13} className="text-tk-amber"/><span>{eqName(current)}{current.section?' ('+current.section+')':''}</span></div>
      </div>
      {note&&<div className="bg-tk-amber/10 border border-tk-amber/40 rounded-lg p-2 text-xs flex items-center gap-2">
        <Lightbulb size={15} className="text-tk-amber shrink-0"/>
        <div className="text-[11px] leading-tight">
          <strong className="text-tk-amber block">Последняя запись по этому узлу:</strong>
          «{note.works}»
        </div>
      </div>}
      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
        <div className="tk-sub p-2 rounded-lg border-l-4 border-l-tk-green">
          <span className="text-[10px] block" style={{color:'var(--tk-muted)'}}>ДОПУСК{current.permit_kind?'':' · неизвестен'}</span>
          <span className={current.permit_kind?"text-tk-green font-black":"text-tk-amber font-black"}>{current.permit_kind?(current.permit_kind==='not_required'?'Не требуется':'Подтверждён'):'Не отмечен'}</span>
        </div>
        <div className="tk-sub p-2 rounded-lg border-l-4 border-l-tk-amber">
          <span className="text-[10px] block" style={{color:'var(--tk-muted)'}}>ОСТАЛОСЬ ВРЕМЕНИ</span>
          <Countdown deadline={current.deadline}/>
        </div>
      </div>
      <Link to={'/orders/'+current.id} className="tk-touch bg-tk-green text-white w-full border border-emerald-600 uppercase text-sm inline-flex items-center justify-center gap-2"><ClipboardCheck size={17}/>Сдать на проверку №{current.id}</Link>
    </div>:<div className="tk-card p-3.5 space-y-2">
      <div className="text-[11px] font-black tracking-wider uppercase" style={{color:'var(--tk-muted)'}}>Свободен</div>
      <div className="text-[15px] font-bold">Нет наряда в работе{queue.length?' — следующий ждёт в «Нарядах»':''}</div>
    </div>}
    <button onClick={()=>window.dispatchEvent(new CustomEvent('naryadai:open-hud'))} className="tk-card p-3 w-full cursor-pointer transition flex items-center justify-between text-left">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-tk-amber/20 text-tk-amber flex items-center justify-center border border-tk-amber/40"><Phone size={17}/></div>
        <div>
          <div className="font-black text-xs">AI-вызов — голосовой ввод без рук</div>
          <div className="text-[10px]" style={{color:'var(--tk-muted)'}}>Говорите — ассистент отвечает текстом. Распознавание зависит от браузера.</div>
        </div>
      </div>
      <ChevronRight size={14} style={{color:'var(--tk-muted)'}}/>
    </button>
    {queue.length>0&&<div className="space-y-2">
      <div className="text-[11px] font-black uppercase tracking-wider px-1" style={{color:'var(--tk-muted)'}}>В очереди · {queue.length}</div>
      {queue.slice(0,3).map((o:any)=><Link to={'/orders/'+o.id} key={o.id} className="tk-card p-3 flex items-center justify-between active:scale-[.99] transition">
        <div className="min-w-0"><div className="font-bold text-xs truncate">{o.title}</div>
          <div className="text-[11px]" style={{color:'var(--tk-muted)'}}>№ {o.id} · {eqName(o)}</div></div>
        <span className="text-[10px] font-black uppercase shrink-0" style={{color:'var(--tk-muted)'}}>{o.status==='issued'?'Выдан':o.status==='queued'?'Очередь':o.status==='accepted'?'Принят':'Пауза'}</span>
      </Link>)}
    </div>}
    <div className="text-center text-[10px] font-bold pt-1" style={{color:'var(--tk-muted)'}}>Синтетические данные · решение о закрытии принимает мастер</div>
  </div>
}
