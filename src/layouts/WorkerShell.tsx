import type {ReactNode} from 'react'
import {NavLink} from 'react-router-dom'
import {Home, ClipboardList, CircleDot, BarChart3, User} from 'lucide-react'
import type {Actor} from '../App'
import {cn} from '../lib/utils'
const tabs = [
  {to:'/', icon:Home, label:'Главная'},
  {to:'/orders', icon:ClipboardList, label:'Наряды'},
  {to:'/current', icon:CircleDot, label:'Текущий'},
  {to:'/report', icon:BarChart3, label:'Отчёт'},
  {to:'/profile', icon:User, label:'Профиль'},
]
export default function WorkerShell({actor, children}:{actor:Actor, children:ReactNode}){
  return <div className="min-h-screen pb-32">
    <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border px-4 h-14 flex items-center justify-between">
      <span className="font-bold text-[17px]">НарядAI</span>
      <span className="text-[13px] text-muted">{actor.name}</span>
    </header>
    <main className="max-w-md mx-auto px-4 pt-4">{children}</main>
    <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map(t=><NavLink key={t.to} to={t.to} end={t.to==='/'} className={({isActive})=>cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive?'text-primary':'text-muted')}>
          <t.icon size={22}/>{t.label}</NavLink>)}
      </div>
    </nav>
  </div>
}
