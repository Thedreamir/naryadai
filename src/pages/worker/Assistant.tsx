import {useEffect, useRef, useState} from 'react'
import * as H from '../../lib/data'
import {Send, Mic, Headset, UserRound, BookOpen, Info, Clock3, Wrench, ShieldCheck} from 'lucide-react'
import type {Actor} from '../../App'
import {cn} from '../../lib/utils'
type Msg={from:'me'|'ai';text:string;mode?:string;sources?:string[]}
const SR:any=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
export default function Assistant({actor}:{actor:Actor}){
  const [msgs,setMsgs]=useState<Msg[]>([])
  const [input,setInput]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [orderId,setOrderId]=useState<number|null>(null)
  const [listening,setListening]=useState(false); const recRef=useRef<any>(null)
  const bottomRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{H.state().then(st=>{const cur=st.orders.find((o:any)=>o.assignee_id===actor.id&&o.status==='in_progress');if(cur)setOrderId(cur.id)}).catch(()=>{})},[actor.id])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[msgs])
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
  return <section className={"assistant-page assistant-chat "+(msgs.length===0?"assistant-empty":"")}>
    <div className="assistant-intro tk-card">
      <div className="assistant-title"><span><Headset size={26}/></span><div><h2>Ptah AI</h2><p>{orderId?'Наряд #'+orderId:'Вопрос по работе'}</p></div></div>
      <p className="assistant-demo"><Info size={16}/>Подсказка, решает человек.</p>
    </div>
    {msgs.length===0&&<div className="assistant-start"><p>Начать разговор</p><button disabled={busy} onClick={()=>send('Какой срок у моего текущего наряда?')}><Clock3 size={23}/><span>Срок наряда</span><Send size={17}/></button><button disabled={busy} onClick={()=>send('Что известно об оборудовании моего текущего наряда?')}><Wrench size={23}/><span>Оборудование</span><Send size={17}/></button></div>}
    <div className="assistant-messages" aria-live="polite">
      {msgs.map((m,i)=><div key={i} className={cn('flex gap-2',m.from==='me'&&'flex-row-reverse')}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",m.from==='me'?'bg-tk-slate text-white':'bg-tk-amber text-black')}>
          {m.from==='me'?<UserRound size={19}/>:<Headset size={19}/>}</div>
        <div className={cn("rounded-xl px-3 py-2 assistant-bubble max-w-[85%] leading-relaxed",m.from==='me'?'bg-tk-slate text-white':'tk-card')}>
          {m.text}
          {m.sources&&m.sources.length>0&&<div className="text-[0.5625rem] mt-1 opacity-70 inline-flex items-center gap-1"><BookOpen size={22}/>Источник: {m.sources.join('; ')}</div>}
          {m.mode&&<div className="text-[0.5625rem] mt-1 opacity-60">{m.mode==='live'?'ИИ':'По правилам'}</div>}
        </div>
      </div>)}
      {busy&&<div className="flex gap-2"><div className="w-8 h-8 rounded-lg bg-tk-amber text-black flex items-center justify-center"><Headset size={19}/></div>
        <div className="tk-card px-3 py-2 text-xs" style={{color:'var(--tk-muted)'}}>Думаю…</div></div>}
      <div ref={bottomRef}/>
    </div>
    {err&&<details className="assistant-error"><summary>Не получилось ответить</summary><p>{err}</p></details>}
    <div className="assistant-compose">
      <label htmlFor="assistant-question">Сообщение</label>
      <textarea id="assistant-question" className="tk-input" placeholder="Сообщение…" rows={1} value={input}
        onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input)}}}/>
      <div className="assistant-compose-actions">
        <button onClick={toggleMic} className={cn('assistant-mic tk-sub',listening&&'text-tk-red')} aria-label={listening?'Остановить запись':'Голосовой ввод'}><Mic size={21}/></button>
        <button onClick={()=>send(input)} disabled={!input.trim()||busy} aria-label="Отправить" className="assistant-send"><Send size={21}/></button>
      </div>
    </div>
  </section>
}
