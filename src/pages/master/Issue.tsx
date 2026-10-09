import {parseVoiceFields,type VoiceDraft} from '../../lib/voice-fields.mjs'
import {selectExecutors} from '../../lib/executor-selection.mjs'
import VoiceButton from '../worker/VoiceButton'
import {issueValidation} from '../../lib/issue-validation.mjs'
import {workerLoad} from '../../lib/dispatch-hints.mjs'
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
  const [requiredSpecialty,setRequiredSpecialty]=useState('');const [requiredPermit,setRequiredPermit]=useState('');
  const [voiceTranscript,setVoiceTranscript]=useState('');const [voiceDraft,setVoiceDraft]=useState<VoiceDraft|null>(null);
  const [title,setTitle]=useState(''); const [eq,setEq]=useState(()=>new URLSearchParams(location.search).get('equipment')||''); const [assignee,setAssignee]=useState('')
  const [section,setSection]=useState('');const [kind,setKind]=useState('unplanned');const [before,setBefore]=useState<string[]>([]);const [photoBusy,setPhotoBusy]=useState(false)
  const [photoCamera,setPhotoCamera]=useState(false);const [priority,setPriority]=useState('normal'); const [hours,setHours]=useState(2)
  useEffect(()=>{H.issueState().then(data=>{setSt(data);const requested=new URLSearchParams(location.search).get('equipment');const selected=(data as any).equipment.find((x:any)=>String(x.id)===requested);if(selected)setSection(String(selected.section));else if(requested)setEq('')}).catch(e=>setErr(e.message))},[])
  if(!st) return <div className="text-muted py-10" role={err?'alert':'status'}>{err||t('Загрузка…')}</div>
  const workers=st.employees.filter((e:any)=>e.role==='worker')
  const cands=selectExecutors(st,eq,{specialty:requiredSpecialty,permit:requiredPermit})
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
          <div className="report-work-field issue-work-field"><textarea required className="mt-1 w-full min-h-28 p-4 rounded-[14px] border border-border bg-surface text-[16px]" placeholder={t('Что нужно исправить?')} value={title} onChange={e=>setTitle(e.target.value)}/><VoiceButton onText={text=>{setTitle(prev=>prev?prev+' '+text:text);setVoiceDraft(parseVoiceFields(text,{mode:'issue',equipment:st.equipment,sections:st.sections.map((s:any)=>s.name)}))}}/></div></label>
        <details className="border rounded p-3"><summary>Разобрать диктовку в поля (черновик)</summary><textarea aria-label="Текст диктовки для полей" className="w-full min-h-24 border p-3" value={voiceTranscript} onChange={e=>setVoiceTranscript(e.target.value)}/><button type="button" className="min-h-14 border rounded p-3" onClick={()=>setVoiceDraft(parseVoiceFields(voiceTranscript,{mode:'issue',equipment:st.equipment,sections:st.sections.map((s:any)=>s.name)}))}>Разобрать черновик</button></details>
        {voiceDraft&&<Card><h3>Поля из диктовки: черновик</h3><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(voiceDraft.fields,null,2)}</pre><p className="text-xs">Не распознано: {voiceDraft.unresolved.length}. Только черновик, проверьте поля. Исполнитель не назначается.</p><button type="button" className="min-h-14 border rounded p-3" onClick={()=>{const f=voiceDraft.fields;if(f.title)setTitle(f.title);if(f.section)setSection(f.section);if(f.equipmentId){setEq(f.equipmentId);const e=st.equipment.find((x:any)=>String(x.id)===String(f.equipmentId));if(e)setSection(e.section);setAssignee('')}if(f.kind)setKind(f.kind);if(f.priority)setPriority(f.priority);if(f.hours)setHours(f.hours);setVoiceDraft(null)}}>Применить к черновику</button></Card>}
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Участок')}</span><select aria-label={t("Участок")} className={input} value={section} onChange={e=>{setSection(e.target.value);setEq('');setAssignee('')}}><option value="">{t("Все участки")}</option>{[...new Set(st.equipment.map((x:any)=>String(x.section)))].map((name:any)=><option key={name} value={name}>{name}</option>)}</select></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Тип работ')}</span><select aria-label={t("Тип работ")} className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="unplanned">{t('Внеплановый')}</option><option value="planned">{t('Плановый')}</option></select></label>
        <label className="block"><span className="text-[13px] font-medium text-muted">{t('Оборудование')}</span>
          <select aria-label={t("Оборудование")} required className={"mt-1 "+input} value={eq} onChange={e=>{setEq(e.target.value);const selected=st.equipment.find((x:any)=>String(x.id)===e.target.value);if(selected)setSection(String(selected.section));setAssignee('')}}>
            <option value="">{t('Выбрать…')}</option>
            {st.equipment.filter((x:any)=>!section||String(x.section)===section).map((x:any)=><option key={x.id} value={x.id}>{x.name} · {x.section}</option>)}</select></label>
        <label className="block">Специальность для подсказки<select aria-label="Специальность для подсказки" className={input} value={requiredSpecialty} onChange={e=>setRequiredSpecialty(e.target.value)}><option value="">Не указана: подсказка недоступна</option>{[...new Set(workers.map((w:any)=>w.specialty).filter(Boolean))].map((s:any)=><option key={s}>{s}</option>)}</select></label>
        <p className="text-xs">{requiredPermit?'Подсказка проверяет только выбранный допуск. Право выполнять конкретную работу подтверждает мастер.':'Допуск не выбран: подсказка не проверяет право выполнять конкретную работу.'}</p><label className="block">Допуск для подсказки (если требуется)<select aria-label="Допуск для подсказки" className={input} value={requiredPermit} onChange={e=>setRequiredPermit(e.target.value)}><option value="">Не выбран</option>{[...new Set((st.permits||[]).map((p:any)=>p.permit))].map((s:any)=><option key={s}>{s}</option>)}</select></label>
        {eligible.length>0&&<Card className="border-primary/40 bg-primary/5 !p-3.5 space-y-2">
          <div className="text-[12px] font-semibold text-muted uppercase">{t('Подбор по правилам · решает мастер')}</div><p className="text-[13px]">Специальность выбирает мастер. Учёт оценок на этом узле; соответствие конкретным работам проверяет мастер.</p>
          {eligible.map((c:any,i:number)=>(<div key={c.w.id} className="space-y-1 pb-2 border-b border-border/50 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px]"><b>{i+1}. {c.w.name}</b> · {c.w.specialty||'—'}{c.w.brigade?' · '+c.w.brigade:''}</div>
              <button type="button" onClick={()=>setAssignee(c.w.id)} className="min-h-14 px-4 rounded-full text-[13px] font-semibold bg-primary text-primary-ink shrink-0">{t('Выбрать')}</button>
            </div>
            <div className="text-[12px] text-muted">
              {c.inWork?t('Занят: наряд')+' #'+c.inWork.id:c.q?t('В очереди')+' '+c.q:c.review?t('На проверке')+' '+c.review:t('Свободен')}
              <span>{c.reason}</span>
              {c.onEq?` · ${c.onEq} закрытых на этом узле`:' · на этом узле не работал'}
              {c.otPct!==null?` · в срок ${c.otPct}%`:''}
              {c.rw?` · переделок ${c.rw}`:''}
            </div>
            {c.perms.length>0&&<div className="text-[12px]">
              {c.perms.map((p:any)=><span key={p.id} className={"inline-block mr-2 px-2 py-0.5 rounded-full "+(p.expired?'bg-danger/15 text-danger':'bg-surface text-muted')}>{p.permit} {p.expired?'· истёк':'до '+p.valid_until}</span>)}
            </div>}
          </div>))}
          <Explain title={t('Почему эти исполнители')}>{t('Доступность, опыт на узле и сроки. Специальность выбирает мастер. Учёт оценок на этом узле; соответствие конкретным работам проверяет мастер. История ограничена загруженным срезом, это не полный рейтинг предприятия. Финальный выбор за мастером.')}</Explain>
        </Card>}
        {refused.length>0&&<Card className="!p-3 text-[12px] text-muted">{t('Не в подборе')} · {refused.map((c:any)=>c.w.name+': '+c.reason).join('; ')}. {t('Мастер проверяет допуск перед назначением.')}</Card>}
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
