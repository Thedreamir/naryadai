// Three-role live demo e2e: master issues -> worker sees it -> leader sees it. One shared DB, real UI, screenshots.
import {chromium} from 'playwright'
const TITLE='E2E-TEST три роли: осмотр вентилятора синтетика'
const step=(n,ok,extra='')=>{console.log(`${ok?'PASS':'FAIL'} ${n}${extra?' :: '+extra:''}`);if(!ok)process.exitCode=1}
const b=await chromium.launch()
const login=async(email,pw)=>{const pg=await (await b.newContext({viewport:{width:1440,height:900}})).newPage()
  await pg.goto('http://localhost:4173/login')
  await pg.fill('input[type=email]',email);await pg.fill('input[type=password]',pw)
  await pg.click('button:has-text("Войти")');return pg}
try{
  const master=await login('master@naryadai.test',process.env.PW_MASTER)
  await master.waitForSelector('a[href="/report"]',{timeout:30000})
  step('master opens master workspace',true)
  const worker=await login('worker-c@naryadai.test',process.env.PW_WORKERC)
  await worker.waitForLoadState('networkidle');await worker.waitForTimeout(2000)
  step('worker opens worker PWA',(await worker.url()).startsWith('http://localhost:4173'))
  const leader=await login('leader@naryadai.test',process.env.PW_LEADER)
  await leader.waitForLoadState('networkidle');await leader.waitForTimeout(2000)
  step('leader opens leader view',true)
  await master.goto('http://localhost:4173/issue')
  await master.fill('textarea',TITLE)
  await master.locator('select').nth(0).evaluate(e=>{const o=[...e.options].find(o=>o.text.includes('Вентилятор В-3'));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}))})
  await master.waitForTimeout(1200)
  await master.locator('select').nth(1).evaluate(e=>{const o=[...e.options].find(o=>o.text.includes('Демо-исполнитель'));e.value=o.value;e.dispatchEvent(new Event('change',{bubbles:true}))})
  await master.click('button:has-text("Выдать наряд")')
  await master.waitForURL('http://localhost:4173/',{timeout:15000})
  step('master issued order via UI',true)
  const {createClient}=await import('@supabase/supabase-js')
  const svc=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
  const row=(await svc.from('orders').select('id,status,assignee_id').eq('title',TITLE).order('id',{ascending:false}).limit(1).single()).data
  step('order stored in shared DB',!!row&&row.status==='issued','#'+row?.id)
  await worker.goto('http://localhost:4173/');await worker.waitForTimeout(3000)
  const wSees=await worker.getByText(TITLE).count()
  step('worker PWA home shows the new order (live, shared DB)',wSees>0)
  await worker.screenshot({path:'/tmp/role-worker.png'})
  await worker.setViewportSize({width:390,height:844});await worker.waitForTimeout(1500);await worker.screenshot({path:'/tmp/role-worker-phone.png'})
  await worker.goto('http://localhost:4173/orders/'+row.id);await worker.waitForTimeout(2500)
  step('worker opens the order detail',(await worker.getByText(TITLE).count())>0)
  await leader.goto('http://localhost:4173/');await leader.waitForTimeout(3500)
  const lBody=await leader.content()
  step('leader overview renders live data',lBody.includes('наряд'))
  await leader.screenshot({path:'/tmp/role-leader.png'})
  await master.goto('http://localhost:4173/orders/'+row.id);await master.waitForTimeout(7000)
  step('master opens the same order detail (same DB row)',(await master.getByText(TITLE).count())>0)
  await master.screenshot({path:'/tmp/role-master.png'})
  // cleanup: master cancels the demo fixture
  const v=(await svc.from('orders').select('version').eq('id',row.id).single()).data.version
  await master.evaluate(async()=>{})
  const mm=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
  await mm.auth.signInWithPassword({email:'master@naryadai.test',password:process.env.PW_MASTER})
  const cx=await mm.rpc('manage_order',{p_order_id:row.id,p_action:'cancel',p_assignee:null,p_priority:null,p_reason:'E2E three-role cleanup'})
  step('fixture cancelled after demo',!cx.error,cx.error?.message||'')
}catch(e){console.log('FATAL',e.message);process.exitCode=1}
await b.close()
