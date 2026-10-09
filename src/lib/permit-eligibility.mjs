// Lane 11: permit (допуск) gate mirror + exact-task permit helper. Pure module, no I/O.
// Every constant and rule here MIRRORS an existing SQL declaration or client flow; nothing
// in this module grants, records or weakens anything. Source of truth stays in Postgres:
//   019_permit.sql            orders.permit_* columns, kind check constraint, record_permit, in_progress gate
//   025_permit_note_strict.sql strict note validation (>=8 trimmed chars, a digit, a letter)
//   048/050                   permit update branch + restored transition guards ('permit required')
//   052_employee_permits.sql  synthetic qualification catalogue (advisory dispatch hints)
//   074_order_write_boundary.sql permit columns immutable except record_permit; two exact pre-work declarations
// Where the mirror and the source could drift, the audit in qa/lanes/11 checks the sources directly.

export const PERMIT_KINDS=['not_required','confirmed']; // 019: orders_permit_kind_chk
export const PERMIT_WINDOW_STATUSES=['issued','queued','accepted','paused','rework']; // 050: permit branch
export const PERMIT_NOTE_MIN_LENGTH=8; // 025: length(btrim(note))>=8

// 074: the two exact pre-work declaration texts required by start_work_with_declarations and
// guard_order_evidence_columns. Byte-identical to the SQL literals (checked by qa/lanes/11 audit).
export const REQUIRED_PREWORK_DECLARATIONS=[
 'Подтверждаю лично: требования безопасности выполнены согласно утверждённой для этой задачи процедуре (включая обесточивание, заземление и LOTO, если они требуются процедурой)',
 'Подтверждаю лично: использую средства защиты, зона работ безопасна'
];

// Mirror of 025 record_permit validation. Error strings match the SQL exceptions so a client
// pre-check and the server give the worker the same message.
export function validatePermitRecord(kind,note){
 if(!PERMIT_KINDS.includes(kind))return{ok:false,error:'bad permit kind'};
 if(kind==='confirmed'){
  const n=(note??'').trim();
  if(n.length<PERMIT_NOTE_MIN_LENGTH)return{ok:false,error:'permit note required'};
  if(!/[0-9]/.test(n))return{ok:false,error:'permit number required'};
  if(!/[a-zA-Zа-яА-ЯёЁ]/.test(n))return{ok:false,error:'permit confirmer required'};
 }
 return{ok:true};
}

// 050: record_permit updates pass the trigger only while the order sits in one of these statuses.
export function permitWindowOpen(status){return PERMIT_WINDOW_STATUSES.includes(status)}

// 050 ('permit required') + 074 (two exact confirmed pre_work declarations by the assigned worker).
// order: {status,permit_kind,cancelled,assignee_id}; declarations: rows like order_declarations.
// Returns the first failing condition; never invents a pass.
export function mayStartWork(order,declarations,actorId){
 if(!order||order.cancelled)return{ok:false,error:'order unavailable'};
 if(order.status!=='accepted'&&order.status!=='rework'&&order.status!=='paused')return{ok:false,error:'invalid status transition'};
 if(order.permit_kind==null)return{ok:false,error:'permit required'};
 const rows=(declarations||[]).filter(d=>d&&d.phase==='pre_work'&&d.confirmed===true&&!d.excluded_from_evidence&&String(d.declared_by)===String(actorId));
 for(const text of REQUIRED_PREWORK_DECLARATIONS){
  if(!rows.some(d=>d.text===text))return{ok:false,error:'two required pre-work declarations required'};
 }
 return{ok:true};
}

// Mirror of executor-selection.mjs expiry semantics: a permit is expired when valid_until is
// unparseable or parses before `now`. Date-only strings parse as UTC midnight, so a permit is
// treated as expired for the whole of its valid_until day; qa/lanes/11 reports that edge.
export function permitExpired(permit,now){
 const t=Date.parse(permit&&permit.valid_until);
 return!Number.isFinite(t)||t<now;
}

// Mirror of executor-selection.mjs matching: permit name compared with exact string equality.
// requiredPermits: exact catalogue names (see TASK_PERMIT_RULES for the known catalogue).
// Returns one entry per requirement; a requirement is never silently dropped.
export function checkWorkerPermits(workerPermits,requiredPermits,now){
 const rows=Array.isArray(workerPermits)?workerPermits:[];
 return(requiredPermits||[]).map(req=>{
  const held=rows.filter(p=>p&&p.permit===req);
  const valid=held.filter(p=>!permitExpired(p,now));
  return{permit:req,status:valid.length?'valid':held.length?'expired':'missing'};
 });
}

// Advisory task->permit helper ("exact-task helper"). The keyword map is a heuristic authored
// for this build, NOT an authoritative safety source; the permit names are exactly the ones
// present in the 052 employee_permits catalogue. A task with no rule match returns
// status 'no_rule' — that means "helper has no opinion, master decides", never "no permit needed".
export const TASK_PERMIT_RULES=[
 {class:'Огневые работы',cataloguePermits:['Огневые работы'],keywords:['сварк','огнев','горячие работ','резка металл','шлифовк']},
 {class:'Электробезопасность',cataloguePermits:['Электробезопасность III','Электробезопасность IV','Электробезопасность V'],keywords:['электр','кабел','напряж','обесточ','двигател','шкаф управлен','привод']},
 {class:'Работы на высоте',cataloguePermits:['Работы на высоте'],keywords:['высот','кровл','лестниц','вышк','подмост']},
 {class:'Сосуды под давлением',cataloguePermits:['Сосуды под давлением'],keywords:['сосуд','давлени','ресивер','компрессор','паропровод','котёл','котел']}
];

export function requiredPermitsForTask(title){
 const text=String(title||'').toLowerCase();
 const matches=[];
 for(const rule of TASK_PERMIT_RULES){
  const hit=rule.keywords.find(k=>text.includes(k));
  if(hit)matches.push({class:rule.class,cataloguePermits:rule.cataloguePermits,keyword:hit});
 }
 if(!matches.length)return{status:'no_rule',permits:[],matches:[],advisory:true,note:'Нет правила подсказки для этой задачи; допуск проверяет мастер.'};
 return{status:'matched',permits:[...new Set(matches.flatMap(m=>m.cataloguePermits))],matches,advisory:true,note:'Эвристическая подсказка по тексту задачи; соответствие допусков проверяет мастер.'};
}

// Combined order-level view for UI/tests: what the gate sees right now.
export function orderPermitGate(order,declarations,actorId,now=Date.now()){
 const recorded=order&&order.permit_kind!=null;
 return{
  recorded,
  kind:recorded?order.permit_kind:null,
  noteCheck:recorded?validatePermitRecord(order.permit_kind,order.permit_note):null,
  windowOpen:order?permitWindowOpen(order.status):false,
  startCheck:order?mayStartWork(order,declarations,actorId):{ok:false,error:'order unavailable'},
  checkedAt:now
 };
}
