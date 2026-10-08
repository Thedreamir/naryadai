import LanguageToggle from '../components/LanguageToggle'
import {kzNavigation} from '../lib/language'
import {useEffect, useState, type ReactNode} from 'react'
import {NavLink, useLocation} from 'react-router-dom'
import {motion} from 'framer-motion'
import {LayoutGrid, ClipboardCheck, PlusCircle, Archive, Repeat, BarChart3, Brain, LogOut} from 'lucide-react'
import * as H from '../lib/data'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
export default function MasterShell({actor, children}:{actor:Actor, children:ReactNode}){
  const loc=useLocation()
  const [kz,setKz]=useState(()=>localStorage.getItem('tekton-language')==='kz');useEffect(()=>{const update=()=>setKz(localStorage.getItem('tekton-language')==='kz');window.addEventListener('tekton-language',update);return ()=>window.removeEventListener('tekton-language',update)},[]);const label=(t:string)=>kz?(kzNavigation[t]||t):t
  const [menuOpen,setMenuOpen]=useState(false)
  const [reviewCount,setReviewCount]=useState(0)
  const [memoryCount,setMemoryCount]=useState(0)
  useEffect(()=>{H.state().then(st=>setReviewCount(st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length)).catch(()=>{});H.repairMemory().then(d=>setMemoryCount((d as any[]).filter(e=>e.status==='candidate').length)).catch(()=>{})},[])
  const items=[
    {to:'/', icon:LayoutGrid, label:'Наряды'},
    {to:'/review', icon:ClipboardCheck, label:'Проверка', badge:reviewCount},
    {to:'/issue', icon:PlusCircle, label:'Выдать наряд'},
    {to:'/closed', icon:Archive, label:'Закрытые'},
    {to:'/handover', icon:Repeat, label:'Передача смены'},
    {to:'/report', icon:BarChart3, label:'Отчёт и рейтинг'},
    ...(import.meta.env.VITE_KNOWLEDGE_PREVIEW==='true'?[{to:'/knowledge',icon:Brain,label:'Загрузка знаний'}]:[]),
    {to:'/memory', icon:Brain, label:'Память ремонтов', badge:memoryCount},
  ]
  return <div className="workspace min-h-screen flex bg-bg">
    <aside className="workspace-sidebar w-[248px] shrink-0 bg-white/70 border-r border-border flex flex-col px-[22px] py-8 sticky top-0 h-screen">
      <div className="flex items-center gap-[11px] px-1">
        <img src="/tekton-symbol.svg" alt="" className="w-[34px] h-[34px]"/>
        <div className="text-[23px] font-bold tracking-[-1px]">Tekton OS</div>
      </div>
      <div className="text-[12px] text-muted mt-3 mb-10 px-1">Мастер · рабочее пространство</div>
      <LanguageToggle/><nav className="flex flex-col">
        {items.map(i=><NavLink key={i.to} to={i.to} end={i.to==='/'} className={({isActive})=>cn('flex items-center gap-3 px-[13px] py-4 rounded-[13px] mb-[7px] text-[15px]', isActive?'bg-[#edf1ee] text-[#174b35] font-bold':'text-[#69726e] hover:bg-black/[0.03]')}>
          <i.icon size={22} strokeWidth={1.5}/><span className="flex-1">{label(i.label)}</span>{i.badge?(<span className="bg-primary text-primary-ink text-[0.6875rem] font-bold px-2 py-0.5 rounded-full">{i.badge}</span>):null}</NavLink>)}
      </nav>
      <div className="mt-auto text-[11px] text-[#78807d] leading-[1.9]">
        <div className="flex items-center gap-2 mb-2"><div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#e9eee9] to-[#d4ded5] text-[#4d6758] grid place-items-center font-bold text-[14px]">{actor.name?.split(' ').map((w:string)=>w[0]).slice(-2).join('')}</div>
          <div className="min-w-0"><div className="text-[13px] font-semibold text-[#313936] truncate">{actor.name}</div><div>Демо-учётка</div></div></div>
        <button className="flex items-center gap-2 h-10 text-[13px] text-muted" onClick={async()=>{await H.logout();location.reload()}}><LogOut size={18}/>Выйти</button>
        <div className="mt-2"><strong className="text-[13px] text-[#313936]">Ptah AI</strong><br/>Помощник, не арбитр качества</div>
        <div className="mt-1">{'dreamir | dream labs | <O>'}</div>
        <div className="mt-2">Синтетические данные · тестовое облако</div>
      </div>
    </aside>
    <header className="workspace-mobile-header"><img src="/tekton-symbol.svg" alt=""/><strong>Tekton OS</strong><LanguageToggle/><span>Мастер</span><button aria-label="Открыть меню" onClick={()=>setMenuOpen(true)}>Меню</button></header>
    <nav className="workspace-bottom" aria-label="Навигация мастера">{items.filter(i=>['/','/review','/issue','/report'].includes(i.to)).map(i=><NavLink to={i.to} end={i.to==='/'} key={i.to}><i.icon size={22}/><span>{label(i.to==='/issue'?'Выдать':i.to==='/report'?'Отчёт':i.label)}</span></NavLink>)}<button onClick={()=>setMenuOpen(true)}><Brain size={22}/><span>{label('Ещё')}</span></button></nav>
    {menuOpen&&<div className="workspace-sheet-backdrop" onClick={()=>setMenuOpen(false)}><section role="dialog" aria-modal="true" aria-label="Меню мастера" className="workspace-sheet" onClick={e=>e.stopPropagation()}><button autoFocus className="sheet-close" onClick={()=>setMenuOpen(false)}>Закрыть</button>{items.map(i=><NavLink to={i.to} key={i.to} onClick={()=>setMenuOpen(false)}>{label(i.label)}</NavLink>)}<button onClick={async()=>{await H.logout();location.reload()}}>Выйти</button></section></div>}
    <main className="workspace-main flex-1 min-w-0 px-[38px] py-8 max-w-[1280px]"><p className="text-[11px] text-muted mb-2">{kz?'Қазақша навигация: аударма жобасы. Мәтіндер RU.':'KZ: только навигация · черновик'}</p><motion.div key={loc.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>{children}</motion.div></main>
  </div>
}
