import {Link} from 'react-router-dom'
import {useLocale} from '../../lib/locale'
import DemoTour from '../../components/DemoTour'
import {Explain,RatingFactors} from '../../components/VisualBlocks'
import {savedPeriod,setPeriod,periodBounds,within,type PeriodDays} from '../../lib/period'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import type {Actor} from '../../App'
import {LogOut} from 'lucide-react'
export default function Profile({actor}:{actor:Actor}){
  const {t,locale}=useLocale()

  const [days,setDays]=useState<PeriodDays>(savedPeriod); const [bounds,setBounds]=useState(()=>periodBounds(savedPeriod()))
  const [st,setSt]=useState<any>(null); const [rt,setRt]=useState<any|null>(null)
  useEffect(()=>{H.state().then(setSt).catch(()=>{});H.ratings(bounds.since,bounds.until).then(rs=>setRt((rs||[]).find((r:any)=>r.worker_id===actor.id)||null)).catch(()=>{})},[bounds])
  const mine=st?st.orders.filter((o:any)=>o.assignee_id===actor.id):[]
  const closed=mine.filter((o:any)=>o.status==='closed'&&within(o.closed_at,bounds))
  const scored=closed.filter((o:any)=>o.ai_result?.human_score)
  const avg=scored.length?(scored.reduce((a:number,o:any)=>a+o.ai_result.human_score,0)/scored.length).toFixed(1):'—'
  // Headline uses the same 90-day window as the five-factor rating so the numbers match.
  const hClosed=rt?Number(rt.closed):closed.length
  const hOnTime=rt&&rt.f_ontime!=null&&Number(rt.closed)?Math.round(Number(rt.on_time)/Number(rt.closed)*100):null
  return <div className="space-y-3"><p className="text-[11px] text-muted" role="note">{locale==='kz'&&t('Казахский перевод: черновик, производственные тексты требуют проверки.')}</p><details className="tk-card p-3 profile-help"><summary>{t("Как устроена смена")}</summary><DemoTour audience="worker"/></details>
    <div className="tk-card p-3.5 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-tk-slate text-white flex items-center justify-center text-lg font-black">{actor.name?.[0]||'?'}</div>
      <div><div className="font-black text-sm">{actor.name}</div><div className="text-[0.6875rem]" style={{color:'var(--tk-muted)'}}>{t("Исполнитель ·")} {actor.email}</div></div>
    </div>
    <fieldset aria-label={t("Период профиля")} className="profile-period"><legend>{t("Период")}</legend>{([7,30,90] as PeriodDays[]).map(d=><button type="button" key={d} aria-pressed={days===d} onClick={()=>{setDays(d);setPeriod(d);setBounds(periodBounds(d))}}>{d} {t("дней")}</button>)}</fieldset>
    <div className="grid grid-cols-3 gap-2">
      {[[hClosed,t('закрыто · {days} дн').replace('{days}',()=>String(days))],[hOnTime!==null?hOnTime+'%':'—',t("в срок")],[rt?.quality_avg??'—',t("оценка мастера")]].map(([v,l])=>
        <div key={String(l)} className="tk-card p-3 text-center"><div className="text-xl font-black text-tk-amber">{v}</div><div className="text-[0.625rem] font-bold uppercase" style={{color:'var(--tk-muted)'}}>{t(l)}</div></div>)}
    </div>
    {rt&&<div className="tk-card p-3.5 space-y-1">
      <div className="flex items-baseline justify-between"><span className="text-[0.625rem] font-bold uppercase" style={{color:'var(--tk-muted)'}}>{t("Мой рейтинг (пять факторов)")}</span>
        <span className="text-xl font-black text-tk-amber">{rt.total??t("Нет данных")}</span></div>
      <span className="visual-tag">{rt.factors_available}{t("/5 факторов · расчёт рейтинга")}</span>
      <RatingFactors rating={rt}/>
      <Explain title={t("Расчёт и причины отказов")}><p>{rt.explanation}</p><p>{t("Подтверждено:")} {rt.rejects_justified} {t("· неоправдано:")} {rt.rejects_unjustified} {t("· неизвестно:")} {rt.rejects_unclassified}</p><p>{t("Веса: качество 30 · в срок 25 · без доработок 20 · объём 15 · без отказов 10.")}</p></Explain>
    </div>}
    {closed.length>0&&<section className="tk-card p-4 space-y-3"><h2 className="font-bold text-[18px]">{t("Оценки по нарядам")}</h2>{closed.map((o:any)=><Link key={o.id} to={'/orders/'+o.id} className="profile-order-rating"><span><strong>№{o.id}</strong><span>{o.title}</span></span><b>{Number.isInteger(o.ai_result?.human_score)&&o.ai_result.human_score>=1&&o.ai_result.human_score<=5?`${o.ai_result.human_score} / 5`:t("без оценки")}</b></Link>)}</section>}
    <div className="tk-card p-3 text-[0.625rem]" style={{color:'var(--tk-muted)'}}>{t("Статистика по доступной истории нарядов — не аттестация и не рейтинг персонала.")}</div>
    <p className="text-center text-[0.625rem]" style={{color:'var(--tk-muted)'}}>Tekton OS · Dreamer Labs</p>
    <button onClick={async()=>{await H.logout();location.reload()}} className="tk-touch tk-sub w-full text-tk-red uppercase text-sm"><LogOut size={19} className="inline mr-1.5"/>{t("Выйти")}</button>
  </div>
}
