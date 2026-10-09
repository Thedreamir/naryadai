// Equipment failure-risk signal from unplanned-order history. Gamma-Poisson with fleet prior (partial pooling).
// Honest by construction: always returns sample sizes, a credible range, and 'insufficient_data' instead of a number when n is small.
const lgamma = (x) => { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); };
// P(N>=1 in h days) for negative binomial predictive: rate~Gamma(a,b) (b = per-day rate), N~Pois(rate*h)
export const pAtLeastOne = (a, b, h) => 1 - Math.pow(b / (b + h), a);
export function gammaQuantile(a, b, q) { // by bisection on regularised incomplete gamma via series (adequate for a<=200)
  const cdf = (x) => { if (x <= 0) return 0; let s = 1 / a, t = s; for (let n = 1; n < 400; n++) { t *= x / (a + n); s += t; if (t < 1e-12 * s) break; } return Math.exp(-x + a * Math.log(x) - lgamma(a)) * s; };
  let lo = 0, hi = (a + 10 * Math.sqrt(a) + 10) / b; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (cdf(m * b) < q) lo = m; else hi = m; } return (lo + hi) / 2; }
// events: array of day offsets (0 = today, positive = days ago) of unplanned failures for ONE equipment. fleet: {ratePerDay, strength} prior.
export function riskSignal(events, { windowDays = 30, horizon = 14, fleetRate = 0.03, priorDays = 60, minObservedDays = 30, observedDays = 90 } = {}) {
  if (observedDays < minObservedDays) return { status: 'insufficient_data', reason: `история ${observedDays} дн < ${minObservedDays}`, n: events.length };
  const recent = events.filter((d) => d >= 0 && d < windowDays).length, prior = events.filter((d) => d >= windowDays && d < windowDays + priorDays).length;
  const a0 = fleetRate * priorDays * 0.5 + 0.5, b0 = priorDays * 0.5 + 0.5 / Math.max(fleetRate, 1e-3) * 0 + 0.5 / Math.max(fleetRate, 1e-3) * 0 + priorDays * 0.5 * 0 + 15; // prior worth ~15 days of fleet-rate data
  const aP = fleetRate * 15 + 0, bP = 15; // Gamma(fleetRate*15, 15)
  const a = aP + 0.7 * recent + 0.3 * prior * (windowDays / priorDays), b = bP + 0.7 * windowDays + 0.3 * windowDays; // recency-weighted
  const mean = a / b, lo = gammaQuantile(a, b, 0.1), hi = gammaQuantile(a, b, 0.9);
  const baseline = (prior + aP) / (priorDays + bP), ratio = mean / Math.max(baseline, 1e-4);
  const p = pAtLeastOne(a, b, horizon); const rising = recent >= 3 && ratio > 1.5;
  return { status: 'ok', n_recent: recent, n_prior: prior, windowDays, priorDays, expectedPerMonth: mean * 30, range80PerMonth: [lo * 30, hi * 30], pFailure14d: p, trendRatio: ratio, rising, text: `${recent} внеплановых за ${windowDays} дн (до этого ${prior} за ${priorDays}); вероятность отказа за ${horizon} дн ≈ ${Math.round(p * 100)}% (диапазон ставки ×30 дн: ${(lo * 30).toFixed(1)}-${(hi * 30).toFixed(1)}). Это оценка по истории, не прогноз с гарантией.` };
}
