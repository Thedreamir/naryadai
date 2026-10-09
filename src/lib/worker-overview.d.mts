export const workerStatusLabels: Record<string,string>
export function workerOverview(orders:any[],actorId:string,hideTechnical?:boolean,technical?:(title:string)=>boolean):{mine:any[],focus:any|null,queue:any[]}
export function workerDeadline(deadline:string|undefined,now?:number):{valid:boolean,overdue:boolean,minutes:number,at:number|null}
export function workerNextAction(status:string):string
