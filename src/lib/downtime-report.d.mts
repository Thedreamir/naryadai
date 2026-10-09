export type DowntimePlan='planned'|'unplanned';
export interface DowntimeEvent{id?:number|string;equipment_id:number|string;state:'running'|'down';observed_at:string;cause?:string|null;plan?:DowntimePlan|null;[k:string]:any}
export interface DowntimeSegment{plan:DowntimePlan|null;cause:string|null;minutes:number}
export interface DowntimeRow{equipment_id:any;covered:boolean;total_minutes:number|null;planned_minutes:number|null;unplanned_minutes:number|null;unclassified_minutes:number|null;partial_observed_minutes:number;segments:DowntimeSegment[]}
export interface DowntimeCause{cause:string|null;plan:DowntimePlan|null;minutes:number;share:number|null}
export interface DowntimeReport{total_minutes:number|null;covered:number;missing:boolean;planned_minutes:number|null;unplanned_minutes:number|null;unclassified_minutes:number|null;shares:{planned:number|null;unplanned:number|null;unclassified:number|null}|null;by_cause:DowntimeCause[];rows:DowntimeRow[];consistent_with_equipment_downtime?:boolean}
export function downtimeReport(events:DowntimeEvent[]|null,options:{since:number;until:number;equipmentIds?:any[]}):DowntimeReport;
