// Browser download helper for generated report bytes.
export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], {type: mime}))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const PDF_MIME = 'application/pdf'
