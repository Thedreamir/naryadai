import model from './predictive-model.json'
export function predictiveRisk(orders:any[],equipmentId:number,asOf=Date.now()){
 const day=86400000;const past=orders.filter(o=>o.equipment_id===equipmentId&&o.kind==='unplanned'&&Date.parse(o.created_at)<asOf).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
 const gaps=past.slice(1).map((o,i)=>(Date.parse(o.created_at)-Date.parse(past[i].created_at))/day);const mtbf=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:30;
 const x=[past.filter(o=>Date.parse(o.created_at)>=asOf-7*day).length,past.filter(o=>Date.parse(o.created_at)>=asOf-30*day).length,past.length?Math.min(60,(asOf-Date.parse(past.at(-1).created_at))/day):60,mtbf,past.length];
 const z=model.weights[0]+x.reduce((s,v,i)=>s+(v-model.mean[i])/model.sd[i]*model.weights[i+1],0);
 return {probability:1/(1+Math.exp(-Math.max(-30,Math.min(30,z)))),recent:x[0],monthly:x[1],interval:mtbf,count:past.length}
}
