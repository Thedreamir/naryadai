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
  const canReview=actor.role==='master'||actor.role==='admin'
  const [items,setItems]=useState<Entry[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [notes,setNotes]=useState<Record<number,string>>({})
  const refresh=useCallback(()=>H.repairMemory().then(d=>setItems(d as unknown as Entry[])).catch(e=>setError(e.message)),[])
  useEffect(()=>{refresh()},[refresh])
  const decide=async(id:number,action:'approve'|'reject'|'revoke')=>{
    setBusy(true);setError('')
    try{await H.reviewRepairMemory(id,action,notes[id]||'');await refresh()}
    catch(e){setError((e as Error).message);await refresh()}
    finally{setBusy(false)}
  }
  const [pres,setPres]=useState(savedPresentation())
  const togglePres=(on:boolean)=>{setPresentation(on);setPres(on)}
  const hidden=items.filter(i=>isTechnicalTitle(i.title)).length
  const visible=pres?items.filter(i=>!isTechnicalTitle(i.title)):items
  const candidates=items.filter(i=>i.status==='candidate').length
  return <div>
    <div className="flex items-end justify-between mb-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.5px]">Память ремонтов</h1>
        <div className="text-[13px] text-muted mt-1">Заметки исполнителей становятся базой знаний Ptah AI только после утверждения мастером. Синтетические демо-данные.</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-[13px] text-muted">{candidates>0?`Ожидают проверки: ${candidates}`:'Нет записей на проверке'}</div>
        <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer"><input type="checkbox" checked={pres} onChange={e=>togglePres(e.target.checked)}/>Скрыть технические{pres&&hidden>0?` (скрыто: ${hidden})`:''}</label>
      </div>
    </div>
    {error&&<div className="mb-4 text-[13px] text-[#9c2b2b] bg-[#fbeaea] rounded-[13px] px-4 py-3">{error}</div>}
    {!canReview&&<div className="mb-4 text-[12px] text-muted">Режим чтения: утверждение и отзыв записей — функции мастера.</div>}
    <div className="flex flex-col gap-4">
      {visible.map(e=>{const st=STATUS[e.status]||{label:e.status,cls:'bg-[#eee] text-[#666]'}
        return <Card key={e.id} className="p-5 rounded-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[15px]">{e.title}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                <span className="text-[11px] text-muted">версия {e.version}</span>
              </div>
              <div className="text-[12px] text-muted mt-1">Наряд: {e.order?.title||`#${e.id}`}{e.equipment?.name?` · ${e.equipment.name}`:''} · Автор: {e.author?.name||'—'}</div>
            </div>
          </div>
          <div className="text-[14px] mt-3 leading-[1.55] whitespace-pre-wrap">{e.body}</div>
          {e.reviewer&&<div className="text-[12px] text-muted mt-3">Решение: {e.reviewer.name}{e.reviewed_at?` · ${new Date(e.reviewed_at).toLocaleString('ru-RU')}`:''}{e.review_note?` · ${e.review_note}`:''}</div>}
          {canReview&&(e.status==='candidate'||e.status==='approved')&&<div className="mt-4 pt-4 border-t border-border">
            <input className="w-full h-10 rounded-[13px] border border-border px-3 text-[13px] mb-3 bg-white" placeholder="Комментарий к решению (необязательно)"
              value={notes[e.id]||''} onChange={ev=>setNotes(n=>({...n,[e.id]:ev.target.value}))}/>
            <div className="flex gap-2">
              {e.status==='candidate'&&<>
                <Button disabled={busy} onClick={()=>decide(e.id,'approve')}>Утвердить в базу знаний</Button>
                <Button disabled={busy} variant="outline" onClick={()=>decide(e.id,'reject')}>Отклонить</Button>
              </>}
              {e.status==='approved'&&<Button disabled={busy} variant="outline" onClick={()=>decide(e.id,'revoke')}>Отозвать из базы знаний</Button>}
            </div>
          </div>}
        </Card>})}
      {visible.length===0&&!error&&<div className="text-[13px] text-muted">Записей пока нет.</div>}
    </div>
  </div>
}
