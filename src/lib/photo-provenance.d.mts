export const PROVENANCE_SCHEMA:'photo-provenance-v1'
export interface ProvenancePhoto{sha256:string|null;byteSize?:number|null;phase:'before'|'after';tier:'server_received'|'untrusted'|'invalid';trusted:boolean;captureTime:'unknown';serverReceivedAt:string|null;findings:string[];reusedOnOrders?:string[]}
export interface ProvenanceAudit{schema:'photo-provenance-v1';orderId:number|string;captureTime:'unknown';after:ProvenancePhoto[];before:ProvenancePhoto[];orderFlags:string[];summary:{afterCount:number;afterServerReceived:number;beforeServerReceived:number};unknowns:string[];limitations:string}
export function sha256OfDataUri(uri:unknown):{sha256:string;byteSize:number}|null
export function auditPhotoProvenance(order:any,options?:{receipts?:any[];otherOrderReceipts?:any[];clientClaims?:any[]}):ProvenanceAudit
