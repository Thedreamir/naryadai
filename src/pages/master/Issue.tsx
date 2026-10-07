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
  // Rule-based candidate hint (PDF 5.1.3): availability + experience on this equipment + on-time share.
  // Not a model verdict; master decides. Never auto-assigns.
  // Two dispatch modes (TZ 5.1.3): manual pick below, or rule-based auto-pick (top-2, explainable).
  // Criteria: availability, experience on this equipment, on-time share, rework count, valid permits.
  // "Ptah advises, never decides": the master confirms every assignment. Nothing auto-assigns.
  const cands=(()=>{if(!eq)return []
    const permitsByW:Record<string,any[]>={}
    for(const p of (st.permits||[])) (permitsByW[p.employee_id]=permitsByW[p.employee_id]||[]).push(p)
    const reworkByW:Record<string,number>={}
    for(const ev of (st.events||[])) if(ev.new_status==='rework'){const o=st.orders.find((x:any)=>x.id===ev.order_id); if(o) reworkByW[o.assignee_id]=(reworkByW[o.assignee_id]||0)+1}
    return st.employees.filter((e:any)=>e.role==='worker'&&e.on_shift).map((w:any)=>{
      const mine=st.orders.filter((o:any)=>o.assignee_id===w.id&&o.status!=='closed'&&o.status!=='rejected')
      const inWork=mine.find((o:any)=>['in_progress','paused','rework'].includes(o.status))
      const q=mine.filter((o:any)=>['issued','queued','accepted'].includes(o.status)).length
      const closedAll=st.orders.filter((o:any)=>o.assignee_id===w.id&&o.status==='closed')
      const onEq=closedAll.filter((o:any)=>String(o.equipment_id)===String(eq))
      const ot=closedAll.filter((o:any)=>o.closed_at&&new Date(o.closed_at)<=new Date(o.deadline)).length
      const otPct=closedAll.length?Math.round(ot/closedAll.length*100):null
      const rw=reworkByW[w.id]||0
      const perms=(permitsByW[w.id]||[]).map((p:any)=>({...p,expired:new Date(p.valid_until)<new Date()}))
      const avail=inWork?2:q?1:0
      const score=(2-avail)*100+(onEq.length*10)+((otPct||0))-(rw*15)
      return {w,inWork,q,onEq:onEq.length,otPct,rw,perms,avail,score,ok:perms.some((p:any)=>!p.expired)}
    }).sort((a:any,b:any)=>((b.ok?1:0)-(a.ok?1:0))||b.score-a.score)})()
  const eligible=cands.filter((c:any)=>c.ok).slice(0,2)
  const refused=cands.filter((c:any)=>!c.ok)
  const memoryHint=(()=>{if(!eq)return null
    const since=Date.now()-30*86400000
    const n=st.orders.filter((o:any)=>String(o.equipment_id)===String(eq)&&new Date(o.created_at).getTime()>=since).length
    return n>=3?n:null})()
  const stockHint=(()=>{if(!eq)return []
    const use:Record<string,number>={}
    for(const o of st.orders) if(String(o.equipment_id)===String(eq)&&o.closure?.materials) for(const m of o.closure.materials) use[m.name]=(use[m.name]||0)+Number(m.quantity||0)
    return Object.entries(use).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,q])=>n+' ('+(Math.round(q*10)/10)+')')})()
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('')
    try{
      await H.createOrder({title,kind:priority==='planned'?'planned':'unplanned',equipment_id:Number(eq),assignee_id:assignee,priority,deadline:new Date(Date.now()+hours*3600000).toISOString()})
      nav('/')
    }catch(ex){setErr((ex as Error).message);setBusy(false)}}
  const input='w-full h-14 px-4 rounded-[14px] border border-border bg-surface text-[16px]'
  return <div className="max-w-xl space-y-4">
    <div><h1 className="text-[26px] font-bold">Выдать наряд</h1>
      <div className="text-[13px] text-muted">Исполнитель увидит наряд в своём списке. Push-уведомления в демо не проверены. Переходы фиксируются в журнале.</div></div>
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <label className="block"><span className="text-[13px] font-medium text-muted">Проблема и работы</span>
          <textarea required className="mt-1 w-full min-h-28 p-4 rounded-[14px] border border-border bg-surface text-[16px]" placeholder="Что нужно исправить?" value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">Оборудование</span>
          <select required className={"mt-1 "+input} value={eq} onChange={e=>setEq(e.target.value)}>
            <option value="">Выбрать…</option>
            {st.equipment.map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.section}</option>)}</select></label>
        {eligible.length>0&&<Card className="border-primary/40 bg-primary/5 !p-3.5 space-y-2">
          <div className="text-[12px] font-semibold text-muted uppercase">Автоподбор по правилам · рекомендация, не решение</div>
          {eligible.map((c:any,i:number)=>(<div key={c.w.id} className="space-y-1 pb-2 border-b border-border/50 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px]"><b>{i+1}. {c.w.name}</b> · {c.w.specialty||'—'}{c.w.brigade?' · '+c.w.brigade:''}</div>
              <button type="button" onClick={()=>setAssignee(c.w.id)} className="h-9 px-4 rounded-full text-[13px] font-semibold bg-primary text-primary-ink shrink-0">Выбрать</button>
            </div>
            <div className="text-[12px] text-muted">
              {c.inWork?'Занят: наряд #'+c.inWork.id:c.q?'В очереди '+c.q:'Свободен'}
              {c.onEq?` · ${c.onEq} закрытых на этом узле`:' · на этом узле не работал'}
              {c.otPct!==null?` · в срок ${c.otPct}%`:''}
              {c.rw?` · переделок ${c.rw}`:''}
            </div>
            {c.perms.length>0&&<div className="text-[12px]">
              {c.perms.map((p:any)=><span key={p.id} className={"inline-block mr-2 px-2 py-0.5 rounded-full "+(p.expired?'bg-danger/15 text-danger':'bg-surface text-muted')}>{p.permit} {p.expired?'· истёк':'до '+p.valid_until}</span>)}
            </div>}
          </div>))}
          <div className="text-[11px] text-muted">Критерии: доступность, опыт на этом узле, доля закрытий в срок, переделки, действующие допуски. Финальный выбор за мастером.</div>
        </Card>}
        {refused.length>0&&<Card className="!p-3 text-[12px] text-muted">Не в подборе (нет действующего допуска): {refused.map((c:any)=>c.w.name).join(', ')}. Назначение таких исполнителей возможно только вручную на ответственность мастера.</Card>}
        {memoryHint&&<Card className="!p-3 text-[13px]">На этом узле <b>{memoryHint} нарядов за 30 дней</b> — проверьте причину повторов перед постановкой следующего.</Card>}
        {stockHint.length>0&&<Card className="!p-3 text-[13px] text-muted">Часто расходуется на этом узле: {stockHint.join(', ')}. Остатки в демо не ведутся (дорожная карта: 1С).</Card>}
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
