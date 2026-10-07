import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Link} from 'react-router-dom'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import {Badge} from '../../components/ui/badge'
import type {Actor} from '../../App'
import {statusOf} from '../../lib/status'
const statusTone: Record<string,{tone:any,label:string}> = {
  issued:{tone:'teal',label:'Выдан'}, queued:{tone:'amber',label:'В очереди'}, accepted:{tone:'primary',label:'Принят'},
  in_progress:{tone:'primary',label:'В работе'}, paused:{tone:'amber',label:'Пауза'}, completed:{tone:'teal',label:'На проверке'},
  ai_review:{tone:'teal',label:'Проверка ИИ'}, closed:{tone:'gray',label:'Закрыт'},
}
export default function WorkerHome({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState('')
  useEffect(()=>{H.state().then(setSt).catch(e=>setErr(e.message))},[])
  if(err) return <Card className="text-danger">{err}</Card>
  if(!st) return <div className="text-muted py-10 text-center">Загрузка нарядов…</div>
  const mine = st.orders.filter((o:any)=>o.assignee_id===actor.id)
  const current = mine.find((o:any)=>o.status==='in_progress')
  const queue = mine.filter((o:any)=>['issued','queued','accepted','paused'].includes(o.status))
  const doneToday = mine.filter((o:any)=>['completed','ai_review','closed'].includes(o.status)).length
  const eqName = (id:number)=>st.equipment.find((e:any)=>e.id===id)?.name||'—'
  return <div className="space-y-4">
    <div className="pt-2"><div className="text-[13px] text-muted font-medium">Добрый день,</div>
      <h1 className="text-[26px] font-bold leading-tight">{actor.name}</h1></div>
    {current?<Card className="bg-primary text-primary-ink border-0 space-y-3">
      <div className="text-[11px] font-bold tracking-widest opacity-80">ТЕКУЩИЙ НАРЯД · #{current.id}</div>
      <div className="text-[20px] font-bold leading-snug">{current.title}</div>
      <div className="text-[13px] opacity-80">{eqName(current.equipment_id)} · срок {new Date(current.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      <Link to={'/orders/'+current.id}><Button size="big" className="w-full bg-surface text-primary">Открыть наряд</Button></Link>
    </Card>:<Card className="space-y-3">
      <div className="text-[11px] font-bold tracking-widest text-muted">СВОБОДЕН</div>
      <div className="text-[17px] font-semibold">Нет наряда в работе{queue.length?' — следующий ждёт ниже':''}</div>
    </Card>}
    <div className="grid grid-cols-2 gap-3">
      <Card><div className="text-[32px] font-bold leading-none">{queue.length}</div><div className="text-[13px] text-muted mt-1">в очереди</div></Card>
      <Card><div className="text-[32px] font-bold leading-none">{doneToday}</div><div className="text-[13px] text-muted mt-1">на проверке/закрыто</div></Card>
    </div>
    {queue.length>0&&<div className="space-y-2">
      <div className="text-[15px] font-semibold">Мои наряды</div>
      {queue.map((o:any)=>{const s=statusOf(o.status)
        return <Link to={'/orders/'+o.id} key={o.id}><Card className="flex items-center gap-3">
          <div className="flex-1 min-w-0"><div className="font-semibold truncate">{o.title}</div>
            <div className="text-[12px] text-muted">#{o.id} · {eqName(o.equipment_id)}</div></div>
          <Badge tone={s.tone}>{s.label}</Badge>
        </Card></Link>})}
    </div>}
    <div className="text-[12px] text-muted text-center pt-2">Синтетические данные · решение о закрытии принимает мастер</div>
  </div>
}
