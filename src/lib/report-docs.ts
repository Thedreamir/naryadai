import {equipmentDowntime} from './equipment-downtime.mjs'
// Document models for XLSX/PDF report export.
// Explicit allowlist only: no emails, credentials, photo URLs or free-text closure text.
// Pure builders: no DOM, no network; unit-tested in Node (tests/report-docs.test.mjs).
import {ACTIVE_STATUSES, statusOf} from './status.ts'
import {withinInstant} from './period.ts'
import {isTechnicalTitle} from './presentation.ts'

export type DocCell = string | number
export interface DocColumn { header: string; weight?: number; align?: 'left' | 'right' | 'center' }
export interface DocTable { columns: DocColumn[]; rows: DocCell[][] }
export interface DocSection { heading: string; table?: DocTable; lines?: string[] }
export interface ReportDoc {
  kind: 'shift' | 'closed-orders' | 'rating'
  title: string
  subtitle: string
  disclaimer: string
  generatedAt: string
  sections: DocSection[]
}

export const REPORT_SOURCE_LABEL = 'Отчёт по учебному набору'
export const REPORT_DISCLAIMER = 'Синтетические данные демонстрации. Не аттестация персонала, не официальный документ завода.'
const TZ = 'Asia/Almaty'

export function fmtAlmaty(value: string | number | Date, withSeconds = false): string {
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleString('ru', {timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...(withSeconds ? {second: '2-digit'} : {})})
}
export function fmtDateAlmaty(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleDateString('ru', {timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric'})
}

export interface PeriodBounds { since: string; until: string }

function baseDoc(kind: ReportDoc['kind'], title: string, subtitle: string): ReportDoc {
  return {kind, title, subtitle, disclaimer: REPORT_DISCLAIMER, generatedAt: fmtAlmaty(Date.now()), sections: []}
}

// --- Отчёт по закрытым нарядам -------------------------------------------------
export function closedOrdersDoc(orders: any[], bounds: PeriodBounds): ReportDoc {
  const lo = Date.parse(bounds.since), hi = Date.parse(bounds.until)
  const selected = orders
    .filter(o => o.status === 'closed' && Date.parse(o.closed_at) >= lo && Date.parse(o.closed_at) < hi)
    .sort((a, b) => Number(a.id) - Number(b.id))
  const doc = baseDoc('closed-orders', 'Отчёт по закрытым нарядам',
    `${REPORT_SOURCE_LABEL} · период ${fmtAlmaty(bounds.since)} - ${fmtAlmaty(bounds.until)} (не включительно) · ${TZ}`)
  doc.sections.push({
    heading: `Закрытые наряды: ${selected.length}`,
    table: {
      columns: [
        {header: 'Наряд', weight: 0.8, align: 'right'},
        {header: 'Оборудование', weight: 1.6},
        {header: 'Участок', weight: 1.2},
        {header: 'Исполнитель', weight: 1.4},
        {header: 'Дата закрытия', weight: 1.4},
        {header: 'Оценка мастера', weight: 1.3, align: 'center'},
      ],
      rows: selected.map(o => [String(o.id), o.equipment ?? '—', o.section ?? '—', o.assignee ?? '—', fmtAlmaty(o.closed_at), o.ai_result?.human_score ?? '—']),
    },
  })
  if (!selected.length) doc.sections[0].lines = ['За выбранный период закрытых нарядов нет.']
  return doc
}

// --- Рейтинг исполнителей с пояснением ------------------------------------------
export function ratingDoc(rows: any[], bounds: PeriodBounds): ReportDoc {
  const doc = baseDoc('rating', 'Рейтинг исполнителей (пять факторов)',
    `${REPORT_SOURCE_LABEL} · период ${fmtAlmaty(bounds.since)} - ${fmtAlmaty(bounds.until)} (не включительно) · ${TZ}`)
  doc.sections.push({
    heading: `Рейтинг: ${rows.length} исполнителей${rows.length?` · ${Math.min(...rows.map(r=>r.factors_available))} из 5 факторов доступны`:""}`,
    table: {
      columns: [
        {header: 'Исполнитель', weight: 1.8},
        {header: 'Балл', weight: 0.7, align: 'right'},
        {header: 'Факторы', weight: 1.0, align: 'center'},
        {header: 'Качество', weight: 1.1, align: 'right'},
        {header: 'В срок', weight: 0.8, align: 'right'},
        {header: 'Без доработок', weight: 1.3, align: 'right'},
        {header: 'Объём', weight: 0.8, align: 'right'},
        {header: 'Без отказов', weight: 1.1, align: 'right'},
      ],
      rows: rows.map(r => [r.name, r.total ?? '—', `${r.factors_available}/5`, r.f_quality ?? '—', r.f_ontime ?? '—', r.f_rework ?? '—', r.f_volume ?? '—', r.f_rejects ?? '—']),
    },
  })
  if (!rows.length) doc.sections[0].lines = ['Закрытых нарядов за период нет, рейтинг не рассчитан.']
  doc.sections.push({
    heading: 'Почему такой балл',
    lines: rows.flatMap(r => [
      `${r.name} - ${r.total ?? '—'} из 100. ${r.explanation ?? ''}`.trim(),
      `Отказы: оправдано ${r.rejects_justified ?? 'неизвестно'} · неоправдано ${r.rejects_unjustified ?? 'неизвестно'} · требуют проверки ${r.rejects_unclassified ?? 'неизвестно'}.`,
    ]),
  })
  doc.sections.push({
    heading: 'Веса и ограничения',
    lines: [
      'Качество 30 · в срок 25 · без доработок 20 · объём 15 · без отказов 10. Только оценки мастера; нет данных = фактор исключён.',
      'Объём - приближение относительно лучшего исполнителя за период, не замеренная трудоёмкость. Выводы ИИ не входят в оценку.',
    ],
  })
  return doc
}

// --- Передача смены --------------------------------------------------------------
export interface ShiftOptions {
  date: string                 // 'YYYY-MM-DD' (Asia/Almaty)
  shift: string                // 'day' | 'night'
  section: string              // '' = все доступные
  presentation?: boolean       // скрыть технические тестовые наряды
}
export function shiftWindow(opts: ShiftOptions): { start: Date; end: Date; label: string } {
  const start = new Date(opts.date + 'T' + (opts.shift === 'day' ? '08:00:00' : '20:00:00') + '+05:00')
  const end = new Date(start.getTime() + 12 * 3600000)
  const label = opts.shift === 'day' ? '08:00-20:00' : '20:00-08:00 (+1 день)'
  return {start, end, label}
}
export function shiftDoc(st: any, opts: ShiftOptions): ReportDoc {
  const {start, end, label} = shiftWindow(opts)
  const down=equipmentDowntime(st.equipment_state_events??null,{since:start.getTime(),until:Math.min(end.getTime(),Date.now()),equipmentIds:(st.equipment||[]).filter((e:any)=>!opts.section||e.section===opts.section).map((e:any)=>e.id)})
  const inScope = st.orders.filter((o: any) => !opts.section || o.section === opts.section)
  const scoped = inScope.filter((o: any) => !opts.presentation || !isTechnicalTitle(o.title))
  const active = scoped.filter((o: any) => !o.cancelled&&ACTIVE_STATUSES.includes(o.status))
  const review = scoped.filter((o: any) => ['completed', 'ai_review'].includes(o.status))
  const overdue = active.filter((o: any) => Date.parse(o.deadline) < Date.now())
  const closed = scoped.filter((o: any) => o.status === 'closed' && withinInstant(o.closed_at, start.getTime(), end.getTime()))
    .sort((a: any, b: any) => Date.parse(a.closed_at) - Date.parse(b.closed_at))
  const scored = closed.filter((o: any) => o.ai_result?.human_score)
  const avg = scored.length ? (scored.reduce((n: number, o: any) => n + Number(o.ai_result.human_score), 0) / scored.length).toFixed(1) : null
  const doc = baseDoc('shift', `Передача смены · ${label} · ${fmtDateAlmaty(start)}`,
    `${REPORT_SOURCE_LABEL} · участок: ${opts.section || 'все доступные'} · окно ${fmtAlmaty(start)} - ${fmtAlmaty(end)} · ${TZ}`)
  doc.sections.push({
    heading: 'Сводка',
    lines: [
      `Закрыто за смену: ${closed.length}. Оценки мастера: ${scored.length}${avg ? ` · средняя ${avg}/5` : ''}. Выводы модели не включены.`,
      `Активные сейчас: ${active.length} · на проверке: ${review.length} · просрочено: ${overdue.length}.`,
      down.minutes===null?'Простой оборудования: недостаточно событий состояния. Паузы работника не являются простоем.':`Простой оборудования: ${down.minutes} мин по отдельным событиям состояния.`,
      'Окно смены 12 часов - настройка демонстрации, не подтверждённый график завода. Незавершённые наряды - текущий срез, не восстановленная история прошлой смены.',
    ],
  })
  doc.sections.push({
    heading: `Закрыто за выбранную смену: ${closed.length}`,
    table: {
      columns: [
        {header: 'Наряд', weight: 0.7, align: 'right'},
        {header: 'Работа', weight: 2.4},
        {header: 'Исполнитель', weight: 1.4},
        {header: 'Закрыт', weight: 1.3},
        {header: 'Оценка мастера', weight: 1.1, align: 'center'},
      ],
      rows: closed.map((o: any) => [String(o.id), o.title, o.assignee ?? '—', fmtAlmaty(o.closed_at), o.ai_result?.human_score ?? 'нет']),
    },
    ...(closed.length ? {} : {lines: ['За выбранное окно закрытий нет.']}),
  })
  if (overdue.length) doc.sections.push({
    heading: `Просроченные: ${overdue.length}`,
    table: {
      columns: [
        {header: 'Наряд', weight: 0.7, align: 'right'},
        {header: 'Работа', weight: 2.4},
        {header: 'Исполнитель', weight: 1.4},
        {header: 'Срок', weight: 1.4},
      ],
      rows: overdue.map((o: any) => [String(o.id), o.title, o.assignee ?? '—', fmtAlmaty(o.deadline)]),
    },
  })
  const byWorker = st.employees.filter((e: any) => e.role === 'worker')
    .map((w: any) => ({w, list: active.filter((o: any) => o.assignee_id === w.id)}))
    .filter((x: any) => x.list.length)
  doc.sections.push({
    heading: `Активные по исполнителям: ${active.length}`,
    table: {
      columns: [
        {header: 'Исполнитель', weight: 1.4},
        {header: 'Наряд', weight: 0.7, align: 'right'},
        {header: 'Работа', weight: 2.4},
        {header: 'Статус', weight: 1.0},
      ],
      rows: byWorker.flatMap(({w, list}: any) => list.map((o: any) => [w.name, String(o.id), o.title, statusOf(o.status).label])),
    },
    ...(active.length ? {} : {lines: ['Активных нарядов нет.']}),
  })
  doc.sections.push({
    heading: `Ждут проверки мастером: ${review.length}`,
    table: {
      columns: [
        {header: 'Наряд', weight: 0.7, align: 'right'},
        {header: 'Работа', weight: 2.4},
        {header: 'Исполнитель', weight: 1.4},
        {header: 'Статус', weight: 1.0},
      ],
      rows: review.map((o: any) => [String(o.id), o.title, o.assignee ?? '—', statusOf(o.status).label]),
    },
    ...(review.length ? {} : {lines: ['Нет.']}),
  })
  return doc
}
