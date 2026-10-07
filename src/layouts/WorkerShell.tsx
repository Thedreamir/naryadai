import type {ReactNode} from 'react'
import {NavLink, useLocation, useNavigate} from 'react-router-dom'
import {motion} from 'framer-motion'
import HeroIcon from '../components/HeroIcon'
import type {HeroName} from '../components/HeroIcon'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
import {usePrefs} from '../ui/prefs'
const tabs:{to:string;icon:HeroName;label:string}[] = [
  {to:'/', icon:'wrenchScrewdriver', label:'В работе'},
  {to:'/orders', icon:'clipboardDocumentCheck', label:'Наряды'},
  {to:'/assistant', icon:'chatBubbleLeftRight', label:'AI чат'},
  {to:'/settings', icon:'cog6Tooth', label:'Настройки'},
  {to:'/profile', icon:'userCircle', label:'Профиль'},
]
export default function WorkerShell({actor, children}:{actor:Actor, children:ReactNode}){
  const loc=useLocation(); const nav=useNavigate(); const {glove}=usePrefs()
  const openHud=()=>window.dispatchEvent(new CustomEvent('naryadai:open-hud'))
  return <div className="h-dvh flex flex-col" style={{background:'var(--tk-bg)',color:'var(--tk-ink)'}}>
    <header className="shrink-0 z-20 border-b px-3.5 py-2.5 flex items-center justify-between" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-11 h-11 rounded-lg bg-tk-amber text-black flex items-center justify-center font-black text-base shrink-0">НА</div>
        <div>
          <h1 className="font-extrabold text-sm tracking-tight uppercase flex items-center gap-1.5 leading-none whitespace-nowrap">
            <span>НарядAI</span>
            {glove&&<span title="Режим перчаток включён" className="shrink-0 bg-tk-amber/20 text-tk-amber border border-tk-amber/50 p-1 rounded flex items-center"><HeroIcon name="handRaised" size={16}/></span>}
          </h1>
          <p className="text-[0.5625rem] font-bold mt-0.5 leading-tight" style={{color:'var(--tk-muted)'}}>Тестовый проект · синтетические данные</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={openHud} className="bg-tk-amber text-black font-black text-[0.6875rem] px-2.5 py-1.5 rounded-lg border border-amber-600 active:scale-95 flex items-center gap-1 uppercase tracking-wide">
          <HeroIcon name="phone" active size={22}/>AI
        </button>
        <button onClick={()=>nav('/settings')} className="w-10 h-10 rounded-lg bg-tk-slate text-white flex items-center justify-center active:scale-95" title="Настройки">
          <HeroIcon name="cog6Tooth" size={22}/>
        </button>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3"><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
    <nav className="shrink-0 border-t w-full" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-20">
        {tabs.map(t=><NavLink key={t.to} to={t.to} end={t.to==='/'} className={({isActive})=>cn('flex flex-col items-center justify-center w-full h-full transition', isActive?'text-tk-amber':'')} style={undefined as any}>
          {({isActive})=><span className={cn('flex flex-col items-center justify-center',isActive?'text-tk-amber':'') } style={isActive?undefined:{color:'var(--tk-muted)'}}>
            <HeroIcon name={t.icon} active={isActive} size={22} className="mb-0.5"/><span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center">{t.label}</span>
          </span>}
        </NavLink>)}
      </div>
    </nav>
  </div>
}
