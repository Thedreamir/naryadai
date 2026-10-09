// Tests for the AI order review core (case §6.2–6.4).
// Run from repo root: node --test tests/review-core.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewOrder, applyMasterOverride, lexicalMatch, scrubText, fromPhotoModule,
  completionTimeFromEvents, intakePhotosToEvidence, VERDICTS,
} from '../supabase/functions/review-order/review-core.mjs';

const NOW = new Date('2026-10-08T15:00:00Z');
const GOOD_MODEL = { score: 0.92, confidence: 0.9, rationale: 'Работы соответствуют заявленной течи масла' };

// A clean, fully-passing unplanned order. Mutate copies per test.
function base() {
  return {
    order: {
      id: 147, title: 'Течь масла на насосе Н-4', kind: 'unplanned', priority: 'emergency',
      created_at: '2026-10-08T13:00:00Z', started_at: '2026-10-08T13:05:00Z',
      completed_at: '2026-10-08T14:30:00Z', active_minutes: 85, overdue_minutes: 0,
      downtime_minutes: 90, deadline: '2026-10-08T16:00:00Z',
    },
    closure: {
      works: 'Заменил сальник насоса, подтянул крепления, проверил на холостом ходу — течи нет',
      fault_code: 'Г-01',
      materials: [{ name: 'Сальник', quantity: 1, unit: 'шт' }],
    },
    photos: [{ sha256: 'a'.repeat(64), captured_at: '2026-10-08T14:25:00Z' }],
    history: {
      before_hashes: ['b'.repeat(64)], other_hashes: [], material_stats: {},
      work_norm_minutes: 120, known_fault_codes: ['Г-01', 'М-02', 'Э-01'],
    },
    workMatch: GOOD_MODEL,
    chronology: ['13:00 выдан', '13:05 принят', '13:10 в работе', '14:30 исполнено'],
    now: NOW,
  };
}

test('good order: accepted with a high score and a full worker report', () => {
  const r = reviewOrder(base());
  assert.equal(r.verdict, 'accepted');
  assert.ok(r.score >= 4, `score ${r.score}`);
  assert.equal(r.needs_master_review, false);
  assert.match(r.report_worker, /Оценка по правилам проверки: [45]\/5/);
  assert.match(r.report_worker, /Время: 1 ч 25 мин при нормативе 2 ч/);
  assert.match(r.report_master, /Хронология:/);
  assert.match(r.report_master, /Простой оборудования/);
  assert.ok(VERDICTS.includes(r.verdict));
});

test('bad order: model mismatch + 5x materials + 5x time => rework, score <= 2', () => {
  const i = base();
  i.workMatch = { score: 0.1, confidence: 0.9, rationale: 'Работы не связаны с заявленной течью' };
  i.closure.materials = [{ name: 'Сальник', quantity: 1, unit: 'шт' }, { name: 'Подшипник', quantity: 20, unit: 'шт' }];
  i.order.active_minutes = 600;
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.score <= 2, `score ${r.score}`);
  assert.ok(r.reasons.some(x => /не соответствуют заявленной проблеме/.test(x)));
  assert.ok(r.reasons.some(x => /Подшипник.*завышение/.test(x)));
  assert.ok(r.reasons.some(x => /дольше нормы/.test(x)));
});

test('no photo on unplanned order: rework (completeness)', () => {
  const i = base();
  i.photos = [];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.reasons.some(x => /Нет фото «после»/.test(x)));
});

test('no photo on planned order: not a rework trigger by itself', () => {
  const i = base();
  i.order.kind = 'planned';
  i.photos = [];
  const r = reviewOrder(i);
  assert.notEqual(r.verdict, 'rework');
});

test('stale photo (taken days before issue): needs_master_review, score null', () => {
  const i = base();
  i.photos = [{ sha256: 'c'.repeat(64), captured_at: '2026-10-05T09:00:00Z' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.equal(r.needs_master_review, true);
  assert.ok(r.reasons.some(x => /старое фото/.test(x)));
});

test('QA probe: photo captured 110 min before closing (but after issue) is stale', () => {
  const i = base();
  i.order.created_at = '2026-10-08T12:00:00Z'; // выдан раньше съёмки — проверяем именно окно закрытия
  i.photos = [{ sha256: 'd'.repeat(64), captured_at: '2026-10-08T12:40:00Z' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.reasons.some(x => /не «в момент закрытия»/.test(x)));
});

test('QA probe: upload-time-only photo is weaker evidence, not a clean accept', () => {
  const i = base();
  i.photos = [{ sha256: 'e'.repeat(64), uploaded_at: '2026-10-08T14:28:00Z' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /по времени загрузки/.test(x)));
});

test('QA probe: invalid capture timestamp is flagged, never silently fresh', () => {
  const i = base();
  i.photos = [{ sha256: 'f'.repeat(64), captured_at: 'not-a-date' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /не читается/.test(x)));
});

test('QA probe: photo without hash skips duplicate check with a remark', () => {
  const i = base();
  i.photos = [{ captured_at: '2026-10-08T14:25:00Z' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /не вычислен хэш/.test(x)));
});

test('QA probe: unknown fault code is flagged', () => {
  const i = base();
  i.closure.fault_code = 'Х-99';
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /отсутствует в справочнике/.test(x)));
});

test('QA probe: electrical cable on a seal (hydraulics) repair is flagged as irrelevant', () => {
  const i = base();
  i.closure.materials = [{ name: 'Кабель', quantity: 10, unit: 'м' }]; // в пределах нормы, но не для шифра Г-01
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /не типичен для шифра Г-01/.test(x)));
});

test('QA probe: wrong unit blocks the norm check with a remark', () => {
  const i = base();
  i.closure.materials = [{ name: 'Сальник', quantity: 1, unit: 'кг' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /единица «кг» не совпадает/.test(x)));
});

test('QA probe: 20 separate seal rows aggregate to one excess write-off', () => {
  const i = base();
  i.closure.materials = Array.from({ length: 20 }, () => ({ name: 'Сальник', quantity: 1, unit: 'шт' }));
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.reasons.some(x => /Сальник.*20/.test(x)));
});

test('duplicate photo hash from another order: needs_master_review, not auto-rework', () => {
  const i = base();
  i.history.other_hashes = [{ order_id: 99, sha256: 'a'.repeat(64) }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.reasons.some(x => /наряде №99/.test(x)));
});

test('after photo identical to before photo: needs_master_review', () => {
  const i = base();
  i.photos = [{ sha256: 'b'.repeat(64), captured_at: '2026-10-08T14:25:00Z' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.ok(r.reasons.some(x => /совпадает с фото неисправности/.test(x)));
});

test('no model: rules fallback keeps working, verdict needs_master_review, score null', () => {
  const i = base();
  i.workMatch = null;
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.equal(r.layer1.completeness.status, 'ok'); // factual checks still ran
  assert.ok(r.limitations.some(x => /только правила/.test(x)));
});

test('no model + hard fail: rework still works without the model', () => {
  const i = base();
  i.workMatch = null;
  i.photos = [];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.score <= 2);
});

test('materials 4x over norm alone: rework (завышение расхода)', () => {
  const i = base();
  i.closure.materials = [{ name: 'Подшипник', quantity: 16, unit: 'шт' }]; // норма до 4; шифр Г-01 делает его ещё и нетипичным
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.reasons.some(x => /завышение/.test(x)));
});

test('materials above historical median on this equipment: remark', () => {
  const i = base();
  i.closure.materials = [{ name: 'Масло', quantity: 4, unit: 'л' }]; // в пределах нормы и типично для Г-01
  i.history.material_stats = { 'масло': { median: 1, samples: 12 } };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted_with_remarks');
  assert.ok(r.reasons.some(x => /медиана 1/.test(x)));
});

test('photo layer injected (Python module): hard layer-1 flags force master review', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'needs_master_review',
    flags: ['stale'],
    score: null,
    reasons: ['Снято 4320 мин до закрытия: возможно старое фото'],
    layer2: null,
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.limitations.some(x => /не выполнялось/.test(x)));
});

test('photo layer with layer-2 verdict rework (fault remains): rework', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'rework',
    flags: [],
    score: 2,
    reasons: ['Течь осталась'],
    layer2: { same_equipment: 'yes', fault_resolved: 'no', score: 2, confidence: 0.85, note: 'Течь осталась' },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.reasons.some(x => /не устранена/.test(x)));
  assert.ok(r.reasons.some(x => /Течь осталась/.test(x))); // supplied reasons merged when layer-2 valid
  assert.equal(r.layer2.photo.fault_resolved, 'no');
});

test('QA probe: layer-2 with confidence 0.01 never forces rework', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'rework',
    flags: [],
    score: 2,
    reasons: ['Течь осталась'],
    layer2: { same_equipment: 'yes', fault_resolved: 'no', score: 2, confidence: 0.01 },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
});

test('QA probe: empty layer2 object keeps the "not performed" limitation and drops supplied reasons', () => {
  const i = base();
  i.photoLayer = { verdict: 'accepted', flags: [], score: 5, reasons: ['Видимая неисправность устранена'], layer2: {} };
  const r = reviewOrder(i);
  assert.ok(r.limitations.some(x => /Визуальное сравнение фото «до\/после» не выполнялось/.test(x)));
  assert.ok(!r.reasons.some(x => /устранена/i.test(x))); // supplied claim ignored without valid layer-2
});

test('QA probe: supplied photo reasons cannot claim a visible repair without layer-2', () => {
  const i = base();
  i.photoLayer = { verdict: 'photo_basic_ok', flags: [], score: null, reasons: ['Течь визуально устранена'], layer2: null };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted');
  assert.ok(!r.reasons.some(x => /устранена/i.test(x)));
  assert.ok(r.limitations.some(x => /не выполнялось/.test(x)));
});

test('fromPhotoModule adapts the raw Python output shape', () => {
  const py = {
    layer1: { flags: ['exact_duplicate'], status: 'review', reasons: ['Точный дубль фото old1'] },
    layer2: null, verdict: 'needs_master_review', score: null, reasons: ['Точный дубль фото old1'],
  };
  const i = base();
  i.photoReview = py; // raw shape
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.ok(r.reasons.some(x => /точный дубликат/i.test(x))); // own flag text, supplied reasons not merged (no layer-2)
});

test('low model confidence: master review, no auto verdict', () => {
  const i = base();
  i.workMatch = { score: 0.8, confidence: 0.3 };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
});

test('completion time comes from the completed event of the current cycle, never review time', () => {
  const events = [
    { new_status: 'issued', created_at: '2026-10-08T13:00:00Z' },
    { new_status: 'in_progress', created_at: '2026-10-08T13:10:00Z' },
    { new_status: 'completed', created_at: '2026-10-08T14:30:00Z' },
  ];
  assert.equal(completionTimeFromEvents(events)?.toISOString(), '2026-10-08T14:30:00.000Z');
  // No completed event => unknown (null), NOT the review time.
  assert.equal(completionTimeFromEvents([]), null);
  assert.equal(completionTimeFromEvents([{ new_status: 'x', created_at: 'junk' }]), null);
  // A completed from a prior cycle (followed by rework/in_progress) is stale => null.
  const staleCycle = [...events,
    { new_status: 'ai_review', created_at: '2026-10-08T14:31:00Z' },
    { new_status: 'rework', created_at: '2026-10-08T14:32:00Z' },
    { new_status: 'in_progress', created_at: '2026-10-08T14:40:00Z' }];
  assert.equal(completionTimeFromEvents(staleCycle), null);
});

test('QA (a): unknown completion time skips close-window freshness instead of faking it', () => {
  const i = base();
  delete i.order.completed_at;
  delete i.order.active_minutes;
  const r = reviewOrder(i);
  assert.ok(r.reasons.some(x => /Время закрытия наряда неизвестно/.test(x)));
  assert.notEqual(r.verdict, 'accepted');
  assert.equal(r.layer1.time.active_minutes, null);
  assert.equal(r.layer1.time.status, 'unknown');
});

test('QA (b): low-confidence layer-2 makes no positive claim', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: ['Течь устранена'],
    layer2: { same_equipment: 'yes', fault_resolved: 'yes', score: 5, confidence: 0.01, note: 'Течь устранена' },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(!r.reasons.some(x => /устранена/i.test(x)));
  assert.ok(r.limitations.some(x => /не выполнялось/.test(x)));
});

test('QA (c): out-of-range layer-2 score (999) fails schema validation and forces master review', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 999, reasons: ['Всё идеально'],
    layer2: { same_equipment: 'yes', fault_resolved: 'yes', score: 999, confidence: 0.95 },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.reasons.some(x => /не прошёл проверку схемы/.test(x)));
  assert.ok(!r.reasons.some(x => /идеально/i.test(x)));
});

test('QA (d): renamed material rows cannot evade aggregation', () => {
  const i = base();
  i.closure.materials = [
    ...Array.from({ length: 7 }, () => ({ name: 'Сальник', quantity: 1, unit: 'шт' })),
    ...Array.from({ length: 7 }, () => ({ name: 'сальник насоса', quantity: 1, unit: 'шт' })),
    ...Array.from({ length: 6 }, () => ({ name: 'САЛЬНИК ', quantity: 1, unit: 'шт' })),
  ];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework'); // суммарно 20 при норме до 4
  assert.ok(r.reasons.some(x => /завышение/.test(x)));
});

test('QA (d2): +20/−19 quantity pairs are rejected per row', () => {
  const i = base();
  i.closure.materials = [{ name: 'Сальник', quantity: 20, unit: 'шт' }, { name: 'Сальник', quantity: -19, unit: 'шт' }];
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'rework');
  assert.ok(r.reasons.some(x => /положительным/.test(x)));
});

test('QA (e): empty fault catalog still flags an unknown code', () => {
  const i = base();
  i.history.known_fault_codes = [];
  const r = reviewOrder(i);
  assert.ok(r.reasons.some(x => /отсутствует в справочнике/.test(x)));
  assert.notEqual(r.verdict, 'accepted');
});

test('QA (e2): unavailable fault catalog flags the code as unverified', () => {
  const i = base();
  delete i.history.known_fault_codes;
  const r = reviewOrder(i);
  assert.ok(r.reasons.some(x => /Справочник шифров недоступен/.test(x)));
  assert.notEqual(r.verdict, 'accepted');
});

test('master override: human score/verdict win, model evidence untouched', () => {
  const r = reviewOrder(base());
  const o = applyMasterOverride(r, { score: 4, verdict: 'accepted_with_remarks', comment: 'Небольшой люфт допустим' });
  assert.equal(o.overridden, true);
  assert.equal(o.final_score, 4);
  assert.equal(o.final_verdict, 'accepted_with_remarks');
  assert.equal(o.score, r.score);           // model evidence intact
  assert.deepEqual(o.layer1, r.layer1);
  const n = applyMasterOverride(r, {});
  assert.equal(n.overridden, false);
  assert.equal(n.final_verdict, r.verdict);
});

test('lexicalMatch: overlapping texts score higher than disjoint', () => {
  const hi = lexicalMatch('течь масла насос', 'заменил сальник насоса, течь устранена');
  const lo = lexicalMatch('течь масла насос', 'покрасил ограждение лестницы');
  assert.ok(hi.score > lo.score, `${hi.score} vs ${lo.score}`);
});

test('scrubText removes emails, phones and staff names', () => {
  const s = scrubText('Звонил Ахметов Ерлан с +1 202 555-0123, почта person@example.invalid', ['Ахметов Ерлан']);
  assert.ok(!/Ахметов|Ерлан/.test(s));
  assert.ok(!/701/.test(s));
  assert.ok(!/@example/.test(s));
});

test('downtime: no verified source => master report omits the downtime line', () => {
  const i = base();
  delete i.order.downtime_minutes;
  assert.ok(!/Простой оборудования/.test(reviewOrder(i).report_master));
  i.order.downtime_minutes = null;
  assert.ok(!/Простой оборудования/.test(reviewOrder(i).report_master));
  i.order.downtime_minutes = 90; // only a verified value is printed
  assert.ok(/Простой оборудования по наряду: 1 ч 30 мин/.test(reviewOrder(i).report_master));
});

test('QA4 (1a): same_equipment=no + fault_resolved=no + score 5 is a contradiction => master review', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: ['Всё хорошо'],
    layer2: { same_equipment: 'no', fault_resolved: 'no', score: 5, confidence: 0.99, note: 'Всё хорошо' },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.reasons.some(x => /другое оборудование/.test(x)));
});

test('QA4 (1b): both enums unsure => master review even with high confidence and score', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: [],
    layer2: { same_equipment: 'unsure', fault_resolved: 'unsure', score: 5, confidence: 0.95 },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
});

test('QA4 (1c): fault_resolved=no with a high score is contradictory => master review, not silent rework/accept', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: [],
    layer2: { same_equipment: 'yes', fault_resolved: 'no', score: 5, confidence: 0.95 },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.ok(r.reasons.some(x => /противоречит/.test(x)));
});

test('QA4 (1d): consistent confident layer-2 (fault resolved, score 5) keeps accepted', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: ['Течь устранена'],
    layer2: { same_equipment: 'yes', fault_resolved: 'yes', score: 5, confidence: 0.9, note: 'Течь устранена' },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted');
  assert.ok(r.reasons.some(x => /устранена/.test(x)));
});

test('QA4 (2): NaN workMatch score abstains to rules, never a mismatch rework', () => {
  const i = base();
  i.workMatch = { score: NaN, confidence: 0.99, rationale: 'broken' };
  const r = reviewOrder(i);
  assert.notEqual(r.verdict, 'rework');
  assert.equal(r.verdict, 'needs_master_review'); // rules fallback still requires master
  assert.ok(r.reasons.some(x => /некорректный ответ/.test(x)));
});

test('QA4 (3): negative active minutes are clamped to unknown and flagged', () => {
  const i = base();
  i.order.active_minutes = -40;
  const r = reviewOrder(i);
  assert.equal(r.layer1.time.active_minutes, null);
  assert.ok(r.reasons.some(x => /журнал событий повреждён/.test(x)));
  assert.ok(!/-40/.test(r.report_worker) && !/-40/.test(r.report_master));
});

test('QA4 (4) normal flow: after photo uploaded before the completed transition is not flagged', () => {
  // Frontend uploads the after photo first (no kind set yet), then presses
  // «Исполнено». With no explicit before hashes, the after photo must pass.
  const i = base();
  i.photos = [{ sha256: 'a'.repeat(64), captured_at: '2026-10-08T14:25:00Z', uploaded_at: '2026-10-08T14:26:00Z' }];
  i.history.before_hashes = []; // handler now fills this only from explicit kind='before' rows / orders.before_photos
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'accepted');
  assert.ok(!r.rule_flags.includes('photo_same_as_before'));
});

test('QA4 (4) explicit before hash reused as after is still caught', () => {
  const i = base();
  i.photos = [{ sha256: 'b'.repeat(64), captured_at: '2026-10-08T14:25:00Z', uploaded_at: '2026-10-08T14:26:00Z' }];
  i.history.before_hashes = ['b'.repeat(64)]; // explicit kind='before' row
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.ok(r.rule_flags.includes('photo_same_as_before'));
});

test('QA5: fault_resolved=unsure never reaches accepted (abstains)', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: ['Похоже, устранено'],
    layer2: { same_equipment: 'yes', fault_resolved: 'unsure', score: 5, confidence: 0.95 },
  };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
});

test('QA5: same_equipment=unsure never reaches accepted either', () => {
  const i = base();
  i.photoLayer = {
    verdict: 'accepted', flags: [], score: 5, reasons: [],
    layer2: { same_equipment: 'unsure', fault_resolved: 'yes', score: 5, confidence: 0.95 },
  };
  assert.equal(reviewOrder(i).verdict, 'needs_master_review');
});

test('QA5: score-only layer-2 is not a visual comparison: invalid, limitation stays', () => {
  const i = base();
  i.photoLayer = { verdict: 'accepted', flags: [], score: 5, reasons: ['Всё хорошо'], layer2: { score: 5, confidence: 0.95 } };
  const r = reviewOrder(i);
  assert.equal(r.verdict, 'needs_master_review');
  assert.equal(r.score, null);
  assert.ok(r.limitations.some(x => /не выполнялось/.test(x)));
  assert.ok(r.reasons.some(x => /не прошёл проверку схемы/.test(x)));
});

test('QA5: invalid-model fallback states the model did not participate', () => {
  const i = base();
  i.workMatch = { score: NaN, confidence: 0.99, rationale: 'broken' };
  const r = reviewOrder(i);
  assert.ok(r.limitations.some(x => /Языковая модель не участвовала/.test(x)));
});

test('intake adapter matches migration 031 and excludes late/client time', () => {
 const rows=[
 {order_id:147,phase:'before_intake',status_at_upload:'accepted',sha256:'before',captured_client_at:'2026-10-08T12:00:00Z'},
 {order_id:147,phase:'baseline_after_start',status_at_upload:'in_progress',sha256:'late'},
 {order_id:148,phase:'before_intake',status_at_upload:'accepted',sha256:'foreign'},
 {order_id:147,phase:'before_intake',status_at_upload:'rework',sha256:'contradiction'},
 {order_id:147,phase:'before_intake',sha256:'unknown'},
 ];
 const ev=intakePhotosToEvidence(rows,147);
 assert.deepEqual(ev.before_hashes,['before']);
 assert.equal(ev.photos_meta[0].captured_at,null);
});
