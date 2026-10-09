export function customBounds(start:string,end:string):{since:string,until:string};
export function matchesScope(order:any,scope:any,employees?:any[]):boolean;
export function scopeIds(scope:any,state:any):{sectionId:number|null,equipmentId:number|null,workerId:string|null,brigade:string|null};
export function dayBuckets(bounds:{since:string,until:string},orders:any[]):{day:string,count:number}[];
