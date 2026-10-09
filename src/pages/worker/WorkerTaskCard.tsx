import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowRight,Clock,MapPin,TriangleAlert,Wrench} from 'lucide-react'
import {useLocale} from '../../lib/locale'
import {workerDeadline,workerNextAction,workerStatusLabels} from '../../lib/worker-overview.mjs'
import './worker-overview.css'
export function WorkerDeadline({deadline,compact=false}:{deadline:string,compact?:boolean}){
  const {t}=useLocale();const[,tick]=useState(0)
  useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),60000);return()=>clearInterval(timer)},[])
  const d=workerDeadline(deadline)
  const duration=d.minutes>=60?Math.floor(d.minutes/60)+' '+t('ч')+(d.minutes%60?' '+d.minutes%60+' '+t('мин'):''):d.minutes+' '+t('мин')
  const date=d.at===null?'':new Date(d.at).toLocaleString('ru',{timeZone:'Asia/Almaty',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
  return <div className={'wo-deadline'+(compact?' wo-deadline-compact':'')+(d.overdue?' wo-overdue':'')}>
    <strong><Clock size={20} aria-hidden="true"/>{!d.valid?t('Срок не указан'):d.minutes===0?t('Срок сейчас'):(d.overdue?t('Просрочено на'):t('До срока'))+' '+duration}</strong>
    {d.valid?<time dateTime={new Date(d.at!).toISOString()}>{t('Срок')}: {date} · {t('время Алматы')}</time>:<span>{t('Уточните у мастера')}</span>}
  </div>
}
export default function WorkerTaskCard({order:o,equipment,focus=false}:{order:any,equipment:any[],focus?:boolean}){
  const {t}=useLocale();const unit=equipment.find(e=>e.id===o.equipment_id)
  const name=o.equipment||unit?.name||t('Оборудование не указано')
  const section=o.section||unit?.section||t('Участок не указан')
  const priority:Record<string,string>={emergency:'Аварийный наряд',high:'Высокий',normal:'Обычный',planned:'Плановый'}
  const content=<>
    <div className="wo-card-top"><span>{t(['issued','queued'].includes(o.status)?'Новое назначение':focus?'Ваш наряд':'Наряд')} №{o.id}</span><span className="wo-status">{t(workerStatusLabels[o.status]||o.status)}</span></div>
    <div className={'wo-priority'+(o.priority==='emergency'?' wo-emergency':'')}>{o.priority==='emergency'&&<TriangleAlert size={20} aria-hidden="true"/>}{t(priority[o.priority]||'Приоритет не указан')}</div>
    <h2 className="wo-task-title">{o.title||t('Описание не указано')}</h2>
    <dl className="wo-location"><div><dt><Wrench size={20} aria-hidden="true"/>{t('Оборудование')}</dt><dd>{name}</dd></div><div><dt><MapPin size={20} aria-hidden="true"/>{t('Участок')}</dt><dd>{section}</dd></div></dl>
    <WorkerDeadline deadline={o.deadline}/>
  </>
  if(!focus)return <Link to={'/orders/'+o.id} className="tk-card wo-card wo-queue-card">{content}<span className="wo-primary wo-row-open tk-touch">{t(workerNextAction(o.status))}<ArrowRight size={22} aria-hidden="true"/></span></Link>
  return <section className="tk-card wo-card wo-focus" aria-label={t('Ваш наряд')}>
    {content}
    <div className="wo-permit"><span>{t('Допуск')}</span><strong>{t(o.permit_kind==='not_required'?'Не требуется':o.permit_kind?'Запись в карточке, проверьте условия':'Не отмечен, уточните у мастера')}</strong></div>
    <p className="wo-next-note">{t('Открытие карточки не меняет статус. Начало работы и сдача отчёта внутри наряда.')}</p>
    <Link className="wo-primary tk-touch" to={'/orders/'+o.id}>{t(workerNextAction(o.status))}<ArrowRight size={24} aria-hidden="true"/></Link>
  </section>
}
