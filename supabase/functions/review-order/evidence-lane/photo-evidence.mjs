// Deterministic photo-evidence checks for work-order close-out. Dependency-free (node:crypto only).
// Pixels come in as 64x64 RGB Uint8Array (client canvas or sharp resize). The model (if any) is advisory;
// every number here is computed by code, so a photo or text cannot talk its way into a better score.
import { createHash } from 'node:crypto';
export const N = 64;
export const DEFAULTS = {
  reuseNcc: 0.985,          // aligned high-pass NCC >= this => reuse (calibrated by eval_visual.mjs)
  sameEquipNcc: 0.5,
  leakFixedRatio: 0.25, partialRatio: 0.75, debrisDelta: 0.012,
  minSharp: 6, minMean: 25, maxMean: 235, minStd: 6,
  freshBeforeStartMin: 10, freshAfterCloseMin: 5,
  abstainMargin: 0.15, debrisLum: 90,
};
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const lum = (rgb, i) => 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
export function gray(rgb) { const g = new Float32Array(N * N); for (let i = 0; i < N * N; i++) g[i] = lum(rgb, i); return g; }
function boxResize(g, w, h) { const o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const x0 = Math.floor(x * N / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * N / w)), y0 = Math.floor(y * N / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * N / h)); let s = 0, c = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += g[yy * N + xx]; c++; } o[y * w + x] = s / c; } return o; }
export function mirror(g) { const o = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o[y * N + x] = g[y * N + (N - 1 - x)]; return o; }
// 64-bit difference hash (+ 64-bit average hash) as BigInt pair
export function dHash(g) { const s = boxResize(g, 9, 8); let h = 0n; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (s[y * 9 + x] > s[y * 9 + x + 1] ? 1n : 0n); return h; }
export function aHash(g) { const s = boxResize(g, 8, 8); const m = s.reduce((a, b) => a + b, 0) / 64; let h = 0n; for (let i = 0; i < 64; i++) h = (h << 1n) | (s[i] > m ? 1n : 0n); return h; }
export function hamming(a, b) { let x = a ^ b, c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return c; }
export function fingerprint(rgb) { const g = gray(rgb); return { d: dHash(g), a: aHash(g), dm: dHash(mirror(g)), g32: g32(rgb) }; }
export function imageQuality(rgb, p = DEFAULTS) {
  const g = gray(rgb); const n = g.length; const mean = g.reduce((a, b) => a + b, 0) / n; let v = 0; for (const x of g) v += (x - mean) ** 2; const std = Math.sqrt(v / n);
  let lap = 0, lc = 0; for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const l = 4 * g[y * N + x] - g[y * N + x - 1] - g[y * N + x + 1] - g[(y - 1) * N + x] - g[(y + 1) * N + x]; lap += l * l; lc++; }
  const sharp = Math.sqrt(lap / lc); const bad = [];
  if (mean < p.minMean) bad.push('too_dark'); if (mean > p.maxMean) bad.push('overexposed'); if (std < p.minStd) bad.push('flat_or_blank'); else if (sharp < p.minSharp) bad.push('blurry');
  return { ok: bad.length === 0, mean, std, sharp, reasons: bad };
}
// ---- EXIF (JPEG APP1) minimal reader: DateTimeOriginal, DateTime, Software, Make
export function readExif(buf) {
  const out = { hasExif: false, dateTimeOriginal: null, dateTime: null, software: null, make: null };
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return out; let p = 2;
  while (p + 4 < buf.length) { if (buf[p] !== 0xff) break; const m = buf[p + 1]; const len = buf.readUInt16BE(p + 2);if(len<2||p+2+len>buf.length)return out;
    if (m === 0xe1 && buf.toString('latin1', p + 4, p + 8) === 'Exif') { const t = p + 10; const le = buf.toString('latin1', t, t + 2) === 'II';
      const u16 = (o) => le ? buf.readUInt16LE(t + o) : buf.readUInt16BE(t + o); const u32 = (o) => le ? buf.readUInt32LE(t + o) : buf.readUInt32BE(t + o);
      const str = (e) => { const n = u32(e + 4); const o = n > 4 ? u32(e + 8) : e + 8; return buf.toString('latin1', t + o, t + o + n).replace(/\0.*$/, ''); };
      const ifd = (o) => { const n = u16(o); let exifPtr = 0; for (let i = 0; i < n; i++) { const e = o + 2 + i * 12, tag = u16(e);
        if (tag === 0x9003) out.dateTimeOriginal = str(e); else if (tag === 0x0132) out.dateTime = str(e); else if (tag === 0x0131) out.software = str(e); else if (tag === 0x010f) out.make = str(e); else if (tag === 0x8769) exifPtr = u32(e + 8); }
        return exifPtr; };
      try { out.hasExif = true; const ptr = ifd(u32(4)); if (ptr) ifd(ptr); } catch { /* corrupt exif => treated as unknown */ }
      return out; }
    p += 2 + len; }
  return out;
}
const parseExifTime = (s) => { const m = s && /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(s); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; };
// Freshness. Weak by nature (EXIF is spoofable): use a server-stamped upload time as the anchor and EXIF only as a cross-check.
export function freshness(buf, { startedAt, closedAt, uploadedAt = closedAt }, p = DEFAULTS) {
  const ex = readExif(buf); const t = parseExifTime(ex.dateTimeOriginal || ex.dateTime); const flags = [];
  if (ex.software && /photoshop|gimp|lightroom|snapseed|picsart|canva/i.test(ex.software)) flags.push('edited_software');
  if (!t) return { status: flags.length ? 'suspicious' : 'unknown', flags: [...flags, ex.hasExif ? 'no_capture_time' : 'no_exif'], exif: ex };
  const ref = new Date(uploadedAt), start = new Date(startedAt);
  if (t > new Date(ref.getTime() + p.freshAfterCloseMin * 60000)) flags.push('capture_in_future');
  if (t < new Date(start.getTime() - p.freshBeforeStartMin * 60000)) flags.push('captured_before_work_started');
  const st = flags.includes('capture_in_future') || flags.includes('edited_software') ? 'suspicious' : flags.length ? 'stale' : 'ok';
  return { status: st, flags, exif: ex, captureTime: t.toISOString() };
}
DEFAULTS.freshAfterCloseMin = 5;
// Reuse against history (list of fingerprints) + exact byte hash
export function reuseCheck(buf, fp, history, p = DEFAULTS) {
  const h = sha256(buf); const q = fp.g32, qf = flip32(q); const exact = history.findIndex((x) => x.sha === h);
  if (exact >= 0) return { reuse: true, exact: true, ncc: 1, idx: exact, mirrored: false, sha: h };
  const coarse = history.map((x, i) => ({ i, n: Math.max(alignedNcc(x.fp.g32, q, { scales: [1], shift: 3, step: 1 }).ncc, alignedNcc(x.fp.g32, qf, { scales: [1], shift: 3, step: 1 }).ncc) })).sort((a, b) => b.n - a.n).slice(0, 3);
  let best = { ncc: -1, idx: -1, mirrored: false };
  for (const c of coarse) { const f = alignedNcc(history[c.i].fp.g32, q), m = alignedNcc(history[c.i].fp.g32, qf); const n = Math.max(f.ncc, m.ncc); if (n > best.ncc) best = { ncc: n, idx: c.i, mirrored: m.ncc > f.ncc }; }
  return { reuse: best.ncc >= p.reuseNcc, exact: false, ...best, sha: h };
}
// Same equipment? aligned structural correlation of the two photos (defect area is small so it survives repair)
export function sameEquipment(rgbB, rgbA, p = DEFAULTS) {
  const r = alignedNcc(g32(rgbB), g32(rgbA)); return { ncc: r.ncc, same: r.ncc >= p.sameEquipNcc, margin: Math.abs(r.ncc - p.sameEquipNcc) / 0.1 };
}
// Visible-defect score: fraction of pixels that look like wet leak (dark blue) or rust (orange-brown). Classical, synthetic-tuned.
export function defectFraction(rgb) { let c = 0; for (let i = 0; i < N * N; i++) { const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]; const leak = b > r + 35 && b > g + 20 && lum(rgb, i) < 140; const rust = r > g + 45 && g > b + 15 && r > 120; if (leak || rust) c++; } return c / (N * N); }
export function debrisFraction(rgb) { let c = 0, t = 0; for (let y = 38; y < N; y++) for (let x = 0; x < N; x++) { t++; if (lum(rgb, y * N + x) < DEFAULTS.debrisLum) c++; } return c / t; }
export function compareBeforeAfter(rgbB, rgbA, p = DEFAULTS, eqPre = null) {
  const eq = eqPre ? { ncc: eqPre.ncc, same: eqPre.ncc >= p.sameEquipNcc, margin: Math.abs(eqPre.ncc - p.sameEquipNcc) / 0.1 } : sameEquipment(rgbB, rgbA, p); const fB = defectFraction(rgbB), fA = defectFraction(rgbA); const flags = [], reasons = [];
  const debris = debrisFraction(rgbA) - debrisFraction(rgbB);
  if (!eq.same) return { verdict: 'wrong_equipment', score: 1, margin: eq.margin, needsMaster: false, flags: ['not_same_equipment'], reasons: ['После-фото не похоже на то же оборудование'], eq };
  if (fB < 0.004) return { verdict: 'unknown', score: 3, margin: 0, needsMaster: true, flags: ['no_visible_defect_in_before'], reasons: ['На «до» дефект не виден: нужна проверка мастером'], eq };
  const ratio = fA / fB; let verdict, score, margin;
  if (ratio <= p.leakFixedRatio) { verdict = 'fixed'; score = 5; margin = (p.leakFixedRatio - ratio) / 0.25; }
  else if (ratio <= p.partialRatio) { verdict = 'partial'; score = 3; margin = Math.min(ratio - p.leakFixedRatio, p.partialRatio - ratio) / 0.25; }
  else { verdict = 'not_fixed'; score = 1; margin = (ratio - p.partialRatio) / 0.25; }
  if (verdict === 'fixed' && debris > p.debrisDelta) { verdict = 'fixed_untidy'; score = 4; flags.push('debris_after'); reasons.push('Проблема устранена, но на «после» виден мусор/посторонние предметы'); }
  margin = Math.min(margin, eq.margin);
  const needsMaster = margin < p.abstainMargin; if (needsMaster) flags.push('low_confidence');
  return { verdict, score, margin, needsMaster, flags, reasons, ratio, eq, debris };
}
export function assessPhotos({ beforeRgb, afterRgb, afterJpeg, history = [], ctx }, p = DEFAULTS) {
  const res = { checks: {} }; const q = imageQuality(afterRgb, p); res.checks.quality = q;
  const fr = ctx ? freshness(afterJpeg, ctx, p) : { status: 'unknown', flags: ['no_context'] }; res.checks.freshness = fr;
  const ru = reuseCheck(afterJpeg, fingerprint(afterRgb), history, p); res.checks.reuse = ru;
  const flags = []; if (!q.ok) flags.push(...q.reasons.map((r) => 'photo_' + r)); if (ru.reuse) flags.push(ru.exact ? 'exact_reuse' : 'near_reuse'); flags.push(...fr.flags);
  if (!q.ok || ru.reuse || fr.status === 'suspicious' || fr.status === 'stale') return { ...res, verdict: 'needs_master', score: ru.reuse ? 1 : null, needsMaster: true, flags, reason: 'photo_integrity' };
  if (!beforeRgb) return { ...res, verdict: 'needs_master', score: null, needsMaster: true, flags: [...flags, 'no_before_photo'], reason: 'no_before' };
  const cmp = compareBeforeAfter(beforeRgb, afterRgb, p); res.checks.compare = cmp;
  const needs = cmp.needsMaster || fr.status === 'unknown';
  return { ...res, verdict: cmp.verdict, score: needs && cmp.verdict !== 'wrong_equipment' ? null : cmp.score, needsMaster: needs, flags: [...flags, ...cmp.flags], reason: 'visual' };
}

// ---- Aligned similarity: tolerates handheld shift / zoom / crop / brightness. Returns best normalised cross-correlation on 32x32 gray.
const W = 32;
function highpass(g) { const o = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < W) { s += g[yy * W + xx]; c++; } } o[y * W + x] = g[y * W + x] - s / c; } return o; }
export function g32(rgb) { return highpass(boxResize(gray(rgb), W, W)); }
function bil(g, x, y) { if (x < 0 || y < 0 || x > W - 1 || y > W - 1) return NaN; const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(W - 1, y0 + 1), fx = x - x0, fy = y - y0; return g[y0 * W + x0] * (1 - fx) * (1 - fy) + g[y0 * W + x1] * fx * (1 - fy) + g[y1 * W + x0] * (1 - fx) * fy + g[y1 * W + x1] * fx * fy; }
export function flip32(g) { const o = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) o[y * W + x] = g[y * W + W - 1 - x]; return o; }
export function alignedNcc(a, b, { scales = [0.89, 0.9, 0.91, 0.92, 0.96, 1, 1.04, 1.08, 1.09, 1.1, 1.11, 1.12], shift = 4, step = 1, coreOnly = true } = {}) {
  let best = { ncc: -1, s: 1, dx: 0, dy: 0 }; const lo = 5, hi = W - 5; const c = (W - 1) / 2;
  const ia = []; for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) ia.push(a[y * W + x]); const ma = ia.reduce((p, q) => p + q, 0) / ia.length; let va = 0; for (const v of ia) va += (v - ma) ** 2;
  for (const s of scales) for (let dy = -shift; dy <= shift; dy += step) for (let dx = -shift; dx <= shift; dx += step) {
    let sb = 0, sbb = 0, sab = 0, n = 0, i = 0; const buf = [];
    for (let y = lo; y < hi; y++) for (let x = lo; x < hi; x++) { const v = bil(b, (x - c) / s + c - dx, (y - c) / s + c - dy); if (Number.isNaN(v)) { n = -1; break; } buf.push(v); } 
    if (n === -1) continue; const mb = buf.reduce((p, q) => p + q, 0) / buf.length; let vb = 0, cab = 0; for (let k = 0; k < buf.length; k++) { vb += (buf[k] - mb) ** 2; cab += (buf[k] - mb) * (ia[k] - ma); }
    const ncc = cab / Math.sqrt(va * vb + 1e-9); if (ncc > best.ncc) best = { ncc, s, dx, dy };
  }
  return best;
}
