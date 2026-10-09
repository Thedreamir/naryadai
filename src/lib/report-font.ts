// Browser-side loader for the embedded report fonts (Inter subset, OFL).
// Node tests read the same files from public/fonts directly and pass base64 to report-pdf.
import type {ReportFonts} from './report-pdf.ts'

let cached: Promise<ReportFonts> | null = null

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Шрифт отчёта недоступен (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  return btoa(bin)
}

export function loadReportFonts(): Promise<ReportFonts> {
  if (!cached) cached = Promise.all([
    toBase64('/fonts/inter-tekton-subset-regular.ttf'),
    toBase64('/fonts/inter-tekton-subset-bold.ttf'),
  ]).then(([regular, bold]) => ({regular, bold})).catch(error => { cached = null; throw error })
  return cached
}
