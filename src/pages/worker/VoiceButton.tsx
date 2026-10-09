import {useEffect,useRef,useState} from 'react'
import {Mic,MicOff} from 'lucide-react'
import {useLocale} from '../../lib/locale'
import {createDictation,speechConstructor,speechLanguage,type VoiceError} from '../../lib/voice-input.mjs'
import {voiceError,voicePrivacyNote,voiceConsentLabel} from '../../lib/voice-copy.mjs'
export default function VoiceButton({onText}:{onText:(t:string)=>void}){
 const {locale}=useLocale();const kz=locale==='kz';const pick=(ru:string,kk:string)=>kz?kk:ru
 const [on,setOn]=useState(false),[consent,setConsent]=useState(false),[info,setInfo]=useState(false),[error,setError]=useState<VoiceError|null>(null)
 const callback=useRef(onText);callback.current=onText;const rec=useRef<ReturnType<typeof createDictation>|null>(null);const supported=!!speechConstructor(window)
 useEffect(()=>{rec.current=createDictation({host:window,lang:speechLanguage(locale),onText:text=>callback.current(text),onState:setOn,onError:setError});setOn(false);setError(null);return()=>{rec.current?.dispose();rec.current=null}},[locale])
 return <section className="report-voice-control" aria-label={pick('Диктовка отчёта','Есепті дауыспен енгізу')}><button type="button" className="report-voice-info" aria-label="О диктовке" onClick={()=>setInfo(v=>!v)}>?</button><button type="button" className="report-voice-mic" aria-label={pick('Надиктовать голосом','Дауыспен енгізу')} aria-pressed={on} onClick={()=>{if(!supported){setError('unsupported');return}if(!consent){setInfo(true);return}setError(null);if(on)rec.current?.stop();else rec.current?.start()}}>{on?<MicOff size={24}/>:<Mic size={24}/>}</button>{info&&<div className="report-voice-consent"><p>{voicePrivacyNote[kz?1:0]}</p><p>{pick('Точность RU/KZ не измерена. Проверьте текст.','RU/KZ дәлдігі өлшенбеген. Мәтінді тексеріңіз.')}</p>{!consent&&<button type="button" className="tk-touch" onClick={()=>{setConsent(true);setInfo(false);rec.current?.start()}}>{pick('Разрешить диктовку','Дауыспен енгізуге рұқсат')}</button>}<button type="button" className="tk-touch tk-sub" onClick={()=>setInfo(false)}>{pick('Закрыть','Жабу')}</button></div>}{error&&<p role="status">{voiceError(error,kz)}</p>}{on&&<p role="status">{pick('Слушаю. Текст остаётся черновиком.','Тыңдап тұрмын. Мәтін жоба болып қалады.')}</p>}</section>
}
