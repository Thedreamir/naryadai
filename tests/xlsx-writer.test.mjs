import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import zlib from 'node:zlib'
import {buildXlsx, sheetsFromDoc, crc32, escapeXml, sanitizeSheetName} from '../src/lib/xlsx-writer.ts'
import {closedOrdersDoc, ratingDoc, shiftDoc} from '../src/lib/report-docs.ts'

const BOUNDS = {since: '2026-10-01T00:00:00+05:00', until: '2026-10-08T00:00:00+05:00'}
const ORDERS = [
  {id: 3, status: 'closed', closed_at: '2026-10-02T10:00:00Z', equipment: 'Конвейер К-3 (Т)', section: 'Цех обжига', assignee: 'Ахметов Е.', ai_result: {human_score: 5}},
  {id: 9, status: 'closed', closed_at: '2026-10-03T10:00:00Z', equipment: 'Дробилка ЩД-6', section: 'Обжиг', assignee: 'Әбдіғали Н.', ai_result: {human_score: 4}},
]

function parseZipEntries(bytes) {
  const entries = new Map()
  let p = 0
  while (p < bytes.length - 4) {
    const sig = bytes.readUInt32LE(p)
    if (sig !== 0x04034B50) break
    const crc = bytes.readUInt32LE(p + 14)
    const size = bytes.readUInt32LE(p + 18)
    const nameLen = bytes.readUInt16LE(p + 26)
    const extraLen = bytes.readUInt16LE(p + 28)
    const name = bytes.subarray(p + 30, p + 30 + nameLen).toString('utf8')
    const data = bytes.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size)
    entries.set(name, {crc, data})
    p += 30 + nameLen + extraLen + size
  }
  return entries
}

test('crc32 matches zlib', () => {
  const data = new TextEncoder().encode('Кириллица ₸ · test 123')
  assert.equal(crc32(data), zlib.crc32(data))
})

test('escapeXml and sanitizeSheetName', () => {
  assert.equal(escapeXml(`a<b>&"'`), 'a&lt;b&gt;&amp;&quot;&apos;')
  assert.equal(sanitizeSheetName('a/b:c*d?e[f]g\\h'), 'a b c d e f g h')
  assert.ok(sanitizeSheetName('x'.repeat(50)).length === 31)
})

test('buildXlsx: valid zip, required parts, intact CRCs, Cyrillic inline strings', () => {
  const doc = closedOrdersDoc(ORDERS, BOUNDS)
  const bytes = Buffer.from(buildXlsx(sheetsFromDoc(doc)))
  assert.equal(bytes.readUInt32LE(0), 0x04034B50, 'zip local header')
  const entries = parseZipEntries(bytes)
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml'])
    assert.ok(entries.has(part), `missing ${part}`)
  for (const [name, e] of entries) assert.equal(zlib.crc32(e.data) >>> 0, e.crc, `crc ${name}`)
  const summary = entries.get('xl/worksheets/sheet1.xml').data.toString('utf8')
  assert.ok(summary.includes('учебному набору'), 'summary sheet carries the source label')
  const sheet = entries.get('xl/worksheets/sheet2.xml').data.toString('utf8')
  assert.ok(sheet.includes('Ахметов Е.'), 'Cyrillic data present')
  assert.ok(sheet.includes('Конвейер К-3 (Т)'))
  assert.ok(sheet.includes('t="inlineStr"'), 'strings stored as inline, never formulas')
  const wb = entries.get('xl/workbook.xml').data.toString('utf8')
  assert.ok(wb.includes('<sheet'))
})

test('buildXlsx: system unzip validates the archive; LibreOffice opens it', () => {
  const doc = ratingDoc([{name: 'Ахметов Е.', total: 78, factors_available: 5, f_quality: 22.5, f_ontime: 15.2, f_rework: 20, f_volume: 10.3, f_rejects: 10, explanation: 'Закрыто 31.', rejects_justified: 1, rejects_unjustified: 0, rejects_unclassified: 2}], BOUNDS)
  const dir = mkdtempSync(join(tmpdir(), 'xlsx-'))
  const file = join(dir, 'rating.xlsx')
  writeFileSync(file, buildXlsx(sheetsFromDoc(doc)))
  execFileSync('unzip', ['-t', file])
  const out = execFileSync('soffice', ['--headless', '--convert-to', 'csv:Text - txt - csv (StarCalc):44,34,76', '--outdir', dir, file]).toString()
  const csv = readFileSync(join(dir, 'rating.csv'), 'utf8')
  assert.ok(csv.includes('Ахметов Е.'), 'LibreOffice reads Cyrillic cell')
  assert.ok(csv.includes('78'), 'numeric score cell')
})

test('sheetsFromDoc: table sections become sheets, line sections stack on Сводка', () => {
  const st = {
    orders: [
      {id: 1, status: 'closed', closed_at: '2026-10-07T05:00:00Z', title: 'Замена', assignee: 'А', assignee_id: 10, section: 'Обжиг', ai_result: {human_score: 5}, deadline: '2026-10-07T10:00:00Z'},
      {id: 2, status: 'in_progress', title: 'Активный', assignee: 'Б', assignee_id: 10, section: 'Обжиг', deadline: '2026-10-07T10:00:00Z'},
    ],
    employees: [{id: 10, role: 'worker', name: 'Ахметов Е.'}],
  }
  const doc = shiftDoc(st, {date: '2026-10-07', shift: 'day', section: '', presentation: false})
  const sheets = sheetsFromDoc(doc)
  assert.ok(sheets.length >= 3, `expected stacked summary + table sheets, got ${sheets.length}`)
  assert.equal(sheets[0].name, 'Сводка')
  assert.ok(sheets[0].rows.flat().some(c => String(c.v).includes('не подтверждённый график завода')))
  for (const s of sheets) assert.ok(s.name.length <= 31 && !/[\[\]:*?/\\]/.test(s.name))
})
