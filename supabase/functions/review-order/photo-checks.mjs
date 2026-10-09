// Hash/metadata checks for photos (case 6.3 item 1). NOT vision: nothing here looks at what the photo shows.
// Pure functions, no I/O. Client computes sha256 + dHash + EXIF time; server re-validates with this module.
export const FRESH_MAX_MIN = 30, DUP_HAMMING = 6, SKEW_MIN = 5;

export function hamming64(a, b) { // a,b: 16-char hex
  let x = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}
/** Client helper: 9x8 grayscale pixel array (72 numbers, row-major) -> 16-hex dHash. */
export function dhashFromGray9x8(g) {
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (g[y * 9 + x + 1] > g[y * 9 + x] ? 1n : 0n);
  return bits.toString(16).padStart(16, "0");
}
const mins = (a, b) => (a - b) / 60000;
const validHex = (s, n) => typeof s === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(s);

/** photo: {id, sha256, dhash, takenAt?(ISO), uploadedAt(ISO)} | null.
 *  history: earlier photos (other orders too): [{id, orderId, sha256, dhash}].
 *  Returns {status: ok|warn|review|missing, flags[], reasons[] (Russian)}. */
export function checkPhoto(photo, { closedAt, history = [] }) {
  if (!photo) return { status: "missing", flags: ["no_photo"], reasons: ["Фото не приложено"] };
  const flags = [], reasons = [];
  if (!validHex(photo.sha256, 64) || !validHex(photo.dhash, 16)) return { status: "review", flags: ["bad_hash"], reasons: ["Не удалось проверить файл: нет корректных отпечатков"] };
  const closed = Date.parse(closedAt), up = Date.parse(photo.uploadedAt), taken = photo.takenAt ? Date.parse(photo.takenAt) : NaN;
  if (Number.isNaN(closed) || Number.isNaN(up)) return { status: "review", flags: ["bad_time"], reasons: ["Нет времени закрытия или загрузки"] };
  if (!Number.isNaN(taken) && taken > up + SKEW_MIN * 60000) return {status:"review",flags:["future_time"],reasons:["Время съёмки позже загрузки"]};
  if (up > closed + SKEW_MIN * 60000 || (!Number.isNaN(taken) && taken > closed + SKEW_MIN * 60000)) return {status:"review",flags:["after_closure"],reasons:["Время файла позже закрытия"]};
  if (Number.isNaN(taken)) {
    flags.push("no_exif"); reasons.push("Время съёмки не найдено, использовано время загрузки (слабее)");
    if (mins(closed, up) > FRESH_MAX_MIN) { flags.push("stale"); reasons.push("Загружено задолго до закрытия"); }
  } else if (taken > up + SKEW_MIN * 60000) { flags.push("future_time"); reasons.push("Время съёмки позже загрузки: часы телефона неверны"); }
  else if (mins(closed, taken) > FRESH_MAX_MIN) { flags.push("stale"); reasons.push(`Снято за ${Math.round(mins(closed, taken))} мин до закрытия`); }
  for (const h of history) {
    if (h.id === photo.id) continue;
    if (h.sha256 === photo.sha256) { flags.push("exact_duplicate"); reasons.push(`Тот же файл, что фото ${h.id}`); break; }
    if (validHex(h.dhash, 16) && hamming64(h.dhash, photo.dhash) <= DUP_HAMMING) { flags.push("near_duplicate"); reasons.push(`Очень похоже на фото ${h.id}`); break; }
  }
  const hard = ["exact_duplicate", "near_duplicate", "stale", "future_time"];
  return { status: hard.some((f) => flags.includes(f)) ? "review" : flags.length ? "warn" : "ok", flags, reasons };
}

/** Pair presence + before-vs-after reuse. before is required only if one existed at issue time. */
export function checkPair({ before, after, beforeRequired = false, closedAt, history = [] }) {
  const a = checkPhoto(after, { closedAt, history });
  const r = { after: a, before: before ? "present" : beforeRequired ? "missing" : "none", flags: [...a.flags], reasons: [...a.reasons] };
  if (before && after && validHex(before.sha256,64) && validHex(after.sha256,64) && before.sha256 === after.sha256) { r.flags.push("same_as_before"); r.reasons.push("Фото «после» совпадает с фото «до»"); }
  else if (before && after && validHex(before.dhash, 16) && validHex(after.dhash, 16) && hamming64(before.dhash, after.dhash) <= 2) { r.flags.push("looks_same_as_before"); r.reasons.push("Фото «после» почти не отличается от «до» (возможно, одно и то же)"); }
  if (r.before === "missing") { r.flags.push("before_missing"); r.reasons.push("Нет фото «до», хотя оно было при выдаче"); }
  r.status = a.status === "missing" ? "missing" : (r.flags.some((f) => ["same_as_before", "looks_same_as_before", "before_missing"].includes(f)) && a.status !== "review") ? "review" : a.status;
  return r;
}
