import {humanScore} from './human-score.mjs';
import{workerLoad,submissionStats}from'./dispatch-hints.mjs';
export function selectExecutors(state,equipmentId,{specialty='',permit='',now=Date.now()}={}){
 if(!specialty||!equipmentId||!Number.isFinite(now))return [];
 return state.employees.filter(w=>w.role==='worker'&&w.on_shift&&w.is_active!==false&&w.specialty===specialty).map(w=>{
 const load=workerLoad(state.orders,w.id),free=!load.active&&!load.queue&&!load.review;
 const history=state.orders.filter(o=>o.assignee_id===w.id&&!o.cancelled&&o.status==='closed'&&String(o.equipment_id)===String(equipmentId)&&Number.isFinite(Date.parse(o.closed_at))&&Date.parse(o.closed_at)<=now);
 const scored=history.map(o=>humanScore(o.ai_result?.human_score)).filter(n=>n!==null);const quality=scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null;
 const permits=(state.permits||[]).filter(p=>p.employee_id===w.id).map(p=>({...p,expired:!Number.isFinite(Date.parse(p.valid_until))||Date.parse(p.valid_until+'T23:59:59.999+05:00')<now}));
 const qualified=!permit||permits.some(p=>p.permit===permit&&!p.expired);const timely=submissionStats(history,state.events||[]);
 return {w,inWork:load.active,q:load.queue,review:load.review,onEq:history.length,quality,qualityN:scored.length,otPct:timely.pct,rw:(state.events||[]).filter(e=>e.new_status==='rework'&&history.some(o=>o.id===e.order_id)).length,perms:permits,avail:free?0:1,ok:free&&qualified,reason:!free?'Есть активные наряды или ожидание проверки.':!qualified?'Нет подтверждённого указанного допуска.':quality===null?'Свободен, специальность совпадает; оценок на этом узле нет.':'Свободен, специальность совпадает; качество на выбранном узле '+quality.toFixed(2)+'/5 по '+scored.length+' оценкам мастера.'};
 }).sort((a,b)=>Number(b.ok)-Number(a.ok)||(b.quality??-1)-(a.quality??-1)||b.qualityN-a.qualityN||a.w.name.localeCompare(b.w.name));
}
