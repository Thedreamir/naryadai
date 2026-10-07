import {TriangleAlert, Zap, Minus} from 'lucide-react'
const MAP:Record<string,{t:string,I:any,hot:'red'|'amber'|null}>={
  emergency:{t:'Аварийный',I:TriangleAlert,hot:'red'},
  high:{t:'Высокий',I:Zap,hot:'amber'},
  normal:{t:'Обычный',I:Minus,hot:null},
  planned:{t:'Плановый',I:Minus,hot:null},
  medium:{t:'Средний',I:Minus,hot:null},
  low:{t:'Низкий',I:Minus,hot:null},
}
export function PriorChip({p,className='',iconSize=11,inherit=false}:{p:string;className?:string;iconSize?:number;inherit?:boolean}){
  const m=MAP[p]||{t:p,I:Minus,hot:null}
  const color=inherit?undefined:(m.hot==='red'?'var(--tk-red)':m.hot==='amber'?'var(--tk-amber)':'var(--tk-muted)')
  return <span className={`inline-flex items-center gap-1 font-black uppercase ${className}`} style={{color}}><m.I size={iconSize} strokeWidth={2.5} className="shrink-0"/>{m.t}</span>
}
