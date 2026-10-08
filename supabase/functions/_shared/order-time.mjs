export function almatyDeadline(value){
 const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return null;
 return new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' (Алматы, UTC+5)';
}
export function completionTiming(started,completed,deadline){
 const a=Date.parse(started),b=Date.parse(completed),d=Date.parse(deadline);
 if(!Number.isFinite(b)||!Number.isFinite(d))return {completed_at:null,elapsed_minutes:null,overdue_minutes:null};
 return {completed_at:new Date(b).toISOString(),elapsed_minutes:Number.isFinite(a)&&b>=a?Math.round((b-a)/60000):null,overdue_minutes:Math.max(0,Math.floor((b-d)/60000))};
}
