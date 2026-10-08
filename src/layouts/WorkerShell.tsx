import DemoTour from '../components/DemoTour'
import {useLocale} from '../lib/locale'
import type {ReactNode} from 'react'
import {NavLink, useLocation} from 'react-router-dom'
import {motion} from 'framer-motion'
import PhIcon from '../components/PhIcon'
import RepairTabIcon from '../components/RepairTabIcon'
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
  const {t}=useLocale();const loc=useLocation(); const {glove}=usePrefs()
  return <div className="worker-workspace h-dvh flex flex-col" style={{background:'var(--tk-bg)',color:'var(--tk-ink)'}}>
    <header className="worker-topbar shrink-0 z-20 px-3.5 py-2.5 flex items-center justify-between" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)'}}>
      <div className="flex items-center gap-2.5 min-w-0">
        <img src="/tekton-symbol.svg" alt="" className="w-10 h-10 shrink-0"/>
        <div>
          <h1 className="font-extrabold text-sm tracking-tight uppercase flex items-center gap-1.5 leading-none whitespace-nowrap">
            <span>Tekton OS</span>
            {glove&&<span title="Режим перчаток включён" className="shrink-0 bg-tk-amber/20 text-tk-amber border border-tk-amber/50 p-1 rounded flex items-center"><PhIcon name="hand" size={16}/></span>}
          </h1>
          
        </div>
      </div>
      <DemoTour audience="worker"/>
    </header>
    <main className={'flex-1 overflow-y-auto w-full max-w-md mx-auto p-3 pb-16 '+(loc.pathname==='/assistant'?' worker-chat-main':'')+''}><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
    <nav className="worker-floating-nav shrink-0" style={{background:'var(--tk-card)',borderColor:'var(--tk-border)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div className="max-w-md mx-auto grid grid-cols-5 h-20">
        {tabs.map(tab=><NavLink key={tab.to} to={tab.to} end={tab.to==='/'} className={({isActive})=>cn('worker-tab flex flex-col items-center justify-center w-full h-full transition',tab.to==='/assistant'?' worker-ai-tab':'',isActive?' worker-tab-active text-tk-amber':'')} style={undefined as any}>
          {({isActive})=><span className="flex flex-col items-center justify-center gap-1" style={{color:isActive?'#f59e0b':'var(--tk-muted)'}}>{tab.to==='/assistant'?<span className="worker-ptah-avatar"><picture><source media="(prefers-reduced-motion: reduce)" srcSet="/1-ptah-avatar.png"/><img src="/2-ptah-blink.webp" alt=""/></picture></span>:tab.to==='/'?<RepairTabIcon size={24}/>:<PhIcon name={tab.icon} active={isActive} size={24}/>}<span className="text-[10px] font-bold tracking-tight text-center">{t(tab.label)}</span></span>}
        </NavLink>)}
      </div>
    </nav>
  </div>
}
