import test from 'node:test'
import assert from 'node:assert/strict'
import {closedOrdersDoc, ratingDoc, shiftDoc, shiftWindow, REPORT_DISCLAIMER} from '../src/lib/report-docs.ts'

const BOUNDS = {since: '2026-10-01T00:00:00+05:00', until: '2026-10-08T00:00:00+05:00'}

test('closedOrdersDoc: filters closed-in-window, sorts by id, allowlist fields only', () => {
  const orders = [
    {id: 9, status: 'closed', closed_at: '2026-10-03T10:00:00Z', equipment: 'Конвейер К-3 (Т)', section: 'Обжиг', assignee: 'Ахметов Е.', ai_result: {human_score: 5}, title: 'secret free text', photos: ['x']},
    {id: 3, status: 'closed', closed_at: '2026-10-02T10:00:00Z', equipment: 'Дробилка ЩД-6', section: 'Обжиг', assignee: 'Иванов И.', ai_result: {human_score: 4}},
    {id: 4, status: 'in_progress', closed_at: null, equipment: 'Мельница'},
    {id: 5, status: 'closed', closed_at: '2026-09-01T10:00:00Z', equipment: 'Старое'},
    {id: 6, status: 'closed', closed_at: '2026-10-08T00:00:00+05:00', equipment: 'Граница до (не вкл.)'},
  ]
  const doc = closedOrdersDoc(orders, BOUNDS)
  assert.equal(doc.kind, 'closed-orders')
  const table = doc.sections[0].table
  assert.deepEqual(table.rows.map(r => r[0]), ['3', '9'])
  assert.equal(table.columns.length, 6)
  assert.ok(doc.disclaimer === REPORT_DISCLAIMER)
  const flat = JSON.stringify(doc)
  assert.ok(!flat.includes('secret free text'), 'free text must not leak into the export')
  assert.ok(!flat.includes('photos'), 'photo refs must not leak into the export')
  assert.ok(flat.includes('учебному набору'))
})

test('closedOrdersDoc: empty period yields explicit note', () => {
  const doc = closedOrdersDoc([], BOUNDS)
  assert.equal(doc.sections[0].table.rows.length, 0)
  assert.match(doc.sections[0].lines[0], /нет/)
})

test('ratingDoc: factors, explanation and rejects carried through', () => {
  const rows = [{
    name: 'Ахметов Е.', total: 78, factors_available: 5,
    f_quality: 22.5, f_ontime: 15.2, f_rework: 20, f_volume: 10.3, f_rejects: 10,
    explanation: 'Закрыто 31 наряд, 19 в срок.', rejects_justified: 1, rejects_unjustified: 0, rejects_unclassified: 2,
  }]
  const doc = ratingDoc(rows, BOUNDS)
  const table = doc.sections[0].table
  assert.deepEqual(table.rows[0].slice(0, 3), ['Ахметов Е.', 78, '5/5'])
  const why = doc.sections.find(s => s.heading === 'Почему такой балл')
  assert.ok(why.lines[0].includes('Закрыто 31 наряд'))
  assert.ok(why.lines[1].includes('требуют проверки 2'))
  const weights = doc.sections.find(s => s.heading === 'Веса и ограничения')
  assert.ok(weights.lines[0].includes('Качество 30'))
  assert.ok(weights.lines[1].includes('не замеренная трудоёмкость'))
})

test('shiftWindow: day and night 12h windows Asia/Almaty', () => {
  const day = shiftWindow({date: '2026-10-07', shift: 'day', section: ''})
  assert.equal(day.start.toISOString(), '2026-10-07T03:00:00.000Z')
  assert.equal(day.end.toISOString(), '2026-10-07T15:00:00.000Z')
  const night = shiftWindow({date: '2026-10-07', shift: 'night', section: ''})
  assert.equal(night.start.toISOString(), '2026-10-07T15:00:00.000Z')
  assert.equal(night.end.toISOString(), '2026-10-08T03:00:00.000Z')
})

test('shiftDoc: window filtering, section filter, presentation filter, honest notes', () => {
  const st = {
    orders: [
      {id: 1, status: 'closed', closed_at: '2026-10-07T05:00:00Z', title: 'Замена подшипника', assignee: 'Ахметов Е.', assignee_id: 10, section: 'Обжиг', ai_result: {human_score: 5}, deadline: '2026-10-07T10:00:00Z'},
      {id: 2, status: 'closed', closed_at: '2026-10-06T05:00:00Z', title: 'Вчерашний', assignee: 'Б', section: 'Обжиг', deadline: '2026-10-07T10:00:00Z'},
      {id: 3, status: 'in_progress', title: 'E2E тестовый наряд', assignee: 'В', assignee_id: 11, section: 'Обжиг', deadline: '2026-10-07T10:00:00Z'},
      {id: 4, status: 'completed', title: 'Ждёт проверки', assignee: 'Г', assignee_id: 11, section: 'Сортировка', deadline: '2026-10-07T10:00:00Z'},
    ],
    employees: [{id: 10, role: 'worker', name: 'Ахметов Е.'}, {id: 11, role: 'worker', name: 'Второй Рабочий'}],
  }
  const doc = shiftDoc(st, {date: '2026-10-07', shift: 'day', section: '', presentation: true})
  assert.equal(doc.kind, 'shift')
  const closed = doc.sections.find(s => s.heading.startsWith('Закрыто за выбранную смену'))
  assert.deepEqual(closed.table.rows.map(r => r[0]), ['1'])
  // technical title hidden by presentation filter
  assert.ok(!JSON.stringify(doc).includes('E2E тестовый наряд'))
  // summary carries the honest caveats
  const summary = doc.sections.find(s => s.heading === 'Сводка')
  assert.ok(summary.lines.some(l => l.includes('не подтверждённый график завода')))
  assert.ok(summary.lines.some(l => l.includes('текущий срез')))
  // section filter
  const only = shiftDoc(st, {date: '2026-10-07', shift: 'day', section: 'Сортировка', presentation: false})
  assert.equal(only.sections.find(s => s.heading.startsWith('Закрыто за выбранную смену')).table.rows.length, 0)
  assert.ok(only.sections.find(s => s.heading.startsWith('Ждут проверки')).table.rows.length === 1)
})
