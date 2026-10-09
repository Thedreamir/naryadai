import HistorySignalsPanel from '../../components/HistorySignalsPanel'
import OrderForecastPanel from '../../components/OrderForecastPanel'
import {useLocale} from '../../lib/locale'
import CheckPriorityPanel from '../../components/CheckPriorityPanel'
import {Explain} from '../../components/VisualBlocks'
import {Link} from 'react-router-dom'
import {useEffect,useRef,useState} from 'react'
import * as H from '../../lib/data'
import {useOrderState} from '../../lib/use-order-state'
import {Card} from '../../components/ui/card'
import {savedPeriod,setPeriod,periodBounds,type PeriodDays} from '../../lib/period'
import {currentSummary,workerLoad,repeatRows} from '../../lib/manager-summary.mjs'
import {isTechnicalTitle,savedPresentation,setPresentation} from '../../lib/presentation'
import type {Actor} from '../../App'
import './manager.css'
const states:Record<string,string>={free:'Свободен',busy:'В работе',queue:'Есть очередь',assigned:'Назначен наряд',off:'Не на смене',unknown:'Смена не указана'}
export default function LeaderOverview({actor:_actor}:{actor:Actor}){
  const {t,locale}=useLocale()
 const stamp=(value:string)=>new Date(value).toLocaleString(locale==='kz'?'kk-KZ':'ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})

 const {st,error,refresh}=useOrderState()
 const [days,setDays]=useState<PeriodDays>(savedPeriod)
 const [bounds,setBounds]=useState(()=>periodBounds(savedPeriod()))
 const [section,setSection]=useState('')
 const [pres,setPres]=useState(savedPresentation)
 const [radar,setRadar]=useState<any[]|null>(null)
 const [repeatError,setRepeatError]=useState('')
 const [loading,setLoading]=useState(false)
 const generation=useRef(0)
 useEffect(()=>{let alive=true;const n=++generation.current;setLoading(true);setRadar(null);setRepeatError('');H.repeatTop(bounds.since,bounds.until).then(rows=>{if(alive&&n===generation.current){if(!Array.isArray(rows))throw Error(t('Сервис вернул неполный ответ'));setRadar(rows)}}).catch(e=>{if(alive&&n===generation.current)setRepeatError((e as Error).message)}).finally(()=>{if(alive&&n===generation.current)setLoading(false)});return()=>{alive=false}},[bounds])
 const update=()=>{refresh();setBounds(periodBounds(days))}
 if(!st)return <div role={error?'alert':'status'} className="space-y-3 py-8"><p>{error?t("Данные недоступны: {v0}").replace("{v0}",()=>String(error)):t("Загрузка сводки…")}</p>{error&&<button className="manager-control" onClick={update}>{t("Повторить")}</button>}</div>
 const visible=st.orders.filter((o:any)=>(!pres||!isTechnicalTitle(o.title))&&(!section||o.section===section))
 const summary=currentSummary(visible)
 const allVisible=st.orders.filter((o:any)=>!pres||!isTechnicalTitle(o.title))
 const globalLoad=workerLoad(st.employees,allVisible)
 const load=workerLoad(st.employees,visible).map(r=>({...r,availability:globalLoad.find(g=>String(g.worker.id)===String(r.worker.id))?.availability||r.availability}))
 const repeats=repeatRows(radar||[],st.equipment,section)
 const unassigned=summary.active.filter(o=>!o.assignee_id||!st.employees.some((e:any)=>String(e.id)===String(o.assignee_id)))
 return <div className="leader-overview space-y-4">
  <div className="manager-header"><div><h1>{t("Завод: сейчас")}</h1><p className="manager-note">{t("Время Алматы")}</p></div><button className="manager-refresh" aria-label={t("Обновить сводку")} onClick={update}>↻</button></div>
  {error&&<p role="alert" className="manager-error">{t("Обновление не удалось:")} {error}{t(". Показан последний загруженный срез.")}</p>}
  <div className="manager-filter-chips"><div aria-label={t("Участок")}><button aria-pressed={!section} onClick={()=>setSection('')}>{t("Все доступные")}</button>{st.sections?.map((s:any)=><button key={s.id} aria-pressed={section===s.name} onClick={()=>setSection(s.name)}>{s.name}</button>)}</div><div aria-label={t("Период повторов")}>{[7,30,90].map(n=><button key={n} aria-pressed={days===n} onClick={()=>{const d=n as PeriodDays;setDays(d);setPeriod(d);setBounds(periodBounds(d))}}>{n} {t("дней")}</button>)}</div></div>
  {summary.review.length>0&&<section className="leader-review-primary"><h2>{summary.review.length} {t("ждут мастера")}</h2><p>{t("Откройте отчёт. Решение принимает мастер.")}</p><Link to="/handover">{t("Проверить")}</Link></section>}
  <section className="leader-glance"><h2 className="text-xl font-bold">{t("Текущий срез")}</h2><div className="manager-metrics"><div><b>{summary.overdue.length}</b><span>{t("Просрочено")}</span></div><div><b>{summary.review.length}</b><span>{t("Ждут мастера")}</span></div><div><b>{summary.inWork.length}</b><span>{t("В работе")}</span></div></div><p>{summary.active.length} {t("активных наряда. Простой не подтверждён.")}</p></section>
  <HistorySignalsPanel orders={st.orders.filter((o:any)=>!section||o.section===section)} since={Date.parse(bounds.since)} until={Date.parse(bounds.until)}/>
  <OrderForecastPanel orders={st.orders} equipment={st.equipment} section={section} offline={st.offline}/>
  <div className="manager-grid"><Link className="visual-action" to="/handover"><strong>{t("Отчёт за смену →")}</strong><span>{t("Закрытия · незавершённые · проверка")}</span></Link><Link className="visual-action" to="/report"><strong>{t("Отчёт и рейтинг →")}</strong><span>{t("Оценки мастера · пять факторов")}</span></Link><Link className="visual-action" to="/memory"><strong>{t("История ремонтов →")}</strong><span>{t("Работы по оборудованию")}</span></Link></div>
  <Card><h2 className="text-lg font-bold">{t("Просрочки: требуется внимание")}</h2>{summary.overdue.slice(0,6).map(o=><div className="manager-row" key={o.id}><div><strong>#{o.id} · {o.equipment}</strong><small>{o.title} · {o.assignee||t("Исполнитель не указан")}</small><small>{t("Срок:")} {stamp(o.deadline)}</small></div><Link className="manager-control shrink-0" to={`/equipment/${o.equipment_id}`}>{t("История")}</Link></div>)}{!summary.overdue.length&&<p className="manager-empty">{t("В загруженном срезе просрочек нет.")}</p>}{summary.overdue.length>6&&<p className="manager-note">{t("Показано 6 из")} {summary.overdue.length}{t(". Полный список в отчёте за смену.")}</p>}</Card>
  <Card><h2 className="text-lg font-bold">{t("Загрузка исполнителей")}</h2><p className="manager-note">{t("Число активных нарядов, не часы работы и не оценка производительности. При фильтре участка счётчики показывают только его наряды; статус занятости учитывает все доступные участки.")}</p>{load.map(r=><div className="manager-row" key={r.worker.id}><div><strong>{r.worker.name}</strong><small>{r.worker.brigade||t("Бригада не указана")}</small><span className={`manager-status ${r.availability}`}>{t(states[r.availability])}</span>{r.availability==='off'&&r.assigned.length>0&&<small className="text-danger">{t("Есть активный наряд вне смены: проверить назначение")}</small>}</div><div className="text-right shrink-0"><strong>{r.assigned.length} {t("активных")}</strong><small>{t("Очередь:")} {r.queued} {t("· проверка:")} {r.reviewing}</small>{r.overdue>0&&<small className="text-danger">{t("Просрочено:")} {r.overdue}</small>}</div></div>)}{load.length===0&&<p className="manager-empty">{t("Доступных исполнителей нет.")}</p>}{unassigned.length>0&&<p className="manager-error">{unassigned.length} {t("активных нарядов без доступной карточки исполнителя. Требуется проверка мастера.")}</p>}</Card>
  <Card><h2 className="text-lg font-bold">{t("Повторные наряды")}</h2><p className="manager-note">{t("Сигнал для проверки, не диагноз и не прогноз отказа.")}</p>{loading&&<p role="status" className="manager-empty">{t("Загрузка повторов…")}</p>}{repeatError&&<p role="alert" className="manager-error">{t("Повторы недоступны:")} {repeatError}{t(". Это не означает отсутствие повторов.")}</p>}{!loading&&!repeatError&&radar&&repeats.map((r:any)=><div className="manager-row" key={`${r.equipment_id}:${r.fault_code}`}><div><strong>{r.equipment}</strong><small>{t("Шифр:")} {r.fault_code} {t("· закрытых нарядов:")} {r.closed_count}</small><small>{t("Пар в окне повтора:")} {r.pairs_within_window}</small></div><Link className="manager-control shrink-0" to={`/equipment/${r.equipment_id}`}>{t("История")}</Link></div>)}{!loading&&!repeatError&&radar&&repeats.length===0&&<p className="manager-empty">{t("В возвращённой выборке повторов для этого участка нет.")}</p>}<Explain title={t("Как считается сигнал")}><p>{t("Источник: repeat_top. Закрытые наряды отбираются по дате закрытия:")} {stamp(bounds.since)} - {stamp(bounds.until)}{t(". Окно пары задаёт справочник шифров; по умолчанию 7 дней. Пары могут пересекаться и не равны числу отказов.")}</p><p>{t("Фильтр участка применяется к возвращённым строкам; полнота зависит от видимости и загрузки истории. Презентационный фильтр технических нарядов не применяется к серверным повторам.")}</p></Explain></Card>
    <CheckPriorityPanel orders={st.orders} equipment={st.equipment} canOpenOrders={false}/>
  <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={pres} onChange={e=>{setPres(e.target.checked);setPresentation(e.target.checked)}}/>{t("Скрыть технические наряды в текущем срезе")}</label>
  <p className="manager-note">{t("Источник: учебный набор данных. Не оперативная диспетчеризация.")}{st.orders.length>=600?t(" Достигнут лимит 600 нарядов: срез может быть неполным."):''} {t("Среднее время реакции, выполнения и простой не показаны без проверенных временных событий.")}</p>
 </div>
}
