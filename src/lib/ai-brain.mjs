/** Read-only composition over caller-visible data. Authentication/RLS remains upstream.
 * No model calls, mutation, dispatch, approval or automatic knowledge promotion.
 */
import {checkPriority} from './check-priority.mjs';
const roles = new Set(['worker', 'master', 'leader', 'admin']);
const verdicts = new Set(['accepted', 'accepted_with_remarks', 'rework', 'needs_master_review']);
const id = value => Number.isSafeInteger(value) && value > 0;
const instant = value => typeof value === 'string' ? Date.parse(value) : NaN;
const same = (a,b) => a != null && b != null && String(a) === String(b);
const list = value => Array.isArray(value) ? value : [];

/** Call only after live auth and caller-JWT reads; never pass service-role results.
 * Authentication and upstream freshness are not established by this function.
 * Review receipts must be captured from review-order's authenticated response,
 * associated with the reviewed order version, not supplied by a user/chat/model.
 */
export function composeAiBrain(input = {}) {
  const {actor, order, review, asOf = Date.now()} = input;
  if (!actor?.id || actor.is_active !== true || !roles.has(actor.role) || !Number.isFinite(asOf)) throw new TypeError('Active known actor and valid asOf required');
  const worker = actor.role === 'worker';
  const selected = id(order?.id) && id(order?.equipment_id) && (!worker || same(order.assignee_id, actor.id)) ? order : null;
  const histories = list(input.history).filter(o => o && (!worker || same(o.assignee_id, actor.id)) && selected && same(o.equipment_id, selected.equipment_id));
  const warnings = ['read_only', 'human_decision_required', 'loaded_history_may_be_incomplete'];
  if (order && !selected) warnings.push('selected_order_not_in_scope');
  const approved = (rows, kind) => list(rows).filter(row => {
    const reviewed = instant(row?.reviewed_at);
    return id(row?.id) && Number.isSafeInteger(row.version) && row.version > 0 && row.status === 'approved' && row.reviewed_by && Number.isFinite(reviewed) && reviewed <= asOf && (row.equipment_id == null || (selected && same(row.equipment_id, selected.equipment_id)));
  }).map(row => ({kind, id:row.id, version:row.version, title:String(row.title ?? '').slice(0,200), normative:kind === 'document', reviewedAt:row.reviewed_at}));
  // Content remains in the grounded-chat retrieval path, never merged into commands.
  const documents = approved(input.documents, 'document');
  const memory = approved(input.memory, 'repair_memory');
  let report = {state:'unavailable', score:null, verdict:null, archive:'unknown', modelParticipated:false, visualComparison:false, flags:[]};
  if (selected && review && same(review.orderId, selected.id)) {
    const current = Number.isSafeInteger(selected.version) && review.orderVersion === selected.version;
    const valid = verdicts.has(review.result?.verdict) && (review.result.score == null || (Number.isInteger(review.result.score) && review.result.score >= 1 && review.result.score <= 5));
    if (!current) warnings.push('review_version_mismatch');
    else if (!valid) warnings.push('review_schema_invalid');
    else {
      const r = review.result;
      const archived = review.archived === true;
      const fallback = list(r.rule_flags).includes('no_model') || r.layer1?.completeness?.semantic?.source === 'rules_fallback';
      report = {state:archived?'archived':'provisional', score:r.score ?? null, verdict:r.verdict, archive:archived?'saved':review.archived===false?'failed':'unknown', modelParticipated:r.layer2?.work_match != null && !fallback, visualComparison:r.layer2?.photo != null, flags:list(r.rule_flags).filter(x => typeof x === 'string').slice(0,50)};
      if (!archived) warnings.push('review_archive_unconfirmed');
    }
  }
  // Does not combine an experimental probability with the report score.
  // Rules retain their own named method, cutoff, pair evidence and limitations.
  const priority = selected ? checkPriority(histories, selected.equipment_id, input.priorityConfig ?? {}, asOf) : null;
  const next = [];
  if (selected) {
    if (['issued','accepted','in_progress','paused','rework'].includes(selected.status)) next.push({kind:'consult_approved_sources', owner:actor.role, orderId:selected.id});
    if (worker && report.state !== 'unavailable') next.push({kind:'read_review_feedback', owner:'worker', orderId:selected.id});
    if (!worker && actor.role !== 'leader' && ['completed','ai_review'].includes(selected.status)) next.push({kind:'master_review', owner:'master', orderId:selected.id});
    if (priority?.status === 'review') next.push({kind:worker?'ask_master_about_repeats':'inspect_repeat_evidence', owner:'master', orderId:selected.id});
    // A proposal is never an approved note. Existing propose RPC enforces rights/state.
    if (['completed','ai_review','closed'].includes(selected.status) && actor.role !== 'leader') next.push({kind:'propose_memory_candidate', owner:actor.role, orderId:selected.id});
  }
  return {
    schema:'ai-brain-v1', mode:'read_only_rules', asOf:new Date(asOf).toISOString(),
    scope:{role:actor.role, orderId:selected?.id ?? null, orderVersion:selected?.version ?? null, equipmentId:selected?.equipment_id ?? null, visibleHistoryCount:histories.length},
    knowledge:{documents, memory, precedence:['document','repair_memory'], contentIsData:true, autoPromotion:false},
    report, priority, next, warnings,
  };
}
