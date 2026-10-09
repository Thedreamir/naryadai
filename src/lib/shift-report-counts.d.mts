export interface ShiftReportBounds{since:string;until:string}
export interface ShiftReportScope{section?:string;equipment?:string|number;worker?:string;brigade?:string}
export interface ShiftReportCounts{
  ok:boolean;
  reason:string|null;
  period:{since:string;until:string}|null;
  counts:{
    issued:{orders:number};
    completed:{events:number;orders:number};
    refused:{events:number;orders:number};
  };
  currentLoad:{active:number;inQueue:number;inWork:number;overdue:number;awaitingReview:number}|null;
  caveats:{
    issuedFromCreatedAt:boolean;
    scopeUsesCurrentAssignment:boolean;
    countedOrdersNowCancelled:number;
    excluded:{unknownStatusOrders:number;unknownStatusEvents:number;eventsWithoutOrder:number;eventsBadTime:number};
  };
}
export function shiftReportCounts(orders:any[],events:any[],bounds:ShiftReportBounds,scope?:ShiftReportScope,employees?:any[],now?:number):ShiftReportCounts;
