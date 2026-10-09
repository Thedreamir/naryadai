// Lane 08: shift report counts scoped to the full selected period.
// Pure counting module: no DB, no model calls, no UI. Rules only.
// Honesty rules baked in:
//  - issued/completed/refused are separate event families, never merged;
//  - issued is derived from order.created_at (order_events has no 'issued' rows in the
//    current schema), completed/refused come from order_events rows;
//  - current load is a snapshot of orders active NOW and is never filtered by the
//    report period - an order issued before the period still counts as load;
//  - scope (section/equipment/worker/brigade) uses the order's CURRENT assignment;
//    historical reassignment is not reconstructed.
import {matchesScope} from './report-scope.mjs';

const ACTIVE=['issued','queued','accepted','in_progress','paused','rework'];
const REVIEW=['completed','ai_review'];
const KNOWN=new Set([...ACTIVE,...REVIEW,'closed','rejected']);

const inPeriod=(iso,lo,hi)=>{const t=Date.parse(iso);return Number.isFinite(t)&&t>=lo&&t<hi};

export function shiftReportCounts(orders,events,bounds,scope={},employees=[],now=Date.now()){
  const empty={issued:{orders:0},completed:{events:0,orders:0},refused:{events:0,orders:0}};
  const base={ok:false,reason:null,period:null,counts:empty,currentLoad:null,
    caveats:{issuedFromCreatedAt:true,scopeUsesCurrentAssignment:true,countedOrdersNowCancelled:0,
      excluded:{unknownStatusOrders:0,unknownStatusEvents:0,eventsWithoutOrder:0,eventsBadTime:0}}};
  if(!Array.isArray(orders)||!Array.isArray(events))return{...base,reason:'orders и events должны быть массивами.'};
  const lo=Date.parse(bounds&&bounds.since),hi=Date.parse(bounds&&bounds.until);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi)return{...base,reason:'Некорректные границы периода: начало должно быть раньше конца.'};
  if(!Number.isFinite(now))return{...base,reason:'Некорректное время среза (now).'};

  const caveats=base.caveats;
  const scopedOrders=orders.filter(o=>{
    if(!o||typeof o!=='object')return false;
    if(!KNOWN.has(o.status)){caveats.excluded.unknownStatusOrders++;return false}
    return matchesScope(o,scope,employees);
  });
  const byId=new Map(scopedOrders.map(o=>[o.id,o]));

  // Issued: order creation inside the period. Cancelled-later orders stay in the
  // historical count but are surfaced so the reader knows the mix.
  const issuedOrders=scopedOrders.filter(o=>inPeriod(o.created_at,lo,hi));
  const eventOrderIds=countedEventOrderIds(events,byId,lo,hi);
  caveats.countedOrdersNowCancelled=scopedOrders.filter(o=>o.cancelled&&(inPeriod(o.created_at,lo,hi)||eventOrderIds.has(o.id))).length;

  const completedEvents=[],refusedEvents=[];
  for(const e of events){
    if(!e||typeof e!=='object'){caveats.excluded.eventsBadTime++;continue}
    if(!KNOWN.has(e.new_status)){caveats.excluded.unknownStatusEvents++;continue}
    if(!byId.has(e.order_id)){caveats.excluded.eventsWithoutOrder++;continue}
    if(!inPeriod(e.created_at,lo,hi)){if(!Number.isFinite(Date.parse(e.created_at)))caveats.excluded.eventsBadTime++;continue}
    if(e.new_status==='completed')completedEvents.push(e);
    else if(e.new_status==='rejected')refusedEvents.push(e);
  }
  const uniq=list=>new Set(list.map(e=>e.order_id)).size;

  // Current load: snapshot at `now`, deliberately NOT bounded by the period.
  const live=scopedOrders.filter(o=>!o.cancelled);
  const active=live.filter(o=>ACTIVE.includes(o.status));
  const currentLoad={
    active:active.length,
    inQueue:active.filter(o=>o.status==='issued'||o.status==='queued').length,
    inWork:active.filter(o=>o.status==='in_progress').length,
    overdue:active.filter(o=>Number.isFinite(Date.parse(o.deadline))&&Date.parse(o.deadline)<now).length,
    awaitingReview:live.filter(o=>REVIEW.includes(o.status)).length,
  };

  return{ok:true,reason:null,period:{since:new Date(lo).toISOString(),until:new Date(hi).toISOString()},
    counts:{issued:{orders:issuedOrders.length},
      completed:{events:completedEvents.length,orders:uniq(completedEvents)},
      refused:{events:refusedEvents.length,orders:uniq(refusedEvents)}},
    currentLoad,caveats};
}

// Helper for the cancelled-mix caveat: ids of scoped orders with a counted
// completed/refused event in the period. (Event exclusion tallies are filled by
// the main loop; this pass only mirrors its period/scope filter for the caveat.)
function countedEventOrderIds(events,byId,lo,hi){
  const ids=new Set();
  for(const e of events){
    if(e&&byId.has(e.order_id)&&(e.new_status==='completed'||e.new_status==='rejected')&&inPeriod(e.created_at,lo,hi))ids.add(e.order_id);
  }
  return ids;
}
