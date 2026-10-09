// Lane 07: downtime cause / planned-vs-unplanned share model.
// Input: explicit equipment state events only ({id,equipment_id,state:'running'|'down',observed_at,cause?,plan?}).
// Order status, worker pauses and free-text `reason` are never used to classify or infer downtime.
// `plan` must be exactly 'planned' or 'unplanned', `cause` a non-empty string; otherwise the interval is "unclassified".
// Not a measured accuracy or a score: arithmetic over supplied events.
import {equipmentDowntime} from './equipment-downtime.mjs';
const r1=n=>Math.round(n*10)/10;
const UNCL='unclassified';
const cleanCause=c=>typeof c==='string'&&c.trim()?c.trim().slice(0,80):null;
const cleanPlan=p=>p==='planned'||p==='unplanned'?p:null;
function parse(e){const at=Date.parse(e?.observed_at);return Number.isFinite(at)&&['running','down'].includes(e?.state)&&e.equipment_id!=null?at:NaN}
export function downtimeReport(events,{since,until,equipmentIds}={}){
 const empty={total_minutes:null,covered:0,missing:true,planned_minutes:null,unplanned_minutes:null,unclassified_minutes:null,shares:null,by_cause:[],rows:[]};
 if(!Array.isArray(events)||!Number.isFinite(since)||!Number.isFinite(until)||until<=since)return empty;
 const base=equipmentDowntime(events,{since,until,equipmentIds});
 const ids=equipmentIds??[...new Set(events.map(e=>String(e.equipment_id)))];
 const rows=[];
 for(const id of ids){
  const list=events.filter(e=>String(e.equipment_id)===String(id)&&parse(e)<until).sort((a,b)=>parse(a)-parse(b)||Number(a.id)-Number(b.id));
  const prior=list.filter(e=>parse(e)<=since).at(-1);
  const covered=!!prior;let cur=prior??null,cursor=since;const seg=[];
  const close=to=>{if(cur?.state==='down'&&to>cursor)seg.push({plan:cleanPlan(cur.plan),cause:cleanCause(cur.cause),minutes:(to-cursor)/60000})};
  for(const e of list.filter(e=>parse(e)>since)){const at=parse(e);close(at);cur=e;cursor=at}
  close(until);
  const sum=(f)=>r1(seg.filter(f).reduce((n,s)=>n+s.minutes,0));
  rows.push({equipment_id:id,covered,
   total_minutes:covered?sum(()=>true):null,planned_minutes:covered?sum(s=>s.plan==='planned'):null,unplanned_minutes:covered?sum(s=>s.plan==='unplanned'):null,unclassified_minutes:covered?sum(s=>!s.plan):null,
   partial_observed_minutes:sum(()=>true),segments:seg.map(s=>({...s,minutes:r1(s.minutes)}))});
 }
 const covered=rows.filter(r=>r.covered).length;const complete=rows.length>0&&covered===rows.length;
 if(!complete)return{...empty,covered,rows,missing:true,total_minutes:null};
 const tot=f=>r1(rows.reduce((n,r)=>n+r[f],0));
 const total=tot('total_minutes');
 const causes=new Map();
 for(const r of rows)for(const s of r.segments){const k=(s.cause??UNCL)+'|'+(s.plan??UNCL);const c=causes.get(k)??{cause:s.cause,plan:s.plan,minutes:0};c.minutes+=s.minutes;causes.set(k,c)}
 const by_cause=[...causes.values()].map(c=>({cause:c.cause??null,plan:c.plan??null,minutes:r1(c.minutes),share:total>0?Math.round(c.minutes/total*1000)/1000:null})).sort((a,b)=>b.minutes-a.minutes||String(a.cause).localeCompare(String(b.cause)));
 const planned=tot('planned_minutes'),unplanned=tot('unplanned_minutes'),uncl=tot('unclassified_minutes');
 const sh=m=>total>0?Math.round(m/total*1000)/1000:null;
 return{total_minutes:total,covered,missing:false,planned_minutes:planned,unplanned_minutes:unplanned,unclassified_minutes:uncl,
  shares:total>0?{planned:sh(planned),unplanned:sh(unplanned),unclassified:sh(uncl)}:null,by_cause,rows,
  consistent_with_equipment_downtime:base.minutes===null||Math.abs(base.minutes-total)<=0.2*rows.length};
}
