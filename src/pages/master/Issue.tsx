import VoiceButton from '../worker/VoiceButton'
import {issueValidation} from '../../lib/issue-validation.mjs'
import {workerLoad,submissionStats} from '../../lib/dispatch-hints.mjs'
import {useLocale} from '../../lib/locale'
import {Explain,WorkSteps} from '../../components/VisualBlocks'
import {sanitizePhoto} from '../../lib/photo-sanitize'
import {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
export default function Issue({actor}:{actor:Actor}){
  const {t}=useLocale();const nav=useNavigate()
  const [st,setSt]=useState<any>(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const [title,setTitle]=useState(''); const [eq,setEq]=useState(()=>new URLSearchParams(location.search).get('equipment')||''); const [assignee,setAssignee]=useState('')
  const [section,setSection]=useState('');const [kind,setKind]=useState('unplanned');const [before,setBefore]=useState<string[]>([]);const [photoBusy,setPhotoBusy]=useState(false)
  const [photoCamera,setPhotoCamera]=useState(false);const [priority,setPriority]=useState('normal'); const [hours,setHours]=useState(2)
  useEffect(()=>{H.state().then(data=>{setSt(data);const requested=new URLSearchParams(location.search).get('equipment');const selected=(data as any).equipment.find((x:any)=>String(x.id)===requested);if(selected)setSection(String(selected.section));else if(requested)setEq('')}).catch(e=>setErr(e.message))},[])
  if(!st) return <div className="text-muted py-10">{t('Загрузка…')}</div>
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
    return st.employees.filter((e:any)=>e.role==='worker'&&e.on_shift&&e.is_active!==false).map((w:any)=>{
      const load=workerLoad(st.orders,w.id);const inWork=load.active;const q=load.queue;const review=load.review
      const closedAll=st.orders.filter((o:any)=>o.assignee_id===w.id&&!o.cancelled&&o.status==='closed')
      const onEq=closedAll.filter((o:any)=>String(o.equipment_id)===String(eq))
      const otPct=submissionStats(closedAll,st.events||[]).pct
      const rw=reworkByW[w.id]||0
      const perms=(permitsByW[w.id]||[]).map((p:any)=>({...p,expired:new Date(p.valid_until)<new Date()}))
      const avail=inWork?2:q||review?1:0
      const score=(2-avail)*100+(onEq.length*10)+((otPct||0))-(rw*15)
      return {w,inWork,q,review,onEq:onEq.length,otPct,rw,perms,avail,score,ok:perms.some((p:any)=>!p.expired)}
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
  const submit=async(e:React.FormEvent)=>{e.preventDefault();const invalid=issueValidation({title,equipmentId:eq,assigneeId:assignee,hours,kind,priority},st.equipment,workers);if(invalid){setErr(t(invalid));return}setBusy(true);setErr('')
    try{
      await H.createOrder({title,kind,equipment_id:Number(eq),assignee_id:assignee,priority,deadline:new Date(Date.now()+hours*3600000).toISOString(),before_photos:before})
      nav('/')
    }catch(ex){setErr((ex as Error).message);setBusy(false)}}
  const invalid=issueValidation({title,equipmentId:eq,assigneeId:assignee,hours,kind,priority},st.equipment,workers)
  const input='w-full h-14 px-4 rounded-[14px] border border-border bg-surface text-[16px]'
  return <div className="max-w-xl space-y-4">
    <div><h1 className="text-[26px] font-bold">{t('Выдать наряд')}</h1>
      <WorkSteps/></div>
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Проблема и работы')}</span>
          <div className="report-work-field issue-work-field"><textarea required className="mt-1 w-full min-h-28 p-4 rounded-[14px] border border-border bg-surface text-[16px]" placeholder={t('Что нужно исправить?')} value={title} onChange={e=>setTitle(e.target.value)}/><VoiceButton onText={text=>setTitle(prev=>prev?prev+' '+text:text)}/></div></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Участок')}</span><select aria-label={t("Участок")} className={input} value={section} onChange={e=>{setSection(e.target.value);setEq('');setAssignee('')}}><option value="">{t("Все участки")}</option>{[...new Set(st.equipment.map((x:any)=>String(x.section)))].map((name:any)=><option key={name} value={name}>{name}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Тип работ')}</span><select aria-label={t("Тип работ")} className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="unplanned">{t('Внеплановый')}</option><option value="planned">{t('Плановый')}</option></select></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Оборудование')}</span>
          <select aria-label={t("Оборудование")} required className={"mt-1 "+input} value={eq} onChange={e=>{setEq(e.target.value);const selected=st.equipment.find((x:any)=>String(x.id)===e.target.value);if(selected)setSection(String(selected.section));setAssignee('')}}>
            <option value="">{t('Выбрать…')}</option>
            {st.equipment.filter((x:any)=>!section||String(x.section)===section).map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.section}</option>)}</select></label>
        {eligible.length>0&&<Card className="border-primary/40 bg-primary/5 !p-3.5 space-y-2">
          <div className="text-[12px] font-semibold text-muted uppercase">{t('Подбор по правилам · решает мастер')}</div><p className="text-[13px]">Допуск найден; соответствие работе не проверено.</p>
          {eligible.map((c:any,i:number)=>(<div key={c.w.id} className="space-y-1 pb-2 border-b border-border/50 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px]"><b>{i+1}. {c.w.name}</b> · {c.w.specialty||'—'}{c.w.brigade?' · '+c.w.brigade:''}</div>
              <button type="button" onClick={()=>setAssignee(c.w.id)} className="min-h-14 px-4 rounded-full text-[13px] font-semibold bg-primary text-primary-ink shrink-0">{t('Выбрать')}</button>
            </div>
            <div className="text-[12px] text-muted">
              {c.inWork?t('Занят: наряд')+' #'+c.inWork.id:c.q?t('В очереди')+' '+c.q:c.review?t('На проверке')+' '+c.review:t('Свободен')}
              {c.onEq?` · ${c.onEq} закрытых на этом узле`:' · на этом узле не работал'}
              {c.otPct!==null?` · в срок ${c.otPct}%`:''}
              {c.rw?` · переделок ${c.rw}`:''}
            </div>
            {c.perms.length>0&&<div className="text-[12px]">
              {c.perms.map((p:any)=><span key={p.id} className={"inline-block mr-2 px-2 py-0.5 rounded-full "+(p.expired?'bg-danger/15 text-danger':'bg-surface text-muted')}>{p.permit} {p.expired?'· истёк':'до '+p.valid_until}</span>)}
            </div>}
          </div>))}
          <Explain title={t('Почему эти исполнители')}>{t('Доступность, опыт на узле и сроки. Допуск найден; соответствие работе не проверено. Финальный выбор за мастером.')}</Explain>
        </Card>}
        {refused.length>0&&<Card className="!p-3 text-[12px] text-muted">{t('Не в подборе: нет действующего допуска')} · {refused.map((c:any)=>c.w.name).join(', ')}. {t('Мастер проверяет допуск перед назначением.')}</Card>}
        {memoryHint&&<Card className="!p-3 text-[13px]">На этом узле <b>{memoryHint} нарядов за 30 дней</b> — проверьте причину повторов перед постановкой следующего.</Card>}
        {stockHint.length>0&&<Card className="!p-3 text-[13px] text-muted">Часто расходуется на этом узле: {stockHint.join(', ')}. Складские остатки не ведутся (дорожная карта: 1С).</Card>}
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Исполнитель')}</span>
          <select aria-label={t("Исполнитель")} required className={"mt-1 "+input} value={assignee} onChange={e=>setAssignee(e.target.value)}>
            <option value="">{t('Выбрать…')}</option>
            {workers.map((w:any)=>{const load=workerLoad(st.orders,w.id)
              const label=w.is_active===false?t('Неактивен'):!w.on_shift?t('Не на смене'):load.active?t('Занят: наряд')+' #'+load.active.id:load.queue?t('В очереди')+' '+load.queue:load.review?t('На проверке')+' '+load.review:t('Свободен')
              return <option key={w.id} value={w.id} disabled={w.is_active===false}>{w.name} · {label}</option>})}</select></label>
        <div className="grid grid-cols-1 gap-3">
          <div role="radiogroup" aria-label={t('Приоритет')} className="block"><span className="text-[13px] font-medium text-muted">{t('Приоритет')}</span><div className="mt-1 grid grid-cols-2 gap-2">{[['emergency','Аварийный'],['high','Высокий'],['normal','Обычный'],['planned','Плановый']].map(([v,l])=><button key={v} type="button" role="radio" aria-checked={priority===v} onClick={()=>setPriority(v)} className={"min-h-14 rounded-[14px] text-[14px] font-semibold border "+(priority===v?(v==='emergency'?'bg-danger text-white border-danger':'bg-primary text-primary-ink border-primary'):'bg-surface border-border')}>{t(l)}</button>)}</div></div>
          <label className="block"><span className="text-[13px] font-medium text-muted">{t('Срок через (часов)')}</span>
            <input className={"mt-1 "+input} type="number" min="0.1" step="0.1" value={hours} onChange={e=>setHours(Number(e.target.value))} required/></label>
        </div>
      </Card>
      <Card className="space-y-3"><div className="grid grid-cols-2 gap-3"><button type="button" disabled={photoBusy||before.length>=5} className="min-h-16 border border-border rounded-xl" onClick={()=>{setPhotoCamera(true);setTimeout(()=>document.getElementById("issue-photo")?.click(),0)}}>{t('Снять фото')}</button><button type="button" disabled={photoBusy||before.length>=5} className="min-h-16 border border-border rounded-xl" onClick={()=>{setPhotoCamera(false);setTimeout(()=>document.getElementById("issue-photo")?.click(),0)}}>{t('Из галереи')}</button></div><input className="sr-only" id="issue-photo" aria-label={t('Фото неисправности')} type="file" multiple={!photoCamera} capture={photoCamera?"environment":undefined} accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={async e=>{const files=Array.from(e.target.files||[]);setPhotoCamera(false);e.target.value='';if(before.length+files.length>5){setErr(t('До 5 фото неисправности'));return}setPhotoBusy(true);setErr('');try{const ready:string[]=[];for(const f of files){const clean=await sanitizePhoto(f);ready.push(await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error(t('Фото не прочиталось')));r.readAsDataURL(clean)}))}setBefore(prev=>[...prev,...ready])}catch(ex){setErr((ex as Error).message)}finally{setPhotoBusy(false)}}}/><p className="text-[12px] text-muted">{t('Фото неисправности: до 5, JPEG/PNG/WebP')} · {before.length}/5</p><p className="text-[12px] text-muted">{t('Метаданные удаляются. Время съёмки не подтверждается. Источник: учебный набор изображений.')}</p><div className="flex gap-2 flex-wrap">{before.map((photo,i)=><div key={i}><img alt={t('Неисправность')+' '+(i+1)} src={photo} className="h-24 rounded-xl"/><button type="button" className="min-h-14 px-3" onClick={()=>setBefore(p=>p.filter((_,j)=>j!==i))}>{t('Удалить')} {i+1}</button></div>)}</div></Card>
      {err&&<Card className="text-danger text-[14px]">{err}</Card>}
      {invalid&&<p className="text-[14px] text-muted" role="status">{t(invalid)}</p>}
      <Button size="big" className="w-full" disabled={busy||photoBusy||!!invalid}>{t(busy?'Выдаю…':'Выдать наряд')}</Button>
    </form>
  </div>
}
