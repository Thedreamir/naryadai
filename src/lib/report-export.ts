// Explicit allowlist only. No emails, credentials, photo URLs or free-text closure.
export function csvCell(value:unknown):string {
 let s=value===null||value===undefined?'':String(value)
 if(/^[\s]*[=+@-]/.test(s))s="'"+s
 return '"'+s.replaceAll('"','""')+'"'
}
export function reportCsv(headers:string[],rows:unknown[][]):string {
 return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'
}
export function closedOrderCsv(orders:any[],bounds:{since:string,until:string}):string {
 const lo=Date.parse(bounds.since),hi=Date.parse(bounds.until)
 const selected=orders.filter(o=>o.status==='closed'&&Date.parse(o.closed_at)>=lo&&Date.parse(o.closed_at)<hi).sort((a,b)=>Number(a.id)-Number(b.id))
 return reportCsv(['Синтетический отчёт','Период от (включительно)','Период до (не включительно)','Наряд','Оборудование','Участок','Исполнитель','Дата закрытия','Оценка мастера'],selected.map(o=>['Не аттестация персонала',bounds.since,bounds.until,o.id,o.equipment,o.section,o.assignee,o.closed_at,o.ai_result?.human_score??'']))
}
export function ratingCsv(rows:any[],bounds:{since:string,until:string}):string {
 return reportCsv(['Синтетический рейтинг','Период от (включительно)','Период до (не включительно)','Исполнитель','Балл','Доступно факторов','Качество','В срок','Без доработок','Объём','Без отказов'],rows.map(r=>['Не аттестация персонала',bounds.since,bounds.until,r.name,r.total,r.factors_available,r.f_quality,r.f_ontime,r.f_rework,r.f_volume,r.f_rejects]))
}
