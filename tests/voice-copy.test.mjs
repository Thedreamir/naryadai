import test from 'node:test'
import assert from 'node:assert/strict'
import {voiceError,voiceErrorText,voicePrivacyNote,voiceConsentLabel,voiceAskFailed} from '../src/lib/voice-copy.mjs'
import {recognitionError} from '../src/lib/voice-input.mjs'
test('every voice error class has RU and KZ text',()=>{for(const code of ['unsupported','permission','microphone','network','silent','language','aborted','unknown']){const pair=voiceErrorText[code];assert.ok(pair&&pair[0]&&pair[1],code);assert.notEqual(pair[0],pair[1],code)}})
test('every browser recognition error maps to existing copy',()=>{for(const raw of ['not-allowed','service-not-allowed','audio-capture','network','no-speech','language-not-supported','aborted','anything-else'])assert.ok(voiceError(recognitionError(raw),false),raw)})
test('unknown code falls back to unknown copy',()=>{assert.equal(voiceError('wat',false),voiceErrorText.unknown[0]);assert.equal(voiceError('wat',true),voiceErrorText.unknown[1])})
test('kz flag picks Kazakh text',()=>{assert.match(voiceError('permission',true),/Микрофон/);assert.match(voiceError('permission',false),/микрофону/);assert.ok(voiceError('permission',true)!==voiceError('permission',false))})
test('privacy copy never claims offline or on-device recognition',()=>{for(const s of [...voicePrivacyNote,...voiceConsentLabel])assert.doesNotMatch(s,/офлайн|оффлайн|on-device|локально|жергілікті/i)})
test('privacy copy forbids secrets and states no audio storage in both languages',()=>{assert.match(voicePrivacyNote[0],/секреты/);assert.match(voicePrivacyNote[0],/не сохраняет аудио/);assert.match(voicePrivacyNote[1],/Құпия/);assert.match(voicePrivacyNote[1],/аудионы сақтамайды/)})
test('consent is explicit opt-in wording in both languages',()=>{assert.match(voiceConsentLabel[0],/^Разрешаю/);assert.match(voiceConsentLabel[1],/рұқсат беремін$/)})
test('ask failure suggests retry without blaming the user in both languages',()=>{assert.match(voiceAskFailed[0],/попробуйте ещё раз/);assert.match(voiceAskFailed[1],/қайта көріңіз/)})
