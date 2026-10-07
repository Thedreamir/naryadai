import {createClient} from '@supabase/supabase-js'
const U=process.env.SUPABASE_URL
const mk=(k)=>createClient(U,k,{auth:{persistSession:false}})
const svc=mk(process.env.SB_SERVICE),anon=mk(process.env.SB_ANON)
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+n+(d?' | '+d:''))}
const login=async(e,p)=>{const c=mk(process.env.SB_ANON);const{error}=await c.auth.signInWithPassword({email:e,password:p});if(error)throw error;return c}
const wa=await login('worker-a@naryadai.test',process.env.PW_WORKERA)
const wb=await login('worker-b@naryadai.test',process.env.PW_WORKERB)
const ms=await login('master@naryadai.test',process.env.PW_MASTER)
// find an order owned by worker-a in executed state
const{data:me}=await wa.auth.getUser()
const{data:ords}=await svc.from('orders').select('id,status').eq('assignee_id',me.user.id).in('status',['completed','ai_review','closed']).limit(1)
const oid=ords?.[0]?.id;ok('worker-a has executed order',!!oid,'order '+oid)
const T='[ТЕСТ 047 синтетика] '+Date.now()
const B='Синтетическая тестовая заметка для проверки журнала решений, не для поиска.'
// reject path (was broken: rejectd)
const{data:n1,error:e1}=await wa.rpc('propose_repair_memory',{p_order_id:oid,p_title:T,p_body:B})
ok('propose',!e1&&n1,e1?.message)
const{error:er}=await ms.rpc('review_repair_memory',{p_id:n1,p_action:'reject',p_note:'тест reject',p_expected_version:1})
ok('master reject succeeds',!er,er?.message)
const{data:row}=await svc.from('repair_memory').select('status').eq('id',n1).single()
ok('status rejected persisted',row?.status==='rejected',row?.status)
const{data:ev}=await svc.from('repair_memory_events').select('event').eq('memory_id',n1).order('id')
ok('journal has proposed,rejected',JSON.stringify(ev?.map(x=>x.event))==='["proposed","rejected"]',JSON.stringify(ev))
const{data:evA}=await wa.from('repair_memory_events').select('event').eq('memory_id',n1)
ok('author sees master decision on own note',evA?.some(x=>x.event==='rejected'),JSON.stringify(evA))
const{data:evB}=await wb.from('repair_memory_events').select('event').eq('memory_id',n1)
ok('other worker sees nothing',(evB||[]).length===0,String(evB?.length))
// approve + revoke events
const{data:n2}=await wa.rpc('propose_repair_memory',{p_order_id:oid,p_title:T+' b',p_body:B})
const{error:ea}=await ms.rpc('review_repair_memory',{p_id:n2,p_action:'approve',p_note:'',p_expected_version:1})
const{error:ev2}=await ms.rpc('review_repair_memory',{p_id:n2,p_action:'revoke',p_note:'тест',p_expected_version:1})
ok('approve then revoke',!ea&&!ev2,(ea||ev2)?.message)
// worker cannot review, reject of non-candidate fails, stale version fails
const{error:ew}=await wa.rpc('review_repair_memory',{p_id:n2,p_action:'approve',p_note:'',p_expected_version:1});ok('worker cannot review',!!ew)
const{error:enc}=await ms.rpc('review_repair_memory',{p_id:n1,p_action:'reject',p_note:'',p_expected_version:1});ok('re-reject denied',!!enc,enc?.message)
// edit approved denied; body limit
const{data:n3}=await wa.rpc('propose_repair_memory',{p_order_id:oid,p_title:T+' c',p_body:B})
await ms.rpc('review_repair_memory',{p_id:n3,p_action:'approve',p_note:'',p_expected_version:1})
const{error:eed}=await wa.rpc('update_repair_memory',{p_id:n3,p_title:T+' x',p_body:B+' правка'});ok('edit of approved denied',!!eed,eed?.message)
await ms.rpc('review_repair_memory',{p_id:n3,p_action:'revoke',p_note:'cleanup',p_expected_version:1})
const{error:big}=await wa.rpc('propose_repair_memory',{p_order_id:oid,p_title:T+' d',p_body:'я'.repeat(4001)});ok('body >4000 rejected',!!big)
const{error:sh}=await wa.rpc('propose_repair_memory',{p_order_id:oid,p_title:'ab',p_body:B});ok('short title rejected',!!sh)
// append-only
const{error:eu}=await svc.from('repair_memory_events').update({note:'x'}).eq('memory_id',n1);ok('journal UPDATE blocked even for service_role',!!eu,eu?.message)
const{error:ed}=await svc.from('repair_memory_events').delete().eq('memory_id',n1);ok('journal DELETE blocked even for service_role',!!ed,ed?.message)
// quota atomic
const uid=crypto.randomUUID()
const rs=await Promise.all(Array.from({length:50},()=>svc.rpc('assistant_quota_take',{p_user:uid,p_limit:30})))
const granted=rs.filter(r=>r.data===true).length,denied=rs.filter(r=>r.data===false).length
ok('50 parallel calls -> exactly 30 granted',granted===30&&denied===20,`granted=${granted} denied=${denied} errors=${rs.filter(r=>r.error).length}`)
const{count}=await svc.from('assistant_requests').select('id',{count:'exact',head:true}).eq('user_id',uid)
ok('counter rows = 30',count===30,String(count))
const{error:ex1}=await wa.rpc('assistant_quota_take',{p_user:uid,p_limit:999});ok('authenticated cannot call quota RPC',!!ex1,ex1?.message)
const{error:ex2}=await anon.rpc('assistant_quota_take',{p_user:uid,p_limit:999});ok('anon cannot call quota RPC',!!ex2)
const{data:rl,error:rle}=await wa.from('assistant_requests').select('id').limit(5);ok('authenticated sees no counter rows',(rl||[]).length===0,rle?.message||'rows 0')
const{error:wi}=await wa.from('assistant_requests').insert({user_id:me.user.id});ok('authenticated cannot insert counter',!!wi)
// window reset: age rows by 2h then take again
await svc.from('assistant_requests').update({created_at:new Date(Date.now()-7200e3).toISOString()}).eq('user_id',uid)
const{data:again}=await svc.rpc('assistant_quota_take',{p_user:uid,p_limit:30});ok('window resets after 1h',again===true)
await svc.from('assistant_requests').delete().eq('user_id',uid)
console.log(`\nSUMMARY pass=${pass} fail=${fail}`)
process.exit(fail?1:0)
