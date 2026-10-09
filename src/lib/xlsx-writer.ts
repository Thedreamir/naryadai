// Minimal dependency-free XLSX writer (Office Open XML spreadsheet).
// Stored (uncompressed) ZIP + inline strings. No external packages.
// String cells are stored as inline strings, so cell text can never become a formula.
import type {ReportDoc, DocTable} from './report-docs.ts'

export interface XlsxCell { v: string | number; style?: number }
export interface XlsxSheet { name: string; rows: XlsxCell[][]; colWeights?: number[] }

const encoder = new TextEncoder()

// --- CRC32 ------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
export function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// --- ZIP (stored entries) ----------------------------------------------------
function u16(v: number) { return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]) }
function u32(v: number) { return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]) }
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const nameBytes = encoder.encode(f.name)
    const crc = crc32(f.data)
    const local = [u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(nameBytes.length), u16(0), nameBytes]
    chunks.push(...local, f.data)
    central.push(u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(f.data.length), u32(f.data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes)
    offset += local.reduce((n, c) => n + c.length, 0) + f.data.length
  }
  const centralStart = offset
  const centralSize = central.reduce((n, c) => n + c.length, 0)
  const end = [u32(0x06054B50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(centralStart), u16(0)]
  const all = [...chunks, ...central, ...end]
  const total = all.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let p = 0
  for (const c of all) { out.set(c, p); p += c.length }
  return out
}

// --- XML ---------------------------------------------------------------------
export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, ch => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'}[ch] as string))
}
function colName(index: number): string { // 0-based -> A, B, ... Z, AA
  let s = '', n = index + 1
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26 }
  return s
}
export function sanitizeSheetName(name: string): string {
  const clean = name.replace(/[\[\]:*?/\\]/g, ' ').trim() || 'Лист'
  return clean.length > 31 ? clean.slice(0, 31) : clean
}

function estimateRowHeight(row: XlsxCell[], colWeights?: number[]): number {
  // Approximate Excel auto-fit for wrapped text: lines = ceil(chars / column width).
  // A single-cell row is merged across all columns, so it measures against the full width.
  if (row.length === 1 && colWeights?.length) {
    const width = colWeights.reduce((n, w) => n + Math.min(60, Math.max(8, Math.round(w))), 0)
    const len = String(row[0].v ?? '').length
    return Math.min(140, Math.max(15, Math.ceil(len / Math.max(1, width - 1)) * 13.6 + 2))
  }
  let lines = 1
  for (let i = 0; i < row.length; i++) {
    const width = Math.min(60, Math.max(8, Math.round(colWeights?.[i] ?? 9)))
    const len = String(row[i].v ?? '').length
    if (len) lines = Math.max(lines, Math.ceil(len / Math.max(1, width - 1)))
  }
  return Math.min(140, Math.max(15, lines * 13.6 + 2))
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.colWeights?.length
    ? `<cols>${sheet.colWeights.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(8, Math.round(w)))}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const rows = sheet.rows.map((row, ri) => {
    const cells = row.map((cell, ci) => {
      const ref = `${colName(ci)}${ri + 1}`
      const sAttr = cell.style ? ` s="${cell.style}"` : ''
      if (typeof cell.v === 'number' && Number.isFinite(cell.v)) return `<c r="${ref}"${sAttr}><v>${cell.v}</v></c>`
      return `<c r="${ref}" t="inlineStr"${sAttr}><is><t xml:space="preserve">${escapeXml(String(cell.v ?? ''))}</t></is></c>`
    }).join('')
    const ht = estimateRowHeight(row, sheet.colWeights)
    return `<row r="${ri + 1}" ht="${ht.toFixed(1)}" customHeight="1">${cells}</row>`
  }).join('')
  const colCount = Math.max(...sheet.rows.map(r => r.length), 1)
  const mergeRefs = sheet.rows
    .map((row, ri) => row.length === 1 && colCount > 1 ? `<mergeCell ref="A${ri + 1}:${colName(colCount - 1)}${ri + 1}"/>` : '')
    .filter(Boolean)
  const merges = mergeRefs.length ? `<mergeCells count="${mergeRefs.length}">${mergeRefs.join('')}</mergeCells>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rows}</sheetData>${merges}</worksheet>`
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B6B62"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>`

export const XLSX_STYLE_HEADER = 1
export const XLSX_STYLE_META = 2
export const XLSX_STYLE_WRAP = 3

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const names = sheets.map(s => sanitizeSheetName(s.name))
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  return zipStore([
    {name: '[Content_Types].xml', data: encoder.encode(contentTypes)},
    {name: '_rels/.rels', data: encoder.encode(rootRels)},
    {name: 'xl/workbook.xml', data: encoder.encode(workbook)},
    {name: 'xl/styles.xml', data: encoder.encode(STYLES_XML)},
    {name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRels)},
    ...sheets.map((s, i) => ({name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(s))})),
  ])
}

// --- ReportDoc -> sheets -------------------------------------------------------
// Sections with a table get their own sheet; line-only sections stack on «Сводка».
export function sheetsFromDoc(doc: ReportDoc): XlsxSheet[] {
  const meta: XlsxCell[][] = [
    [{v: doc.title, style: XLSX_STYLE_HEADER}],
    [{v: doc.subtitle, style: XLSX_STYLE_META}],
    [{v: doc.disclaimer, style: XLSX_STYLE_META}],
    [{v: `Сформировано ${doc.generatedAt} · Tekton OS`, style: XLSX_STYLE_META}],
    [{v: ''}],
  ]
  const summaryRows: XlsxCell[][] = [...meta]
  const sheets: XlsxSheet[] = []
  for (const section of doc.sections) {
    if (section.table && section.table.rows.length) {
      const rows: XlsxCell[][] = [[{v: section.heading, style: XLSX_STYLE_HEADER}],
        section.table.columns.map(c => ({v: c.header, style: XLSX_STYLE_HEADER})),
        ...section.table.rows.map(r => r.map(v => ({v: typeof v === 'number' ? v : String(v ?? ''), style: XLSX_STYLE_WRAP})))]
      sheets.push({name: sanitizeSheetName(section.heading.replace(/:\s*\d+$/, '')), rows, colWeights: section.table.columns.map(c => c.weight ? c.weight * 9 : 9)})
    } else {
      summaryRows.push([{v: section.heading, style: XLSX_STYLE_HEADER}], ...(section.lines || []).map(l => [{v: l, style: XLSX_STYLE_WRAP}] as XlsxCell[]), [{v: ''}])
    }
  }
  sheets.unshift({name: 'Сводка', rows: summaryRows, colWeights: [60]})
  return sheets
}
