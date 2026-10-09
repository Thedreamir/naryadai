// Lane 13: pure photo provenance audit. Server receipt time is NOT capture time.
// No EXIF parsing, no image decoding, no vision/API calls. Client-supplied
// captured_at/EXIF values are never trusted; capture time is always 'unknown'.
import{createHash}from'node:crypto'
export const PROVENANCE_SCHEMA='photo-provenance-v1'
const SHA=/^[a-f0-9]{64}$/
const DATA=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/
const ms=v=>{if(v==null||v==='')return NaN;const t=typeof v==='number'?v:Date.parse(v);return Number.isFinite(t)?t:NaN}
const PHASES=['before','after']
export function sha256OfDataUri(uri){
 const m=typeof uri==='string'&&uri.length<=400000?DATA.exec(uri):null
 if(!m)return null
 const b=Buffer.from(m[1],'base64')
 if(b.length<3||b.length>290000||b[0]!==0xff||b[1]!==0xd8||b[2]!==0xff)return null
 return{sha256:createHash('sha256').update(b).digest('hex'),byteSize:b.length}
}
function checkReceipt(r,order){
 const f=[]
 if(!r||typeof r!=='object')return['receipt_malformed']
 const sha=r.sha256,at=ms(r.received_at??r.serverReceivedAt),ph=r.phase,by=r.uploaded_by??r.uploadedBy
 if(!SHA.test(sha||''))f.push('receipt_hash_invalid')
 if(!PHASES.includes(ph))f.push('receipt_phase_invalid')
 if(!Number.isFinite(at))f.push('receipt_time_invalid')
 if(String(r.order_id??r.orderId)!==String(order.id))f.push('receipt_order_mismatch')
 if(!order.assignee_id||by!==order.assignee_id)f.push('receipt_uploader_not_assignee')
 const mt=r.mime_type??r.mimeType;if(mt!=null&&mt!=='image/jpeg')f.push('receipt_mime_not_canonical')
 const bs=r.byte_size??r.byteSize;if(bs!=null&&!(Number.isInteger(bs)&&bs>=1&&bs<=290000))f.push('receipt_size_invalid')
 if(!(r.decoder_version??r.decoder))f.push('receipt_decoder_missing')
 return f
}
// order: {id,assignee_id,created_at,started_at,closed_at?,closure:{photos:[dataUri]}}
// receipts: canonical_photo_evidence rows (server-written only)
// otherOrderReceipts: receipts of other orders for hash reuse (optional)
export function auditPhotoProvenance(order,{receipts=[],otherOrderReceipts=[],clientClaims=[]}={}){
 if(!order||order.id==null)throw Error('order required')
 const created=ms(order.created_at),started=ms(order.started_at),closed=ms(order.closed_at)
 const photos=[];const orderFlags=new Set()
 const byHash=new Map()
 for(const r of receipts){const k=(r&&r.sha256)+'|'+(r&&r.phase);if(!byHash.has(k))byHash.set(k,r)}
 const seenAfter=new Set()
 const uris=Array.isArray(order.closure?.photos)?order.closure.photos:[]
 for(const uri of uris){
  const d=sha256OfDataUri(uri)
  const e={sha256:d?.sha256??null,byteSize:d?.byteSize??null,phase:'after',tier:'untrusted',trusted:false,captureTime:'unknown',serverReceivedAt:null,findings:[]}
  if(!d){e.tier='invalid';e.findings.push('not_canonical_jpeg')}
  else{
   if(seenAfter.has(d.sha256))e.findings.push('duplicate_within_order');seenAfter.add(d.sha256)
   const r=byHash.get(d.sha256+'|after')
   if(!r)e.findings.push('no_server_receipt')
   else{
    const bad=checkReceipt(r,order);e.findings.push(...bad)
    const rb=r.byte_size??r.byteSize;if(rb!=null&&rb!==d.byteSize)e.findings.push('receipt_size_mismatch')
    const at=ms(r.received_at??r.serverReceivedAt);e.serverReceivedAt=Number.isFinite(at)?new Date(at).toISOString():null
    if(Number.isFinite(at)){
     if(Number.isFinite(created)&&at<created)e.findings.push('received_before_order_created')
     if(Number.isFinite(started)&&at<started)e.findings.push('after_received_before_work_started')
     if(Number.isFinite(closed)&&at>closed)e.findings.push('received_after_order_closed')
    }
    if(!e.findings.some(x=>x.startsWith('receipt_')||x==='received_before_order_created'||x==='after_received_before_work_started'||x==='received_after_order_closed'))
     {e.tier='server_received';e.trusted=true}
   }
   const reuse=otherOrderReceipts.filter(o=>o&&o.sha256===d.sha256&&String(o.order_id??o.orderId)!==String(order.id))
   if(reuse.length){e.findings.push('same_bytes_on_other_order');e.reusedOnOrders=[...new Set(reuse.map(o=>String(o.order_id??o.orderId)))].sort()}
  }
  if(e.tier!=='server_received')e.trusted=false
  photos.push(e)
 }
 const before=[]
 for(const r of receipts.filter(r=>r&&r.phase==='before')){
  const e={sha256:r.sha256??null,phase:'before',tier:'untrusted',trusted:false,captureTime:'unknown',serverReceivedAt:null,findings:checkReceipt(r,order)}
  const at=ms(r.received_at??r.serverReceivedAt);e.serverReceivedAt=Number.isFinite(at)?new Date(at).toISOString():null
  if(Number.isFinite(at)&&Number.isFinite(started)&&at>started)e.findings.push('before_received_after_work_started')
  if(Number.isFinite(at)&&Number.isFinite(created)&&at<created)e.findings.push('received_before_order_created')
  if(!e.findings.length){e.tier='server_received';e.trusted=true}
  before.push(e)
 }
 if(receipts.some(r=>r&&r.phase==='after'&&r.sha256&&!photos.some(p=>p.sha256===r.sha256)))orderFlags.add('receipt_without_closure_photo')
 const claims=clientClaims.filter(c=>c&&c.captured_at!=null)
 if(claims.length)orderFlags.add('client_capture_claim_ignored')
 const afterTrusted=photos.some(p=>p.trusted)
 if(!uris.length)orderFlags.add('no_after_photo')
 if(uris.length&&!afterTrusted)orderFlags.add('no_trusted_after_receipt')
 if(!before.some(b=>b.trusted))orderFlags.add('no_trusted_before_receipt')
 const unknowns=['Время съёмки неизвестно: сервер фиксирует только время получения.','EXIF не использовался и не подтверждает съёмку или ремонт.']
 return{schema:PROVENANCE_SCHEMA,orderId:order.id,captureTime:'unknown',after:photos,before,orderFlags:[...orderFlags].sort(),
  summary:{afterCount:photos.length,afterServerReceived:photos.filter(p=>p.trusted).length,beforeServerReceived:before.filter(b=>b.trusted).length},
  unknowns,limitations:'Время получения сервером не равно времени съёмки. Аудит не подтверждает содержимое, качество ремонта или подлинность сцены.'}
}
