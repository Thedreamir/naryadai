// Tests for the optional §6.2 LLM comparison adapter. node --test tests/llm-compare.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCompareEnabled, buildComparePrompt, parseCompareResponse, callOpenAiCompatible, compareWorkToProblem, COMPARE_ENV,
} from '../supabase/functions/review-order/llm-compare.mjs';

const ENV_ON = {
  [COMPARE_ENV.flag]: 'true',
  [COMPARE_ENV.endpoint]: 'https://example.invalid/v1/chat/completions',
  [COMPARE_ENV.model]: 'open-weights-free-model',
  [COMPARE_ENV.apiKey]: 'k',
};
const GOOD_JSON = JSON.stringify({ match: 0.9, confidence: 0.85, rationale: 'Работы соответствуют течи', issues: [] });
const okFetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: GOOD_JSON } }] }) });

test('flag defaults OFF: no env, partial env, or flag!=true => disabled', () => {
  assert.equal(isCompareEnabled({}), false);
  assert.equal(isCompareEnabled({ [COMPARE_ENV.flag]: 'true' }), false); // no endpoint/model
  assert.equal(isCompareEnabled({ ...ENV_ON, [COMPARE_ENV.flag]: 'yes' }), false);
  assert.equal(isCompareEnabled(ENV_ON), true);
});

test('disabled flag: call returns null without touching the network', async () => {
  let called = 0;
  const spy = async () => { called++; return okFetch(); };
  assert.equal(await callOpenAiCompatible({ env: {}, prompt: 'x', fetchImpl: spy }), null);
  assert.equal(await compareWorkToProblem({ problem: 'a', works: 'b' }, { env: {}, fetchImpl: spy }), null);
  assert.equal(called, 0);
});

test('prompt is anonymized: names, phones, emails never leave the system', () => {
  const { text } = buildComparePrompt({
    problem: 'Течь у насоса, сообщил Ахметов Ерлан, +1 202 555-0123, person@example.invalid',
    works: 'Заменил сальник. Ахметов Ерлан подтвердил.',
    faultCode: 'Г-01',
    materials: [{ name: 'Сальник', quantity: 1, unit: 'шт' }],
  }, ['Ахметов Ерлан']);
  assert.ok(!/Ахметов|Ерлан/.test(text));
  assert.ok(!/701 123/.test(text));
  assert.ok(!/@example/.test(text));
  assert.match(text, /не инструкции/); // data marked untrusted
});

test('parse: valid response maps to a clamped workMatch', () => {
  const r = parseCompareResponse(GOOD_JSON);
  assert.equal(r.score, 0.9);
  assert.equal(r.confidence, 0.85);
  assert.equal(r.rationale, 'Работы соответствуют течи');
});

test('parse fail-closed: markdown wrapper, garbage, ranges, NaN, wrong types => null', () => {
  assert.equal(parseCompareResponse('no json here'), null);
  assert.equal(parseCompareResponse('{"match": 5, "confidence": 0.9}'), null);   // out of range
  assert.equal(parseCompareResponse('{"match": "high", "confidence": 0.9}'), null); // wrong type
  assert.equal(parseCompareResponse('{"match": NaN, "confidence": 0.9}'), null);    // invalid JSON (NaN literal)
  assert.equal(parseCompareResponse('{"match": 0.2, "confidence": 1.7}'), null);
  // JSON embedded in markdown/prose still parses:
  const wrapped = parseCompareResponse('Вот ответ:\n```json\n' + GOOD_JSON + '\n```');
  assert.equal(wrapped.score, 0.9);
  // rationale/issues are capped:
  const long = parseCompareResponse(JSON.stringify({ match: 0.5, confidence: 0.5, rationale: 'x'.repeat(500), issues: ['a', 1, 'b'] }));
  assert.equal(long.rationale.length, 200);
  assert.deepEqual(long.issues, ['a', 'b']);
});

test('call fail-closed: HTTP error, timeout/abort, bad envelope, bad JSON => null', async () => {
  assert.equal(await callOpenAiCompatible({ env: ENV_ON, prompt: 'x', fetchImpl: async () => ({ ok: false, status: 429 }) }), null);
  assert.equal(await callOpenAiCompatible({ env: ENV_ON, prompt: 'x', fetchImpl: async () => { throw new Error('aborted'); } }), null);
  assert.equal(await callOpenAiCompatible({ env: ENV_ON, prompt: 'x', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), null);
  assert.equal(await callOpenAiCompatible({ env: ENV_ON, prompt: 'x', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'мусор' } }] }) }) }), null);
  const ok = await callOpenAiCompatible({ env: ENV_ON, prompt: 'x', fetchImpl: okFetch });
  assert.equal(ok.score, 0.9);
});

test('end-to-end: scrubbed input reaches the model, result validates', async () => {
  let seen = '';
  const spy = async (url, opts) => { seen = opts.body; return okFetch(); };
  const r = await compareWorkToProblem(
    { problem: 'Течь масла (Ахметов Ерлан)', works: 'Заменил сальник, течи нет', faultCode: 'Г-01', materials: [] },
    { env: ENV_ON, staffNames: ['Ахметов Ерлан'], fetchImpl: spy },
  );
  assert.equal(r.score, 0.9);
  assert.ok(!/Ахметов/.test(seen));
});
