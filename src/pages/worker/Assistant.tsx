import {useEffect, useRef, useState} from 'react'
import * as H from '../../lib/data'
import {Send, Mic, MicOff, Headset, UserRound, BookOpen, Info} from 'lucide-react'
import type {Actor} from '../../App'
import {cn} from '../../lib/utils'
type Msg={from:'me'|'ai';text:string;mode?:string;sources?:string[]}
const SR:any=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
export default function Assistant({actor}:{actor:Actor}){
  const [msgs,setMsgs]=useState<Msg[]>([{from:'ai',text:'Задайте вопрос по наряду или оборудованию. Отвечаю только по данным системы и демо-документации — если данных нет, скажу прямо.'}])
  const [input,setInput]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [orderId,setOrderId]=useState<number|null>(null)
  const [listening,setListening]=useState(false); const recRef=useRef<any>(null)
  const bottomRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{H.state().then(st=>{const cur=st.orders.find((o:any)=>o.assignee_id===actor.id&&o.status==='in_progress');if(cur)setOrderId(cur.id)}).catch(()=>{})},[actor.id])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[msgs])
  const send=async(text:string)=>{const t=text.trim();if(!t||busy)return
    setMsgs(m=>[...m,{from:'me',text:t}]);setInput('');setBusy(true);setErr('')
    try{const r=await H.assistantChat(t,orderId??undefined);setMsgs(m=>[...m,{from:'ai',text:r.answer,mode:r.mode,sources:r.sources}])}
    catch(e){setErr((e as Error).message);setMsgs(m=>[...m,{from:'ai',text:'Не удалось получить ответ. Проверьте связь и попробуйте ещё раз.'}])}
    finally{setBusy(false)}}
  const toggleMic=()=>{
    if(listening){recRef.current?.stop();return}
    if(!SR){setErr('Распознавание речи недоступно в этом браузере — введите текст.');return}
    const rec=new SR();rec.lang='ru-RU';rec.interimResults=false;recRef.current=rec
    rec.onresult=(e:any)=>{const t=e.results[0]?.[0]?.transcript||'';if(t)send(t)}
    rec.onend=()=>setListening(false)
    rec.onerror=()=>{setListening(false);setErr('Микрофон недоступен или распознавание прервано — введите текст.')}
    setListening(true);try{rec.start()}catch{setListening(false)}
  }
  return <div className="flex flex-col" style={{height:'calc(100dvh - 8.5rem)'}}>
    <div className="tk-card p-2.5 mb-2 text-[10px] font-bold flex items-center gap-2" style={{color:'var(--tk-muted)'}}>
      <Info size={13} className="text-tk-amber shrink-0"/>
      Текстовый ассистент. Отвечает только по данным наряда и демо-документации (синтетической, не заводской); без данных отвечает «нет данных». Ничего не меняет в нарядах.
      {orderId&&<span className="text-tk-amber">· контекст: наряд #{orderId}</span>}
    </div>
    <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
      {msgs.map((m,i)=><div key={i} className={cn('flex gap-2',m.from==='me'&&'flex-row-reverse')}>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",m.from==='me'?'bg-tk-slate text-white':'bg-tk-amber text-black')}>
          {m.from==='me'?<UserRound size={13}/>:<Headset size={13}/>}</div>
        <div className={cn("rounded-xl px-3 py-2 text-xs max-w-[80%] leading-relaxed",m.from==='me'?'bg-tk-slate text-white':'tk-card')}>
          {m.text}
          {m.sources&&m.sources.length>0&&<div className="text-[9px] mt-1 opacity-70 inline-flex items-center gap-1"><BookOpen size={10}/>Источник: {m.sources.join('; ')}</div>}
          {m.mode&&<div className="text-[9px] mt-1 opacity-60">{m.mode==='live'?'ответ модели Gemini (демо, бесплатный тариф)':'ответ по правилам без модели'} · учебная документация — не применять на реальном оборудовании</div>}
        </div>
      </div>)}
      {busy&&<div className="flex gap-2"><div className="w-7 h-7 rounded-lg bg-tk-amber text-black flex items-center justify-center"><Headset size={13}/></div>
        <div className="tk-card px-3 py-2 text-xs" style={{color:'var(--tk-muted)'}}>Думаю…</div></div>}
      <div ref={bottomRef}/>
    </div>
    {err&&<div className="text-[11px] text-tk-red font-bold py-1">{err}</div>}
    <div className="pt-2 flex gap-2">
      <input className="tk-input flex-1 h-12 px-3 text-sm" placeholder="Например: что известно об этом узле?" value={input}
        onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send(input)}/>
      <button onClick={toggleMic} className={cn("w-12 h-12 rounded-xl flex items-center justify-center border transition",listening?'bg-tk-red text-white border-red-400 pulse-ring-anim':'tk-sub')} title={SR?'Голосовой ввод':'Распознавание недоступно'}>
        {listening?<MicOff size={17}/>:<Mic size={17}/>}</button>
      <button onClick={()=>send(input)} disabled={!input.trim()||busy} className="w-12 h-12 rounded-xl bg-tk-amber text-black flex items-center justify-center disabled:opacity-40 border border-amber-600"><Send size={17}/></button>
    </div>
  </div>
}
