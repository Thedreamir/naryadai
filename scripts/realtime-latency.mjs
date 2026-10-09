// Measures how long a status change made by one session takes to arrive at another session over Supabase realtime.
// Case target: 5 seconds. Uses synthetic test accounts only; credentials come from the environment, never from this file.
//
// Required env:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   project URL and anon key
//   MASTER_EMAIL, MASTER_PASSWORD               master test account
//   WORKER_EMAIL, WORKER_PASSWORD               worker test account assigned to ORDER_ID
//   ORDER_ID                                    id of a synthetic test order the worker can read
// Optional: RUNS (default 10)
//
// Each run: the master session updates the order title (a harmless column); the worker session, subscribed to public.orders,
// reports when the change event arrives. This measures transport latency only, not a full status transition.
import { createClient } from '@supabase/supabase-js'

const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'MASTER_EMAIL', 'MASTER_PASSWORD', 'WORKER_EMAIL', 'WORKER_PASSWORD', 'ORDER_ID']
const missing = need.filter(k => !process.env[k])
if (missing.length) { console.error('Missing env: ' + missing.join(', ')); process.exit(2) }

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const runs = Number(process.env.RUNS || 10)
const orderId = Number(process.env.ORDER_ID)

async function session(email, password) {
  const c = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error('login failed for ' + email.split('@')[0] + ': ' + error.message)
  return c
}

const master = await session(process.env.MASTER_EMAIL, process.env.MASTER_PASSWORD)
const worker = await session(process.env.WORKER_EMAIL, process.env.WORKER_PASSWORD)

let pending = null
const ch = worker.channel('latency-check').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'id=eq.' + orderId }, payload => {
  if (pending) { pending.resolve(performance.now()); pending = null }
})
await new Promise((res, rej) => { ch.subscribe(s => { if (s === 'SUBSCRIBED') res(); if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') rej(new Error('subscribe ' + s)) }) })

const times = []
for (let i = 0; i < runs; i++) {
  const got = new Promise((resolve, reject) => { pending = { resolve }; setTimeout(() => reject(new Error('no event in 15 s')), 15000) })
  const t0 = performance.now()
  const { error } = await master.from('orders').update({ title: 'latency probe ' + i }).eq('id', orderId)
  if (error) { console.error('update failed: ' + error.message + ' (the master may need a different harmless field; adjust the probe)'); process.exit(1) }
  try { times.push((await got) - t0) } catch (e) { console.error('run ' + (i + 1) + ': ' + e.message); times.push(Infinity) }
  await new Promise(r => setTimeout(r, 1000))
}
await worker.removeChannel(ch)

const ok = times.filter(Number.isFinite).sort((a, b) => a - b)
const pct = p => ok.length ? ok[Math.min(ok.length - 1, Math.floor(p * ok.length))] : NaN
console.log(JSON.stringify({ runs, received: ok.length, lost: runs - ok.length, min_ms: Math.round(ok[0]), p50_ms: Math.round(pct(0.5)), p95_ms: Math.round(pct(0.95)), max_ms: Math.round(ok[ok.length - 1]), target_ms: 5000, within_target: ok.length === runs && ok[ok.length - 1] <= 5000 }, null, 2))
process.exit(ok.length === runs && ok[ok.length - 1] <= 5000 ? 0 : 1)
