import '../../styles/ptah-experience.css'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import * as H from '../../lib/data'
import VoiceAskPanel from '../../components/VoiceAskPanel'
import {ArrowLeft} from 'lucide-react'
import {useLocale} from '../../lib/locale'
import type {Actor} from '../../App'
export default function VoiceHud({actor}:{actor:Actor}){
  const [open,setOpen]=useState(false);const [seconds,setSeconds]=useState(0)
  useEffect(()=>{if(!open){setSeconds(0);return}const t=setInterval(()=>setSeconds(n=>n+1),1000);return()=>clearInterval(t)},[open])
  const [orderId,setOrderId]=useState<number|null>(null)
  const dialogRef=useRef<HTMLDivElement>(null)
  const {locale}=useLocale();const kz=locale==='kz'
  useEffect(()=>{const h=()=>setOpen(true);window.addEventListener('naryadai:open-hud',h);return()=>window.removeEventListener('naryadai:open-hud',h)},[])
  useEffect(()=>{if(!open)return
    H.state().then(st=>{const cur=st.orders.find((o:any)=>o.assignee_id===actor.id&&o.status==='in_progress');setOrderId(cur?cur.id:null)}).catch(()=>{})
  },[open,actor.id])
  useEffect(()=>{if(!open)return
    const previous=document.activeElement as HTMLElement|null
    const background=document.getElementById('root');const priorInert=background?.inert;const overflow=document.body.style.overflow;if(background)background.inert=true;document.body.style.overflow='hidden'
    dialogRef.current?.querySelector<HTMLElement>('input,button')?.focus()
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false)}if(e.key==='Tab'){const items=[...dialogRef.current?.querySelectorAll<HTMLElement>('button,input')||[]].filter(el=>!(el as HTMLButtonElement).disabled);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
    document.addEventListener('keydown',key)
    return()=>{document.body.style.overflow=overflow;if(background)background.inert=priorInert||false;document.removeEventListener('keydown',key);previous?.focus()}
  },[open])
  if(!open)return null
  const ask=async(text:string)=>{const r=await H.assistantChat(text,orderId??undefined);return r.answer}
  return createPortal(<div className="ptah-call-overlay fixed inset-0 z-[60] flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.92)'}}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={kz?'Дауыстық енгізу, телефон қоңырауы емес':'Голосовой ввод, не телефонный звонок'} className="voice-hud-panel w-full max-w-sm rounded-2xl border p-5 flex flex-col items-center space-y-4" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',maxHeight:'calc(100dvh - 32px)',overflowY:'auto'}}>
      <div className="ptah-call-heading"><button aria-label="Закрыть голосовой ввод" onClick={()=>setOpen(false)}><ArrowLeft size={20}/></button>Ptah AI</div>
      <time className="ptah-call-timer">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</time>
      <VoiceAskPanel onAsk={ask} onClose={()=>setOpen(false)}/>
      <div className="voice-call-caption w-full text-[0.625rem] text-center font-bold" style={{color:'var(--tk-muted)'}}>{kz?'Дауыс сұраққа айналады — көмекші мәтінмен жауап береді, дауыспен емес.':'Ответ придёт текстом'}</div>

    </div>
  </div>,document.body)
}
