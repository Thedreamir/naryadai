// Equipment state intervals only. Worker pauses/order lifetime never substitute.
export function equipmentDowntime(events,{since,until,equipmentIds}={}){
 if(!Array.isArray(events)||!Number.isFinite(since)||!Number.isFinite(until)||until<=since)return {minutes:null,covered:0,missing:true,rows:[]};
 const ids=equipmentIds??[...new Set(events.map(e=>String(e.equipment_id)))];const rows=[];
 for(const id of ids){const list=events.filter(e=>String(e.equipment_id)===String(id)&&['running','down'].includes(e.state)&&Number.isFinite(Date.parse(e.observed_at))&&Date.parse(e.observed_at)<until).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)||Number(a.id)-Number(b.id));const prior=list.filter(e=>Date.parse(e.observed_at)<=since).at(-1);let state=prior?.state??null,cursor=since,minutes=0;let covered=!!prior;
 for(const e of list.filter(e=>Date.parse(e.observed_at)>since)){const at=Date.parse(e.observed_at);if(state==='down')minutes+=(at-cursor)/60000;state=e.state;cursor=at}
 if(state==='down')minutes+=(until-cursor)/60000;rows.push({equipment_id:id,minutes:covered?Math.round(minutes*10)/10:null,partial_observed_minutes:Math.round(minutes*10)/10,covered})}
 const covered=rows.filter(r=>r.covered).length;return{minutes:rows.length&&covered===rows.length?Math.round(rows.reduce((n,r)=>n+r.minutes,0)*10)/10:null,covered,missing:covered!==rows.length||!rows.length,rows};
}
