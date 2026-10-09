// Leader KPI model: reaction and completion times per worker/section.
// Boundary: only acceptance ('accepted') and completion ('completed') order_events
// timestamps are measured. Master closure latency (completed -> ai_review/closed)
// is review-queue time owned by the master and is never attributed to a worker.
// Pure model: no scores, no norms, no productivity verdicts. Missing or
// inconsistent timestamps exclude the order from that metric, never invent it.
const MIN=60000;
const median=values=>{const a=[...values].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2};
const p90=values=>{const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.ceil(0.9*a.length)-1)]};
const round1=x=>Math.round(x*10)/10;

// First acceptance and last completion event for one order, from order_events rows.
// Rework cycles: the last 'completed' marks the final report, so completion elapsed
// honestly includes rework and pause time (labelled in notes, not downtime).
export function orderTimeline(order,events){
  const rows=(events||[]).filter(e=>String(e.order_id)===String(order.id)&&Number.isFinite(Date.parse(e.created_at)));
  const accepted=rows.filter(e=>e.new_status==='accepted').map(e=>Date.parse(e.created_at));
  const completed=rows.filter(e=>e.new_status==='completed').map(e=>Date.parse(e.created_at));
  return {
    acceptedAt:accepted.length?Math.min(...accepted):null,
    completedAt:completed.length?Math.max(...completed):null,
  };
}

function aggregate(rows){
  const reaction=rows.map(r=>r.reactionMinutes).filter(Number.isFinite);
  const completion=rows.map(r=>r.completionMinutes).filter(Number.isFinite);
  return {
    orders_total:rows.length,
    reaction_samples:reaction.length,
    completion_samples:completion.length,
    reaction_median_min:reaction.length?round1(median(reaction)):null,
    reaction_p90_min:reaction.length?round1(p90(reaction)):null,
    completion_median_min:completion.length?round1(median(completion)):null,
    completion_p90_min:completion.length?round1(p90(completion)):null,
  };
}

// orders: rows with id, assignee_id, section, created_at, closed_at, cancelled.
// events: order_events rows {order_id,new_status,created_at}.
// options: {since, until} ms epoch bounds on order.created_at, half-open [since,until);
//          employees optional [{id,name}] for display names only.
export function leaderKpis(orders,events,options={}){
  const {since=-Infinity,until=Infinity,employees=[]}=options;
  const nameOf=id=>employees.find(e=>String(e.id)===String(id))?.name??null;
  const inBounds=(orders||[]).filter(o=>!o.cancelled&&Number.isFinite(Date.parse(o.created_at))&&Date.parse(o.created_at)>=since&&Date.parse(o.created_at)<until);
  const excluded={cancelled:(orders||[]).length-inBounds.length<0?0:(orders||[]).length-inBounds.length};
  let noAccept=0,noComplete=0,badClock=0;
  const measured=[];
  for(const o of inBounds){
    const {acceptedAt,completedAt}=orderTimeline(o,events);
    const createdAt=Date.parse(o.created_at);
    let reactionMinutes=null,completionMinutes=null;
    // An acceptance before creation contradicts the journal; the whole timeline
    // is untrustworthy, so both metrics abstain for that order.
    const inconsistent=acceptedAt!==null&&acceptedAt<createdAt;
    if(inconsistent)badClock++;
    if(acceptedAt===null)noAccept++;
    else if(!inconsistent)reactionMinutes=(acceptedAt-createdAt)/MIN;
    if(completedAt===null)noComplete++;
    else if(!inconsistent&&acceptedAt!==null&&completedAt>=acceptedAt)completionMinutes=(completedAt-acceptedAt)/MIN;
    else if(!inconsistent&&acceptedAt!==null)badClock++;
    measured.push({order:o,reactionMinutes,completionMinutes});
  }
  const byWorker=new Map();
  for(const m of measured){
    const key=String(m.order.assignee_id??m.order.assignee??'');
    if(!byWorker.has(key))byWorker.set(key,[]);
    byWorker.get(key).push(m);
  }
  const workers=[...byWorker.entries()].map(([id,rows])=>({assignee_id:id,name:nameOf(id),...aggregate(rows)}))
    .sort((a,b)=>b.orders_total-a.orders_total||a.assignee_id.localeCompare(b.assignee_id));
  const bySection=new Map();
  for(const m of measured){
    const key=String(m.order.section??'');
    if(!bySection.has(key))bySection.set(key,[]);
    bySection.get(key).push(m);
  }
  const sections=[...bySection.entries()].map(([section,rows])=>({section,...aggregate(rows)}))
    .sort((a,b)=>b.orders_total-a.orders_total||a.section.localeCompare(b.section));
  const notes=[
    'Реакция: от создания наряда до первого события «Принят»; выполнение: от первого «Принят» до последнего «На проверке».',
    'Время выполнения включает паузы и доработки — это прошедшее время, не норма и не простой.',
    'Время проверки мастером (от «На проверке» до «Закрыт») сюда не входит и исполнителю не приписывается.',
    'Наряды без событий принятия/завершения и записи с противоречивыми метками времени исключены из соответствующей метрики.',
    'Это описание сроков по событиям, не оценка производительности и не рейтинг.',
  ];
  return {
    since,until,
    overall:aggregate(measured),
    workers,sections,
    excluded:{outside_or_cancelled:excluded.cancelled,no_accept_event:noAccept,no_completed_event:noComplete,inconsistent_timestamps:badClock},
    notes,
    limits:'KPI из загруженного среза событий; полнота журнала не гарантирована. Учебный набор, решения за руководителем.',
  };
}
