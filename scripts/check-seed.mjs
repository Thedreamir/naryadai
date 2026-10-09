// Checks for the generated history. Exit 1 on any failure.
import { generate, templates, faultCodes, equipment, DAYS } from './seed-history.mjs';
const d = generate(); const o = d.orders; let bad = 0; const fail = m => { bad++; console.log('FAIL', m); };
const NORMS = { подшипник: 'шт', смазка: 'кг', масло: 'л', кабель: 'м', фильтр: 'шт', ремень: 'шт', сальник: 'шт', уплотнение: 'шт', прокладка: 'шт', болт: 'шт', гайка: 'шт', датчик: 'шт', предохранитель: 'шт' };
const MAX = { подшипник: 4, смазка: 5, масло: 20, кабель: 50, фильтр: 2, ремень: 2, сальник: 4, уплотнение: 4, прокладка: 6, болт: 16, гайка: 16, датчик: 2, предохранитель: 5 };
const FM = { М: ['подшипник', 'смазка', 'ремень', 'болт', 'гайка', 'шайба', 'вал', 'муфта', 'шпонка', 'звездочка', 'цепь', 'масло', 'электрод'], Э: ['кабель', 'датчик', 'предохранитель', 'контактор', 'автомат', 'лампа', 'провод', 'клемма', 'двигатель', 'болт', 'гайка'], Г: ['сальник', 'уплотнение', 'прокладка', 'масло', 'фильтр', 'шланг', 'рукав', 'манжета', 'клапан'], П: ['уплотнение', 'фильтр', 'шланг', 'манжета', 'клапан', 'масло', 'прокладка'], С: ['смазка', 'масло', 'фильтр', 'ветошь'] };
const UNIV = ['ветошь', 'обтироч', 'обезжириват', 'керосин', 'салфетк'];
if (o.length < 500) fail('orders < 500: ' + o.length);
const span = (Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5; if (span < 90) fail('span < 3 months');
const BANNED = /(?<![а-яё])(демо(?!нт)|тест|синтет|учебн|прототип|концепт|демонстрац)|\(Т\)|\b(demo|test|fake|lorem)\b/i;
const ids = new Set(); const eqNames = new Set(equipment.map(e => e[0]));
for (const x of o) {
  if (ids.has(x.id)) fail('dup id ' + x.id); ids.add(x.id);
  const t = templates[x.fault_code]; if (!t) { fail(`#${x.id} unknown cipher`); continue; }
  if (!faultCodes[x.fault_code]) fail(`#${x.id} cipher not in catalog`);
  if (!x.title.startsWith(t.title)) fail(`#${x.id} title/cipher mismatch`);
  if (!eqNames.has(x.equipment) || !x.title.endsWith(x.equipment)) fail(`#${x.id} equipment/title mismatch`);
  if (t.kinds && !t.kinds.some(k => x.equipment.startsWith(k))) fail(`#${x.id} ${x.fault_code} on ${x.equipment}`);
  if ((x.kind === 'planned') !== x.fault_code.startsWith('С')) fail(`#${x.id} kind/cipher`);
  if (BANNED.test(JSON.stringify(x))) fail(`#${x.id} banned wording`);
  if (x.closure) {
    if (x.closure.works !== t.works) fail(`#${x.id} works/title`);
    if (x.closure.fault_code !== x.fault_code) fail(`#${x.id} closure cipher`);
    for (const m of x.closure.materials) {
      const k = Object.keys(NORMS).find(n => m.name.toLowerCase().includes(n));
      if (k && NORMS[k] !== m.unit) fail(`#${x.id} unit ${m.name} ${m.unit}`);
      if (k && m.quantity > MAX[k] && !x.material_spike) fail(`#${x.id} qty ${m.name} ${m.quantity}`);
      const lm = m.name.toLowerCase(); const pre = x.fault_code[0];
      if (!(FM[pre].some(a => lm.includes(a)) || UNIV.some(a => lm.includes(a)))) fail(`#${x.id} material ${m.name} atypical for ${x.fault_code}`);
      if (!(m.quantity > 0)) fail(`#${x.id} qty<=0`);
    }
    if (Date.parse(x.closed_at) <= Date.parse(x.started_at) || Date.parse(x.started_at) <= Date.parse(x.created_at)) fail(`#${x.id} time order`);
  }
}
// patterns
const unp = n => o.filter(x => x.equipment === n && x.kind === 'unplanned').length;
const ratio = unp('Конвейер К-3') / Math.max(1, (unp('Конвейер К-4') + unp('Конвейер К-5')) / 2);
if (ratio < 2.5) fail('pattern1 ratio ' + ratio.toFixed(2));
const m02 = o.filter(x => x.equipment === 'Конвейер К-3' && x.fault_code === 'М-02').length; if (m02 < 40) fail('pattern1 M-02 repeats ' + m02);
const post = o.filter(p => p.equipment === 'Дробилка КМД-1750' && p.kind === 'planned' && o.some(u => u.equipment === p.equipment && u.kind === 'unplanned' && Date.parse(u.created_at) > Date.parse(p.created_at) && Date.parse(u.created_at) - Date.parse(p.created_at) <= 48 * 36e5)).length; if (post < 8) fail('pattern2 ' + post);
const spikes = o.filter(x => x.material_spike); if (spikes.length !== 1) fail('pattern3 spikes ' + spikes.length);
const rw = n => o.filter(x => x.assignee === n && x.rework_reason === 'Нет фото после ремонта').length; const weak = rw('Ермеков Жандос'); const maxOther = Math.max(...[...new Set(o.map(x => x.assignee))].filter(n => n !== 'Ермеков Жандос').map(rw)); if (weak < 2 * Math.max(1, maxOther)) fail(`pattern4 weak=${weak} other max=${maxOther}`);
const wk = new Set(d.catalog.workers.map(w => w.name)); if (d.catalog.masters.length + wk.size !== 19) fail('staff count ' + (d.catalog.masters.length + wk.size) + ' (+2 managers = 21)');
console.log(`orders ${o.length}, span ${span.toFixed(0)}d, К-3/К-4,5 ratio ${ratio.toFixed(2)}, М-02 on К-3 ${m02}, post-planned<=48h ${post}, spike ${spikes.map(s => '#' + s.id)}, weak no-photo ${weak} vs other max ${maxOther}`);
console.log(bad ? `FAILED ${bad}` : 'ALL CHECKS PASS'); process.exit(bad ? 1 : 0);
