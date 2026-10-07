// Hosted Supabase data layer. Same shapes the local /api server returns.
// Active only when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set at build time.
import {createClient, SupabaseClient} from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string|undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined
export const enabled = Boolean(url && key)
export const supabase: SupabaseClient|null = enabled ? createClient(url!, key!) : null

type AnyOrder = Record<string,any>

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('')
}

function dataUrlToBytes(dataUrl: string): {bytes: Uint8Array, mime: string} {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!m) throw new Error('Неверный формат фото')
  const bin = atob(m[2]); const bytes = new Uint8Array(bin.length)
  for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i)
  return {bytes, mime: m[1]}
}

export async function restoreSession(): Promise<boolean> {
  if (!supabase) return false
  const {data} = await supabase.auth.getSession()
  return Boolean(data.session)
}

export async function login(email: string, password: string) {
  if (!supabase) throw new Error('Supabase не настроен')
  const {error} = await supabase.auth.signInWithPassword({email, password})
  if (error) throw new Error('Вход не удался: проверьте логин и пароль')
}

export async function logout() { if (supabase) await supabase.auth.signOut() }

async function uid(): Promise<string> {
  const {data} = await supabase!.auth.getUser()
  if (!data.user) throw new Error('Сессия истекла. Войдите снова.')
  return data.user.id
}

export async function state() {
  const s = supabase!
  const myId = await uid()
  const [emp, orders, events, equipment, sections, faults, materials, notifications, norms] = await Promise.all([
    s.from('employees').select('*'),
    s.from('orders').select('*').eq('cancelled',false).order('id', {ascending:false}).limit(600),
    s.from('order_events').select('*').order('id', {ascending:false}).limit(2000),
    s.from('equipment').select('*'),
    s.from('sections').select('*'),
    s.from('fault_codes').select('*'),
    s.from('materials').select('*'),
    s.from('notifications').select('*').order('id', {ascending:false}).limit(20),
    s.from('work_norms').select('*'),
  ])
  for (const r of [emp,orders,equipment,sections,faults,materials]) if (r.error) throw new Error(r.error.message)
  const employees = emp.data||[]
  const byId: Record<string,any> = {}; employees.forEach(e=>byId[e.id]=e)
  const secById: Record<number,string> = {}; (sections.data||[]).forEach(x=>secById[x.id]=x.name)
  const eqById: Record<number,any> = {}; (equipment.data||[]).forEach(x=>eqById[x.id]={...x, section: secById[x.section_id]||''})
  const actor = byId[myId]
  if (!actor) throw new Error('У этой учётной записи нет карточки сотрудника')
  const ordersJoined: AnyOrder[] = (orders.data||[]).map((o:AnyOrder)=>({...o,
    equipment: eqById[o.equipment_id]?.name||'—', section: eqById[o.equipment_id]?.section||'—',
    assignee: byId[o.assignee_id]?.name||'—'}))
  // Worker declarations (pre_work recorded at start, etc.)
  try {
    const {data: declRows} = await s.from('order_declarations').select('*').order('id')
    for (const o of ordersJoined) (o as any).declarations = (declRows||[]).filter((r:any)=>r.order_id===o.id)
  } catch { for (const o of ordersJoined) (o as any).declarations = [] }
  // Intake (before) photos: own table, mint signed URLs best-effort.
  try {
    const {data: intakeRows} = await s.from('order_intake_photos').select('*').order('id')
    for (const o of ordersJoined) {
      const ips = (intakeRows||[]).filter((r:any)=>r.order_id===o.id)
      for (const p of ips) {
        try { const {data:sd} = await s.storage.from('repair-photos').createSignedUrl(String(p.storage_path||''), 3600); (p as any).url = sd?.signedUrl||null } catch { (p as any).url = null }
      }
      ;(o as any).intake_photos = ips
    }
  } catch { for (const o of ordersJoined) (o as any).intake_photos = [] }
  const eventsJoined = (events.data||[]).map((e:AnyOrder)=>({...e, actor: byId[e.actor_id]?.name||'—'}))
  let permits: any[] = []
  try { const {data: pr} = await s.from('employee_permits').select('*'); permits = pr||[] } catch { permits = [] }
  return {actor, orders: ordersJoined, employees, events: eventsJoined, permits,
    equipment: Object.values(eqById), fault_codes: faults.data||[], materials: materials.data||[],
    notifications: notifications.data||[], work_norms: norms.data||[], backend: 'Supabase · тестовый проект (синтетические данные)'}
}

export async function transition(id: number, x: {status:string,version:number,reason?:string,human_score?:number,closure?:any}) {
  const s = supabase!
  if (x.status === 'ai_review') return reviewOrder(id, x.version)
  let closure = x.closure
  const uploadedPaths: string[] = []
  const uploadedHashes: string[] = []
  if (x.status === 'completed' && closure) {
    // Validate before any upload: a rejected closure must not leave orphan photos or order_photos rows.
    const w = String(closure.works||'').trim()
    if (w.length < 12) throw new Error('Опишите выполненные работы: минимум 12 символов')
    if (!closure.fault_code) throw new Error('Укажите шифр неисправности')
    for (const m of (closure.materials||[])) {
      const q = Number(m?.quantity)
      if (!isFinite(q) || q <= 0) throw new Error(`Количество материала «${m?.name||'?'}» должно быть положительным числом`)
      if (q > 100000) throw new Error(`Количество материала «${m?.name||'?'}» слишком велико`)
    }
    const myId = await uid()
    const evidence = []
    const uploadOne = async (dataUrl: string, i: number, phase: string) => {
      const {bytes, mime} = dataUrlToBytes(dataUrl)
      if (bytes.length > 400000) throw new Error('Фото слишком большое')
      const hash = await sha256Hex(bytes)
      const ext = mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'
      const path = `${myId}/${id}-${Date.now()}-${phase}-${i}.${ext}`
      const up = await s.storage.from('repair-photos').upload(path, bytes, {contentType: mime})
      if (up.error) throw new Error('Фото не загрузилось в хранилище: '+up.error.message)
      const dup = await s.from('order_photos').select('order_id').eq('sha256', hash).neq('order_id', id).limit(1)
      const ins = await s.from('order_photos').insert({order_id: id, uploaded_by: myId, sha256: hash, byte_size: bytes.length, mime_type: mime})
      if (ins.error) throw new Error('Запись фото отклонена: '+ins.error.message)
      uploadedPaths.push(path); uploadedHashes.push(hash)
      return {sha256: hash, server_received_at: new Date().toISOString(), byte_size: bytes.length, phase,
        storage_path: path, duplicate_order_id: dup.data?.[0]?.order_id||null,
        limits: 'Время получения сервером, не доказательство времени съёмки'}
    }
    const photos: string[] = closure.photos||[]
    for (let i=0;i<photos.length;i++) evidence.push(await uploadOne(photos[i], i, 'after'))
    const beforePhotos: string[] = closure.before_photos||[]
    const beforeEvidence = []
    for (let i=0;i<beforePhotos.length;i++) beforeEvidence.push(await uploadOne(beforePhotos[i], i, 'before'))
    closure = {...closure, photo_evidence: evidence, client_recorded_at: new Date().toISOString()}
    if (beforeEvidence.length) closure = {...closure, before_photos: undefined, before_photo_evidence: beforeEvidence}
    if (evidence.some(p=>p.duplicate_order_id)) closure = {...closure, duplicate_warning: true}
  }
  if (x.status === 'completed' && closure && !(closure as any).client_recorded_at) closure = {...closure, client_recorded_at: new Date().toISOString()}
  const {data, error} = await s.rpc('transition_order', {order_id: id, target_status: x.status,
    expected_version: x.version, reason_text: x.reason||'', closure_data: closure??null,
    human_score: x.human_score??null, human_comment: ''})
  if (error) {
    // Garbage-collect photos uploaded for a rejected transition.
    for (const p of uploadedPaths) { try { await s.storage.from('repair-photos').remove([p]) } catch {} }
    for (const h of uploadedHashes) { try { await s.from('order_photos').delete().eq('order_id', id).eq('sha256', h) } catch {} }
    throw new Error(translateError(error.message))
  }
  return data
}

export async function recordPermit(id: number, x: {kind:string, note:string, version:number}) {
  const s = supabase!
  const {error} = await s.rpc('record_permit', {order_id: id, kind: x.kind, note: x.note, expected_version: x.version})
  if (error) throw new Error(translateError(error.message))
}

export async function savePushSubscription(sub: {endpoint:string, keys:{p256dh:string, auth:string}}) {
  const s = supabase!
  const myId = await uid()
  const {error} = await s.from('push_subscriptions').upsert(
    {user_id: myId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth},
    {onConflict: 'endpoint'})
  if (error) throw new Error('Подписка на push не сохранена: '+error.message)
}

export async function pinUnlock(email: string) {
  const s = supabase!
  const {data, error} = await s.rpc('pin_unlock', {employee_email: email})
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function markReportSeen(id: number) {
  const s = supabase!
  await s.rpc('mark_report_seen', {order_id: id})
}

async function reviewOrder(id: number, version: number) {
  const s = supabase!
  try {
    const {data, error} = await s.functions.invoke('review-order', {body: {id, version}})
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  } catch (e) {
    // The model/function path failed: run the same deterministic rule layer server-side.
    // Fails closed (needs_master) and the client never writes ai_result itself.
    const {data, error: fbError} = await s.rpc('review_fallback', {p_order_id: id, p_expected_version: version})
    if (fbError) throw new Error(translateError(fbError.message))
    return data
  }
}

export async function createOrder(x: {title:string,kind:string,equipment_id:number,assignee_id:string,priority:string,deadline:string,before_photos?:string[]}) {
  const s = supabase!
  const myId = await uid()
  const photos = (x.before_photos||[]).filter(p=>/^data:image\/(jpeg|jpg|png|webp);base64,/.test(p)).slice(0,2)
  const {error} = await s.from('orders').insert({title: x.title, kind: x.kind, equipment_id: x.equipment_id,
    assignee_id: x.assignee_id, master_id: myId, priority: x.priority, deadline: x.deadline, status: 'issued', before_photos: photos})
  if (error) throw new Error(translateError(error.message))
}

export async function repeatCheck(id: number, asOf?: string) {
  const s = supabase!
  const {data, error} = await s.rpc('repeat_check', {p_order_id: id, p_as_of: asOf??new Date().toISOString()})
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function repeatTop(since: string, until: string) {
  const s = supabase!
  const {data, error} = await s.rpc('repeat_top', {p_since: since, p_until: until, p_limit: 5})
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function report(since?: string, until?: string) {
  const s = supabase!
  let q = s.from('order_report').select('*')
  if (since) q = q.gte('created_at', since)
  if (until) q = q.lte('created_at', until)
  const {data: rows, error} = await q
  if (error) throw new Error(error.message)
  const {data: ratingsView, error: e2} = await s.from('employee_ratings').select('*')
  if (e2) throw new Error(e2.message)
  const {data: emps} = await s.from('employees').select('*').eq('role','worker')
  const fullById: Record<string,any> = {}; (ratingsView||[]).forEach(r=>fullById[r.id]=r)
  const byAssignee: Record<string,any> = {}
  for (const r of rows||[]) {
    if (r.status !== 'closed') continue
    const a = byAssignee[r.assignee_id] = byAssignee[r.assignee_id] || {closed:0, on_time:0, rework:0}
    a.closed++; if (r.on_time) a.on_time++; if (r.had_rework) a.rework++
  }
  const ratings = (emps||[]).map(e=>{
    const a = byAssignee[e.id] || {closed:0,on_time:0,rework:0}
    const score = a.closed ? Math.round((0.7*a.on_time/a.closed + 0.3*(1-a.rework/a.closed))*1000)/10 : null
    const full = fullById[e.id]
    return {id: e.id, name: e.name, closed: a.closed, on_time: a.on_time, rework: a.rework, score,
      full_score: full?.full_score ?? null, returned_or_repeated: full?.returned_or_repeated ?? 0,
      weighted_volume: full?.weighted_volume ?? 0}
  }).sort((a,b)=>(b.score??-1)-(a.score??-1))
  const matAgg: Record<string,{name:string,quantity:number,unit:string,orders:number}> = {}
  for (const r of rows||[]) {
    if (r.status !== 'closed' || !Array.isArray(r.materials)) continue
    for (const m of r.materials as any[]) {
      if (!m?.name) continue
      const key = m.name
      const a = matAgg[key] = matAgg[key] || {name: m.name, quantity: 0, unit: m.unit||'', orders: 0}
      a.quantity += Number(m.quantity)||0; a.orders++
    }
  }
  const materials = Object.values(matAgg).sort((a,b)=>b.quantity-a.quantity).slice(0,12)
  // Downtime: pair paused -> resume (in_progress) or terminal event per order; cap open pauses at now.
  let evQ = s.from('order_events').select('order_id,new_status,created_at').in('new_status',['paused','in_progress','completed','rework','rejected','closed']).order('created_at',{ascending:true}).limit(5000)
  if (since) evQ = evQ.gte('created_at', since)
  if (until) evQ = evQ.lte('created_at', until)
  const {data: ev} = await evQ
  const pauseStart: Record<number,string> = {}
  const downByOrder: Record<number,number> = {}
  let pauses = 0
  for (const e of ev||[]) {
    if (e.new_status==='paused') { pauseStart[e.order_id]=e.created_at; pauses++ }
    else if (pauseStart[e.order_id]) {
      const mins = Math.max(0,(new Date(e.created_at).getTime()-new Date(pauseStart[e.order_id]).getTime())/60000)
      downByOrder[e.order_id]=(downByOrder[e.order_id]||0)+mins
      delete pauseStart[e.order_id]
    }
  }
  const nowIso = new Date().toISOString()
  for (const [oid,ts] of Object.entries(pauseStart)) downByOrder[Number(oid)]=(downByOrder[Number(oid)]||0)+Math.max(0,(Date.now()-new Date(ts).getTime())/60000)
  const downtime_minutes = Math.round(Object.values(downByOrder).reduce((a,b)=>a+b,0))
  const downtime_top = Object.entries(downByOrder).map(([order_id,mins])=>({order_id:Number(order_id),minutes:Math.round(mins)})).sort((a,b)=>b.minutes-a.minutes).slice(0,5)
  const anomalies = {
    rework: (ev||[]).filter(e=>e.new_status==='rework').length,
    rejected: (ev||[]).filter(e=>e.new_status==='rejected').length,
    pauses,
  }
  return {rows: rows||[], ratings, materials, downtime_minutes, downtime_top, anomalies, full_rating_formula: 'Полный балл: 40% качество мастера + 25% в срок + 20% без повторов/доработок + 10% объём + 5% без отказов.'}
}

export async function pinLogin(email: string, pin: string) {
  const s = supabase!
  // text/plain body keeps the request preflight-free; the function ignores content-type
  const res = await fetch(`${url}/functions/v1/pin-login`, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify({email, pin})})
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.token_hash) throw new Error(data.error === 'pin locked, try later' ? 'ПИН временно заблокирован после 5 ошибок' : 'ПИН не подошёл')
  const {error: vErr} = await s.auth.verifyOtp({token_hash: data.token_hash, type: 'magiclink'})
  if (vErr) throw new Error(translateError(vErr.message))
}

export async function setHumanScore(id: number, score: number, comment: string) {
  const s = supabase!
  const {data, error} = await s.rpc('set_human_score', {p_order_id: id, p_score: score, p_comment: comment})
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function shiftSummary(stats: any) {
  const s = supabase!
  const {data, error} = await s.functions.invoke('shift-summary', {body: stats})
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function equipmentHistory(equipmentId: number) {
  const s = supabase!
  const {data, error} = await s.from('orders').select('id,created_at,status,closure').eq('equipment_id', equipmentId).order('created_at', {ascending:false}).limit(50)
  if (error) throw new Error(error.message)
  return {orders: (data||[]).map((o:AnyOrder)=>({id:o.id, created_at:o.created_at, status:o.status, fault_code:o.closure?.fault_code||null}))}
}

export function watch(onChange: ()=>void) {
  if (!supabase) return ()=>{}
  const ch = supabase.channel('orders-live').on('postgres_changes', {event:'*', schema:'public', table:'orders'}, ()=>onChange()).subscribe()
  return ()=>{ supabase!.removeChannel(ch) }
}

export function watchNotifications(onNew: (n:any)=>void) {
  if (!supabase) return ()=>{}
  const ch = supabase.channel('notifications-live').on('postgres_changes', {event:'INSERT', schema:'public', table:'notifications'}, (p:any)=>onNew(p.new)).subscribe()
  return ()=>{ supabase!.removeChannel(ch) }
}

function translateError(msg: string): string {
  if (msg.includes('actor required')) return 'Сессия не распознана. Войдите снова.'
  if (msg.includes('invalid status transition')) return 'Недопустимый переход статуса'
  if (msg.includes('assigned worker required')) return 'Действие доступно только назначенному исполнителю'
  if (msg.includes('already has an order in progress')) return 'У исполнителя уже есть наряд в работе: завершите его или поставьте на паузу'
  if (msg.includes('master')) return 'Действие доступно мастеру'
  if (msg.includes('reason required')) return 'Укажите причину'
  if (msg.includes('closure incomplete')) return 'Закрытие неполное: работы и шифр обязательны'
  if (msg.includes('after photo required')) return 'Для внепланового наряда нужно фото после'
  if (msg.includes('stale order version')) return 'Данные изменились. Обновите наряд'
  if (msg.includes('permit required')) return 'Сначала зафиксируйте допуск: «не требуется» или «подтверждён» с записью, кто и когда'
  if (msg.includes('permit note required')) return 'Укажите номер наряда-допуска и кто подтвердил (минимум 8 символов)'
  if (msg.includes('permit number required')) return 'Нужен номер наряда-допуска (хотя бы одна цифра)'
  if (msg.includes('permit confirmer required')) return 'Укажите, кто подтвердил допуск (текст)'
  if (msg.includes('permit already recorded')) return 'Допуск уже зафиксирован'
  if (msg.includes('permit window closed')) return 'Допуск фиксируется до начала работ'
  if (msg.includes('bad permit kind')) return 'Некорректный тип допуска'
  if (msg.includes('row-level security')) return 'Нет доступа к этой записи'
  return msg
}

export async function assistantChat(message: string, orderId?: number): Promise<{answer:string,sources:string[],mode:string,knowledge_used:boolean,fallback_reason?:string}> {
  const s = supabase!
  const {data, error} = await s.functions.invoke('assistant-chat', {body: {message, order_id: orderId ?? null}})
  if (error) throw new Error(translateError(error.message))
  if (data?.error) throw new Error(data.error)
  return data
}

export async function recordIntakePhoto(id: number, dataUrl: string): Promise<any[]> {
  const s = supabase!
  const myId = await uid()
  const {bytes, mime} = dataUrlToBytes(dataUrl)
  if (bytes.length > 400000) throw new Error('Фото слишком большое')
  const hash = await sha256Hex(bytes)
  const ext = mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'
  const path = `${myId}/${id}-intake-${Date.now()}.${ext}`
  const up = await s.storage.from('repair-photos').upload(path, bytes, {contentType: mime})
  if (up.error) throw new Error('Фото не загрузилось в хранилище: '+up.error.message)
  const {data, error} = await s.from('order_intake_photos').insert({order_id: id, uploaded_by: myId, storage_path: path, sha256: hash, byte_size: bytes.length, mime_type: mime, captured_client_at: new Date().toISOString()}).select().single()
  if (error) { try { await s.storage.from('repair-photos').remove([path]) } catch {} ; throw new Error(translateError(error.message)) }
  return data
}

export async function startWork(id: number, version: number, texts: string[]) {
  const s = supabase!
  const {data, error} = await s.rpc('start_work_with_declarations', {p_order_id: id, p_expected_version: version, p_texts: texts})
  if (error) throw new Error(translateError(error.message))
  return data
}
export async function recordDeclarations(orderId: number, phase: string, texts: string[]): Promise<void> {
  const s = supabase!
  const myId = await uid()
  const rows = texts.map(t => ({order_id: orderId, declared_by: myId, phase, text: t, confirmed: true}))
  const {error} = await s.from('order_declarations').insert(rows)
  if (error) throw new Error(translateError(error.message))
}

export async function ratings(since: string, until: string) {
  const s = supabase!
  const {data, error} = await s.rpc('worker_rating', {since, until})
  if (error) throw new Error(error.message)
  return data as any[]
}

export async function anomalies(since: string, until: string) {
  const s = supabase!
  const {data, error} = await s.rpc('anomaly_report', {since, until})
  if (error) throw new Error(error.message)
  return data as any[]
}

export async function refusalReviews() {
  const events=await supabase!.from('order_events').select('*').eq('new_status','rejected').order('created_at',{ascending:false}).limit(1000)
  const reviews=await supabase!.from('refusal_reviews').select('*')
  if(events.error) throw events.error; if(reviews.error) throw reviews.error
  return (events.data||[]).map(e=>({...e,review:(reviews.data||[]).find(r=>r.event_id===e.id)||null}))
}
export async function reviewRefusal(eventId:number,classification:'justified'|'unjustified',note:string) {
  const r=await supabase!.rpc('review_refusal',{p_event_id:eventId,p_classification:classification,p_note:note})
  if(r.error) throw new Error(r.error.code==='23505'?'Решение уже сохранено. Обновите список; повторная запись недоступна.':r.error.message)
}

export async function manageOrder(id:number,action:'reassign'|'priority'|'cancel',options:{assignee?:string,priority?:string,reason:string}) {
 const r=await supabase!.rpc('manage_order',{p_order_id:id,p_action:action,p_assignee:options.assignee||null,p_priority:options.priority||null,p_reason:options.reason})
 if(r.error) throw new Error(/reassign only/.test(r.error.message)?'Переназначить можно только выданный, ожидающий или отклонённый наряд.':/cancelled/.test(r.error.message)?'Наряд уже отменён.':r.error.message)
}

export async function repairMemory() {
  const r=await supabase!.from('repair_memory')
    .select('id,order_id,equipment_id,title,body,status,version,review_note,reviewed_at,created_at,author:employees!repair_memory_author_id_fkey(name),reviewer:employees!repair_memory_reviewed_by_fkey(name),order:orders!repair_memory_order_id_fkey(title),equipment:equipment!repair_memory_equipment_id_fkey(name)')
    .order('created_at',{ascending:false}).limit(200)
  if(r.error) throw r.error
  return r.data||[]
}
export async function reviewRepairMemory(id:number,action:'approve'|'reject'|'revoke',note:string,expectedVersion:number) {
  const r=await supabase!.rpc('review_repair_memory',{p_id:id,p_action:action,p_note:note,p_expected_version:expectedVersion})
  if(r.error) throw new Error(/version changed/.test(r.error.message)?'Запись изменилась. Обновите список перед решением.':/only candidate/.test(r.error.message)?'Запись уже рассмотрена. Обновите список.':/only approved/.test(r.error.message)?'Отозвать можно только утверждённую запись.':r.error.message)
}
