// Tekton OS — AI order review edge function (case «НарядAI» §6.2–6.4).
// Master triggers after the worker pressed «Исполнено»; the verdict is stored in
// orders.ai_result and archived in ai_reviews. Final word stays with the master
// (trigger 005: only human_score/human_comment may be added at closing).
//
// Local candidate: rules by default, opt-in loopback open model, final master decision.
// Work/problem lexical matching is not an LLM check. Visual repair acceptance
// is not implemented; supplied-byte dedupe/timestamps do not prove capture.
// Low confidence and unavailable visual checks require master review.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { reviewOrder, scrubText, completionTimeFromEvents, intakePhotosToEvidence } from './review-core.mjs';
import {compareWithLocalModel} from './local-model.mjs';
import {advisoryGuards} from './evidence-lane/advisory-guards.mjs';
import { REVIEW_CONFIG } from './review-config.mjs';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('PWA_ORIGIN') || '',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Vary': 'Origin',
};

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');

async function sha256OfDataUri(uri: string): Promise<string | null> {
  const m = String(uri).match(/^data:image\/[a-z]+;base64,(.+)$/i);
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return await hex(await crypto.subtle.digest('SHA-256', bytes));
  } catch { return null; }
}

Deno.serve(async req => {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const reply = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers });
  try {
    const token = req.headers.get('Authorization');
    if (!token) return reply({ error: 'authentication required' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } } });
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return reply({ error: 'invalid session' }, 401);
    const { data: employee } = await db.from('employees').select('role,is_active').eq('id', user.id).single();
    if (!employee || employee.is_active !== true || !['master', 'admin'].includes(employee.role)) return reply({ error: 'master required' }, 403);

    // NOTE: the request body deliberately carries no photo_layer — see header.
    const { id, version } = await req.json();
    const { data: o, error } = await db.from('orders').select('*').eq('id', id).single();
    if (error || !o) return reply({ error: 'order unavailable' }, 404);
    if (o.status !== 'completed' || o.version !== version) return reply({ error: 'order version/status changed' }, 409);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Evidence gathering -----------------------------------------------------
    const { data: events, error: eventsError } = await admin.from('order_events').select('new_status, created_at, reason').eq('order_id', id).order('created_at');
      if (eventsError) throw new Error('EVIDENCE_UNAVAILABLE:events');
    const chronology = (events ?? []).map((e: any) => `${String(e.created_at).slice(11, 16)} ${e.new_status}${e.reason ? ` (${e.reason})` : ''}`);
    // Completion time = the worker's «Исполнено» event of the current cycle.
    // Null when unknown — time and photo-freshness checks then report
    // "not verified" instead of silently using the review time.
    const completedAt = completionTimeFromEvents(events ?? []);
    // Active minutes: only in-progress intervals, pauses excluded, capped at completion.
    let activeMin: number | null = null;
    {
      let acc = 0, start: number | null = null;
      for (const e of events ?? []) {
        const t = new Date(e.created_at).getTime();
        if (isNaN(t)) continue;
        if (e.new_status === 'in_progress' && start == null) start = t;
        if (e.new_status !== 'in_progress' && start != null) { acc += t - start; start = null; }
      }
      if (start != null && completedAt) acc += completedAt.getTime() - start;
      if (acc > 0) activeMin = Math.round(acc / 60000);
    }

    // After-photo hashes (data URIs) + metadata from order_photos.
    // Own photos are fetched uncapped (a capped global window could drop them);
    // the duplicate sweep across other orders is capped at the latest 1000.
    const { data: ownRowsRaw, error: ownPhotosError } = await admin.from('order_photos').select('sha256, captured_at, server_received_at, kind').eq('order_id', id);
      if (ownPhotosError) throw new Error('EVIDENCE_UNAVAILABLE:ownRowsRaw');
    const ownRows = ownRowsRaw ?? [];
    const uriHashes: (string | null)[] = [];
    for (const uri of Array.isArray(o.closure?.photos) ? o.closure.photos : []) uriHashes.push(await sha256OfDataUri(uri));
    // Duplicate sweep: indexed equality on the current after-hashes (photos_hash_idx),
    // not a capped global scan.
    let otherHashes: { order_id: any; sha256: string }[] = [];
    const afterHashes = uriHashes.filter((h): h is string => !!h);
    if (afterHashes.length) {
      const { data: foreignRows, error: foreignPhotosError } = await admin.from('order_photos').select('order_id, sha256').in('sha256', afterHashes).neq('order_id', id);
      if (foreignPhotosError) throw new Error('EVIDENCE_UNAVAILABLE:foreignRows');
      otherHashes = foreignRows ?? [];
    }
    const photos = uriHashes.filter((h): h is string => h !== null).map((h: string) => {
      const row = ownRows.find((r: any) => r.sha256 === h);
      return { sha256: h, captured_at: row?.captured_at ?? null, uploaded_at: row?.server_received_at ?? null };
    });
    // "Before" photos: ONLY explicit kind='before' rows plus independently
    // hashed orders.before_photos. No time-based inference: the frontend
    // uploads after photos BEFORE the completed transition, so any timestamp
    // heuristic misclassifies them as before photos. The upload path MUST set
    // kind='before'|'after' (migration 063 adds the column).
    const beforeHashes: string[] = ownRows.filter((r: any) => r.kind === 'before').map((r: any) => r.sha256);
    for (const uri of Array.isArray(o.before_photos) ? o.before_photos : []) {
      const h = await sha256OfDataUri(uri);
      if (h) beforeHashes.push(h);
    }
    // Intake evidence: photos of the fault taken at issue time live in
    // order_intake_photos with a phase/status lifecycle (builder's table).
    // The pure adapter decides what counts as "before" evidence; intake
    // captured_at also enriches the after-photo metadata by hash.
    const { data: intakeRows, error: intakeError } = await admin.from('order_intake_photos')
      .select('order_id, phase, status_at_upload, sha256, captured_client_at, server_received_at').eq('order_id', id);
    if (intakeError) throw new Error('EVIDENCE_UNAVAILABLE:intake');
    const intake = intakePhotosToEvidence(intakeRows, id);
    for (const h of intake.before_hashes) if (!beforeHashes.includes(h)) beforeHashes.push(h);
    for (const ph of photos) {
      const m = intake.photos_meta.find(x => x.sha256 === ph.sha256);
      if (m && !ph.captured_at) ph.captured_at = m.captured_at;
    }

    // Norms, fault codes, and history -----------------------------------------
    const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
    let workNormMin: number | null = null;
    try {
      const { data: norms, error: normsError } = await admin.from('work_norms').select('work_type, norm_minutes');
      if (normsError) throw new Error('EVIDENCE_UNAVAILABLE:norms');
      const tN = norm(String(o.title ?? ''));
      const hit = (norms ?? []).find((n: any) => tN.includes(norm(n.work_type)));
      if (hit) workNormMin = hit.norm_minutes;
    } catch { throw new Error('EVIDENCE_UNAVAILABLE:norms'); }

    const { data: faultRows, error: faultsError } = await admin.from('fault_codes').select('code');
      if (faultsError) throw new Error('EVIDENCE_UNAVAILABLE:faultRows');
    const knownFaultCodes = (faultRows ?? []).map((f: any) => f.code);

    const materialStats: Record<string, { median: number; samples: number }> = {};
    try {
      const { data: past, error: historyError } = await admin.from('orders').select('closure').eq('equipment_id', o.equipment_id).eq('status', 'closed').neq('id', id).limit(200);
      if (historyError) throw new Error('EVIDENCE_UNAVAILABLE:past');
      const byMat: Record<string, number[]> = {};
      for (const p of past ?? []) {
        for (const m of Array.isArray(p?.closure?.materials) ? p.closure.materials : []) {
          const k = String(m?.name ?? '').toLowerCase();
          const q = Number(m?.quantity);
          if (k && Number.isFinite(q) && q > 0) (byMat[k] ??= []).push(q);
        }
      }
      for (const [k, arr] of Object.entries(byMat)) {
        arr.sort((a, b) => a - b);
        materialStats[k] = { median: arr[Math.floor(arr.length / 2)], samples: arr.length };
      }
    } catch { throw new Error('EVIDENCE_UNAVAILABLE:material_history'); }

    // Depersonalisation: scrub staff names from any text sent to the model.
    const { data: people, error: peopleError } = await admin.from('employees').select('name');
      if (peopleError) throw new Error('EVIDENCE_UNAVAILABLE:people');
    const names = (people ?? []).map((p: any) => p.name);

    // Unit lookup for materials.
    const { data: matRef, error: materialsError } = await admin.from('materials').select('name, unit');
      if (materialsError) throw new Error('EVIDENCE_UNAVAILABLE:matRef');
    const unitOf = (n: string) => (matRef ?? []).find((m: any) => m.name === n)?.unit ?? '';

    const closure = {
      works: String(o.closure?.works ?? ''),
      fault_code: String(o.closure?.fault_code ?? ''),
      materials: (Array.isArray(o.closure?.materials) ? o.closure.materials : []).map((m: any) => ({ name: m?.name, quantity: m?.quantity, unit: m?.unit ?? unitOf(String(m?.name ?? '')) })),
      comment: o.closure?.comment,
    };

    // Layer-2 work/problem match (model, optional) ---------------------------
    const llmPayload = {
      problem: scrubText(o.title, names),
      works: scrubText(closure.works, names),
      fault_code: scrubText(closure.fault_code,names),
      materials: closure.materials.map((m: any) => ({ name: scrubText(m.name,names), quantity: m.quantity, unit: scrubText(m.unit,names) })),
    };
    const cacheHash = await hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(llmPayload) + REVIEW_CONFIG.promptVersion + (Deno.env.get('GEMINI_MODEL') ?? 'nomodel'))));
    // Server-owned scrubbed input, loopback only. Confidence capped advisory-only.
    const workMatch = await compareWithLocalModel({problem:llmPayload.problem,works:llmPayload.works,faultCode:llmPayload.fault_code,materials:llmPayload.materials},{staffNames:names,env:{AI_LLM_COMPARE_ENABLED:Deno.env.get('AI_LLM_COMPARE_ENABLED'),AI_COMPARE_ENDPOINT:Deno.env.get('AI_COMPARE_ENDPOINT'),AI_COMPARE_MODEL:Deno.env.get('AI_COMPARE_MODEL')}});

    // Review ------------------------------------------------------------------
    const result = reviewOrder({
      order: {
        id: o.id, title: o.title, kind: o.kind, priority: o.priority, deadline: o.deadline,
        created_at: o.created_at, started_at: o.started_at, completed_at: completedAt ? completedAt.toISOString() : null,
        active_minutes: activeMin,
        overdue_minutes: completedAt ? Math.max(0, Math.round((completedAt.getTime() - new Date(o.deadline).getTime()) / 60000)) : null,
        // Downtime: created->completed is NOT verified equipment downtime (builder finding).
        // No trustworthy source exists yet, so we pass null and the report omits the line.
        downtime_minutes: null,
      },
      closure,
      photos,
      history: {
        before_hashes: beforeHashes,
        other_hashes: otherHashes,
        material_stats: materialStats,
        work_norm_minutes: workNormMin,
        known_fault_codes: knownFaultCodes,
      },
      workMatch,
      photoLayer: null, // server-side wiring point for the photo module — see header
      chronology,
      now: new Date(),
    });

    const guardEvidence=advisoryGuards({problem:llmPayload.problem,work:llmPayload.works,materials:llmPayload.materials.map((m:any)=>m.name),photoInput:null});
    // No trusted bounded server pixel decoder in this edge path yet. Never accept client RGB/EXIF attestation.
    result.evidence_guards=guardEvidence;
    result.limitations.push(...guardEvidence.limitations);
    // Persist: order state (guarded by trigger 005) + audit row in ai_reviews.
    const { data: updated, error: updateError } = await admin.rpc('commit_ai_review',{p_id:id,p_version:version,p_actor:user.id,p_result:result});
    if (updateError || !updated) return reply({ error: 'review commit failed; refresh order' }, 409);
    return reply({ result, ...updated });

  } catch (e) {
    if (String(e).includes('EVIDENCE_UNAVAILABLE:')) return reply({ error: 'required evidence unavailable', code: 'EVIDENCE_UNAVAILABLE' }, 503);
    console.error('Review request failed', String(e));
    return reply({ error: 'review request failed' }, 400);
  }
});
