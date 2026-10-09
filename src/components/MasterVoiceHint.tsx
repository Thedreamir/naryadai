import {useEffect,useRef,useState} from 'react'
import {Volume2,VolumeX} from 'lucide-react'
import {useLocale} from '../lib/locale'
import {masterVoiceHint} from '../lib/voice-input.mjs'
export default function MasterVoiceHint({order}:{order:any}){
  const {locale}=useLocale();const kz=locale==='kz'
  const [consent,setConsent]=useState(false),[speaking,setSpeaking]=useState(false),[error,setError]=useState('')
  const token=useRef(0);const hint=masterVoiceHint(order)
  const supported=typeof window.speechSynthesis!=='undefined'&&typeof window.SpeechSynthesisUtterance!=='undefined'
  const stop=()=>{token.current++;if(supported)window.speechSynthesis.cancel();setSpeaking(false)}
  useEffect(()=>{setSpeaking(false);return()=>{token.current++;if(supported)window.speechSynthesis.cancel()}},[order.id,hint,locale,supported])
  const speak=()=>{if(!supported||!consent)return;stop();setError('');const id=++token.current;const u=new SpeechSynthesisUtterance(hint);u.lang='ru-RU';u.rate=1;u.onend=()=>{if(id===token.current)setSpeaking(false)};u.onerror=()=>{if(id===token.current){setSpeaking(false);setError(kz?'Оқу қолжетімсіз. Төмендегі мәтінді оқыңыз.':'Озвучка недоступна. Прочитайте текст ниже.')}};try{setSpeaking(true);window.speechSynthesis.speak(u)}catch{setSpeaking(false);setError(kz?'Оқу қолжетімсіз.':'Озвучка недоступна.')}}
  return <section className="border border-border rounded-xl p-3 space-y-2 min-w-0" aria-label="Голосовая подсказка мастеру">
    <h2 className="font-semibold text-sm">{kz?'Шеберге дауыстық көмек':'Голосовая подсказка мастеру'}</h2>
    <p className="text-xs leading-relaxed">{hint}</p>
    <p className="text-xs text-muted">{kz?'Нақты кеңес мәтіні орыс тілінде. Оқу тек түймемен қосылады.':'Подсказка из карточки и правил, не голосовая модель. Озвучка только по кнопке.'}</p>
    {supported?<><label className="flex gap-2 items-start py-2 text-xs"><input type="checkbox" className="w-5 h-5 shrink-0" checked={consent} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)stop()}}/><span>{kz?'Браузерде оқуға рұқсат беремін. Жақын адамдар естуі мүмкін; мәтінді браузер қызметі өңдеуі мүмкін.':'Разрешаю браузерную озвучку. Содержание могут слышать окружающие; текст может обрабатывать сервис браузера.'}</span></label>
    <button type="button" disabled={!consent} aria-pressed={speaking} onClick={speaking?stop:speak} className="min-h-12 w-full rounded-xl border border-border px-3 py-2 flex items-center justify-center gap-2 disabled:opacity-50">{speaking?<VolumeX size={20}/>:<Volume2 size={20}/>}<span>{speaking?(kz?'Тоқтату':'Остановить озвучку'):(kz?'Кеңесті орысша оқу':'Озвучить подсказку')}</span></button></>:<p className="text-xs" role="status">{kz?'Браузер оқуды қолдамайды. Мәтін жоғарыда.':'Браузер не поддерживает озвучку. Подсказка доступна текстом выше.'}</p>}
    {error&&<p role="status" className="text-xs">{error}</p>}
  </section>
}
