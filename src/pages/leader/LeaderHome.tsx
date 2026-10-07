import * as H from '../../lib/data'
import Report from '../master/Report'
import type {Actor} from '../../App'
export default function LeaderHome({actor}:{actor:Actor}){
  return <div className="min-h-screen bg-bg">
    <header className="border-b border-border bg-surface px-5 py-4 flex items-center justify-between">
      <div><div className="text-[18px] font-bold">НарядAI · Руководитель</div>
        <div className="text-[12px] text-muted">{actor.name} · демо-учётка</div></div>
      <button onClick={()=>{H.logout();location.reload()}} className="h-11 px-4 rounded-[14px] border border-border text-[14px] font-semibold">Выйти</button>
    </header>
    <main className="max-w-5xl mx-auto p-5">
      <div className="text-[12px] text-muted mb-3">Руководителю доступен сводный отчёт и рейтинг. Выдача и проверка нарядов — функции мастера смены.</div>
      <Report actor={actor}/>
      <div className="text-[12px] text-muted mt-4">Синтетические данные · тестовое облако</div>
    </main>
  </div>
}
