import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
export default function Issue({actor}:{actor:Actor}){
  const nav=useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [title,setTitle]=useState(''); const [eq,setEq]=useState(''); const [assignee,setAssignee]=useState('')
  const [priority,setPriority]=useState('normal'); const [hours,setHours]=useState(2)
  useEffect(()=>{H.state().then(setSt).catch(e=>setErr(e.message))},[])
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const workers=st.employees.filter((e:any)=>e.role==='worker')
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('')
    try{
      await H.createOrder({title,kind:priority==='planned'?'planned':'unplanned',equipment_id:Number(eq),assignee_id:assignee,priority,deadline:new Date(Date.now()+hours*3600000).toISOString()})
      nav('/')
    }catch(ex){setErr((ex as Error).message);setBusy(false)}}
  const input='w-full h-14 px-4 rounded-[14px] border border-border bg-surface text-[16px]'
  return <div className="max-w-xl space-y-4">
    <div><h1 className="text-[26px] font-bold">Выдать наряд</h1>
      <div className="text-[13px] text-muted">Исполнитель получит уведомление. Переходы фиксируются в журнале.</div></div>
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <label className="block"><span className="text-[13px] font-medium text-muted">Проблема и работы</span>
          <textarea required className="mt-1 w-full min-h-28 p-4 rounded-[14px] border border-border bg-surface text-[16px]" placeholder="Что нужно исправить?" value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">Оборудование</span>
          <select required className={"mt-1 "+input} value={eq} onChange={e=>setEq(e.target.value)}>
            <option value="">Выбрать…</option>
            {st.equipment.map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.section}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">Исполнитель</span>
          <select required className={"mt-1 "+input} value={assignee} onChange={e=>setAssignee(e.target.value)}>
            <option value="">Выбрать…</option>
            {workers.map((w:any)=>{const active=st.orders.find((o:any)=>o.assignee_id===w.id&&o.status==='in_progress')
              const q=st.orders.filter((o:any)=>o.assignee_id===w.id&&['issued','queued','accepted'].includes(o.status)).length
              const t=active?'в работе #'+active.id:q?'в очереди '+q:'свободен'
              return <option key={w.id} value={w.id}>{w.name} · {t}</option>})}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[13px] font-medium text-muted">Приоритет / тип</span>
            <select className={"mt-1 "+input} value={priority} onChange={e=>setPriority(e.target.value)}>
              <option value="high">Высокий</option><option value="normal">Обычный</option>
              <option value="emergency">Аварийный</option><option value="planned">Плановый</option></select></label>
          <label className="block"><span className="text-[13px] font-medium text-muted">Срок через (часов)</span>
            <input className={"mt-1 "+input} type="number" min="0.1" step="0.1" value={hours} onChange={e=>setHours(Number(e.target.value))} required/></label>
        </div>
      </Card>
      {err&&<Card className="text-danger text-[14px]">{err}</Card>}
      <Button size="big" className="w-full" disabled={busy}>{busy?'Выдаю…':'Выдать наряд'}</Button>
    </form>
  </div>
}
