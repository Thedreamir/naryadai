import {useEffect, useState, type ReactNode} from 'react'
import {NavLink} from 'react-router-dom'
import {LayoutGrid, ClipboardCheck, PlusCircle, Archive, Repeat, BarChart3, LogOut} from 'lucide-react'
import * as H from '../lib/data'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
export default function MasterShell({actor, children}:{actor:Actor, children:ReactNode}){
  const [reviewCount,setReviewCount]=useState(0)
  useEffect(()=>{H.state().then(st=>setReviewCount(st.orders.filter((o:any)=>['completed','ai_review'].includes(o.status)).length)).catch(()=>{})},[])
  const items=[
    {to:'/', icon:LayoutGrid, label:'Наряды'},
    {to:'/review', icon:ClipboardCheck, label:'Проверка', badge:reviewCount},
    {to:'/issue', icon:PlusCircle, label:'Выдать наряд'},
    {to:'/closed', icon:Archive, label:'Закрытые'},
    {to:'/handover', icon:Repeat, label:'Передача смены'},
    {to:'/report', icon:BarChart3, label:'Отчёт и рейтинг'},
  ]
  return <div className="min-h-screen flex">
    <aside className="w-60 shrink-0 bg-surface border-r border-border flex flex-col p-4 gap-1 sticky top-0 h-screen">
      <div className="font-bold text-[19px] px-2 py-3">НарядAI<div className="text-[11px] font-medium text-muted">СМЕНА 01 · тестовый участок</div></div>
      {items.map(i=><NavLink key={i.to} to={i.to} end={i.to==='/'} className={({isActive})=>cn('flex items-center gap-3 px-3 h-11 rounded-[12px] text-[14px] font-medium', isActive?'bg-primary/10 text-primary':'text-ink hover:bg-bg')}>
        <i.icon size={18}/><span className="flex-1">{i.label}</span>{i.badge?(<span className="bg-primary text-primary-ink text-[11px] font-bold px-2 py-0.5 rounded-full">{i.badge}</span>):null}</NavLink>)}
      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2 px-2"><div className="h-9 w-9 rounded-full bg-primary text-primary-ink grid place-items-center font-bold">{actor.name?.[0]}</div>
          <div className="min-w-0"><div className="text-[13px] font-semibold truncate">{actor.name}</div><div className="text-[11px] text-muted">Демо-учётка</div></div></div>
        <button className="flex items-center gap-2 px-3 h-10 text-[13px] text-muted w-full" onClick={async()=>{await H.logout();location.reload()}}><LogOut size={16}/>Сменить роль</button>
        <div className="text-[10px] text-muted px-2">Синтетические данные · тестовое облако</div>
      </div>
    </aside>
    <main className="flex-1 min-w-0 p-6 max-w-[1200px]">{children}</main>
  </div>
}
