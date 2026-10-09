/** Local deterministic transcript-to-draft rules. Not an AI/STT engine or an action API. */
const MAX_TRANSCRIPT = 8000;
const MAX_VALUE = 4000;
const MODES = new Set(['issue', 'closure']);
const ISSUE = new Set(['title', 'equipmentId', 'section', 'kind', 'priority', 'hours']);
const CLOSURE = new Set(['works', 'materialsText', 'faultCode', 'reason']);
const LABELS = new Map([
  ['задача', 'title'], ['проблема', 'title'], ['задание', 'title'], ['тапсырма', 'title'],
  ['оборудование', 'equipmentId'], ['жабдық', 'equipmentId'],
  ['участок', 'section'], ['учаске', 'section'],
  ['тип работ', 'kind'], ['жұмыс түрі', 'kind'],
  ['приоритет', 'priority'], ['басымдық', 'priority'],
  ['срок', 'hours'], ['мерзім', 'hours'],
  ['работы', 'works'], ['выполненные работы', 'works'], ['орындалған жұмыс', 'works'],
  ['материалы', 'materialsText'], ['материалдар', 'materialsText'],
  ['код неисправности', 'faultCode'], ['ақау коды', 'faultCode'],
  ['причина', 'reason'], ['себеп', 'reason'],
]);
const normalize = text => text.normalize('NFKC').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
const PRIORITY = new Map([['аварийный', 'emergency'], ['авариялық', 'emergency'], ['высокий', 'high'], ['жоғары', 'high'], ['обычный', 'normal'], ['қалыпты', 'normal'], ['плановый', 'planned'], ['жоспарлы', 'planned']]);
const KIND = new Map([['плановый', 'planned'], ['жоспарлы', 'planned'], ['внеплановый', 'unplanned'], ['жоспардан тыс', 'unplanned']]);
const NUMBER = new Map([['один', 1], ['одна', 1], ['два', 2], ['две', 2], ['три', 3], ['четыре', 4], ['пять', 5], ['шесть', 6], ['семь', 7], ['восемь', 8], ['девять', 9], ['десять', 10], ['бір', 1], ['екі', 2], ['үш', 3], ['төрт', 4], ['бес', 5], ['алты', 6], ['жеті', 7], ['сегіз', 8], ['тоғыз', 9], ['он', 10]]);
const allowed = mode => mode === 'issue' ? ISSUE : CLOSURE;
function duration(text) {
  const match = normalize(text).match(/^(?:через\s+)?(\d+(?:[.,]\d+)?|[^\s]+)\s+(час(?:а|ов)?|ч|минут(?:а|ы)?|мин|сағат|минут)(?:\s+ішінде)?$/u);
  if (!match) return null;
  const amount = NUMBER.has(match[1]) ? NUMBER.get(match[1]) : (/^\d+(?:[.,]\d+)?$/u.test(match[1]) ? Number(match[1].replace(',', '.')) : NaN);
  const hours = /^(мин)/u.test(match[2]) ? amount / 60 : amount;
  return Number.isFinite(hours) && hours >= 0.1 && hours <= 720 ? hours : null;
}
function resolveCatalogue(text, rows) {
  if (!Array.isArray(rows)) return null;
  const key = normalize(text);
  const hits = rows.filter(row => row && (typeof row.id === 'string' || (typeof row.id === 'number' && Number.isFinite(row.id))) && String(row.id).trim() &&
    [String(row.id), row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])].some(name => typeof name === 'string' && normalize(name) === key));
  const ids = [...new Set(hits.map(row => String(row.id)))];
  return ids.length === 1 ? ids[0] : null;
}
function validate(field, value, options) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_VALUE) return null;
  const text = value.trim();
  switch (field) {
    case 'equipmentId': return resolveCatalogue(text, options.equipment);
    case 'section': {
      const hits = Array.isArray(options.sections) ? [...new Set(options.sections.filter(x => typeof x === 'string' && normalize(x) === normalize(text)))] : [];
      return hits.length === 1 ? hits[0] : null;
    }
    case 'priority': return PRIORITY.get(normalize(text)) ?? null;
    case 'kind': return KIND.get(normalize(text)) ?? null;
    case 'hours': return duration(text);
    default: return text;
  }
}
function checkOptions(options) {
  if (!options || !MODES.has(options.mode)) throw new TypeError('mode must be issue or closure');
}
/** Parse only explicit label:value clauses separated by semicolons or newlines.
 * Unlabelled dictation stays in the title/works field. Unknown clauses are retained for review.
 */
export function parseVoiceFields(transcript, options) {
  checkOptions(options);
  if (typeof transcript !== 'string') throw new TypeError('transcript must be text');
  const draft = {mode: options.mode, transcript, fields: {}, evidence: {}, unresolved: [], warnings: [], requiresReview: true, executable: false};
  if (transcript.length > MAX_TRANSCRIPT) {
    draft.warnings.push('transcript_too_long');
    return draft;
  }
  if (!transcript.trim()) { draft.warnings.push('empty_transcript'); return draft; }
  const clauses = [...transcript.matchAll(/[^;\r\n]+/gu)];
  const labelled = clauses.some(part => /^\s*[^:：]+[:：]/u.test(part[0]));
  if (!labelled) {
    const field = options.mode === 'issue' ? 'title' : 'works';
    const value = validate(field, transcript, options);
    if (value !== null) {
      draft.fields[field] = value;
      draft.evidence[field] = {source: 'dictation', text: transcript, start: 0, end: transcript.length};
    } else draft.warnings.push('value_too_long');
    return draft;
  }
  const seen = new Set();
  for (const part of clauses) {
    const text = part[0];
    const span = {text, start: part.index, end: part.index + text.length};
    const match = text.match(/^\s*([^:：]+)[:：]\s*([\s\S]*)$/u);
    const field = match ? LABELS.get(normalize(match[1])) : undefined;
    if (!field || !allowed(options.mode).has(field)) {
      draft.unresolved.push({...span, reason: field ? 'wrong_mode' : 'unknown_clause'});
      continue;
    }
    if (seen.has(field)) {
      delete draft.fields[field]; delete draft.evidence[field];
      draft.unresolved.push({...span, field, reason: 'duplicate_field'});
      if (!draft.warnings.includes('duplicate_field')) draft.warnings.push('duplicate_field');
      continue;
    }
    seen.add(field);
    const value = validate(field, match[2], options);
    if (value === null) { draft.unresolved.push({...span, field, reason: 'invalid_or_ambiguous_value'}); continue; }
    draft.fields[field] = value;
    draft.evidence[field] = {...span, source: 'dictation'};
  }
  return draft;
}
/** Pure, non-mutating manual correction. Empty text clears a field; never authorizes submission. */
export function editVoiceDraft(draft, field, text, options) {
  checkOptions(options);
  if (!draft || draft.mode !== options.mode || draft.executable !== false || draft.requiresReview !== true) throw new TypeError('expected review-only draft');
  if (!allowed(options.mode).has(field)) throw new TypeError('field is not editable in this mode');
  if (typeof text !== 'string') throw new TypeError('edit must be text');
  const value = text.trim() ? validate(field, text, options) : undefined;
  if (value === null) throw new RangeError('invalid or ambiguous field value');
  // Copy only declared draft properties; do not carry caller-supplied commands/status flags.
  const result = {
    mode: draft.mode, transcript: draft.transcript, fields: {}, evidence: {},
    unresolved: draft.unresolved.map(x => ({...x})), warnings: [...draft.warnings],
    requiresReview: true, executable: false,
  };
  for (const key of allowed(options.mode)) {
    if (Object.hasOwn(draft.fields, key)) result.fields[key] = draft.fields[key];
    if (Object.hasOwn(draft.evidence, key)) result.evidence[key] = {...draft.evidence[key]};
  }
  if (value === undefined) { delete result.fields[field]; delete result.evidence[field]; }
  else { result.fields[field] = value; result.evidence[field] = {source: 'manual', text}; }
  result.unresolved = result.unresolved.filter(x => x.field !== field);
  if (!result.unresolved.some(x => x.reason === 'duplicate_field')) result.warnings = result.warnings.filter(x => x !== 'duplicate_field');
  return result;
}
