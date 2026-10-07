import {predictiveRisk} from '../../lib/predictive'
import {useEffect, useState} from 'react'
import * as H from '../../lib/data'
import {Card} from '../../components/ui/card'
import {savedPeriod, periodBounds, type PeriodDays} from '../../lib/period'
import {ACTIVE_STATUSES} from '../../lib/status'
import {isTechnicalTitle, savedPresentation, setPresentation} from '../../lib/presentation'
import type {Actor} from '../../App'
export default function LeaderOverview({actor}:{actor:Actor}){
  const [st,setSt]=useState<any>(null); const [an,setAn]=useState<any[]|null>(null); const [radar,setRadar]=useState<any[]|null>(null)
  const [days]=useState<PeriodDays>(savedPeriod()); const [bounds]=useState(()=>periodBounds(days)); const [pres,setPres]=useState(savedPresentation())
  useEffect(()=>{H.state().then(setSt).catch(()=>{});H.anomalies(bounds.since,bounds.until).then(setAn).catch(()=>setAn(null));H.repeatTop(bounds.since,bounds.until).then(setRadar).catch(()=>setRadar(null))},[bounds])
  if(!st) return <div className="text-muted py-10">Загрузка…</div>
  const visible=pres?st.orders.filter((o:any)=>!isTechnicalTitle(o.title)):st.orders; const hiddenN=st.orders.length-visible.length
  const active=visible.filter((o:any)=>ACTIVE_STATUSES.includes(o.status))
  const review=visible.filter((o:any)=>['completed','ai_review'].includes(o.status))
  const inWork=visible.filter((o:any)=>o.status==='in_progress')
  const overdue=active.filter((o:any)=>new Date(o.deadline).getTime()<Date.now())
  const top=(an||[]).slice(0,4)
  const byEquip:Record<string,{name:string,closed:number,pairs:number}>= {}
  ;(radar||[]).forEach((r:any)=>{const k=String(r.equipment_id);if(!byEquip[k])byEquip[k]={name:r.equipment,closed:0,pairs:0};byEquip[k].closed+=r.closed_count||0;byEquip[k].pairs=Math.max(byEquip[k].pairs,r.pairs_within_window||0)})
  const radarRows=Object.values(byEquip).sort((a,b)=>b.pairs-a.pairs||b.closed-a.closed).slice(0,5)
  const level=(r:{closed:number,pairs:number})=>r.pairs>=20||r.closed>=8?{label:'Высокий сигнал',dot:'#c0392b',bg:'#fbeaea',text:'#8f2424'}:r.pairs>=10||r.closed>=5?{label:'Средний сигнал',dot:'#c08c41',bg:'#fdf3e3',text:'#8a5a12'}:{label:'В норме',dot:'#3d8a5a',bg:'#e6f2ea',text:'#1e6b41'}
  const topRisk=radarRows[0]
  const variantB=new URLSearchParams(location.search).get('summary')==='b'
  return <div className="leader-overview space-y-[18px]">
    <section className="leader-glance"><h1>Завод: текущий срез</h1><p>Синтетическое демо · не оперативные данные</p><div className="glance-metrics"><div><b>{overdue.length}</b><span>Просрочено</span></div><div><b>{review.length}</b><span>На проверке</span></div><div><b>{inWork.length}</b><span>В работе</span></div></div><div className="section-bars">{st.sections?.map((section:any)=>{const n=active.filter((o:any)=>o.section===section.name).length;return <div key={section.id}><div className="flex justify-between"><span>{section.name}</span><b>{n}</b></div><div className="section-bar"><span style={{width:Math.round(n/Math.max(1,active.length)*100)+'%'}}/></div></div>})}</div><p>Активные по участкам. Простой: нет проверенных данных.</p></section>
    <Card><h2 className="text-[18px] font-bold">Радар повторов · эксперимент</h2><p className="text-[12px] text-muted mt-2">Риск внепланового наряда в ближайшие 7 дней, не подтверждённого отказа. Логистическая регрессия + интервалы между нарядами. Синтетическая история.</p><p className="text-[13px] mt-2 text-warn">Отложенный тест: 82,13% против 82,40% у «риск всегда». Модель не лучше сильной простой базы. Не используйте для автоматических решений.</p><div className="space-y-3 mt-4">{st.equipment.map((eq:any)=>({...eq,risk:predictiveRisk(visible,eq.id)})).sort((a:any,b:any)=>b.risk.probability-a.risk.probability).slice(0,5).map((eq:any)=><div key={eq.id}><div className="flex justify-between gap-2 text-[13px]"><b>{eq.name}</b><span>{Math.round(eq.risk.probability*100)}% · модель</span></div><div className="h-2 rounded bg-border mt-1"><div className="h-full rounded bg-primary" style={{width:Math.round(eq.risk.probability*100)+'%'}}/></div><p className="text-[11px] text-muted mt-1">{eq.risk.recent} внеплановых за 7 дней · {eq.risk.monthly} за 30 · средний интервал {eq.risk.interval.toFixed(1)} дн.</p></div>)}</div><p className="text-[11px] text-muted mt-3">Обучение до 15 сентября, тест после. Показатели пересчитаны по доступной истории, не потоковый промышленный мониторинг. Решение принимает мастер.</p></Card>
    <section className={'ptah-brief '+(variantB?'ptah-brief-b':'')}>
      <div className="brief-title"><div><span>PTAH · СРЕЗ СМЕНЫ</span><h2>Сводка в одном взгляде</h2></div><small>Советует,<br/>не решает</small></div>
      <div className="brief-tiles">{[{n:active.length,t:'Активных',sub:'по доступной истории'},{n:inWork.length,t:'В работе',sub:'часть активных'},{n:review.length,t:'На проверке',sub:'ждут мастера'},{n:overdue.length,t:'Просрочено',sub:'по сроку',warn:true}].map(x=><div key={x.t} className={x.warn?'tile-warn':''}><b>{x.n}</b><strong>{x.t}</strong><small>{x.sub}</small></div>)}</div>
      <div className="brief-actions"><article className="brief-signal"><span className="brief-eyebrow">01 · СИГНАЛ ЗА {days} ДНЕЙ</span><h3>{topRisk?topRisk.name:'Повторные сигналы'}</h3><p>{topRisk?<><b>{topRisk.pairs}</b> повторных пар закрытий.<br/>Повторы, не диагноз поломки.</>:'В доступной истории не найдены. Отсутствие сигнала не доказывает исправность.'}</p></article><article className="brief-recommendation"><span className="brief-eyebrow">02 · РЕКОМЕНДАЦИЯ</span><h3>{topRisk?'Проверить причину':'Проверить текущую очередь'}</h3><p>{topRisk?'Мастеру разобрать повторные наряды и подтвердить причину до назначения работ.':'Мастеру проверить просрочки и завершённые наряды. Решение не автоматическое.'}</p><small>Решение принимает мастер</small></article></div>
      <footer>Черновик {variantB?'B · акцент на действии':'A · спокойные карточки'} · правила, не вывод языковой модели · синтетика, не оперативная сводка</footer>
    </section>
    <Card>
      <div className="flex items-center justify-between mb-3"><h2 className="text-[20px] font-bold tracking-[-0.6px]">Радар рисков оборудования</h2><span className="text-[11px] px-2 py-1 rounded-[7px] bg-[#f1f2f1] text-[#6a736e]">Повторы, не диагноз</span></div>
      {radarRows.map((r,i)=>{const lv=level(r);return <div key={i} className="flex items-center gap-3 py-2.5 border-t border-border first:border-0">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{background:lv.dot}}/>
        <span className="text-[14px] font-semibold flex-1">{r.name}</span>
        <span className="text-[12px] text-muted">{r.pairs} повторных пар · {r.closed} закрытий</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{background:lv.bg,color:lv.text}}>{lv.label}</span>
      </div>})}
      {radarRows.length===0&&<div className="text-[13px] text-muted">Повторов за период не найдено.</div>}
      <div className="text-[11px] text-muted mt-3">Градация по повторным закрытиям одного кода неисправности на том же оборудовании. Причину устанавливает мастер.</div>
    </Card>
    <div className="flex items-end justify-between">
      <div><h1 className="text-[38px] font-bold tracking-[-1.8px] leading-[1.1]">Картина производства.</h1>
        <p className="text-[15px] text-muted mt-2">Сначала отклонения. Затем причины и действия.</p></div>
      <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть технические{pres&&hiddenN>0?` (${hiddenN})`:''}</label>
    </div>
    <div className="grid grid-cols-3 gap-[18px]">
      <Card><div className="text-[12px] text-muted">Активные наряды</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{active.length}</div><div className="text-[12px] text-muted">По доступной истории</div></Card>
      <Card><div className="text-[12px] text-muted">В работе</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{inWork.length}</div><div className="text-[12px] text-muted">Часть активных нарядов</div></Card>
      <Card><div className="text-[12px] text-muted">На проверке</div><div className="text-[38px] font-bold tracking-[-1.5px] my-1">{review.length}</div><div className="text-[12px] text-muted">Ожидают решения мастера</div></Card>
    </div>
    <div className="grid grid-cols-[1.44fr_1fr] gap-[18px]">
      <Card>
        <div className="flex items-center justify-between mb-4"><h2 className="text-[20px] font-bold tracking-[-0.6px]">Оборудование · сигналы</h2><span className="text-[11px] px-2 py-1 rounded-[7px] bg-[#f1f2f1] text-[#6a736e]">Не диагноз</span></div>
        {top.map((a:any,i:number)=><div key={i} className="py-3 border-t border-border first:border-0">
          <div className="flex items-center gap-2 text-[12px] text-[#67766b]"><span className="h-2 w-2 rounded-full bg-[#c08c41]"/>Нужна проверка причины</div>
          <div className="text-[14px] font-semibold mt-1">{a.subject}</div>
          <div className="text-[12px] text-muted mt-0.5">{a.facts}</div></div>)}
        {top.length===0&&<div className="text-[13px] text-muted">Сигналов за период не найдено.</div>}
        <div className="mt-4 p-3 rounded-[13px] bg-[#f5f7f4] text-[12px] leading-[1.7] text-[#576b5b]">Сигналы помогают выбрать объект для проверки. Подтверждённая причина и простой показываются только с основанием.</div>
      </Card>
      <Card>
        <div className="flex items-center justify-between mb-3"><h2 className="text-[20px] font-bold tracking-[-0.6px]">Требуют внимания</h2><span className="text-[11px] px-2 py-1 rounded-[7px] bg-[#fff1de] text-[#935d17]">Сроки</span></div>
        {overdue.slice(0,5).map((o:any)=><div key={o.id} className="p-3 border-l-[3px] border-[#d79639] bg-[#fff8ee] rounded-[10px] mb-2">
          <div className="text-[14px] font-semibold">Наряд #{o.id} · срок пропущен</div>
          <div className="text-[12px] text-muted mt-1">{o.title}<br/>{new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'})}</div></div>)}
        {overdue.length===0&&<div className="text-[13px] text-muted">Просроченных нарядов нет.</div>}
        <div className="text-[12px] text-[#6e7a72] leading-[1.6]">Просрочка и повторная поломка — разные сигналы. Причину устанавливает мастер.</div>
      </Card>
    </div>
    <div className="text-[11px] text-muted">Синтетические данные · тестовое облако · не оперативные данные</div>
  </div>
}
