import {lazy,Suspense} from 'react'
const Knowledge=lazy(()=>import('./pages/master/Knowledge'))
import Equipment from './pages/master/Equipment'
import {useEffect, useState} from 'react'
import {Routes, Route, Navigate} from 'react-router-dom'
import * as H from './lib/data'
import Login from './pages/Login'
import WorkerShell from './layouts/WorkerShell'
import WorkerHome from './pages/worker/Home'
import WorkerOrders from './pages/worker/Orders'
import WorkerOrderDetail from './pages/worker/OrderDetail'
import WorkerProfile from './pages/worker/Profile'
import WorkerAssistant from './pages/worker/Assistant'
import WorkerSettings from './pages/worker/Settings'
import VoiceHud from './pages/worker/VoiceHud'
import {UiPrefsProvider} from './ui/prefs'
import MasterShell from './layouts/MasterShell'
import Board from './pages/master/Board'
import Review from './pages/master/Review'
import MasterOrderDetail from './pages/master/OrderDetail'
import Issue from './pages/master/Issue'
import Closed from './pages/master/Closed'
import Handover from './pages/master/Handover'
import Report from './pages/master/Report'
import Memory from './pages/master/Memory'
import LeaderHome from './pages/leader/LeaderHome'
export type Actor = {id:string, email:string, role:string, name:string}
export default function App(){
  const [actor, setActor] = useState<Actor|null>(null)
  const [ready, setReady] = useState(false)
  useEffect(()=>{(async()=>{
    try{
      const ok = await H.restoreSession()
      if(ok){ const st = await H.state(); setActor((st as any).actor) }
    }catch{/* not logged in */}
    setReady(true)
  })()},[])
  if(!ready) return <div className="min-h-screen grid place-items-center" style={{background:'#12161E',color:'#94A3B8'}}>Загрузка…</div>
  if(!actor) return <Login onLogin={setActor}/>
  if(actor.role==='worker') return <UiPrefsProvider><WorkerShell actor={actor}><Routes><Route path="/" element={<WorkerHome actor={actor}/>}/><Route path="/equipment/:id" element={<Equipment actor={actor}/>}/><Route path="/orders" element={<WorkerOrders actor={actor}/>}/><Route path="/orders/:id" element={<WorkerOrderDetail actor={actor}/>}/><Route path="/current" element={<WorkerHome actor={actor}/>}/><Route path="/assistant" element={<WorkerAssistant actor={actor}/>}/><Route path="/settings" element={<WorkerSettings/>}/><Route path="/report" element={<WorkerProfile actor={actor}/>}/><Route path="/profile" element={<WorkerProfile actor={actor}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></WorkerShell><VoiceHud actor={actor}/></UiPrefsProvider>
  if(actor.role==='master'||actor.role==='admin') return <MasterShell actor={actor}><Routes><Route path="/equipment/:id" element={<Equipment actor={actor}/>}/><Route path="/" element={<Board actor={actor}/>}/><Route path="/review" element={<Review actor={actor}/>}/><Route path="/issue" element={<Issue actor={actor}/>}/><Route path="/closed" element={<Closed actor={actor}/>}/><Route path="/handover" element={<Handover actor={actor}/>}/><Route path="/report" element={<Report actor={actor}/>}/><Route path="/knowledge" element={import.meta.env.VITE_KNOWLEDGE_PREVIEW==='true'?<Suspense fallback={<div>Загрузка знаний…</div>}><Knowledge actor={actor}/></Suspense>:<Navigate to="/" replace/>}/><Route path="/memory" element={<Memory actor={actor}/>}/><Route path="/orders/:id" element={<MasterOrderDetail actor={actor}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></MasterShell>
  if(actor.role==='leader') return <LeaderHome actor={actor}/>
  return <div className="p-6">Роль {actor.role}: интерфейс в разработке (v8). <button className="underline" onClick={()=>{H.logout();location.reload()}}>Выйти</button></div>
}
