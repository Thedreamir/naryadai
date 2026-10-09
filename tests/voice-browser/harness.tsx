import '../../src/mobile-accessibility.css'
import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import VoiceButton from '../../src/pages/worker/VoiceButton'
import MasterVoiceHint from '../../src/components/MasterVoiceHint'
import VoiceAskPanel from '../../src/components/VoiceAskPanel'
import '../../src/index.css'
declare global{interface Window{__ask?:string[]}}
function Harness(){const [works,setWorks]=useState('Заменён сальник.')
  const ask=async(t:string)=>{(window.__ask=window.__ask||[]).push(t);await new Promise(r=>setTimeout(r,(window as any).__askDelay||0));return 'Срок: завтра 17:00 (проверочный ответ).'}
  return <main style={{padding:16,maxWidth:430,margin:'auto'}}><h1 className="text-xl font-bold mb-4">Отчёт исполнителя</h1><textarea aria-label="Выполненные работы" className="tk-input w-full min-h-24 p-3" value={works} onChange={e=>setWorks(e.target.value)}/><VoiceButton onText={t=>setWorks(w=>w+' '+t)}/><div className="mt-6"><MasterVoiceHint order={{id:124,closure:{works,photos:[]},ai_result:{reasons:['Нет фото после ремонта.']}}}/></div><div className="mt-6 tk-card p-4" id="askpanel"><VoiceAskPanel onAsk={ask}/></div></main>}
document.body.classList.add('theme-light');
createRoot(document.getElementById('root')!).render(<Harness/>);
