// No network connector and no production writes. v1 transfers synthetic records only.
export const VERSION = 'tekton.erp.v1';
export const ORDER_FIELDS = ['order_id','equipment_id','status','kind','priority','created_at','closed_at','fault_code','works','materials_json'];
export const EQUIPMENT_FIELDS = ['erp_equipment_id','name','section_ref'];
export class ErpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (message) => { throw new ErpError(400, message); };
export function positiveId(value, label='id') {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(`Invalid ${label}`);
  return Number(value);
}
export function pageOptions(params) {
  const cursor = params.get('cursor') === null ? 0 : positiveId(params.get('cursor'),'cursor');
  const limit = params.get('limit') === null ? 100 : positiveId(params.get('limit'),'limit');
  if (limit > 500) fail('limit must be 1..500');
  const format = params.get('format') || 'json';
  if (!['json','csv'].includes(format)) fail('format must be json or csv');
  return {cursor, limit, format};
}
export function mapClosedOrder(order) {
  if (order.status !== 'closed') throw new ErpError(500, 'Source returned a non-closed order');
  for (const field of ['created_at','closed_at']) if (!order[field] || !Number.isFinite(Date.parse(order[field]))) throw new ErpError(500, `Source missing ${field}`);
  const closure = order.closure || {};
  return {order_id:positiveId(order.id),equipment_id:positiveId(order.equipment_id),status:'closed',kind:order.kind,priority:order.priority,
    created_at:new Date(order.created_at).toISOString(),closed_at:new Date(order.closed_at).toISOString(),
    fault_code:String(closure.fault_code || ''),works:String(closure.works || ''),materials_json:JSON.stringify((closure.materials || []).map(m=>({name:String(m.name||''),quantity:m.quantity,unit:String(m.unit||'')})))};
}
// Spreadsheet formula protection applies to every string, including leading whitespace.
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/u.test(s) || /^[\t\r\n]/u.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"','""')}"`;
}
export function toCsv(rows, fields) {
  return '\uFEFF' + [fields.map(csvCell).join(','),...rows.map(row=>fields.map(k=>csvCell(row[k])).join(','))].join('\r\n') + '\r\n';
}
export function parseCsv(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1_000_000) fail('CSV too large');
  text=text.replace(/^\uFEFF/,'');
  const rows=[]; let row=[],cell='',quoted=false,afterQuote=false;
  const pushCell=()=>{row.push(cell);cell='';afterQuote=false;};
  const pushRow=()=>{pushCell();if(row.some(x=>x!==''))rows.push(row);row=[];};
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=ch;continue;}
    if(ch===',' ){pushCell();continue;}
    if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
    if(afterQuote)fail('Unexpected content after CSV quote');
    if(ch==='"'){if(cell!=='')fail('Unexpected CSV quote');quoted=true;}else cell+=ch;
  }
  if(quoted)fail('Unclosed CSV quote');
  if(cell!==''||row.length||afterQuote)pushRow();
  if(!rows.length)fail('CSV header required');
  const header=rows.shift();
  if(header.length!==EQUIPMENT_FIELDS.length||header.some((v,i)=>v!==EQUIPMENT_FIELDS[i]))fail('Equipment CSV header mismatch');
  return rows.map(values=>{if(values.length!==header.length)fail('CSV column count mismatch');return Object.fromEntries(header.map((k,i)=>[k,values[i]]));});
}
export function validateImport(payload) {
  if(!payload||payload.schema_version!==VERSION)fail('schema_version mismatch');
  if(payload.source!=='synthetic')fail('Only synthetic imports permitted');
  const rows=payload.format==='csv'?parseCsv(payload.csv):payload.format==='json'?payload.records:null;
  if(!Array.isArray(rows)||rows.length<1||rows.length>500)fail('1..500 equipment records required');
  const seen=new Set();
  const records=rows.map((row,i)=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!EQUIPMENT_FIELDS.includes(k)))fail(`Unexpected fields at row ${i+1}`);
    const clean={};
    for(const k of EQUIPMENT_FIELDS){const value=row[k];if(typeof value!=='string'||!value.trim()||value.length>(k==='name'?200:64)||/[\x00-\x1F\x7F]/.test(value))fail(`Invalid ${k} at row ${i+1}`);clean[k]=value.trim();}
    if(!/^[A-Za-z0-9_.:-]+$/.test(clean.erp_equipment_id)||!/^[A-Za-z0-9_.:-]+$/.test(clean.section_ref))fail(`Invalid reference at row ${i+1}`);
    if(seen.has(clean.erp_equipment_id))fail('Duplicate ERP equipment id');seen.add(clean.erp_equipment_id);return clean;
  });
  return records;
}
