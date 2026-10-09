import InternetReference from '../../components/InternetReference'
import '../../styles/ptah-experience.css'
import {useEffect, useRef, useState} from 'react'
import * as H from '../../lib/data'
import {Phone, ArrowLeft, Send, Mic, Headset, UserRound, BookOpen, Info, Clock3, Wrench} from 'lucide-react'
import type {Actor} from '../../App'
import {cn} from '../../lib/utils'
import {useLocale} from '../../lib/locale'
import {createDictation,speechConstructor,speechLanguage,type VoiceError} from '../../lib/voice-input.mjs'
import {voiceError,voicePrivacyNote,voiceConsentLabel} from '../../lib/voice-copy.mjs'
type Msg={from:'me'|'ai';text:string;at?:number;mode?:string;sources?:string[]}
export default function Assistant({actor}:{actor:Actor}){
  const {locale}=useLocale();const kz=locale==='kz';const pick=(ru:string,kk:string)=>kz?kk:ru
  const [msgs,setMsgs]=useState<Msg[]>([])
  const [input,setInput]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [orderId,setOrderId]=useState<number|null>(null)
  const [listening,setListening]=useState(false); const [consent,setConsent]=useState(false); const [showConsent,setShowConsent]=useState(false)
  const [voiceErr,setVoiceErr]=useState<VoiceError|null>(null)
  const rec=useRef<ReturnType<typeof createDictation>|null>(null)
  const supported=!!speechConstructor(window)
  const bottomRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{H.state().then(st=>{const cur=st.orders.find((o:any)=>o.assignee_id===actor.id&&o.status==='in_progress');if(cur)setOrderId(cur.id)}).catch(()=>{})},[actor.id])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[msgs])
  useEffect(()=>{rec.current=createDictation({host:window,lang:speechLanguage(locale),
    onText:t=>setInput(cur=>cur?cur+' '+t:t),onState:setListening,onError:setVoiceErr})
    setListening(false);setVoiceErr(null)
    return()=>{rec.current?.dispose();rec.current=null}},[locale])
  const sending=useRef(false)
  const send=async(text:string)=>{const t=text.trim();if(!t||sending.current)return;sending.current=true
    setMsgs(m=>[...m,{from:'me',text:t,at:Date.now()}]);setInput('');setBusy(true);setErr('')
    try{const r=await H.assistantChat(t,orderId??undefined);setMsgs(m=>[...m,{from:'ai',text:r.answer,at:Date.now(),mode:r.mode,sources:r.sources}])}
    catch(e){setInput(cur=>cur||t);setErr((e as Error).message);setMsgs(m=>[...m,{from:'ai',text:'Не удалось получить ответ. Проверьте связь и попробуйте ещё раз.'}])}
    finally{sending.current=false;setBusy(false)}}
  const toggleMic=()=>{
    if(listening){rec.current?.stop();return}
    setVoiceErr(null)
    if(!supported){setVoiceErr('unsupported');return}
    if(!consent){setShowConsent(true);return}
    rec.current?.start()
  }
  return <section className={"assistant-page assistant-chat "+(msgs.length===0?"assistant-empty":"")}>
    <header className="ptah-chat-header"><button className="ptah-back" onClick={()=>history.back()} aria-label="Назад"><ArrowLeft size={20}/></button><div><strong>Ptah AI</strong><span>{orderId?'Наряд #'+orderId:'Помощник по работе'}</span></div><button className="ptah-call-link" onClick={()=>window.dispatchEvent(new Event('naryadai:open-hud'))}><Phone size={18}/>Голос</button></header>
    {msgs.length===0&&<div className="ptah-welcome"><img src="/ptah-avatar.png" alt="Ptah"/><h2>Разберёмся вместе.</h2><p>Спросите о сроке, оборудовании или доступной инструкции. Решение остаётся за вами.</p><span>По правилам · без автоматических действий</span><div className="ptah-starter-cards">{[{label:'Срок наряда',text:'Какой срок у моего текущего наряда?'},{label:'Оборудование',text:'Что известно об оборудовании моего текущего наряда?'},{label:'История ремонта',text:'Покажи доступную историю ремонта'}].map(q=><button key={q.label} onClick={()=>setInput(q.text)}>{q.label}<ArrowLeft size={17} style={{transform:'rotate(180deg)'}}/></button>)}</div></div>}
    <div className="assistant-messages" aria-live="polite">
      {msgs.map((m,i)=><div key={i} className={cn('flex gap-2',m.from==='me'&&'flex-row-reverse')}>
        {m.from==='ai'&&<img className="ptah-reply-avatar" src="/ptah-avatar.png" alt="Ptah"/>}
        <div className={cn("rounded-xl px-3 py-2 assistant-bubble max-w-[85%] leading-relaxed",m.from==='me'?'ptah-bubble-me':'ptah-bubble-ai')}>
          {m.text}
          {m.sources&&m.sources.length>0&&<details className="ptah-source-chip"><summary>Основание · {m.mode==='live'?'ИИ':'по правилам'}</summary><p>{m.sources.join('; ')}</p>{m.at&&<time>{new Date(m.at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</time>}</details>}
        </div>
      </div>)}
      {busy&&<div className="flex gap-2"><div className="w-8 h-8 rounded-lg bg-tk-amber text-black flex items-center justify-center"><Headset size={19}/></div>
        <div className="tk-card px-3 py-2 text-xs" style={{color:'var(--tk-muted)'}}>Думаю…</div></div>}
      <div ref={bottomRef}/>
    </div>
    <details className="ptah-chat-menu"><summary aria-label="Меню чата">Ещё</summary><InternetReference/></details>
    {err&&<details className="assistant-error"><summary>Не получилось ответить</summary><p>{err}</p></details>}
    <div className="ptah-quick-replies">{[{label:'Срок наряда',text:'Какой срок у моего текущего наряда?'},{label:'Оборудование',text:'Что известно об оборудовании моего текущего наряда?'},{label:'История ремонта',text:'Покажи доступную историю ремонта'}].map(q=><button key={q.label} onClick={()=>setInput(q.text)}>{q.label}</button>)}</div>
    <div className="assistant-compose">
      <label className="sr-only" htmlFor="assistant-question">Сообщение</label>
      {showConsent&&<div className="tk-sub p-2.5 space-y-2" style={{gridColumn:'1 / -1'}}>
        <p className="text-[0.625rem] leading-relaxed" style={{color:'var(--tk-muted)'}}>{voicePrivacyNote[kz?1:0]} {pick('Распознанный текст попадает в поле сообщения и проверяется перед отправкой.','Танылған мәтін хабар өрісіне түседі және жіберу алдында тексеріледі.')}</p>
        <label className="flex items-start gap-2 text-[0.6875rem] leading-relaxed">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked){rec.current?.dispose();setListening(false)}}}/>
          <span>{voiceConsentLabel[kz?1:0]}</span>
        </label>
      </div>}
      <textarea id="assistant-question" className="tk-input" placeholder="Сообщение…" rows={1} value={input}
        onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(input)}}}/>
      <div className="assistant-compose-actions">
        {input.trim()?<button onClick={()=>send(input)} disabled={busy} aria-label="Отправить" className="assistant-send"><Send size={21}/></button>:<button onClick={toggleMic} aria-pressed={listening} className={cn('assistant-mic tk-sub',listening&&'text-tk-red')} aria-label={listening?pick('Остановить диктовку','Дауыспен енгізуді тоқтату'):pick('Надиктовать сообщение','Хабарды дауыспен енгізу')}><Mic size={21}/></button>}
      </div>
      {(voiceErr||listening)&&<p role="status" aria-live="polite" className="text-[0.625rem] leading-relaxed" style={{gridColumn:'1 / -1',color:voiceErr?'var(--tk-red,#f87171)':'var(--tk-muted)'}}>
        {voiceErr?voiceError(voiceErr,kz):pick('Слушаю. Текст попадёт в поле сообщения — проверьте перед отправкой.','Тыңдап тұрмын. Мәтін хабар өрісіне түседі — жібермес бұрын тексеріңіз.')}
      </p>}
    </div>
  </section>
}
