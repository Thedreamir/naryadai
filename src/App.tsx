import {useEffect, useState} from 'react'
import {Routes, Route, Navigate} from 'react-router-dom'
import * as H from './lib/data'
import Login from './pages/Login'
import WorkerShell from './layouts/WorkerShell'
import WorkerHome from './pages/worker/Home'
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
  if(!ready) return <div className="min-h-screen grid place-items-center text-muted">Загрузка…</div>
  if(!actor) return <Login onLogin={setActor}/>
  if(actor.role==='worker') return <WorkerShell actor={actor}><Routes><Route path="/" element={<WorkerHome actor={actor}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></WorkerShell>
  return <div className="p-6">Роль {actor.role}: интерфейс в разработке (v8). <button className="underline" onClick={()=>{H.logout();location.reload()}}>Выйти</button></div>
}
