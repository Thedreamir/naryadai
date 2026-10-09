import {humanDeadline} from './human-deadline.mjs';
// Deterministic extractive retrieval only. Callers must provide RLS-visible rows.
export const NO_DATA = 'Не знаю: в доступных утверждённых источниках ответа не найдено. Уточните у мастера или в документации оборудования.';
const stop = new Set(['какой','какая','какие','когда','моего','текущего','наряда','наряд','оборудовании','оборудования','известно','вопрос','пожалуйста','менің','қандай']);
export function tokens(text) {
  return [...new Set(String(text).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter(w => w.length > 2 && !stop.has(w));
}
export function scopedApproved(rows, equipmentId) {
  return rows.filter(r => r.status === 'approved' && r.reviewed_by && r.reviewed_at &&
    (r.equipment_id === null || (equipmentId != null && String(r.equipment_id) === String(equipmentId))));
}
export function rankRows(rows, question) {
  const words = tokens(question);
  return rows.map(row => ({row, score:words.filter(w => `${row.title} ${row.body}`.toLocaleLowerCase().includes(w)).length}))
    .filter(x => x.score >= 2).sort((a,b) => b.score-a.score || String(a.row.id).localeCompare(String(b.row.id),undefined,{numeric:true}));
}
const unsafe = /(?:подключ|соедин|пуск|запуск).{0,40}(?:электр|ток|напряж|питан|двигател)|электр.{0,40}(?:подключ|қос)|(?:электр|ток|кернеу).{0,40}(?:қос|бер)|(?:включи|включить|включите|подать|подача|подачи|подавайте).{0,40}(?:напряж|питан|оборуд|станок|двигател)|energiz|power\s+on|кернеу.{0,20}(?:бер|қос)|(?:іске|токқа)\s+қос/iu;
const source = (kind, r) => ({kind,id:String(r.id),title:r.title || `Наряд #${r.id}`,version:r.version ?? null,reviewed_at:r.reviewed_at ?? null});
function result(answer, citations = [], extra = {}) {
  return {answer, sources:citations.map(c => `${c.kind} #${c.id}: ${c.title}${c.version != null ? ` · версия ${c.version}` : ''}`), citations, source_id:citations[0]?.id || '', mode:'rules', knowledge_used:citations.some(c => c.kind === 'Документация' || c.kind === 'Память'), ...extra};
}
export function groundedAnswer({message, order = null, docs = [], memory = [], history = [], retrievalTruncated = false}) {
  if(unsafe.test(message)) return result('Я не даю инструкций по включению или подаче напряжения. Обратитесь к мастеру и утверждённой процедуре допуска.');
  const suffix = retrievalTruncated ? ' Поиск ограничен выборкой источников, это не проверка всей базы.' : '';
  if(order && /(срок|дедлайн|когда.*(сдать|законч|выполн)|мерзім)/iu.test(message))
    return result(`Срок наряда #${order.id}: ${order.deadline ? humanDeadline(order.deadline) : order.deadline_almaty || 'не подтверждён, уточните у мастера'}.`, [source('Контекст наряда',order)]);
  if(order && /(статус|мәртебе)/iu.test(message))
    return result(`Статус наряда #${order.id}: ${order.status}. Это запись базы, а не подтверждение безопасности.`, [source('Контекст наряда',order)]);
  if(order && /(что известно об оборудовании|какое оборудование|жабдық)/iu.test(message))
    return result(`Оборудование наряда #${order.id}: ${order.equipment || 'не указано'}. Технические параметры без документации не подтверждены.`, [source('Контекст наряда',order)]);
  if(order && /(истори|предыдущ|прошл.*ремонт|тарих)/iu.test(message)) {
    const rows = history.filter(r => r.status === 'closed' && String(r.equipment_id) === String(order.equipment_id)).slice(0,3);
    if(rows.length) return result('Доступная история закрытых нарядов (не инструкция и не допуск):\n'+rows.map(r => `#${r.id} · ${r.closed_at || 'дата не указана'} · ${r.title}`).join('\n'), rows.map(r => source('История',r)));
    return result(NO_DATA + suffix);
  }
  for(const [kind, rows] of [['Документация',docs],['Память',memory]]) {
    const approved=scopedApproved(rows,order?.equipment_id)
    const eligible=approved.filter(r=>r.content_domain==='reference_nonoperational'&&r.safety_sensitive===false&&r.worker_extract_eligible===true)
    const found = rankRows(eligible,message)[0];
    if(!found&&rankRows(approved,message).length)return result('Найденный источник не разрешён для выдачи инструкций исполнителю. Спросите мастера и используйте утверждённую процедуру.');
    if(found) {
      const r = found.row;
      // Do not turn a keyword hit into a certified answer or relay energizing text.
      if(unsafe.test(r.body) || (/электр|кернеу|токқа/iu.test(r.body) && r.safety_eligible !== true)) return result('Не знаю: найденный источник требует проверки мастером. Инструкции по подаче напряжения не выдаю.');
      const quote = String(r.body).slice(0,1200);
      return result(`Найден фрагмент по совпадению слов, соответствие вопросу проверьте с мастером. ${kind === 'Память' ? 'Полевая заметка, не норматив. ' : ''}Источник #${r.id}, версия ${r.version}:\n«${quote}»${String(r.body).length>1200 ? ' [фрагмент сокращён]' : ''}` + suffix, [source(kind,r)]);
    }
  }
  return result(NO_DATA + suffix);
}
