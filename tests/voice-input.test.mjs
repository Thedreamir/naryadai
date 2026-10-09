import test from 'node:test'
import assert from 'node:assert/strict'
import {createDictation,speechLanguage,recognitionError,masterVoiceHint} from '../src/lib/voice-input.mjs'
function fixture({prefixed=false,throws=false}={}){
 const instances=[],texts=[],states=[],errors=[]
 class Recognition {constructor(){instances.push(this)} start(){if(throws)throw Error('start')}stop(){this.stopped=true}abort(){this.aborted=true}}
 const host={[prefixed?'webkitSpeechRecognition':'SpeechRecognition']:Recognition}
 const d=createDictation({host,lang:'kk-KZ',onText:x=>texts.push(x),onState:x=>states.push(x),onError:x=>errors.push(x)})
 return {d,instances,texts,states,errors}
}
const result=(text,final=true)=>Object.assign([{transcript:text}],{isFinal:final})
test('language selection requests kk-KZ or ru-RU only',()=>{assert.equal(speechLanguage('kz'),'kk-KZ');assert.equal(speechLanguage('ru'),'ru-RU');assert.equal(speechLanguage('en'),'ru-RU')})
test('unsupported browser returns an explicit text fallback error',()=>{let error;const d=createDictation({host:{},lang:'ru-RU',onText(){assert.fail()},onState(){},onError:x=>error=x});assert.equal(d.start(),false);assert.equal(error,'unsupported')})
test('prefixed browser and bounded settings work',()=>{const f=fixture({prefixed:true});assert.equal(f.d.start(),true);const r=f.instances[0];assert.equal(r.lang,'kk-KZ');assert.equal(r.continuous,false);assert.equal(r.interimResults,false)})
test('interim results cannot change report text',()=>{const f=fixture();f.d.start();f.instances[0].onresult({results:[result('unsafe interim',false)]});assert.deepEqual(f.texts,[])})
test('only final trimmed results, deduplicated by index',()=>{const f=fixture();f.d.start();const event={results:[result('  Сальник заменён '),result(' ')],resultIndex:0};f.instances[0].onresult(event);f.instances[0].onresult(event);assert.deepEqual(f.texts,['Сальник заменён'])})
test('new session can deliver new results at same index',()=>{const f=fixture();f.d.start();f.instances[0].onresult({results:[result('first')]});f.instances[0].onend();f.d.start();f.instances[1].onresult({results:[result('second')]});assert.deepEqual(f.texts,['first','second'])})
test('double start cannot open parallel microphones',()=>{const f=fixture();f.d.start();assert.equal(f.d.start(),false);assert.equal(f.instances.length,1)})
test('stop asks browser to stop and allows its last final result',()=>{const f=fixture();f.d.start();f.d.stop();assert.equal(f.instances[0].stopped,true);f.instances[0].onresult({results:[result('final')]});f.instances[0].onend();assert.deepEqual(f.texts,['final']);assert.equal(f.states.at(-1),false)})
test('dispose detaches all handlers and aborts microphone',()=>{const f=fixture();f.d.start();const r=f.instances[0],late=r.onresult;f.d.dispose();late({results:[result('late')]});assert.deepEqual(f.texts,[]);assert.equal(r.aborted,true);assert.equal(r.onresult,null)})
test('stale result from older session cannot change draft',()=>{const f=fixture();f.d.start();const late=f.instances[0].onresult;f.instances[0].onend();f.d.start();late({results:[result('stale')]});assert.deepEqual(f.texts,[])})
test('permission error is explicit and ends session',()=>{const f=fixture();f.d.start();f.instances[0].onerror({error:'not-allowed'});assert.deepEqual(f.errors,['permission']);assert.equal(f.states.at(-1),false);assert.equal(f.d.start(),true)})
test('aborted session gives no spurious error',()=>{const f=fixture();f.d.start();f.instances[0].onerror({error:'aborted'});assert.deepEqual(f.errors,[])})
test('synchronous start exception does not leave listening state',()=>{const f=fixture({throws:true});assert.equal(f.d.start(),false);assert.equal(f.states.at(-1),false);assert.equal(f.instances[0].aborted,true);assert.deepEqual(f.errors,['unknown'])})
test('all browser error classes mapped safely',()=>{for(const [code,mapped] of Object.entries({'audio-capture':'microphone',network:'network','no-speech':'silent','language-not-supported':'language',wat:'unknown'}))assert.equal(recognitionError(code),mapped)})
test('hint cites available reasons and reserves decision to master',()=>{const x=masterVoiceHint({closure:{works:'Done',photos:['x']},ai_result:{reasons:['Нет шифра']}});assert.match(x,/Нет шифра/);assert.match(x,/решает мастер/);assert.doesNotMatch(x,/Фото после ремонта отсутствует/)})
test('missing data is stated, no invented confirmation',()=>{const x=masterVoiceHint({});assert.match(x,/Описание выполненных работ отсутствует/);assert.match(x,/Фото после ремонта отсутствует/);assert.match(x,/не проверяет безопасность/)})
