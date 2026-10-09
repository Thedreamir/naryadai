// Deterministic problem-vs-work consistency for work-order close-out. Free text is DATA: it never changes scoring rules.
// Output is advisory; abstains ("needs_master") instead of guessing.
export const CATS = {
  bearing: ['подшипн', 'вибрац', 'люфт', 'гул', 'перегрев узл', 'стук', 'заклин'],
  belt: ['лент', 'ремен', 'ремн', 'сход ленты', 'обрыв ленты', 'роликов', 'ролик', 'барабан'],
  seal: ['течь', 'течи', 'протеч', 'сальник', 'уплотнен', 'прокладк', 'утечк', 'подтек', 'подтёк', 'манжет'],
  electrical: ['двигател', 'электр', 'кабел', 'контактор', 'предохранит', 'обмотк', 'замыкан', 'пускател', 'автомат', 'фаз', 'не включ', 'клемм'],
  valve: ['клапан', 'задвижк', 'кран', 'вентил', 'шиб'],
  hydraulic: ['гидро', 'шланг', 'давлен', 'насос', 'рукав', 'маслостанц'],
  wear: ['футеров', 'брон', 'щек', 'конус', 'износ', 'дроблен', 'молот', 'плит'],
  lubrication: ['смазк', 'смазат', 'консистент', 'солидол', 'литол', 'маслен', 'заправ'],
};
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s.-]/g, ' ').replace(/\s+/g, ' ').trim();
const nstem = (k) => k.replace(/ё/g, 'е');
export function categories(text) { const t = norm(text), out = new Set(); for (const [c, ks] of Object.entries(CATS)) if (ks.some((k) => t.includes(nstem(k)))) out.add(c); return out; }
const INJECTION = [/игнорир/, /ignore (all|previous|prior)/, /system prompt|системн\w* (промпт|инструкц)/, /поставь\s+(оценк\w*\s*)?\d/, /(оценк\w*|балл\w*)\s*(5|пять|100)\b/, /вердикт\s*[:=-]?\s*принят/, /ты (теперь )?(ии|ai|модель|ассистент)/, /(выведи|покажи|raw|json|скрыт)/, /не проверяй/, /принять без проверки/, /забудь/];
export function injectionFlags(text) { const t = norm(text); return INJECTION.filter((r) => r.test(t)).map(String); }
const UNFINISHED = ['не доделан', 'не завершен', 'не закончен', 'частично', 'осталось', 'временно', 'ждем', 'ждём', 'до конца смены', 'позже', 'не хватило', 'на потом', 'недоделан', 'не устранен', 'не смогли'];
const VAGUE = ['сделано', 'все ок', 'всё ок', 'выполнено', 'работы выполнены', 'поправили', 'починили', 'готово', 'порядок', 'ок'];
export function stripInjection(text) { return String(text || '').split(/(?<=[.!?\n;,:])/).filter((s) => injectionFlags(s).length === 0).join(' '); }
export function checkConsistency({ problem, work, materials = [] }) {
  const flags = []; const inj = [...injectionFlags(problem), ...injectionFlags(work)]; if (inj.length) flags.push('prompt_injection_attempt');
  const w = stripInjection(work), p = stripInjection(problem); const wn = norm(w); const words = wn.split(' ').filter(Boolean);
  const pc = categories(p), wc = categories(w + ' ' + materials.join(' '));
  const base = { flags, problemCats: [...pc], workCats: [...wc] };
  const done = (verdict, why, needsMaster, extra = {}) => ({ verdict, why, needsMaster: needsMaster || inj.length > 0, ...base, ...extra });
  if (words.length < 2 && wc.size === 0) return done('insufficient', 'empty_or_too_short', false);
  if (UNFINISHED.some((u) => wn.includes(u))) return done('incomplete', 'work_marked_unfinished', false);
  if (wc.size === 0 && VAGUE.some((v) => wn.includes(v)) && words.length < 8) return done('insufficient', 'no_specific_work', false);
  if (pc.size === 0) return done('unknown', 'problem_not_classified', true);
  if (wc.size === 0) return done('unknown', 'work_not_classified', true);
  const inter = [...pc].filter((c) => wc.has(c));
  if (inter.length) return done('match', 'shared:' + inter.join(','), false, { shared: inter });
  return done('mismatch', 'disjoint_categories', false);
}
export function materialsPlausible(workCats, materials, usual = {}) { // usual: {material: maxQty}; flag implausible ones
  const out = []; for (const m of materials) { const mc = categories(m.name); if (mc.size && ![...mc].some((c) => workCats.includes(c))) out.push({ name: m.name, why: 'material_not_for_work_type' }); if (usual[m.name] && m.qty > usual[m.name] * 2) out.push({ name: m.name, why: 'qty_over_2x_usual' }); } return out;
}
