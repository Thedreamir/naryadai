export function currentSummary(orders:any[],now?:number):{active:any[],overdue:any[],review:any[],inWork:any[]}
export function workerLoad(employees:any[],orders:any[],now?:number):{worker:any,assigned:any[],queued:number,working:number,reviewing:number,availability:string,overdue:number}[]
export function repeatRows(rows:any[],equipment:any[],section?:string):any[]
