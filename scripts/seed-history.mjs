// Deterministic order-history generator (case section 8): 91 days, 600+ closed/active orders,
// four seeded patterns, one catalog, one work template per fault code so title, work,
// cipher, materials and units always agree. Usage: node scripts/seed-history.mjs [out.json]
import { writeFileSync } from 'node:fs';

export const END = Date.UTC(2026, 9, 8, 12); // 2026-10-08 12:00Z, history = 91 days before
export const DAYS = 91;

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const sections = ['Дробление', 'Обогащение', 'Транспорт', 'Энергетика'];
// [name, section]
export const equipment = [
  ['Дробилка КМД-1750', 0], ['Дробилка Д-1', 0], ['Грохот Г-1', 0], ['Грохот Г-4', 0], ['Питатель П-5', 0], ['Питатель П-2', 0],
  ['Мельница М-2', 1], ['Насос Н-12', 1], ['Насос Н-2', 1], ['Насос Н-6', 1], ['Сепаратор С-3', 1], ['Смеситель СМ-1', 1],
  ['Конвейер К-3', 2], ['Конвейер К-4', 2], ['Конвейер К-5', 2], ['Конвейер К-7', 2], ['Элеватор Э-2', 2], ['Транспортер Т-1', 2], ['Транспортер Т-6', 2],
  ['Вентилятор В-3', 3], ['Компрессор КП-1', 3], ['Компрессор КП-2', 3], ['Шкаф Ш-7', 3], ['Двигатель Д-8', 3], ['Редуктор Р-4', 3],
];
// fault codes: prefix letter drives allowed materials (review-config faultMaterials)
export const faultCodes = {
  'М-01': 'Износ подшипника', 'М-02': 'Повышенная вибрация привода', 'М-03': 'Ослабление крепежа', 'М-04': 'Износ ремня или цепи', 'М-05': 'Недостаток смазки',
  'Э-01': 'Обрыв или повреждение кабеля', 'Э-02': 'Отказ датчика', 'Э-03': 'Перегорел предохранитель', 'Э-04': 'Перегрев двигателя',
  'Г-01': 'Течь сальника', 'Г-02': 'Износ уплотнения', 'Г-03': 'Засорён фильтр', 'Г-04': 'Течь масла в стыке',
  'П-01': 'Утечка воздуха', 'П-02': 'Износ манжеты цилиндра',
  'С-01': 'Плановая смазка', 'С-02': 'Замена масла', 'С-03': 'Плановый осмотр',
  'М-06': 'Износ вала', 'Э-05': 'Ослабление клемм',
};
// template per fault code: title, works text, materials [name, unit, min, max] (inside review norms), norm minutes, equipment kinds allowed (prefix of name) or null
export const templates = {
  'М-01': { title: 'Замена подшипника', works: 'Снят узел, заменён подшипник, проверена посадка и соосность, пробный пуск без шума', mats: [['Подшипник 6314', 'шт', 1, 2], ['Смазка Литол-24', 'кг', 0.3, 1]], norm: 120, kinds: ['Конвейер', 'Дробилка', 'Мельница', 'Грохот', 'Двигатель', 'Вентилятор', 'Питатель', 'Редуктор', 'Элеватор', 'Транспортер'] },
  'М-02': { title: 'Устранение вибрации привода', works: 'Проверена центровка и крепление привода, заменён подшипник опоры, замерена вибрация после пуска', mats: [['Подшипник 6314', 'шт', 1, 2], ['Болт М16', 'шт', 2, 8]], norm: 150, kinds: ['Конвейер', 'Транспортер', 'Элеватор', 'Питатель', 'Редуктор', 'Вентилятор'] },
  'М-03': { title: 'Подтяжка и замена крепежа', works: 'Подтянут крепёж, заменены сорванные болты и гайки, проверена затяжка динамометрическим ключом', mats: [['Болт М20', 'шт', 2, 10], ['Гайка М20', 'шт', 2, 10]], norm: 60, kinds: ['Дробилка', 'Грохот', 'Мельница', 'Питатель', 'Конвейер'] },
  'М-04': { title: 'Замена приводного ремня', works: 'Снят изношенный ремень, установлен новый, выставлено натяжение, пробный пуск', mats: [['Ремень клиновой', 'шт', 1, 2]], norm: 45, kinds: ['Вентилятор', 'Компрессор', 'Насос', 'Грохот', 'Смеситель'] },
  'М-05': { title: 'Смазка узлов', works: 'Удалена старая смазка, набита свежая в узлы, проверена температура подшипников', mats: [['Смазка Литол-24', 'кг', 0.3, 2]], norm: 30, kinds: ['Конвейер', 'Транспортер', 'Элеватор', 'Мельница', 'Питатель', 'Грохот', 'Дробилка'] },
  'М-06': { title: 'Ремонт вала', works: 'Снят вал, проточены посадочные места, установлена шпонка, собрано и проверено биение', mats: [['Шпонка', 'шт', 1, 2], ['Подшипник 6314', 'шт', 1, 2]], norm: 240, kinds: ['Насос', 'Смеситель', 'Мельница', 'Редуктор'] },
  'Э-01': { title: 'Замена повреждённого кабеля', works: 'Обесточено, проложен новый кабель, замерено сопротивление изоляции, подключено', mats: [['Кабель ВВГ 3x2.5', 'м', 5, 30]], norm: 60, kinds: ['Конвейер', 'Транспортер', 'Шкаф', 'Двигатель', 'Насос', 'Компрессор'] },
  'Э-02': { title: 'Замена датчика', works: 'Демонтирован неисправный датчик, установлен новый, проверены показания на пульте', mats: [['Датчик температуры', 'шт', 1, 1]], norm: 35, kinds: ['Насос', 'Мельница', 'Двигатель', 'Компрессор', 'Сепаратор', 'Смеситель', 'Редуктор'] },
  'Э-03': { title: 'Замена предохранителя', works: 'Найдена причина перегрузки, заменён предохранитель, проверена токовая нагрузка', mats: [['Предохранитель 16А', 'шт', 1, 3]], norm: 25, kinds: ['Шкаф', 'Двигатель', 'Насос', 'Вентилятор'] },
  'Э-04': { title: 'Устранение перегрева двигателя', works: 'Проверено охлаждение, замерен ток по фазам, заменён датчик температуры обмотки и повреждённый участок кабеля', mats: [['Датчик температуры', 'шт', 1, 1], ['Кабель ВВГ 3x2.5', 'м', 2, 10]], norm: 120, kinds: ['Двигатель', 'Вентилятор', 'Насос', 'Компрессор'] },
  'Э-05': { title: 'Подтяжка клемм', works: 'Обесточено, подтянуты и зачищены клеммы, замена обгоревшего провода, проверка под нагрузкой', mats: [['Провод ПВ-3', 'м', 2, 10]], norm: 40, kinds: ['Шкаф', 'Двигатель'] },
  'Г-01': { title: 'Замена сальника', works: 'Остановлен узел, заменён сальник, проверена герметичность под давлением', mats: [['Сальник 45x65', 'шт', 1, 2], ['Масло гидравлическое', 'л', 1, 5]], norm: 90, kinds: ['Насос', 'Редуктор', 'Смеситель', 'Сепаратор'] },
  'Г-02': { title: 'Замена уплотнения', works: 'Разобран узел, заменено уплотнение, собрано, проверена герметичность', mats: [['Уплотнение торцевое', 'шт', 1, 2]], norm: 100, kinds: ['Насос', 'Сепаратор', 'Смеситель', 'Мельница'] },
  'Г-03': { title: 'Замена фильтра', works: 'Заменён забитый фильтр, проверено давление в магистрали', mats: [['Фильтр масляный', 'шт', 1, 1]], norm: 30, kinds: ['Насос', 'Компрессор', 'Редуктор', 'Дробилка'] },
  'Г-04': { title: 'Устранение течи масла', works: 'Найдено место течи, заменена прокладка, долито масло до уровня', mats: [['Прокладка паронитовая', 'шт', 1, 3], ['Масло гидравлическое', 'л', 2, 8]], norm: 60, kinds: ['Редуктор', 'Насос', 'Дробилка', 'Компрессор', 'Мельница'] },
  'П-01': { title: 'Устранение утечки воздуха', works: 'Найдена утечка, заменено уплотнение штуцера, проверено давление', mats: [['Уплотнение торцевое', 'шт', 1, 2]], norm: 40, kinds: ['Компрессор'] },
  'П-02': { title: 'Замена манжеты цилиндра', works: 'Разобран цилиндр, заменена манжета, собрано, проверен ход штока', mats: [['Манжета 50', 'шт', 1, 2]], norm: 80, kinds: ['Компрессор', 'Грохот', 'Питатель'] },
  'С-01': { title: 'Плановая смазка узлов', works: 'Смазаны узлы по карте смазки, проверены уровни', mats: [['Смазка Литол-24', 'кг', 0.3, 2]], norm: 30, kinds: null },
  'С-02': { title: 'Плановая замена масла', works: 'Слито отработанное масло, заменён фильтр, залито новое, проверен уровень', mats: [['Масло индустриальное', 'л', 4, 15], ['Фильтр масляный', 'шт', 1, 1]], norm: 60, kinds: ['Редуктор', 'Компрессор', 'Насос', 'Мельница', 'Дробилка'] },
  'С-03': { title: 'Плановый осмотр', works: 'Осмотр узлов, проверка крепежа и уровней, замечаний нет, записи внесены в журнал', mats: [['Ветошь', 'кг', 0.2, 1]], norm: 20, kinds: null },
};
export const UNPLANNED_CODES = ['М-01', 'М-02', 'М-03', 'М-04', 'М-05', 'М-06', 'Э-01', 'Э-02', 'Э-03', 'Э-04', 'Э-05', 'Г-01', 'Г-02', 'Г-03', 'Г-04', 'П-01', 'П-02'];
export const PLANNED_CODES = ['С-01', 'С-02', 'С-03'];
// 21 staff: 2 masters, 17 workers in 3 brigades (5+6+6 incl. leads), 2 managers
export const masters = ['Омаров Данияр', 'Касенов Талгат'];
export const workers = [
  ['Ахметов Ержан', 1], ['Бериков Сейтек', 1], ['Смаилов Даурен', 1], ['Кусаинов Ерлан', 1], ['Оспанов Марат', 1],
  ['Сейтов Нуржан', 2], ['Жумабеков Айбек', 2], ['Тлеубеков Нурлан', 2], ['Абдрахманов Серик', 2], ['Ермеков Жандос', 2], ['Нурпеисов Азамат', 2],
  ['Галиев Тимур', 3], ['Ибраев Руслан', 3], ['Калиев Арман', 3], ['Нургожин Болат', 3], ['Сарсенов Кайрат', 3], ['Дюсенов Алмас', 3],
];
export const WEAK_WORKER = 'Ермеков Жандос'; // pattern 4: repeated "no photo" rework

export function generate(seed = 20261008) {
  const r = rng(seed); const pick = a => a[Math.floor(r() * a.length)]; const rnd = (a, b) => a + r() * (b - a);
  const eq = n => equipment.find(e => e[0] === n);
  const raw = [];
  const mk = (eqName, code, kind, t, opts = {}) => raw.push({ eqName, code, kind, t, ...opts });
  const dayT = (d, h, m = 0) => END - (DAYS - d) * 864e5 + (h - 12) * 36e5 + m * 6e4;
  // baseline: unplanned orders weekdays 0-3/day, planned weekly
  for (let d = 0; d < DAYS; d++) {
    const wd = new Date(dayT(d, 12)).getUTCDay(); const n = wd === 0 || wd === 6 ? Math.floor(rnd(1, 3)) : Math.floor(rnd(4, 9));
    for (let i = 0; i < n; i++) {
      const code = pick(UNPLANNED_CODES); const tpl = templates[code];
      const cands = equipment.filter(e => !tpl.kinds || tpl.kinds.some(k => e[0].startsWith(k)));
      let e = pick(cands);
      mk(e[0], code, 'unplanned', dayT(d, Math.floor(rnd(3, 15)), Math.floor(rnd(0, 60))));
    }
    if (wd === 1) for (let i = 0; i < 2; i++) { const code = pick(PLANNED_CODES); const tpl = templates[code]; const cands = equipment.filter(e => !tpl.kinds || tpl.kinds.some(k => e[0].startsWith(k))); mk(pick(cands)[0], code, 'planned', dayT(d, 4 + i * 2)); }
  }
  // pattern 1: Конвейер К-3 has ~3x the unplanned orders of К-4/К-5, same cipher М-02 repeating within days
  for (let d = 2; d < DAYS; d += 3) { mk('Конвейер К-3', 'М-02', 'unplanned', dayT(d, 8 + (d % 3))); if (d % 2 === 0) mk('Конвейер К-3', 'М-02', 'unplanned', dayT(d + 1, 9)); }
  // pattern 2: Дробилка КМД-1750: planned on Monday, unplanned within 48h after most of them
  for (let d = 0; d < DAYS; d++) { const wd = new Date(dayT(d, 12)).getUTCDay(); if (wd === 1) { mk('Дробилка КМД-1750', 'С-02', 'planned', dayT(d, 7)); if (d % 7 !== 0 || d % 2) mk('Дробилка КМД-1750', 'Г-04', 'unplanned', dayT(d + 1, 10 + (d % 5))); } }
  // pattern 3: Насос Н-12 one oversize write-off (set below on one order)
  for (let d = 5; d < DAYS; d += 11) mk('Насос Н-12', pick(['Г-01', 'Г-02']), 'unplanned', dayT(d, 9 + (d % 4)));
  mk('Насос Н-12', 'Г-04', 'unplanned', dayT(45, 10), { spike: true });
  // pattern 4: weak worker gets reworked for missing photo on unplanned orders
  raw.sort((a, b) => a.t - b.t);
  const orders = raw.map((o, i) => {
    const tpl = templates[o.code]; const id = i + 1; const [, sIdx] = eq(o.eqName);
    const w = o.kind === 'unplanned' && r() < 0.12 ? workers.find(x => x[0] === WEAK_WORKER) : pick(workers);
    const master = pick(masters);
    const mats = tpl.mats.map(([name, unit, lo, hi]) => { let q = rnd(lo, hi); q = unit === 'шт' ? Math.max(1, Math.round(q)) : Math.round(q * 10) / 10; return { name, quantity: q, unit }; });
    if (o.spike) { const m = mats.find(x => x.name.startsWith('Масло')); if (m) m.quantity = 80; }
    const priority = o.kind === 'planned' ? 'planned' : (r() < 0.12 ? 'emergency' : r() < 0.3 ? 'high' : 'normal');
    const created = o.t; const accept = created + rnd(2, 20) * 6e4; const started = accept + rnd(3, 40) * 6e4;
    const dur = tpl.norm * rnd(0.7, 1.5) * 6e4; const closed = started + dur + rnd(5, 30) * 6e4;
    const deadlineH = priority === 'emergency' ? 2 : priority === 'high' ? 8 : o.kind === 'planned' ? 24 : 24;
    const deadline = created + deadlineH * 36e5;
    const weakNoPhoto = o.kind === 'unplanned' && r() < (w[0] === WEAK_WORKER ? 0.6 : 0.02);
    const rework = weakNoPhoto || r() < 0.05;
    const active = id > raw.length - 6; // last few are not yet closed
    const status = active ? pick(['issued', 'accepted', 'in_progress', 'queued', 'paused']) : 'closed';
    return {
      id, title: tpl.title + ' · ' + o.eqName, kind: o.kind, priority, equipment: o.eqName, section: sections[sIdx],
      fault_code: o.code, fault_name: faultCodes[o.code], assignee: w[0], brigade: 'Бригада ' + w[1], master,
      created_at: new Date(created).toISOString(), deadline: new Date(deadline).toISOString(),
      started_at: status === 'issued' || status === 'accepted' || status === 'queued' ? null : new Date(started).toISOString(),
      closed_at: status === 'closed' ? new Date(closed).toISOString() : null, status,
      closure: status === 'closed' ? { works: tpl.works, fault_code: o.code, materials: mats, photo_after: o.kind === 'unplanned' && !weakNoPhoto } : null,
      norm_minutes: tpl.norm, rework_count: status === 'closed' && rework ? 1 : 0,
      rework_reason: status === 'closed' && rework ? (weakNoPhoto ? 'Нет фото после ремонта' : 'Уточнить работы в отчёте') : null,
      material_spike: !!o.spike,
    };
  });
  return { dataset: 'История нарядов за 91 день', period: { from: new Date(END - DAYS * 864e5).toISOString(), to: new Date(END).toISOString() }, catalog: { sections, equipment: equipment.map(e => ({ name: e[0], section: sections[e[1]] })), fault_codes: faultCodes, masters, workers: workers.map(w => ({ name: w[0], brigade: 'Бригада ' + w[1] })) }, orders };
}
if (process.argv[1] && process.argv[1].endsWith('seed-history.mjs')) {
  const out = process.argv[2] || 'history.json'; const d = generate(); writeFileSync(out, JSON.stringify(d, null, 1)); console.log('orders', d.orders.length, '->', out);
}
