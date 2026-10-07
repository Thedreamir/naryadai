import type {ReactNode} from 'react'
import {NavLink, useLocation, useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import PhIcon from '../components/PhIcon'
import type {PhName} from '../components/PhIcon'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
import {usePrefs} from '../ui/prefs'
const tabs:{to:string;icon:PhName;label:string}[] = [
  {to:'/', icon:'pulse', label:'В работе'},
  {to:'/orders', icon:'clipboardText', label:'Наряды'},
  {to:'/assistant', icon:'chatsCircle', label:'Ptah AI'},
  {to:'/settings', icon:'gearSix', label:'Настройки'},
  {to:'/profile', icon:'userCircle', label:'Профиль'},
]
export default function WorkerShell({actor, children}:{actor:Actor, children:ReactNode}){
  const loc=useLocation(); const nav=useNavigate(); const {glove}=usePrefs()
  const openHud=()=>window.dispatchEvent(new CustomEvent('naryadai:open-hud'))
  return <div className="worker-workspace h-dvh flex flex-col" style={{background:'var(--tk-bg)',color:'var(--tk-ink)'}}>
    <header className="shrink-0 z-20 border-b px-3.5 py-2.5 flex items-center justify-between" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-11 h-11 rounded-lg bg-tk-amber text-black flex items-center justify-center font-black text-base shrink-0">TO</div>
        <div>
          <h1 className="font-extrabold text-sm tracking-tight uppercase flex items-center gap-1.5 leading-none whitespace-nowrap">
            <span>Tekton OS</span>
            {glove&&<span title="Режим перчаток включён" className="shrink-0 bg-tk-amber/20 text-tk-amber border border-tk-amber/50 p-1 rounded flex items-center"><PhIcon name="hand" size={16}/></span>}
          </h1>
          <p className="text-[0.5625rem] font-bold mt-0.5 leading-tight" style={{color:'var(--tk-muted)'}}>Тестовый проект · синтетические данные</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={openHud} className="bg-tk-amber text-black font-black text-[0.6875rem] px-2.5 py-1.5 rounded-lg border border-amber-600 active:scale-95 flex items-center gap-1 uppercase tracking-wide">
          <PhIcon name="chatsCircle" active size={22}/>AI
        </button>
        <button onClick={()=>nav('/settings')} className="w-12 h-12 rounded-lg bg-tk-slate text-white flex items-center justify-center active:scale-95" title="Настройки">
          <PhIcon name="gearSix" size={22}/>
        </button>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3 pb-16"><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
    <nav className="shrink-0 border-t w-full" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-20">
        {tabs.map(t=><NavLink key={t.to} to={t.to} end={t.to==='/'} className={({isActive})=>cn('flex flex-col items-center justify-center w-full h-full transition', isActive?'text-tk-amber':'')} style={undefined as any}>
          {({isActive})=><span className="flex flex-col items-center justify-center gap-1" style={{color:isActive?'#f59e0b':'var(--tk-muted)'}}><PhIcon name={t.icon} active={isActive} size={24}/><span className="text-[10px] font-bold tracking-tight text-center">{t.label}</span></span>}
        </NavLink>)}
      </div>
    </nav>
  </div>
}
