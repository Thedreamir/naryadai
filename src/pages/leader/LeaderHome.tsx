import '../../styles/ptah-experience.css'
import {useLocale} from '../../lib/locale'
import {lazy,Suspense} from 'react'
const Knowledge=lazy(()=>import('../master/Knowledge'))
import LanguageToggle from '../../components/LanguageToggle'
import Equipment from '../master/Equipment'
import {useEffect,useState} from 'react'
import {NavLink} from 'react-router-dom'
import {BarChart3, LayoutGrid, Brain, LogOut} from 'lucide-react'
import * as H from '../../lib/data'
import Report from '../master/Report'
import Memory from '../master/Memory'
import LeaderOverview from './LeaderOverview'
import Handover from '../master/Handover'
import type {Actor} from '../../App'
import {Routes, Route, Navigate} from 'react-router-dom'
export default function LeaderHome({actor}:{actor:Actor}){
  const {t,locale}=useLocale()
  useEffect(()=>{let theme='light';try{theme=JSON.parse(localStorage.getItem('tk-prefs')||'{}').theme||'light'}catch{};document.body.classList.toggle('theme-dark',theme==='dark'||(theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches));document.body.classList.toggle('theme-light',theme==='light')},[])

  const [menuOpen,setMenuOpen]=useState(false)
  return <div className="workspace leader-workspace min-h-screen flex bg-bg">
    <aside className="workspace-sidebar w-[248px] shrink-0 bg-white/70 border-r border-border flex flex-col px-[22px] py-8 sticky top-0 h-screen">
      <div className="flex items-center gap-[11px] px-1">
        <img src="/tekton-symbol.svg" alt="" className="w-[34px] h-[34px]"/>
        <div className="text-[23px] font-bold tracking-[-1px]">Tekton OS</div>
      </div>
      <div className="text-[12px] text-muted mt-3 mb-10 px-1">{t("Руководитель · рабочее пространство")}</div>
      <LanguageToggle/><nav className="flex flex-col">
        <NavLink to="/" end className={({isActive})=>('flex items-center gap-3 px-[13px] py-4 rounded-[13px] mb-[7px] text-[15px] '+(isActive?'bg-[#edf1ee] text-[#174b35] font-bold':'text-[#69726e] hover:bg-black/[0.03]'))}>
          <LayoutGrid size={22} strokeWidth={1.5}/>{t("Обзор")}</NavLink>
        <NavLink to="/report" className={({isActive})=>('flex items-center gap-3 px-[13px] py-4 rounded-[13px] mb-[7px] text-[15px] '+(isActive?'bg-[#edf1ee] text-[#174b35] font-bold':'text-[#69726e] hover:bg-black/[0.03]'))}>
          <BarChart3 size={22} strokeWidth={1.5}/>{t("Отчёт и рейтинг")}</NavLink>
        <NavLink to="/memory" className={({isActive})=>('flex items-center gap-3 px-[13px] py-4 rounded-[13px] mb-[7px] text-[15px] '+(isActive?'bg-[#edf1ee] text-[#174b35] font-bold':'text-[#69726e] hover:bg-black/[0.03]'))}>
          <Brain size={22} strokeWidth={1.5}/>{t("Память ремонтов")}</NavLink>
      </nav>
      <div className="mt-auto text-[11px] text-[#78807d] leading-[1.9]">
        <div className="flex items-center gap-2 mb-2"><div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#e9eee9] to-[#d4ded5] text-[#4d6758] grid place-items-center font-bold text-[14px]">{actor.name?.split(' ').map((w:string)=>w[0]).slice(-2).join('')}</div>
          <div className="min-w-0"><div className="text-[13px] font-semibold text-[#313936] truncate">{actor.name}</div><div>{t("Учётная запись")}</div></div></div>
        <button className="flex items-center gap-2 h-10 text-[13px] text-muted" onClick={async()=>{await H.logout();location.reload()}}><LogOut size={18}/>{t("Выйти")}</button>
        <div className="mt-2"><strong className="text-[13px] text-[#313936]">Ptah AI</strong><br/>{t("Помощник, не арбитр качества")}</div>
        <div className="mt-1">{'dreamir | dream labs | <O>'}</div>
        <div className="mt-2">{t("Tekton OS · рабочее пространство")}</div>
      </div>
    </aside>
    <header className="workspace-mobile-header"><img src="/tekton-symbol.svg" alt=""/><strong>Tekton OS</strong><button aria-label={t("Открыть меню")} onClick={()=>setMenuOpen(true)}>{t("Меню")}</button></header>
    <nav className="workspace-bottom leader-bottom" aria-label={t("Навигация руководителя")}><NavLink to="/" end><LayoutGrid size={22}/><span>{t('Обзор')}</span></NavLink><NavLink to="/report"><BarChart3 size={22}/><span>{t('Отчёт')}</span></NavLink><NavLink to="/memory"><Brain size={22}/><span>{t('Знания')}</span></NavLink></nav>
    {menuOpen&&<div className="workspace-sheet-backdrop" onClick={()=>setMenuOpen(false)}><section role="dialog" aria-modal="true" aria-label={t("Меню руководителя")} className="workspace-sheet" onClick={e=>e.stopPropagation()}><button autoFocus className="sheet-close" onClick={()=>setMenuOpen(false)}>{t("Закрыть")}</button><LanguageToggle/><p>{t('Казахский перевод: черновик, производственные тексты требуют проверки.')}</p><p>{actor.name} {t("· руководитель · только чтение")}</p><button onClick={async()=>{await H.logout();location.reload()}}>{t("Выйти")}</button></section></div>}
    <main className="workspace-main flex-1 min-w-0 px-[38px] py-8 max-w-[1280px]">
      
<Routes><Route path="/knowledge" element={import.meta.env.VITE_KNOWLEDGE_PREVIEW==='true'?<Suspense fallback={<div>{t("Загрузка знаний…")}</div>}><Knowledge actor={actor}/></Suspense>:<Navigate to="/" replace/>}/><Route path="/equipment/:id" element={<Equipment actor={actor}/>}/><Route path="/" element={<LeaderOverview actor={actor}/>}/><Route path="/handover" element={<Handover actor={actor}/>}/><Route path="/report" element={<Report actor={actor}/>}/><Route path="/memory" element={<Memory actor={actor}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>
    </main>
  </div>
}
