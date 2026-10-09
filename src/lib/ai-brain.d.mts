import type {CheckConfig,CheckResult} from './check-priority.mjs';
export interface BrainActor {id:string; role:'worker'|'master'|'leader'|'admin';is_active:boolean}
export interface BrainOrder {id:number;version?:number;equipment_id:number;assignee_id?:string;status:string;[key:string]:unknown}
export interface BrainSource {id:number;version:number;status:string;reviewed_by:string|null;reviewed_at:string|null;equipment_id?:number|null;title?:string}
export interface BrainReview {orderId:number;orderVersion:number;archived?:boolean;result:Record<string,any>}
export interface BrainInput {actor:BrainActor;order?:BrainOrder|null;history?:BrainOrder[];documents?:BrainSource[];memory?:BrainSource[];review?:BrainReview|null;asOf?:number;priorityConfig?:Partial<CheckConfig>}
export interface BrainSnapshot {schema:string;mode:string;asOf:string;scope:{role:string;orderId:number|null;orderVersion:number|null;equipmentId:number|null;visibleHistoryCount:number};knowledge:{documents:Record<string,unknown>[];memory:Record<string,unknown>[];precedence:string[];contentIsData:boolean;autoPromotion:boolean};report:{state:string;score:number|null;verdict:string|null;archive:string;modelParticipated:boolean;visualComparison:boolean;flags:string[]};priority:CheckResult|null;next:{kind:string;owner:string;orderId:number}[];warnings:string[]}
export function composeAiBrain(input:BrainInput):BrainSnapshot;
