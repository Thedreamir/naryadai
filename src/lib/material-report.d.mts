export const KNOWN_UNITS: readonly string[];
export function normalizeUnit(u:unknown):string|null;
export type MaterialRow={name:string;unit:string;total:number;lines:number;orders:number;order_ids:any[];equipment:string[]};
export type ExcludedLine={order_id:any;name:string|null;unit:any;quantity:any;reason:'missing_name'|'unknown_unit'|'invalid_quantity'};
export function materialReport(orders:any[]|null|undefined,options?:{since?:number|string;until?:number|string}):{
 rows:MaterialRow[];excluded:ExcludedLine[];excluded_by_reason:Record<string,number>;
 skipped_orders:{order_id:any;reason:'no_date'|'outside_period'}[];
 counts:{orders_with_materials:number;lines_seen:number;lines_included:number;lines_excluded:number};
 complete:boolean;caveats:string[]};
