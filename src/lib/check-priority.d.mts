export interface CheckConfig {lookbackDays:number;repeatWindowDays:number;pairThreshold:number}
export interface RepeatPair {code:string;firstOrderId:string|number;secondOrderId:string|number;firstCreatedAt:string;secondCreatedAt:string;firstClosedAt:string;secondClosedAt:string;overlappingWork:boolean;gapDays:number}
export interface CheckResult {label:string;method:string;source:string;status:'insufficient'|'review'|'below_threshold';pairCount:number;eligibleCount:number;excludedCount:number;missingCount:number;pairs:RepeatPair[];config:CheckConfig;asOf:string;since:string}
export const DEFAULT_CHECK_CONFIG:Readonly<CheckConfig>
export function validateCheckConfig(config?:Partial<CheckConfig>):CheckConfig
export function checkPriority(orders:unknown[],equipmentId:string|number,config?:Partial<CheckConfig>,asOf?:number):CheckResult
