export interface LeaderKpiAggregate{orders_total:number;reaction_samples:number;completion_samples:number;reaction_median_min:number|null;reaction_p90_min:number|null;completion_median_min:number|null;completion_p90_min:number|null}
export interface LeaderKpiWorker extends LeaderKpiAggregate{assignee_id:string;name:string|null}
export interface LeaderKpiSection extends LeaderKpiAggregate{section:string}
export function orderTimeline(order:any,events:any[]):{acceptedAt:number|null;completedAt:number|null};
export function leaderKpis(orders:any[],events:any[],options?:{since?:number;until?:number;employees?:any[]}):{since:number;until:number;overall:LeaderKpiAggregate;workers:LeaderKpiWorker[];sections:LeaderKpiSection[];excluded:{outside_or_cancelled:number;no_accept_event:number;no_completed_event:number;inconsistent_timestamps:number};notes:string[];limits:string};
