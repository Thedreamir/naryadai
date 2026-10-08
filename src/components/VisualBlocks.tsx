import {useLocale} from '../lib/locale'
import {useState} from 'react'
import {isTechnicalTitle,savedPresentation,setPresentation} from '../lib/presentation'
import type {ReactNode} from 'react'
import {CheckCircle2,Clock3,ShieldCheck,RotateCcw,Layers} from 'lucide-react'
export function Explain({title='Как это считается',children}:{title?:string,children:ReactNode}){return <details className="visual-explain"><summary>{title}</summary><div>{children}</div></details>}
export function RatingFactors({rating:r}:{rating:any}){
 const factors=[['Качество',r.f_quality,ShieldCheck],['В срок',r.f_ontime,Clock3],['Без доработок',r.f_rework,RotateCcw],['Объём',r.f_volume,Layers],['Без отказов',r.f_rejects,CheckCircle2]] as const
 return <div className="factor-blocks">{factors.map(([label,v,Icon])=><div key={label}><div className="factor-label"><Icon size={15}/><span>{label}</span><b>{v==null?'Нет данных':Math.round(Number(v))+'/100'}</b></div><div className="factor-track"><span style={{width:v==null?'0%':Math.max(0,Math.min(100,Number(v)))+'%'}}/></div></div>)}</div>
}
export function WorkSteps(){const {t}=useLocale();return <ol className="work-steps" aria-label="Этапы наряда">{['Выдать','Выполнить','Проверить'].map((x,i)=><li key={x}><b>{i+1}</b><span>{t(x)}</span></li>)}</ol>}

export function useDemoOrders(orders:any[],keepActive=false){const [hidden,setHidden]=useState(savedPresentation);const visible=hidden?orders.filter(o=>!isTechnicalTitle(o.title)||(keepActive&&['in_progress','paused','rework'].includes(o.status))):orders;const control=<label className="presentation-choice"><input type="checkbox" checked={hidden} onChange={e=>{setHidden(e.target.checked);setPresentation(e.target.checked)}}/>Скрыть технические наряды{hidden&&orders.length!==visible.length?' ('+(orders.length-visible.length)+')':''}</label>;return {visible,control}}
