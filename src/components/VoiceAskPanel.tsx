import {useEffect,useRef,useState} from 'react'
import {Mic,MicOff,Send,PhoneOff} from 'lucide-react'
import {useLocale} from '../lib/locale'
import {createDictation,speechConstructor,speechLanguage,type VoiceError} from '../lib/voice-input.mjs'
import {voiceError,voicePrivacyNote,voiceConsentLabel,voiceAskFailed} from '../lib/voice-copy.mjs'
import {cn} from '../lib/utils'
// Self-contained voice Q&A panel: consent gate, dictation, error states and a
// typed fallback. No data-layer import: the caller wires onAsk.
export default function VoiceAskPanel({onAsk,onClose}:{onAsk:(text:string)=>Promise<string>;onClose?:()=>void}){
  const {locale,setLocale}=useLocale();const kz=locale==='kz';const pick=(ru:string,kk:string)=>kz?kk:ru
  const [infoOpen,setInfoOpen]=useState(false);const [consent,setConsent]=useState(false),[listening,setListening]=useState(false)
  const [heard,setHeard]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false)
  const [err,setErr]=useState<VoiceError|null>(null),[askErr,setAskErr]=useState(''),[typed,setTyped]=useState('')
  const supported=!!speechConstructor(window)
  const busyRef=useRef(false);const inputRef=useRef<HTMLInputElement>(null)
  const ask=async(t:string)=>{const q=t.trim();if(!q||busyRef.current)return
    busyRef.current=true;setHeard(q);setBusy(true);setAskErr('');setAnswer('');setErr(null)
    try{setAnswer(await onAsk(q));setTyped(cur=>cur===q?'':cur)}catch{setAskErr(voiceAskFailed[kz?1:0]);inputRef.current?.focus()}finally{busyRef.current=false;setBusy(false)}}
  const askRef=useRef(ask);askRef.current=ask
  const rec=useRef<ReturnType<typeof createDictation>|null>(null)
  useEffect(()=>{rec.current=createDictation({host:window,lang:speechLanguage(locale),
    onText:t=>{if(busyRef.current){rec.current?.stop();return}setTyped(cur=>cur?cur+' '+t:t);setHeard(t);rec.current?.stop()},onState:setListening,onError:e=>{setErr(e);inputRef.current?.focus()}})
    setListening(false);setErr(null)
    return()=>{rec.current?.dispose();rec.current=null}},[locale])
  return <div className="ptah-call-body w-full space-y-3 min-w-0" aria-label={pick('Голосовой вопрос ассистенту','Көмекшіге дауыстық сұрақ')}>
    <div className="ptah-call-language"><button onClick={()=>setLocale('ru')} aria-pressed={!kz}>RU</button><button onClick={()=>setLocale('kz')} aria-pressed={kz}>ҚАЗ</button></div>
    <div className="ptah-call-avatar"><img src="/ptah-avatar.png" alt="Ptah"/><span className="avatar-ai-chip">ИИ</span></div>
    <button className="call-info-trigger" aria-label="О распознавании голоса" onClick={()=>setInfoOpen(v=>!v)}>?</button>{infoOpen&&<div className="call-privacy"><p>{voicePrivacyNote[kz?1:0]}</p><p>{''}</p></div>}
    {supported&&<>
      <label className="flex items-start gap-2 text-[0.6875rem] leading-relaxed">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked){rec.current?.dispose();setListening(false)}}}/>
        <span>{pick('Разрешаю распознавание голоса','Дауысты тануға рұқсат беремін')}</span>
      </label>
      <div className="ptah-call-controls flex items-center justify-around gap-2"><div className="call-control"><button className="call-mute" aria-label={pick('Остановить микрофон','Микрофонды тоқтату')} disabled={!listening} onClick={()=>rec.current?.stop()}><MicOff size={26}/></button><span>{pick('Без звука','Дыбыссыз')}</span></div>
        {onClose&&<div className="call-control"><button className="ptah-call-end" onClick={onClose} aria-label="Закрыть голосовой ввод"><PhoneOff size={29}/></button><span>{pick('Завершить','Аяқтау')}</span></div>}
        <div className="call-control">
        <button type="button" disabled={!consent||busy} aria-pressed={listening}
          aria-label={listening?pick('Остановить голосовой вопрос','Дауыстық сұрақты тоқтату'):pick('Начать голосовой вопрос','Дауыстық сұрақты бастау')}
          onClick={()=>{setErr(null);if(listening)rec.current?.stop();else rec.current?.start()}}
          className={cn("w-24 h-24 rounded-full flex items-center justify-center border-4 transition disabled:opacity-50",listening?'bg-tk-amber text-black border-amber-400 pulse-ring-anim':'tk-sub text-tk-amber')}>
          <Mic size={28}/>
        </button><span>{pick('Говорить','Сөйлеу')}</span></div>
      </div>
        <div className="ptah-listening-pill flex items-end gap-1 h-11">{listening?[0,1,2,3,4].map(i=><div key={i} className="hud-wave-bar"/>):<div className="text-[0.6875rem] font-bold" style={{color:'var(--tk-muted)'}}>{busy?pick('Отправляю вопрос…','Сұрақ жіберілуде…'):pick('Готов слушать','Тыңдауға дайын')}</div>}</div>
      <p role="status" aria-live="polite" className="text-[0.625rem] leading-relaxed text-center" style={{color:err?'var(--tk-red,#f87171)':'var(--tk-muted)'}}>
        {err?voiceError(err,kz):listening?pick('Слушаю. Затем проверьте и отправьте текст.','Тыңдап тұрмын. Төмендегі мәтінді тексеріңіз.'):''}
      </p>
    </>}
    {!supported&&<p role="status" className="text-[0.6875rem] leading-relaxed text-center">{voiceError('unsupported',kz)}</p>}
    {heard&&<div className="w-full tk-sub p-2.5 text-xs"><span className="text-[0.5625rem] font-black uppercase block" style={{color:'var(--tk-muted)'}}>{pick('Вы сказали','Сіз айттыңыз')}</span>{heard}</div>}
    {busy&&<div className="w-full tk-sub p-2.5 text-xs" style={{color:'var(--tk-muted)'}}>{pick('Думаю…','Ойлануда…')}</div>}
    {answer&&<div className="w-full tk-sub p-2.5 text-xs leading-relaxed"><span className="text-[0.5625rem] font-black uppercase block text-tk-amber">{pick('Ответ','Жауап')}</span>{answer}</div>}
    {askErr&&<div role="status" className="w-full text-[0.6875rem] font-bold text-center" style={{color:'var(--tk-red,#f87171)'}}>{askErr}</div>}
    <div className="call-typed-field w-full flex gap-2 items-center">
      <input className="tk-input flex-1 min-w-0 px-3 py-2 text-sm" value={typed} onChange={e=>setTyped(e.target.value)}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(busyRef.current)return;ask(typed)}}}
        placeholder={pick('Или введите вопрос текстом…','Немесе сұрақты мәтінмен енгізіңіз…')} ref={inputRef} aria-label={pick('Вопрос текстом','Мәтіндік сұрақ')}/>
      <button type="button" disabled={!typed.trim()||busy} aria-label={pick('Отправить вопрос','Сұрақты жіберу')} onClick={()=>{if(busyRef.current)return;ask(typed)}}
        className="h-11 w-11 shrink-0 rounded-xl bg-tk-amber text-black grid place-items-center disabled:opacity-50"><Send size={18}/></button>
    </div>
  </div>
}
