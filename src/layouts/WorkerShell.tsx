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
  {to:'/assistant', icon:'chatsCircle', label:'AI чат'},
  {to:'/settings', icon:'gearSix', label:'Настройки'},
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
            {glove&&<span title="Режим перчаток включён" className="shrink-0 bg-tk-amber/20 text-tk-amber border border-tk-amber/50 p-1 rounded flex items-center"><PhIcon name="hand" size={16}/></span>}
          </h1>
          <p className="text-[0.5625rem] font-bold mt-0.5 leading-tight" style={{color:'var(--tk-muted)'}}>Тестовый проект · синтетические данные</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={openHud} className="bg-tk-amber text-black font-black text-[0.6875rem] px-2.5 py-1.5 rounded-lg border border-amber-600 active:scale-95 flex items-center gap-1 uppercase tracking-wide">
          <PhIcon name="phone" active size={22}/>AI
        </button>
        <button onClick={()=>nav('/settings')} className="w-10 h-10 rounded-lg bg-tk-slate text-white flex items-center justify-center active:scale-95" title="Настройки">
          <PhIcon name="gearSix" size={22}/>
        </button>
      </div>
    </header>
    <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto p-3 pb-16"><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
    <nav className="shrink-0 border-t w-full" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-20">
        {tabs.map(t=><NavLink key={t.to} to={t.to} end={t.to==='/'} className={({isActive})=>cn('flex flex-col items-center justify-center w-full h-full transition', isActive?'text-tk-amber':'')} style={undefined as any}>
          {({isActive})=>t.icon==='chatsCircle'?(
            <span className="relative flex flex-col items-center justify-center -mt-1">
<span className="relative flex h-14 w-14">
                <span className="relative h-14 w-14 rounded-full overflow-hidden border-2 border-tk-amber shadow-lg">
                  <img src="/ai-face.jpg" alt="Вымышленный цифровой помощник" className="h-full w-full object-cover"/>
                  <img src="/ai-face-closed.jpg" alt="" aria-hidden="true" className="blink-closed absolute inset-0 h-full w-full object-cover"/>
                </span>
                <svg className="absolute -top-1 left-1/2 -translate-x-1/2" style={{filter:'drop-shadow(0 2px 2px rgba(0,0,0,0.35))'}} width="46" height="22" viewBox="0 0 46 22"><defs><linearGradient id="tkHatDome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fcd34d"/><stop offset="1" stopColor="#f59e0b"/></linearGradient><linearGradient id="tkHatBrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbbf24"/><stop offset="1" stopColor="#d97706"/></linearGradient></defs><path d="M8 17 C8 7 14 2 23 2 C32 2 38 7 38 17 Z" fill="url(#tkHatDome)" stroke="#b45309" strokeWidth="1"/><path d="M20.5 3 h5 v13.5 h-5 Z" fill="#f59e0b" stroke="#b45309" strokeWidth="0.75"/><path d="M3 16.5 h40 c1.2 0 1.7 1 1.2 2 c-0.5 1 -1.6 1.5 -3 1.5 h-36.4 c-1.4 0 -2.5 -0.5 -3 -1.5 c-0.5 -1 0 -2 1.2 -2 Z" fill="url(#tkHatBrim)" stroke="#b45309" strokeWidth="1"/><ellipse cx="15" cy="8" rx="3.5" ry="5.5" fill="#ffffff" opacity="0.28" transform="rotate(-14 15 8)"/></svg>
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-tk-amber text-black text-[0.4375rem] font-black px-1.5 py-px rounded-full border border-amber-600">ИИ</span>
              </span>
              <span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center mt-1" style={{color:isActive?'#f59e0b':'var(--tk-muted)'}}>{t.label}</span>
            </span>
          ):(<span className={cn('flex flex-col items-center justify-center',isActive?'text-tk-amber':'') } style={isActive?undefined:{color:'var(--tk-muted)'}}>
            <span className={cn('rounded-full px-3 py-1 mb-0.5', isActive&&'bg-tk-amber/15')}><PhIcon name={t.icon} active={isActive} size={24}/></span><span className="text-[0.5rem] font-black uppercase tracking-tight leading-none px-0.5 text-center">{t.label}</span>
          </span>)}
        </NavLink>)}
      </div>
    </nav>
  </div>
}
