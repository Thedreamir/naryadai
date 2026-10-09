import {useLocale} from '../../lib/locale'
import {Link} from 'react-router-dom'
import {useCallback, useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {Button} from '../../components/ui/button'
import type {Actor} from '../../App'
import {isTechnicalTitle, savedPresentation, setPresentation} from '../../lib/presentation'

type Entry={id:number,title:string,body:string,status:string,version:number,review_note:string|null,reviewed_at:string|null,created_at:string,
  author?:{name:string}|null,reviewer?:{name:string}|null,order?:{title:string}|null,equipment?:{name:string}|null}

const STATUS:Record<string,{label:string,cls:string}>={
  candidate:{label:'Кандидат',cls:'bg-[#fdf3e3] text-[#8a5a12]'},
  approved:{label:'Утверждена',cls:'bg-[#e6f2ea] text-[#1e6b41]'},
  rejected:{label:'Отклонена',cls:'bg-[#fbeaea] text-[#9c2b2b]'},
  revoked:{label:'Отозвана',cls:'bg-[#eee] text-[#666]'},
}

export default function Memory({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

  const canReview=actor.role==='master'||actor.role==='admin'
  const [items,setItems]=useState<Entry[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [notes,setNotes]=useState<Record<number,string>>({})
  const refresh=useCallback(()=>H.repairMemory().then(d=>setItems(d as unknown as Entry[])).catch(e=>setError(e.message)),[])
  useEffect(()=>{refresh()},[refresh])
  const decide=async(id:number,action:'approve'|'reject'|'revoke',version:number)=>{
    setBusy(true);setError('')
    try{await H.reviewRepairMemory(id,action,notes[id]||'',version);await refresh()}
    catch(e){setError((e as Error).message);await refresh()}
    finally{setBusy(false)}
  }
  const [pres,setPres]=useState(savedPresentation())
  const togglePres=(on:boolean)=>{setPresentation(on);setPres(on)}
  const hidden=items.filter(i=>isTechnicalTitle(i.title)).length
  const visible=pres?items.filter(i=>!isTechnicalTitle(i.title)):items
  const candidates=items.filter(i=>i.status==='candidate').length
  return <div>{import.meta.env.VITE_KNOWLEDGE_PREVIEW==='true'&&<Link to="/knowledge" className="inline-flex items-center h-12 px-4 border rounded-xl mb-3">{t("Загрузить знания (черновик)")}</Link>}
    <div className="flex items-end justify-between mb-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.5px]">{t("Память ремонтов")}</h1>
        <div className="text-[13px] text-muted mt-1">{t("В базу знаний попадает только утверждённое мастером.")}</div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-[13px] text-muted">{candidates>0?t("Ожидают проверки: {v0}").replace("{v0}",()=>String(candidates)):t("Нет записей на проверке")}</div>
        <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer"><input type="checkbox" checked={pres} onChange={e=>togglePres(e.target.checked)}/>{t("Скрыть технические")}{pres&&hidden>0?t(" (скрыто: {v0})").replace("{v0}",()=>String(hidden)):''}</label>
      </div>
    </div>
    {error&&<div className="mb-4 text-[13px] text-[#9c2b2b] bg-[#fbeaea] rounded-[13px] px-4 py-3">{error}</div>}
    {!canReview&&<div className="mb-4 text-[12px] text-muted">{t("Режим чтения: утверждение и отзыв записей — функции мастера.")}</div>}
    <div className="flex flex-col gap-4">
      {visible.map(e=>{const st=STATUS[e.status]||{label:e.status,cls:'bg-[#eee] text-[#666]'}
        return <Card key={e.id} className="p-5 rounded-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[15px]">{e.title}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{t(st.label)}</span>
                <span className="text-[11px] text-muted">{t("версия")} {e.version}</span>
              </div>
              <div className="text-[12px] text-muted mt-1">{t("Наряд:")} {e.order?.title||`#${e.id}`}{e.equipment?.name?` · ${e.equipment.name}`:''} {t("· Автор:")} {e.author?.name||'—'}</div>
            </div>
          </div>
          <details className="visual-explain" open={e.status==='candidate'}><summary>{t("Открыть запись")}</summary><div className="whitespace-pre-wrap">{e.body}</div></details>
          {e.reviewer&&<div className="text-[12px] text-muted mt-3">{t("Решение:")} {e.reviewer.name}{e.reviewed_at?` · ${new Date(e.reviewed_at).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU')}`:''}{e.review_note?` · ${e.review_note}`:''}</div>}
          {canReview&&(e.status==='candidate'||e.status==='approved')&&<div className="mt-4 pt-4 border-t border-border">
            <input className="w-full h-10 rounded-[13px] border border-border px-3 text-[13px] mb-3 bg-white" placeholder={t("Комментарий к решению (необязательно)")}
              value={notes[e.id]||''} onChange={ev=>setNotes(n=>({...n,[e.id]:ev.target.value}))}/>
            <div className="flex gap-2">
              {e.status==='candidate'&&<>
                <Button disabled={busy} onClick={()=>decide(e.id,'approve',e.version)}>{t("Утвердить в базу знаний")}</Button>
                <Button disabled={busy} variant="outline" onClick={()=>decide(e.id,'reject',e.version)}>{t("Отклонить")}</Button>
              </>}
              {e.status==='approved'&&<Button disabled={busy} variant="outline" onClick={()=>decide(e.id,'revoke',e.version)}>{t("Отозвать из базы знаний")}</Button>}
            </div>
          </div>}
        </Card>})}
      {visible.length===0&&!error&&<div className="text-[13px] text-muted">{t("Записей пока нет.")}</div>}
    </div>
  </div>
}
