import {createClient} from '@supabase/supabase-js'
import assert from 'node:assert/strict'
const url=process.env.SUPABASE_URL,key=process.env.SB_ANON
const svc=createClient(url,process.env.SB_SERVICE),worker=createClient(url,key),master=createClient(url,key),leader=createClient(url,key)
await worker.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
await master.auth.signInWithPassword({email:'master@naryadai.test',password:process.env.PW_MASTER})
await leader.auth.signInWithPassword({email:'leader@naryadai.test',password:process.env.PW_LEADER})
let mid
try{
 const own=(await svc.from('orders').select('id').eq('assignee_id',(await worker.auth.getUser()).data.user.id).eq('status','closed').limit(1)).data[0].id
 const other=(await svc.from('orders').select('id').neq('assignee_id',(await worker.auth.getUser()).data.user.id).eq('status','closed').limit(1)).data[0].id
 const bad=await worker.rpc('propose_repair_memory',{p_order_id:other,p_title:'Чужой наряд',p_body:'попытка записи по чужому наряду не должна пройти'})
 assert(bad.error&&/own order/.test(bad.error.message));console.log('ok - worker cannot propose on foreign order')
 const p=await worker.rpc('propose_repair_memory',{p_order_id:own,p_title:'Замена сальника Н-5: сначала снять защиту',p_body:'Синтетическая заметка: после демонтажа защиты проверить посадку сальника и чистоту посадочного места перед запрессовкой.'})
 assert.ifError(p.error);mid=p.data;console.log('ok - candidate proposed, id',mid)
 const visible=await leader.from('repair_memory').select('*').eq('id',mid)
 assert.equal(visible.data[0].status,'candidate');console.log('ok - leader reads candidate (review surface)')
 const wApprove=await worker.rpc('review_repair_memory',{p_id:mid,p_action:'approve',p_expected_version:1});assert(wApprove.error);console.log('ok - worker cannot approve')
 const lApprove=await leader.rpc('review_repair_memory',{p_id:mid,p_action:'approve',p_expected_version:1});assert(lApprove.error);console.log('ok - leader cannot approve')
 const stale=await master.rpc('review_repair_memory',{p_id:mid,p_action:'approve',p_note:'stale',p_expected_version:99});assert(stale.error&&/version changed/.test(stale.error.message));console.log('ok - stale version rejected')
 const a=await master.rpc('review_repair_memory',{p_id:mid,p_action:'approve',p_note:'Синтетическая проверка мастера',p_expected_version:1});assert.ifError(a.error);console.log('ok - master approves with identity')
 const ans=await worker.functions.invoke('assistant-chat',{body:{message:'запрессовка посадочного места?'}})
 assert.ifError(ans.error);assert.match(ans.data.answer,/\[Память\]/);assert.match(ans.data.answer,/запрессовк/);console.log('ok - approved memory enters assistant retrieval:',ans.data.mode,ans.data.answer.slice(0,90))
 const rv=await master.rpc('review_repair_memory',{p_id:mid,p_action:'revoke',p_note:'Тест отзыва',p_expected_version:1});assert.ifError(rv.error)
 const ev=await master.from('repair_memory_events').select('event,actor_id,version,title,body').eq('memory_id',mid).order('id')
 assert.ifError(ev.error);const kinds=ev.data.map(e=>e.event)
 assert(kinds.includes('proposed')&&kinds.includes('approved')&&kinds.includes('revoked'),'audit events: '+kinds)
 assert(ev.data.every(e=>e.actor_id&&e.title&&e.body),'events keep actor+snapshot')
 const mst=(await master.auth.getUser()).data.user.id
 assert(ev.data.find(e=>e.event==='approved').actor_id===mst,'approve event actor is acting master')
 console.log('ok - audit events proposed/approved/revoked with actor+snapshot:',kinds.join(','))
 const long=await master.rpc('propose_repair_memory',{p_order_id:own,p_title:'X'.repeat(201),p_body:'Синтетическая проверка ограничения длины заголовка записи памяти.'});assert(long.error);console.log('ok - title length cap enforced')
 const ans2=await worker.functions.invoke('assistant-chat',{body:{message:'запрессовка посадочного места?'}})
 assert.ifError(ans2.error);assert.doesNotMatch(ans2.data.answer||'',/запрессовк/);console.log('ok - revoked memory removed from retrieval:',(ans2.data.answer||'').slice(0,70))
 const upd=await worker.rpc('update_repair_memory',{p_id:mid,p_title:'x'.repeat(10),p_body:'y'.repeat(30)});assert(upd.error);console.log('ok - revoked not editable')
}finally{
 if(mid)await svc.from('repair_memory').delete().eq('id',mid)
 await worker.auth.signOut();await master.auth.signOut();await leader.auth.signOut();console.log('ok - memory fixture cleaned')
}
