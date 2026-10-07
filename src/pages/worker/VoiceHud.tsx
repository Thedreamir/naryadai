import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import * as H from '../../lib/data'
import {PhoneOff, Mic, MicOff} from 'lucide-react'
import {cn} from '../../lib/utils'
import type {Actor} from '../../App'
const SR:any=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
export default function VoiceHud({actor}:{actor:Actor}){
  const [open,setOpen]=useState(false); const [listening,setListening]=useState(false)
  const [heard,setHeard]=useState(''); const [answer,setAnswer]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [orderId,setOrderId]=useState<number|null>(null)
  const recRef=useRef<any>(null)
  useEffect(()=>{const h=()=>setOpen(true);window.addEventListener('naryadai:open-hud',h);return()=>window.removeEventListener('naryadai:open-hud',h)},[])
  useEffect(()=>{if(!open)return
    setHeard('');setAnswer('');setErr('')
    H.state().then(st=>{const cur=st.orders.find((o:any)=>o.assignee_id===actor.id&&o.status==='in_progress');setOrderId(cur?cur.id:null)}).catch(()=>{})
  },[open,actor.id])
  const start=()=>{
    if(!SR){setErr('Распознавание речи недоступно в этом браузере. AI-вызов принимает голос только там, где браузер его поддерживает.');return}
    const rec=new SR();rec.lang='ru-RU';rec.interimResults=false;recRef.current=rec
    rec.onresult=async(e:any)=>{const t=e.results[0]?.[0]?.transcript||'';if(!t)return
      setHeard(t);setBusy(true);setErr('')
      try{const r=await H.assistantChat(t,orderId??undefined);setAnswer(r.answer)}catch(ex){setErr((ex as Error).message)}finally{setBusy(false)}}
    rec.onend=()=>setListening(false)
    rec.onerror=()=>{setListening(false);setErr('Микрофон недоступен или распознавание прервано.')}
    setListening(true);setHeard('');setAnswer('');try{rec.start()}catch{setListening(false)}
  }
  const stop=()=>{recRef.current?.stop();setListening(false)}
  if(!open)return null
  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.92)'}}>
    <div className="w-full max-w-sm rounded-2xl border p-5 flex flex-col items-center space-y-4" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
      <div className="text-[0.625rem] font-black uppercase tracking-widest text-tk-amber">AI-вызов</div>
      <button onClick={listening?stop:start} className={cn("w-24 h-24 rounded-full flex items-center justify-center border-4 transition",listening?'bg-tk-amber text-black border-amber-400 pulse-ring-anim':'tk-sub')}>
        {listening?<Mic size={34}/>:<MicOff size={30}/>}
      </button>
      <div className="flex items-end gap-1 h-11">{listening?[0,1,2,3,4].map(i=><div key={i} className="hud-wave-bar"/>):<div className="text-[0.6875rem] font-bold" style={{color:'var(--tk-muted)'}}>{busy?'Отправляю вопрос…':'Нажмите и говорите'}</div>}</div>
      <div className="w-full text-[0.625rem] text-center font-bold" style={{color:'var(--tk-muted)'}}>Голос превращается в вопрос — ассистент отвечает текстом, не озвучкой.</div>
      {heard&&<div className="w-full tk-sub p-2.5 text-xs"><span className="text-[0.5625rem] font-black uppercase block" style={{color:'var(--tk-muted)'}}>Вы сказали</span>{heard}</div>}
      {busy&&<div className="w-full tk-sub p-2.5 text-xs" style={{color:'var(--tk-muted)'}}>Думаю…</div>}
      {answer&&<div className="w-full tk-sub p-2.5 text-xs leading-relaxed"><span className="text-[0.5625rem] font-black uppercase block text-tk-amber">Ответ</span>{answer}</div>}
      {err&&<div className="w-full text-[0.6875rem] text-tk-red font-bold text-center">{err}</div>}
      <button onClick={()=>{stop();setOpen(false)}} className="w-12 h-12 rounded-full bg-tk-red text-white flex items-center justify-center border border-red-400"><PhoneOff size={19}/></button>
    </div>
  </div>,document.body)
}
