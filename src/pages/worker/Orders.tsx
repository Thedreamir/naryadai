import {useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
import {statusOf} from '../../lib/status'
const T: Record<string,{tone:any,label:string}> = {
  issued:{tone:'teal',label:'Выдан'},queued:{tone:'amber',label:'В очереди'},accepted:{tone:'primary',label:'Принят'},
  in_progress:{tone:'primary',label:'В работе'},paused:{tone:'amber',label:'Пауза'},completed:{tone:'teal',label:'На проверке'},
  ai_review:{tone:'teal',label:'Проверка ИИ'},closed:{tone:'gray',label:'Закрыт'}}
export default function Orders({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{})},[])
  if(!st) return <div className="text-muted py-10 text-center">Загрузка…</div>
  const mine = st.orders.filter((o:any)=>o.assignee_id===actor.id)
  const groups = [['Активные',(o:any)=>['issued','queued','accepted','in_progress','paused'].includes(o.status)],
    ['На проверке',(o:any)=>['completed','ai_review'].includes(o.status)],['Закрытые',(o:any)=>o.status==='closed']] as const
  return <div className="space-y-5">
    <h1 className="text-[24px] font-bold pt-2">Мои наряды</h1>
    {groups.map(([name,f])=>{const list=mine.filter(f); if(!list.length)return null
      return <div key={name} className="space-y-2"><div className="text-[13px] font-semibold text-muted">{name} · {list.length}</div>
        {list.map((o:any)=><Link to={'/orders/'+o.id} key={o.id}><Card className="flex items-center gap-3 active:scale-[.99] transition">
          <div className="flex-1 min-w-0"><div className="font-semibold">{o.title}</div>
            <div className="text-[12px] text-muted">#{o.id} · {o.equipment} · срок {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div>
          <Badge tone={statusOf(o.status).tone as any}>{statusOf(o.status).label}</Badge></Card></Link>)}</div>})}
    {!mine.length&&<Card className="text-center text-muted py-8">Нарядов нет</Card>}
  </div>
}
