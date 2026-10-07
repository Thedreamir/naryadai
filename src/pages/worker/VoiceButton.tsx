import {useRef, useState} from 'react'
import {Mic, MicOff} from 'lucide-react'
export default function VoiceButton({onText}:{onText:(t:string)=>void}){
  const [on,setOn]=useState(false); const rec = useRef<any>(null)
  const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
  if(!SR) return null
  const toggle=()=>{
    if(on){rec.current?.stop();setOn(false);return}
    const r=new SR(); r.lang='ru-RU'; r.continuous=true; r.interimResults=false
    r.onresult=(e:any)=>{for(let i=e.resultIndex;i<e.results.length;i++) if(e.results[i].isFinal) onText(e.results[i][0].transcript)}
    r.onend=()=>setOn(false); r.onerror=()=>setOn(false)
    rec.current=r; r.start(); setOn(true)
  }
  return <button type="button" onClick={toggle} className={"h-16 w-16 rounded-[14px] grid place-items-center border "+(on?'bg-danger text-white border-danger':'bg-surface text-primary border-border')} aria-label={on?'Остановить диктовку':'Надиктовать голосом'}>
    {on?<MicOff size={26}/>:<Mic size={26}/>}</button>
}
