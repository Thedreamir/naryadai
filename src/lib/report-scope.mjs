const DAY=86400000;
export function customBounds(start,end){
 const stamp=x=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x)?Date.parse(x+':00+05:00'):NaN;
 const lo=stamp(start),hi=stamp(end);
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi||hi-lo>366*DAY)throw Error('Период: начало раньше конца, максимум 366 дней. Часовой пояс Asia/Almaty.');
 // Reject JS date normalization (e.g. February 30).
 const local=ms=>new Date(ms+5*3600000).toISOString().slice(0,16);
 if(local(lo)!==start||local(hi)!==end)throw Error('Некорректная календарная дата');
 return {since:new Date(lo).toISOString(),until:new Date(hi).toISOString()};
}
export function matchesScope(order,scope={},employees=[]){
 const worker=employees.find(w=>w.id===order.assignee_id);
 return (!scope.section||order.section===scope.section)&&(!scope.equipment||String(order.equipment_id)===String(scope.equipment))&&(!scope.worker||order.assignee_id===scope.worker)&&(!scope.brigade||worker?.brigade===scope.brigade);
}
export function scopeIds(scope,state){return {sectionId:scope.section?state.sections.find(s=>s.name===scope.section)?.id??-1:null,equipmentId:scope.equipment?Number(scope.equipment):null,workerId:scope.worker||null,brigade:scope.brigade||null};}
export function dayBuckets(bounds,orders){const lo=Date.parse(bounds.since),hi=Date.parse(bounds.until);if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi)return [];const first=Math.floor((lo+18000000)/DAY)*DAY-18000000;const map=new Map();for(let ms=first;ms<hi&&map.size<368;ms+=DAY)map.set(new Date(ms+18000000).toISOString().slice(0,10),0);for(const o of orders){const t=Date.parse(o.closed_at);if(t>=lo&&t<hi){const key=new Date(t+18000000).toISOString().slice(0,10);if(map.has(key))map.set(key,map.get(key)+1)}}return [...map].map(([day,count])=>({day,count}));}
