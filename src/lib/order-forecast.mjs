// Arrival cadence of recorded orders, never physical failure probability/MTBF.
const DAY=86400000;
const quantile=(sorted,p)=>{const x=(sorted.length-1)*p,i=Math.floor(x);return sorted[i]+(sorted[Math.ceil(x)]-sorted[i])*(x-i)};
export function orderForecast(orders,equipmentId,{asOf=Date.now(),windowDays=180,minOrders=6}={}){
 if(!Number.isFinite(asOf))return {state:'unavailable',count:0};
 const seen=new Set();let invalid=0;
 const past=orders.filter(o=>String(o.equipment_id)===String(equipmentId)&&o.kind==='unplanned'&&!o.cancelled&&!['cancelled','rejected'].includes(o.status)).filter(o=>{const at=Date.parse(o.created_at);if(!Number.isFinite(at)){invalid++;return false}if(at>=asOf||at<asOf-windowDays*DAY||o.id==null||seen.has(String(o.id)))return false;seen.add(String(o.id));return true}).map(o=>Date.parse(o.created_at)).sort((a,b)=>a-b);
 const gaps=past.slice(1).map((at,i)=>(at-past[i])/DAY).filter(x=>x>0);
 const base={count:past.length,intervalCount:gaps.length,invalid,windowDays,lastAt:past.at(-1)||null,asOf};
 if(past.length<minOrders||gaps.length<minOrders-1)return {...base,state:'thin'};
 const sorted=[...gaps].sort((a,b)=>a-b);const medianDays=quantile(sorted,.5),lowDays=quantile(sorted,.1),highDays=quantile(sorted,.9);const lastAt=past.at(-1);
 return {...base,state:asOf>lastAt+highDays*DAY?'elapsed':'estimate',medianDays,lowDays,highDays,expectedAt:lastAt+medianDays*DAY,rangeStart:lastAt+lowDays*DAY,rangeEnd:lastAt+highDays*DAY};
}
