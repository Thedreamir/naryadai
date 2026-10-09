export type FactorKey = 'f_quality'|'f_ontime'|'f_rework'|'f_volume'|'f_rejects'
export interface RatingFactorRow {worker_id:string|number; f_quality?:unknown; f_ontime?:unknown; f_rework?:unknown; f_volume?:unknown; f_rejects?:unknown}
export interface BrigadeEmployee {id:string|number; role:string; brigade?:string|null}
export interface FactorDefinition {key:FactorKey; label:string; weight:number}
export interface BrigadeFactor extends FactorDefinition {mean:number|null; available:number; missing:number; min:number|null; max:number|null}
export interface WeightProfile {profile:string; workerCount:number; activeWeight:number; weights:Record<FactorKey,number>}
export interface BrigadeSummary {name:string; workerCount:number; heterogeneousWeights:boolean; weightProfiles:WeightProfile[]; factors:BrigadeFactor[]}
export interface BrigadeFactorModel {brigades:BrigadeSummary[]; omittedRows:number; invalidFactors:number; sourceRows:number}
export const BRIGADE_FACTORS: readonly Readonly<FactorDefinition>[]
export function factorValue(value:unknown):number|null
export function brigadeFactors(ratings:readonly RatingFactorRow[]|null|undefined,employees:readonly BrigadeEmployee[]|null|undefined,options?:{brigade?:string|null}):BrigadeFactorModel
