import {Explain} from '../../components/VisualBlocks'
import {Link} from 'react-router-dom'
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
  return <div className="leader-overview space-y-4">
    <section className="leader-glance"><h1>Завод: сейчас</h1><p>Синтетическое демо</p><div className="glance-metrics"><div><b>{overdue.length}</b><span>Просрочено</span></div><div><b>{review.length}</b><span>Ждут проверки</span></div><div><b>{inWork.length}</b><span>В работе</span></div></div><div className="section-bars">{st.sections?.map((section:any)=>{const n=active.filter((o:any)=>o.section===section.name).length;return <div key={section.id}><div className="flex justify-between"><span>{section.name}</span><b>{n}</b></div><div className="section-bar"><span style={{width:Math.round(n/Math.max(1,active.length)*100)+'%'}}/></div></div>})}</div><p>Простой оборудования: нет проверенных данных</p></section>
    <div className="visual-action-row"><Link className="visual-action" to="/report"><strong>Отчёт и рейтинг →</strong><span>Закрытия · качество · сроки</span></Link><Link className="visual-action" to="/memory"><strong>История ремонтов →</strong><span>Что делали на оборудовании</span></Link></div>
    <Card><h2 className="text-lg font-bold">Нужна проверка мастера</h2><span className="visual-tag visual-tag-warn">{overdue.length} просрочено</span>{overdue.slice(0,4).map((o:any)=><div className="visual-alert-row" key={o.id}><span className="visual-alert-number">#{o.id}</span><div><b>{o.equipment}</b><small>{o.title}</small><small>Срок: {new Date(o.deadline).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div></div>)}{!overdue.length&&<p className="mt-3 text-sm">Просрочек нет</p>}</Card>
    <Card><h2 className="text-lg font-bold">Повторные ремонты</h2><span className="visual-tag">Сигнал, не диагноз</span>{radarRows.map((r,i)=><div className="visual-alert-row" key={i}><span className="visual-alert-number">{r.pairs}</span><div><b>{r.name}</b><small>пар повторов · {r.closed} закрытий</small></div></div>)}<Explain title="Что считать повтором">Два закрытых наряда с одним кодом на одном оборудовании в окне повтора. Период: {days} дней. Причину устанавливает мастер; закономерности заложены в синтетические данные.</Explain></Card>
    <details className="visual-explain"><summary>Эксперимент · модель хуже простой базы</summary><div><p className="text-warn">Модель 82,13% · простая база 82,40%. Модель не лучше базы. Не использовать для автоматических решений.</p><p>Риск наряда в ближайшие 7 дней, не подтверждённого отказа. Синтетическая история.</p>{st.equipment.map((eq:any)=>({...eq,risk:predictiveRisk(visible,eq.id)})).sort((a:any,b:any)=>b.risk.probability-a.risk.probability).slice(0,5).map((eq:any)=><div key={eq.id} className="mt-3"><div className="flex justify-between"><b>{eq.name}</b><span>{Math.round(eq.risk.probability*100)}%</span></div><div className="factor-track"><span style={{width:Math.round(eq.risk.probability*100)+'%'}}/></div></div>)}<p className="mt-3">Обучение до 15 сентября, тест после. Не промышленный мониторинг.</p></div></details>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть технические {pres&&hiddenN>0?`(${hiddenN})`:''}</label>
    <span className="visual-tag">Демо · не оперативные данные</span>
  </div>
}
