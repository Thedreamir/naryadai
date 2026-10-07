import type {ReactNode} from 'react'
import {NavLink, useLocation, useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import {Activity, ListChecks, MessagesSquare, Settings, UserRound, PhoneCall, Hand} from 'lucide-react'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
import {usePrefs} from '../ui/prefs'
const tabs = [
  {to:'/', icon:Activity, label:'В работе'},
  {to:'/orders', icon:ListChecks, label:'Наряды'},
  {to:'/assistant', icon:MessagesSquare, label:'AI чат'},
  {to:'/settings', icon:Settings, label:'Настройки'},
  {to:'/profile', icon:UserRound, label:'Профиль'},
]
export default function WorkerShell({actor, children}:{actor:Actor, children:ReactNode}){
  const loc=useLocation(); const nav=useNavigate(); const {glove}=usePrefs()
  const openHud=()=>window.dispatchEvent(new CustomEvent('naryadai:open-hud'))
  return <div className="h-dvh flex flex-col" style={{background:'var(--tk-bg)',color:'var(--tk-ink)'}}>
    <header className="shrink-0 z-20 border-b px-3.5 py-2.5 flex items-center justify-between" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-tk-amber text-black flex items-center justify-center font-black text-base shrink-0">НА</div>
        <div>
          <h1 className="font-extrabold text-sm tracking-tight uppercase flex items-center gap-1.5 leading-none">
            <span>НарядAI</span>
            {glove&&<span className="text-[9px] bg-tk-amber/20 text-tk-amber border border-tk-amber/50 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5"><Hand size={9}/>ПЕРЧАТКА</span>}
          </h1>
          <p className="text-[10px] font-bold mt-0.5 leading-none" style={{color:'var(--tk-muted)'}}>Тестовый проект · синтетические данные</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={openHud} className="bg-tk-amber text-black font-black text-[11px] px-2.5 py-1.5 rounded-lg border border-amber-600 active:scale-95 flex items-center gap-1 uppercase tracking-wide">
          <PhoneCall size={12}/>AI
        </button>
        <button onClick={()=>nav('/settings')} className="w-8 h-8 rounded-lg bg-tk-slate text-white flex items-center justify-center active:scale-95" title="Настройки">
          <Settings size={14}/>
        </button>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3"><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
    <nav className="shrink-0 border-t w-full" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {tabs.map(t=><NavLink key={t.to} to={t.to} end={t.to==='/'} className={({isActive})=>cn('flex flex-col items-center justify-center w-full h-full transition', isActive?'text-tk-amber':'')} style={undefined as any}>
          {({isActive})=><span className={cn('flex flex-col items-center justify-center',isActive?'text-tk-amber':'') } style={isActive?undefined:{color:'var(--tk-muted)'}}>
            <t.icon size={18} className="mb-0.5"/><span className="text-[9px] font-black uppercase">{t.label}</span>
          </span>}
        </NavLink>)}
      </div>
    </nav>
  </div>
}
