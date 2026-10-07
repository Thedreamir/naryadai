export type PeriodDays=7|30|90
export function savedPeriod():PeriodDays {const n=Number(localStorage.getItem('naryadai.report.days'));return n===7||n===30||n===90?n:90}
export function setPeriod(days:PeriodDays){localStorage.setItem('naryadai.report.days',String(days))}
export function periodBounds(days:PeriodDays){const until=new Date().toISOString();return {since:new Date(Date.parse(until)-days*86400000).toISOString(),until}}
export function within(value:string|undefined,bounds:{since:string,until:string}){return !!value && Date.parse(value)>=Date.parse(bounds.since) && Date.parse(value)<Date.parse(bounds.until)}
