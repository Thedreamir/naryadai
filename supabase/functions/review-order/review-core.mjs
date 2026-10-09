// Tekton OS — AI order review core (hackathon case «НарядAI» §6.2–6.4).
// Pure functions, no I/O: the same file is loaded by the Supabase edge function
// (Deno) and by the Node test runner. Model results (work/problem match) and the
// Python before/after photo module are injected as plain JSON, so this core is
// deterministic and testable offline.
//
// Output contract (shared with the photo module):
//   { layer1, layer2, verdict, score, reasons, ... }
// verdict ∈ accepted | accepted_with_remarks | rework | needs_master_review
// score  ∈ 1..5, or null when confidence is low (master must decide, §6.3 п.4).

import { REVIEW_CONFIG } from './review-config.mjs';
import {checkConsistency} from './evidence-lane/text-consistency.mjs';

export const VERDICTS = ['accepted', 'accepted_with_remarks', 'rework', 'needs_master_review'];

// --- text helpers -----------------------------------------------------------

export function normText(s) {
  return String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

const STOPWORDS = new Set(('и в во на с со по для от до из за у о об не что это при как же его ее их был была были быть этот тот там здесь очень также после перед без над под через или но а'.split(' ')));

function tokens(s) {
  return new Set(normText(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

// Rules-only similarity between the reported problem and the reported works.
// Used only when no language model answered; it never earns full confidence.
export function lexicalMatch(problem, works) {
  const a = tokens(problem), b = tokens(works);
  if (!a.size || !b.size) return { score: 0, overlap: 0 };
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const jaccard = inter / (a.size + b.size - inter);
  const containment = inter / Math.min(a.size, b.size);
  return { score: Math.max(jaccard, containment * 0.8), overlap: inter };
}

// Strip personal data before anything leaves the system (§9: no personal data
// to external services without depersonalisation).
export function scrubText(text, names = []) {
  let s = String(text ?? '');
  s = s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]');
  s = s.replace(/\+?\d[\d\s()+-]{7,}\d/g, '[телефон]');
  for (const full of names) {
    for (const part of String(full ?? '').split(/\s+/)) {
      if (part.length < 4) continue;
      const esc = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(esc, 'gi'), '[имя]');
    }
  }
  return s;
}

// Accepts the raw output of the Python photo module (photo_review.review):
// {layer1:{flags,status,reasons}, layer2, verdict, score, reasons}
// and normalises it to the injected hook shape:
// {verdict, flags, score, reasons, layer2}
export function fromPhotoModule(out) {
  if (!out || typeof out !== 'object') return null;
  return {
    verdict: typeof out.verdict === 'string' ? out.verdict : null,
    flags: Array.isArray(out.layer1?.flags) ? out.layer1.flags : [],
    score: Number.isInteger(out.score) ? out.score : null,
    reasons: Array.isArray(out.reasons) ? out.reasons.map(String) : [],
    layer2: out.layer2 && typeof out.layer2 === 'object' ? out.layer2 : null,
  };
}

// Completion time = the moment the worker pressed «Исполнено» in the CURRENT
// cycle. A completed event followed by rework/in_progress belongs to an older
// cycle; and «no event» never falls back to the review time — completion is
// then unknown (null) and time/freshness checks are skipped, not faked.
export function completionTimeFromEvents(events = []) {
  let completedIdx = -1, completedAt = null;
  for (let i = 0; i < events.length; i++) {
    if (events[i]?.new_status === 'completed') {
      const d = new Date(events[i].created_at);
      if (!isNaN(d.getTime())) { completedIdx = i; completedAt = d; }
    }
  }
  if (completedIdx < 0) return null;
  for (let i = completedIdx + 1; i < events.length; i++) {
    if (['rework', 'in_progress', 'issued'].includes(events[i]?.new_status)) return null; // stale cycle
  }
  return completedAt;
}

// --- order_intake_photos adapter ---------------------------------------------
// Schema contract with the builder (CONFIRM exact vocabulary): rows carry
// { order_id, phase, status, sha256, captured_at, server_received_at }.
//   phase  = lifecycle stage of the shot; 'intake' (фото неисправности при выдаче)
//            is the "before" evidence.
//   status = row state; rows in REJECTED/DELETED-style states are not evidence.
// Only intake-phase rows in a usable state become before_hashes. Completion-phase
// intake rows (if any) are metadata only — the closure photos stay the "after".

export const INTAKE_BEFORE_PHASES = ['before_intake'];
export const INTAKE_SKIP_STATUSES = ['issued', 'queued', 'in_progress', 'paused', 'rework', 'completed', 'ai_review', 'closed', 'rejected'];

export function intakePhotosToEvidence(rows, orderId) {
  const before = [], meta = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (String(r?.order_id) !== String(orderId)) continue;
    const status = String(r?.status_at_upload ?? '').toLowerCase();
    if (INTAKE_SKIP_STATUSES.includes(status)) continue;
    const phase = String(r?.phase ?? '').toLowerCase();
    if (INTAKE_BEFORE_PHASES.includes(phase) && status === 'accepted' && r?.sha256) before.push(String(r.sha256));
    if (r?.sha256) meta.push({ sha256: String(r.sha256), phase, captured_at: null, uploaded_at: r.server_received_at ?? null });
  }
  return { before_hashes: before, photos_meta: meta };
}

// --- small utils ------------------------------------------------------------

const clamp01 = x => Math.max(0, Math.min(1, Number(x) || 0));
const toDate = v => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const minutes = (a, b) => Math.round((b.getTime() - a.getTime()) / 60000);
const fmtMin = m => (m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`) : `${m} мин`);

// A layer-2 result counts only if it passes schema validation (mirrors the
// photo module's validate_vision): score int 1..5 or null, confidence 0..1,
// enums yes|no|unsure, at least one meaningful key. An object that fails
// validation is not "no evidence" — it is suspicious and forces master review.
const ENUM3 = new Set(['yes', 'no', 'unsure']);
function validatePhotoLayer2(l2) {
  if (l2 == null) return null;                       // absent
  if (typeof l2 !== 'object' || Array.isArray(l2)) return 'invalid';
  const meaningful = Number.isInteger(l2.score) || typeof l2.fault_resolved === 'string' || typeof l2.same_equipment === 'string';
  if (!meaningful) return null;                      // empty object: no evidence
  // A visual comparison must carry BOTH claim fields; a bare score is not a comparison.
  if (!ENUM3.has(l2.same_equipment) || !ENUM3.has(l2.fault_resolved)) return 'invalid';
  if (l2.score != null && !(Number.isInteger(l2.score) && l2.score >= 1 && l2.score <= 5)) return 'invalid';
  if (l2.confidence != null && !(Number.isFinite(Number(l2.confidence)) && Number(l2.confidence) >= 0 && Number(l2.confidence) <= 1)) return 'invalid';
  if (l2.tidy != null && !ENUM3.has(l2.tidy)) return 'invalid';
  return l2;
}

// Self-generated RU text for known layer-1 flags. Supplied reason strings are
// only merged when a valid layer-2 exists (otherwise they could claim a
// visible repair that was never checked).
const FLAG_REASONS = {
  exact_duplicate: 'Фото совпадает с ранее загруженным (точный дубликат): нужна проверка мастером',
  near_duplicate: 'Фото почти совпадает с ранее загруженным (возможно пересъёмка/старое): нужна проверка мастером',
  stale: 'Фото снято задолго до закрытия: возможно старое фото, нужна проверка мастером',
  future_time: 'Время съёмки фото в будущем: часы устройства неверны, нужна проверка мастером',
  unreadable: 'Файл фото не читается как изображение: нужна проверка мастером',
  no_exif: 'Нет времени съёмки в метаданных фото: свежесть оценена по времени загрузки (слабее)',
  blurry: 'Фото размыто',
  too_dark: 'Фото слишком тёмное',
};

// --- main -------------------------------------------------------------------
//
// input = {
//   order:   {id, title, kind, priority, deadline, created_at, started_at,
//             completed_at, active_minutes?, overdue_minutes?, downtime_minutes?}
//   closure: {works, fault_code, materials: [{name, quantity, unit?}], comment?}
//   photos:  [{sha256?, captured_at?, uploaded_at?}]        // "after" photos
//   history: {before_hashes: [sha256], other_hashes: [{order_id, sha256}],
//             material_stats: {normName: {median, samples}}, work_norm_minutes: number|null,
//             known_fault_codes: string[]}
//   workMatch: {score 0..1, confidence 0..1, rationale?, issues?[]} | null  // layer-2 LLM, injected
//   photoLayer: {verdict, flags, score|null, reasons[], layer2?} | null      // photo module, injected
//   chronology: string[]                                   // for the master report
//   now: Date
// }
export function reviewOrder(input, config = REVIEW_CONFIG) {
  const cfg = config;
  const {
    order = {}, closure = {}, photos = [], history = {},
    workMatch = null, chronology = [], now = new Date(),
  } = input;
  const photoLayer = input.photoLayer ?? fromPhotoModule(input.photoReview);

  const fails = [];        // hard facts -> rework
  const masterFlags = [];  // uncertainty -> needs_master_review
  const remarks = [];      // minor issues -> accepted_with_remarks
  const reasons = [];
  const good = [];         // "что сделано хорошо" for the worker report

  const works = String(closure.works ?? '').trim();
  const title = String(order.title ?? '').trim();
  const faultCode = String(closure.fault_code ?? '').trim();
  const materialList = Array.isArray(closure.materials) ? closure.materials : [];
  const completedAt = toDate(order.completed_at); // null => completion time unknown
  const issuedAt = toDate(order.created_at);

  // --- 1. Completeness (§6.2 «Полнота закрытия») -----------------------------
  const letters = (works.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
  const completeness = { status: 'ok', detail: [] };
  if (works.length < 12 || letters < 10) {
    completeness.status = 'fail';
    fails.push('works_missing');
    reasons.push('Описание выполненных работ отсутствует или слишком короткое');
  } else if (works.length < 30) {
    completeness.status = 'warn';
    remarks.push('works_short');
    reasons.push('Описание работ короче 30 символов: деталей мало для проверки');
  } else {
    good.push('работы описаны');
  }
  const wN = normText(works), tN = normText(title);
  if (wN && tN && (wN === tN || (tN.includes(wN) && wN.length > 10))) {
    completeness.status = completeness.status === 'fail' ? 'fail' : 'warn';
    remarks.push('works_repeat_problem');
    reasons.push('Текст работ повторяет формулировку проблемы: не описано, что именно сделано');
  }
  if (!faultCode) {
    completeness.status = 'fail';
    fails.push('fault_code_missing');
    reasons.push('Не указан шифр неисправности');
  } else {
    const known = history.known_fault_codes;
    if (!Array.isArray(known)) {
      completeness.status = completeness.status === 'fail' ? 'fail' : 'warn';
      remarks.push('fault_catalog_unavailable');
      reasons.push('Справочник шифров недоступен: шифр не проверен');
    } else if (!known.includes(faultCode)) {
      completeness.status = completeness.status === 'fail' ? 'fail' : 'warn';
      remarks.push('fault_code_unknown');
      reasons.push(`Шифр неисправности «${faultCode}» отсутствует в справочнике: соответствие материалов и работ не проверено`);
    } else {
      good.push('шифр неисправности указан');
    }
  }
  const photoRequired = order.kind === 'unplanned';
  if (photoRequired && photos.length === 0) {
    completeness.status = 'fail';
    fails.push('photo_missing');
    reasons.push('Нет фото «после»: для внеплановых работ обязательно (§5.3)');
  }

  // --- 2. Work vs problem (§6.2 «Соответствие работ проблеме») ---------------
  let semantic;
  if (workMatch && Number.isFinite(workMatch.score)) {
    const s = clamp01(workMatch.score);
    const c = clamp01(workMatch.confidence ?? 0);
    semantic = { status: 'ok', value: s, confidence: c, source: 'model' };
    if (c >= cfg.semantic.minConfidence && s < cfg.semantic.reworkBelow) {
      semantic.status = 'fail';
      fails.push('work_mismatch');
      reasons.push(`Выполненные работы не соответствуют заявленной проблеме (совпадение ${Math.round(s * 100)}%)`);
    } else if (s < cfg.semantic.remarkBelow) {
      semantic.status = 'warn';
      remarks.push('work_match_weak');
      reasons.push(c<cfg.semantic.minConfidence?'Предварительная подсказка модели: соответствие неясно, проверьте лично; это не подтверждённый дефект':'Работы лишь частично соответствуют описанию проблемы');
    } else {
      if(c>=cfg.semantic.minConfidence)good.push('работы соответствуют проблеме');
    }
    if (c < cfg.semantic.lowConfidence) {
      masterFlags.push('model_low_confidence');
      reasons.push('Модель не уверена в оценке соответствия: нужна проверка мастером');
    }
    if (workMatch.rationale) reasons.push(`${c<cfg.semantic.minConfidence?'Непроверенная подсказка модели':'Модель'}: ${String(workMatch.rationale).slice(0, 200)}`);
    for (const i of Array.isArray(workMatch.issues) ? workMatch.issues : []) reasons.push((c<cfg.semantic.minConfidence?'Вопрос для проверки, не факт: ':'')+String(i).slice(0, 200));
  } else {
    if (workMatch) reasons.push('Языковая модель вернула некорректный ответ: использованы только правила');
    const fb = lexicalMatch(title, works);
    semantic = {
      status: fb.score < cfg.semantic.fallbackWeakBelow ? 'warn' : 'ok',
      value: Math.min(Math.max(fb.score, 0.3), 0.7),
      confidence: 0.3,
      source: 'rules_fallback',
    };
    masterFlags.push('no_model');
    reasons.push('Языковая модель недоступна: соответствие работ проблеме оценено только по правилам, вердикт за мастером');
    if (fb.score < cfg.semantic.fallbackWeakBelow) {
      remarks.push('work_match_weak_rules');
      reasons.push('По правилам текст работ слабо пересекается с описанием проблемы');
    }
  }

  // --- 3. Materials (§6.2 «Логичность материалов») ---------------------------
  // Rows are aggregated by material (and unit) first: 20 separate rows of one
  // seal are one write-off of 20 seals, not 20 valid ones.
  const matCfg = cfg.materials;
  const stats = history.material_stats ?? {};
  // Every row is validated BEFORE aggregation: a +20/−19 pair nets to 1 and
  // must still fail. Aggregation key is the norm family (when matched), so
  // renamed rows («Сальник», «сальник насоса», «САЛЬНИК») cannot evade it.
  const aggregated = new Map();
  let invalidRow = false;
  for (const m of materialList) {
    const name = String(m?.name ?? '?');
    const unit = String(m?.unit ?? '').trim();
    const qty = Number(m?.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      invalidRow = true;
      fails.push('material_qty_invalid');
      reasons.push(`Материал «${name}»: количество должно быть положительным`);
    }
    const family = matCfg.norms.find(x => normText(name).includes(x.match))?.match ?? normText(name);
    const key = family + '|' + unit;
    const prev = aggregated.get(key);
    aggregated.set(key, { name: prev?.name ?? name, unit, quantity: (prev?.quantity ?? 0) + (Number.isFinite(qty) ? qty : 0), rows: (prev?.rows ?? 0) + 1 });
  }
  const materialFindings = [];
  let materialsStatus = materialList.length ? 'ok' : 'unknown';
  const faultPrefix = faultCode.charAt(0).toUpperCase();
  const relevant = matCfg.faultMaterials[faultPrefix] ?? null;
  for (const g of aggregated.values()) {
    const { name, unit, quantity: qty, rows } = g;
    const nN = normText(name);
    if (qty <= 0) { // все строки семейства были неположительными — уже отмечено выше
      materialFindings.push({ name, qty, status: 'fail' });
      materialsStatus = 'fail';
      continue;
    }
    let st = 'ok';
    const norm = matCfg.norms.find(x => nN.includes(x.match)) ??
      (matCfg.unitDefaults[unit] ? { min: matCfg.unitDefaults[unit][0], max: matCfg.unitDefaults[unit][1], match: `ед. «${unit}»`, unit } : null);
    if (norm && norm.unit && unit && norm.unit !== unit) {
      // Wrong unit: the quantity cannot be compared to the norm at all.
      st = 'warn';
      remarks.push('material_unit_mismatch');
      reasons.push(`Материал «${name}»: единица «${unit}» не совпадает со справочной «${norm.unit}» — расход не проверен`);
    } else if (norm) {
      const ratio = qty / norm.max;
      if (ratio > matCfg.failAbove) {
        st = 'fail';
        fails.push('material_excess');
        reasons.push(`Материал «${name}»: списано ${qty} ${unit || ''} при обычной норме до ${norm.max} ${norm.unit ?? unit} — завышение в ${ratio.toFixed(1)} раза`);
      } else if (ratio > matCfg.warnAbove) {
        st = 'warn';
        remarks.push('material_above_norm');
        reasons.push(`Материал «${name}»: списано ${qty} ${unit || ''}, норма до ${norm.max} ${norm.unit ?? unit} — выше обычного`);
      }
    }
    if (st !== 'fail') {
      const h = stats[nN];
      if (h && h.samples >= matCfg.historyMinSamples && h.median > 0) {
        const hr = qty / h.median;
        if (hr > matCfg.historyFailAbove) {
          st = 'fail';
          fails.push('material_history_excess');
          reasons.push(`Материал «${name}»: в ${hr.toFixed(1)} раза больше обычного расхода на этом оборудовании (медиана ${h.median}, ${h.samples} нарядов)`);
        } else if (hr > matCfg.historyWarnAbove && st === 'ok') {
          st = 'warn';
          remarks.push('material_history_above');
          reasons.push(`Материал «${name}»: выше обычного расхода на этом оборудовании (медиана ${h.median}, ${h.samples} нарядов)`);
        }
      }
    }
    // Relevance to the fault type (§6.2: «соответствуют ли материалы типу работ и шифру»).
    if (st !== 'fail' && relevant && faultCode) {
      const universal = matCfg.universalMaterials.some(u => nN.includes(u));
      if (!universal && !relevant.some(r => nN.includes(r))) {
        if (st === 'ok') st = 'warn';
        remarks.push('material_irrelevant');
        reasons.push(`Материал «${name}» не типичен для шифра ${faultCode}: проверить обоснованность списания`);
      }
    }
    if (!norm && !stats[nN]) {
      materialFindings.push({ name, qty, status: st === 'ok' ? 'unknown' : st });
      if (st === 'ok') {
        if (materialsStatus === 'ok') materialsStatus = 'unknown';
        remarks.push('material_no_norm');
        reasons.push(`Материал «${name}»: нет норматива в справочнике, расход не проверен`);
      }
    } else {
      materialFindings.push({ name, qty, status: st });
    }
    if (st === 'fail') materialsStatus = 'fail';
    else if (st === 'warn' && materialsStatus !== 'fail') materialsStatus = 'warn';
    if (rows > 1) reasons.push(`Материал «${name}» указан ${rows} строками — суммарно ${qty} ${unit}`.trim());
  }
  const materials = {
    status: materialsStatus,
    value: materialsStatus === 'ok' ? 1 : materialsStatus === 'warn' || materialsStatus === 'unknown' ? 0.5 : 0,
    confidence: materialsStatus === 'unknown' ? 0.4 : 0.9,
    findings: materialFindings,
  };
  if (materialsStatus === 'ok' && materialList.length) good.push('материалы в пределах норм');

  // --- 4. Time (§6.2 «Время») ------------------------------------------------
  const normMin = Number.isFinite(history.work_norm_minutes) ? history.work_norm_minutes : null;
  let activeMin = Number.isFinite(order.active_minutes)
    ? order.active_minutes
    : (toDate(order.started_at) && completedAt ? minutes(toDate(order.started_at), completedAt) : null);
  if (activeMin != null && activeMin < 0) {
    activeMin = null;
    remarks.push('time_events_corrupt');
    reasons.push('Отрицательное время работы: журнал событий повреждён, время не проверено');
  }
  const time = { status: 'unknown', value: 0.5, confidence: 0.3, active_minutes: activeMin, norm_minutes: normMin };
  if (normMin && activeMin != null) {
    const r = activeMin / normMin;
    time.confidence = 0.8;
    if (r < cfg.time.fastRatio) {
      time.status = 'warn';
      remarks.push('time_too_fast');
      reasons.push(`Выполнено за ${fmtMin(activeMin)} при нормативе ${fmtMin(normMin)} — подозрительно быстро, проверить достоверность`);
    } else if (r > cfg.time.verySlowRatio) {
      time.status = 'warn';
      remarks.push('time_very_slow');
      reasons.push(`Выполнение заняло ${fmtMin(activeMin)} при нормативе ${fmtMin(normMin)} — в ${r.toFixed(1)} раза дольше нормы`);
    } else if (r > cfg.time.slowRatio) {
      time.status = 'warn';
      remarks.push('time_slow');
      reasons.push(`Выполнение заняло ${fmtMin(activeMin)} при нормативе ${fmtMin(normMin)} — дольше нормы`);
    } else {
      time.status = 'ok';
      good.push(`время в норме (${fmtMin(activeMin)} при нормативе ${fmtMin(normMin)})`);
    }
    time.value = time.status === 'ok' ? 1 : 0.5;
  }
  if (Number.isFinite(order.overdue_minutes) && order.overdue_minutes > 0) {
    reasons.push(`Наряд закрыт с просрочкой ${fmtMin(order.overdue_minutes)} (контроль сроков — модуль 6.1)`);
  }

  // --- 5. Photos (§6.3 п.1: наличие, свежесть, дубликаты) ---------------------
  const photoCfg = cfg.photo;
  const photo = { status: 'ok', value: 1, confidence: 0.9, detail: [] };
  if (!photos.length) {
    if (photoRequired) {
      photo.status = 'fail'; // verdict уже решён completeness-фейлом выше
      photo.value = 0;
    } else {
      photo.status = 'unknown';
      photo.value = 0.5;
      photo.confidence = 0.4;
    }
  } else {
    const before = new Set(history.before_hashes ?? []);
    const others = history.other_hashes ?? [];
    for (const p of photos) {
      // Hash: no hash => duplicates not checked (weaker evidence, remark).
      if (!p?.sha256) {
        if (photo.status === 'ok') photo.status = 'warn';
        photo.confidence = Math.min(photo.confidence, 0.6);
        remarks.push('photo_hash_missing');
        reasons.push('Для фото не вычислен хэш: проверка на дубликаты невозможна');
      } else {
        if (before.has(p.sha256)) {
          photo.status = 'fail';
          masterFlags.push('photo_same_as_before');
          reasons.push('Фото «после» совпадает с фото неисправности «до»: нужна проверка мастером');
        } else {
          const hit = others.find(o => o.sha256 === p.sha256);
          if (hit) {
            photo.status = 'fail';
            masterFlags.push('photo_duplicate');
            reasons.push(`Фото «после» уже использовалось в наряде №${hit.order_id}: нужна проверка мастером`);
          }
        }
      }
      // Freshness: capture must be near the closing moment (§6.3 п.1).
      const captured = p?.captured_at ? toDate(p.captured_at) : null;
      const uploaded = toDate(p?.uploaded_at);
      if (p?.captured_at && !captured) {
        if (photo.status === 'ok') photo.status = 'warn';
        photo.confidence = Math.min(photo.confidence, 0.5);
        remarks.push('photo_time_invalid');
        reasons.push('Время съёмки фото не читается: свежесть не подтверждена');
      } else if (!captured) {
        if (photo.status === 'ok') photo.status = 'warn';
        photo.confidence = Math.min(photo.confidence, 0.6);
        remarks.push('photo_time_unverified');
        reasons.push('Время съёмки фото не подтверждено метаданными: оценено только по времени загрузки (слабее)');
      }
      const ref = captured ?? uploaded;
      if (ref) {
        if (issuedAt && minutes(ref, issuedAt) > photoCfg.captureBeforeIssueToleranceMin) {
          photo.status = 'fail';
          masterFlags.push('photo_stale');
          reasons.push(`Фото снято раньше выдачи наряда (${ref.toISOString().slice(0, 16)}): возможно старое фото, нужна проверка мастером`);
        } else if (captured && completedAt && minutes(ref, completedAt) > photoCfg.captureBeforeCloseMaxMin) {
          photo.status = 'fail';
          masterFlags.push('photo_stale');
          reasons.push(`Фото снято за ${minutes(ref, completedAt)} мин до закрытия: не «в момент закрытия» (§6.3), нужна проверка мастером`);
        } else if (completedAt && minutes(completedAt, ref) > photoCfg.captureAfterCloseToleranceMin) {
          if (photo.status === 'ok') photo.status = 'warn';
          remarks.push('photo_late_upload');
          reasons.push('Фото загружено заметно позже закрытия наряда');
        }
      }
    }
    if (!completedAt) {
      if (photo.status === 'ok') photo.status = 'warn';
      photo.confidence = Math.min(photo.confidence, 0.5);
      remarks.push('photo_close_time_unknown');
      reasons.push('Время закрытия наряда неизвестно: свежесть фото относительно закрытия не проверена');
    }
    if (photo.status === 'fail') photo.value = 0;
    else if (photo.status === 'warn') photo.value = 0.5;
    else good.push('фото «после» приложено и свежее');
  }

  // --- 5b. Injected photo module (layer 1 flags + optional layer 2) -----------
  let photoLayer2 = null;
  if (photoLayer) {
    const flags = photoLayer.flags ?? [];
    const hard = flags.filter(f => photoCfg.hardFlags.includes(f));
    const soft = flags.filter(f => photoCfg.warnFlags.includes(f));
    if (hard.length) {
      photo.status = 'fail';
      photo.value = 0;
      masterFlags.push('photo_layer1_flags');
    }
    if (soft.length && photo.status === 'ok') {
      photo.status = 'warn';
      photo.value = 0.5;
    }
    for (const f of [...hard, ...soft]) if (FLAG_REASONS[f]) reasons.push(FLAG_REASONS[f]);

    const l2 = validatePhotoLayer2(photoLayer.layer2);
    if (l2 === 'invalid') {
      masterFlags.push('photo_model_invalid');
      reasons.push('Результат модели сравнения фото не прошёл проверку схемы: нужна проверка мастером');
      photoLayer2 = null;
    } else if (l2) {
      const conf = Number(l2.confidence ?? 0);
      if (conf < photoCfg.layer2MinConfidence) {
        // Low confidence: no positive or negative claim stands, master decides.
        masterFlags.push('photo_model_low_confidence');
        reasons.push('Модель сравнения фото не уверена: нужна проверка мастером');
        photoLayer2 = null;
      } else {
        // Validated, confident visual comparison. Verdict effects are driven by
        // the validated FIELDS, not the outer verdict string; contradictions
        // (score 5 + fault not resolved, equipment mismatch, double "unsure")
        // never produce a positive claim — they go to the master.
        photoLayer2 = l2;
        const sameEq = l2.same_equipment, resolved = l2.fault_resolved;
        const l2score = Number.isInteger(l2.score) ? l2.score : null;
        if (sameEq === 'no') {
          masterFlags.push('photo_different_equipment');
          reasons.push('Модель сравнения фото: похоже на другое оборудование — нужна проверка мастером');
        } else if (resolved === 'no' && (l2score == null || l2score <= 3)) {
          fails.push('photo_model_fault_remains');
          reasons.push('Модель сравнения фото: неисправность не устранена');
          for (const r of photoLayer.reasons ?? []) reasons.push(String(r).slice(0, 200));
          if (l2score != null) photo.value = l2score / 5;
        } else if (resolved === 'no' || (resolved === 'yes' && l2score != null && l2score <= 2)) {
          masterFlags.push('photo_model_contradiction');
          reasons.push('Модель сравнения фото противоречит сама себе (балл не согласован с результатом): нужна проверка мастером');
        } else if (sameEq === 'unsure' || resolved === 'unsure') {
          masterFlags.push('photo_model_unsure');
          reasons.push('Модель сравнения фото не уверена: нужна проверка мастером');
        } else {
          for (const r of photoLayer.reasons ?? []) reasons.push(String(r).slice(0, 200));
          if (l2score != null) photo.value = l2score / 5;
          if (photoLayer.verdict === 'rework') {
            if (resolved === 'yes') {
              masterFlags.push('photo_model_contradiction');
              reasons.push('Модель сравнения фото противоречит сама себе (вердикт не согласован с результатом): нужна проверка мастером');
            } else {
              fails.push('photo_model_fault_remains');
              reasons.push('Модель сравнения фото: неисправность не устранена');
            }
          } else if (photoLayer.verdict === 'needs_master_review') {
            masterFlags.push('photo_model_unsure');
          } else if (photoLayer.verdict === 'accepted_with_remarks') {
            remarks.push('photo_model_remarks');
          }
        }
      }
    } else if (photoLayer.verdict === 'needs_master_review') {
      // Module abstained without visual comparison (e.g. layer-1 review status).
      masterFlags.push('photo_needs_master');
    } else if (photoLayer.verdict === 'accepted_with_remarks') {
      remarks.push('photo_module_remarks');
    }
    // Without a valid layer-2, supplied reasons are ignored on purpose: they
    // must not be able to claim a visible repair that was never checked.
  }

  // --- verdict ----------------------------------------------------------------
  let verdict;
  if (fails.length) verdict = 'rework';
  else if (masterFlags.length) verdict = 'needs_master_review';
  else if (remarks.length) verdict = 'accepted_with_remarks';
  else verdict = 'accepted';

  const components = { semantic, materials, photo, time };
  let wsum = 0, wtot = 0, csum = 0;
  for (const k of Object.keys(cfg.weights)) {
    wsum += cfg.weights[k] * components[k].value;
    wtot += cfg.weights[k];
    csum += cfg.weights[k] * components[k].confidence;
  }
  let score = Math.max(1, Math.min(5, Math.round(1 + 4 * (wsum / wtot))));
  const confidence = Math.round((csum / wtot) * 100) / 100;

  if (verdict === 'rework') score = Math.min(score, cfg.score.reworkCap);
  if (verdict === 'needs_master_review') score = null;
  if (verdict === 'accepted' && score < cfg.score.acceptMin) verdict = 'accepted_with_remarks';
  if (verdict === 'accepted_with_remarks' && score < cfg.score.remarksMin) { verdict = 'needs_master_review'; score = null; }

  if (verdict === 'accepted' && !good.length) good.push('все обязательные проверки пройдены');

  // --- reports (§6.4) -----------------------------------------------------------
  const consistency=checkConsistency({problem:order.title,work:closure.works,materials:materialList.map(m=>m.name)});
  const guardFlags=consistency.flags;
  if(guardFlags.includes('prompt_injection_attempt')){verdict='needs_master_review';score=null;reasons.push('Текст содержит попытку изменить правила проверки. Нужна проверка мастера.')}
  const verdictText = {
    accepted: 'принято',
    accepted_with_remarks: 'принято с замечаниями',
    rework: 'требует доработки',
    needs_master_review: 'нужна проверка мастером',
  }[verdict];
  const improve = reasons.filter(r => !r.startsWith('Модель:'));
  const timeLine = normMin && activeMin != null
    ? `Время: ${fmtMin(activeMin)} при нормативе ${fmtMin(normMin)}`
    : normMin ? 'Время: подтверждённое время работы не задано' : 'Время: норматив для этого типа работ не задан';
  const report_worker = [
    score != null ? `Оценка по правилам проверки: ${score}/5` : 'Оценка по правилам проверки: будет выставлена после проверки мастером',
    `Вердикт: ${verdictText}`,
    good.length ? `Что хорошо: ${good.join('; ')}` : null,
    improve.length ? `Что улучшить: ${improve.join('; ')}` : null,
    timeLine,
  ].filter(Boolean).join('\n');
  const report_master = [
    `Вердикт проверки: ${verdictText}${score != null ? `, оценка ${score}/5` : ''} (основание: ${workMatch ? 'оценка модели не калибрована' : 'правила; соответствие проверяет мастер'}; фото: ${photoLayer ? 'есть отдельный слой проверки' : 'визуально не проверено'})`,
    `Основания: ${reasons.length ? reasons.join('; ') : 'все проверки пройдены'}`,
    materialList.length
      ? `Материалы: ${materialFindings.map(f => `${f.name} ${f.qty}${f.status === 'ok' ? '' : f.status === 'unknown' ? ' (нет нормы)' : f.status === 'warn' ? ' (выше нормы)' : ' (завышение)'}`).join(', ')}`
      : 'Материалы: не списывались',
    timeLine,
    Number.isFinite(order.downtime_minutes) ? `Простой оборудования по наряду: ${fmtMin(order.downtime_minutes)}` : null,
    chronology.length ? `Хронология: ${chronology.join(' → ')}` : null,
    'Финальное решение за мастером: оценку ИИ можно подтвердить или изменить.',
  ].filter(Boolean).join('\n');

  const limitations = [
    'ИИ не подтверждает физическое выполнение ремонта: решение принимает мастер',
    'Точность модели не калибрована на реальных данных предприятия',
  ];
  if (!photoLayer2) limitations.push('Визуальное сравнение фото «до/после» не выполнялось');
  if (semantic.source === 'rules_fallback') limitations.push('Языковая модель не участвовала: только правила');

  return {
    layer1: { completeness, materials, time, photo, consistency },
    layer2: { work_match: workMatch ?? null, photo: photoLayer2 },
    verdict,
    score,
    reasons,
    confidence,
    needs_master_review: verdict === 'needs_master_review',
    rule_flags: [...fails, ...masterFlags, ...remarks, ...guardFlags],
    report_worker,
    report_master,
    limitations,
    prompt_version: cfg.promptVersion,
  };
}

// Master override (§6.4: «финальное решение за человеком»). Model evidence is
// never rewritten: the override lives next to it, and final_* reflects it.
export function applyMasterOverride(result, master = {}) {
  const hasScore = Number.isInteger(master.score) && master.score >= 1 && master.score <= 5;
  const hasVerdict = ['accepted', 'accepted_with_remarks', 'rework'].includes(master.verdict);
  if (!hasScore && !hasVerdict) {
    return { ...result, final_verdict: result.verdict, final_score: result.score, overridden: false };
  }
  return {
    ...result,
    master: {
      score: hasScore ? master.score : null,
      verdict: hasVerdict ? master.verdict : null,
      comment: String(master.comment ?? ''),
    },
    final_verdict: hasVerdict ? master.verdict : result.verdict,
    final_score: hasScore ? master.score : result.score,
    overridden: true,
  };
}
