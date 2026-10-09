// PDF rendering for ReportDoc via jsPDF with embedded Inter subset (Cyrillic + Kazakh + Latin).
// Free stack only: jsPDF (MIT) + Inter (OFL 1.1), subset stored in public/fonts/.
import {jsPDF} from 'jspdf'
import type {ReportDoc, DocTable} from './report-docs.ts'

export interface ReportFonts { regular: string; bold: string } // base64 TTF

const PAGE_W = 210, PAGE_H = 297, MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const INK: [number, number, number] = [32, 33, 36]
const MUTED: [number, number, number] = [110, 110, 104]
const LINE: [number, number, number] = [220, 220, 214]
const AMBER: [number, number, number] = [199, 126, 31]

function registerFonts(pdf: jsPDF, fonts: ReportFonts) {
  pdf.addFileToVFS('InterTektonSubset-Regular.ttf', fonts.regular)
  pdf.addFont('InterTektonSubset-Regular.ttf', 'InterTekton', 'normal')
  pdf.addFileToVFS('InterTektonSubset-Bold.ttf', fonts.bold)
  pdf.addFont('InterTektonSubset-Bold.ttf', 'InterTekton', 'bold')
}

class Cursor {
  pdf: jsPDF
  y = MARGIN
  page = 1
  constructor(pdf: jsPDF) { this.pdf = pdf }
  ensure(height: number) {
    if (this.y + height > PAGE_H - MARGIN - 8) {
      this.footer()
      this.pdf.addPage()
      this.page++
      this.y = MARGIN
    }
  }
  footer() {
    const font=this.pdf.getFont(),size=this.pdf.getFontSize(),color=this.pdf.getTextColor()
    this.pdf.setFont('InterTekton', 'normal')
    this.pdf.setFontSize(8)
    this.pdf.setTextColor(...MUTED)
    this.pdf.text(`Tekton OS · учебный набор · стр. ${this.page}`, PAGE_W - MARGIN, PAGE_H - 8, {align: 'right'})
    this.pdf.setFont(font.fontName,font.fontStyle);this.pdf.setFontSize(size);this.pdf.setTextColor(color)
  }
}

function wrap(pdf: jsPDF, text: string, width: number): string[] {
  return pdf.splitTextToSize(text, width) as string[]
}

function drawTable(cur: Cursor, table: DocTable) {
  const pdf = cur.pdf
  const totalWeight = table.columns.reduce((n, c) => n + (c.weight ?? 1), 0)
  const widths = table.columns.map(c => CONTENT_W * (c.weight ?? 1) / totalWeight)
  const lineH = 4.6, padX = 1.6, padY = 1.4
  const header = table.columns.map(c => c.header)
  const drawSegment=(wrapped:string[][],bold:boolean)=>{
    pdf.setFont('InterTekton',bold?'bold':'normal');pdf.setFontSize(9);pdf.setTextColor(...INK)
    const rowH=Math.max(1,...wrapped.map(w=>w.length))*lineH+padY*2
    wrapped.forEach((lines,i)=>{const x=widths.slice(0,i).reduce((n,w)=>n+w,MARGIN);const align=table.columns[i].align
      lines.forEach((line,li)=>{const tx=align==='right'?x+widths[i]-padX:align==='center'?x+widths[i]/2:x+padX
        pdf.text(line,tx,cur.y+padY+(li+.75)*lineH,{align:align==='right'?'right':align==='center'?'center':'left'})})})
    pdf.setDrawColor(...LINE);pdf.line(MARGIN,cur.y+rowH,PAGE_W-MARGIN,cur.y+rowH);cur.y+=rowH
  }
  pdf.setFont('InterTekton','bold');pdf.setFontSize(9)
  const wrappedHeader=header.map((c,i)=>wrap(pdf,c,widths[i]-padX*2))
  const headerHeight=Math.max(...wrappedHeader.map(w=>w.length))*lineH+padY*2
  const nextPage=()=>{cur.footer();pdf.addPage();cur.page++;cur.y=MARGIN;drawSegment(wrappedHeader,true)}
  cur.ensure(headerHeight+lineH+padY*2);drawSegment(wrappedHeader,true)
  for(const row of table.rows){
    pdf.setFont('InterTekton','normal');pdf.setFontSize(9)
    const wrapped=row.map((c,i)=>wrap(pdf,String(c??''),widths[i]-padX*2))
    let offset=0;const count=Math.max(1,...wrapped.map(w=>w.length))
    while(offset<count){
      let capacity=Math.floor((PAGE_H-MARGIN-8-cur.y-padY*2)/lineH)
      if(capacity<1){nextPage();capacity=Math.floor((PAGE_H-MARGIN-8-cur.y-padY*2)/lineH)}
      const take=Math.min(count-offset,capacity)
      drawSegment(wrapped.map(w=>w.slice(offset,offset+take)),false);offset+=take
      if(offset<count)nextPage()
    }
  }
  cur.y += 4
}

export function reportDocToPdf(doc: ReportDoc, fonts: ReportFonts): Uint8Array {
  const pdf = new jsPDF({unit: 'mm', format: 'a4', compress: true})
  registerFonts(pdf, fonts)
  const cur = new Cursor(pdf)
  pdf.setFont('InterTekton', 'bold')
  pdf.setFontSize(15)
  pdf.setTextColor(...INK)
  for (const line of wrap(pdf, doc.title, CONTENT_W)) { cur.ensure(8); pdf.text(line, MARGIN, cur.y + 5); cur.y += 7 }
  pdf.setFont('InterTekton', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  for (const line of wrap(pdf, doc.subtitle, CONTENT_W)) { cur.ensure(5); pdf.text(line, MARGIN, cur.y + 3.5); cur.y += 4.4 }
  pdf.setTextColor(...AMBER)
  for (const line of wrap(pdf, doc.disclaimer, CONTENT_W)) { cur.ensure(5); pdf.text(line, MARGIN, cur.y + 3.5); cur.y += 4.4 }
  pdf.setTextColor(...MUTED)
  pdf.setFontSize(8)
  pdf.text(`Сформировано ${doc.generatedAt}`, MARGIN, cur.y + 3.5)
  cur.y += 7
  pdf.setDrawColor(...LINE)
  pdf.line(MARGIN, cur.y, PAGE_W - MARGIN, cur.y)
  cur.y += 5
  for (const section of doc.sections) {
    cur.ensure(10)
    pdf.setFont('InterTekton', 'bold')
    pdf.setFontSize(11)
    pdf.setTextColor(...INK)
    for (const line of wrap(pdf, section.heading, CONTENT_W)) { cur.ensure(6); pdf.text(line, MARGIN, cur.y + 4.5); cur.y += 5.4 }
    cur.y += 1.5
    if (section.lines) {
      pdf.setFont('InterTekton', 'normal')
      pdf.setFontSize(9.5)
      pdf.setTextColor(...INK)
      for (const text of section.lines) {
        for (const line of wrap(pdf, text, CONTENT_W)) { cur.ensure(5); pdf.text(line, MARGIN, cur.y + 3.5); cur.y += 4.6 }
        cur.y += 1.2
      }
      cur.y += 2
    }
    if (section.table && section.table.rows.length) drawTable(cur, section.table)
  }
  cur.footer()
  return new Uint8Array(pdf.output('arraybuffer'))
}
