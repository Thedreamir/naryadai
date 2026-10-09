import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {pairingLink,validToken,alive,pendingReady,createResult} from '../src/components/telegram-pairing-state.mjs';
import {privateStart,hashToken,makeBindingToken} from '../supabase/functions/_shared/telegram-core.mjs';
const token='A'.repeat(43),p={id:'00000000-0000-0000-0000-000000000001',pending_chat:'123',confirmed:false,expires_at:'2099-01-01T00:00:00Z'};
test('link only known bot and token',()=>{assert.equal(pairingLink(token),`https://t.me/TektonOSdreamlabs_bot?start=${token}`);for(const bad of ['','A'.repeat(42),token+'?x','https://evil.test'])assert.throws(()=>pairingLink(bad))});
test('expires at boundary',()=>{assert.equal(alive('2026-01-01',Date.parse('2026-01-01')),false);assert.equal(alive('invalid'),false);assert.equal(alive(p.expires_at),true)});
test('confirmation requires valid unexpired own pending',()=>{assert.equal(pendingReady(p),true);for(const change of [{confirmed:true},{pending_chat:'-10'},{pending_chat:'123x'},{expires_at:'2000-01-01'},{id:'other'}])assert.equal(pendingReady({...p,...change}),false)});
test('create result validates expiry',()=>{assert.equal(createResult(p),p.expires_at);assert.throws(()=>createResult({id:p.id,expires_at:'invalid'}))});
test('random token and hash',async()=>{const a=makeBindingToken(),b=makeBindingToken();assert.equal(validToken(a),true);assert.notEqual(a,b);assert.match(await hashToken(a),/^[0-9a-f]{64}$/);await assert.rejects(()=>hashToken('bad'))});
const update={update_id:1,message:{chat:{type:'private',id:123},from:{id:123,is_bot:false},text:'/start '+token}};
test('bare start ignored, token start accepted',()=>{assert.equal(privateStart({...update,message:{...update.message,text:'/start'}}),null);assert.equal(privateStart(update).chatId,'123')});
test('ignore group, bot, mismatched identity and malformed update',()=>{for(const m of [{...update.message,chat:{type:'group',id:123}},{...update.message,from:{id:123,is_bot:true}},{...update.message,from:{id:124,is_bot:false}},{...update.message,text:'/start '+token+' extra'}])assert.equal(privateStart({...update,message:m}),null);assert.equal(privateStart({...update,update_id:1.5}),null)});

test('current status checks persistent connection, active caller and visible bounded polling',async()=>{
 const {readFileSync}=await import('node:fs');const sql=readFileSync('supabase/migrations/078_telegram_current_status.sql','utf8');assert.match(sql,/telegram_connections where employee_id=owner and revoked_at is null/);assert.match(sql,/active actor required/);
 const ui=readFileSync('src/components/TelegramPairing.tsx','utf8');assert.match(ui,/setInterval\(check,60000\)/);assert.match(ui,/document.visibilityState==='hidden'/);assert.match(ui,/p\?\.connected===true/);assert.match(ui,/clearInterval\(timer\)/)
})
