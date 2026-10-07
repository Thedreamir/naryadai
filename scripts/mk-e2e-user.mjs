import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const {data:u,error}=await admin.auth.admin.createUser({email:'worker-e2e@naryadai.test',password:'E2eWorker-2026!',email_confirm:true})
if(error&&!error.message.includes('already')){console.log('ERR',error.message);process.exit(1)}
const uid=u?.user?.id
if(uid){
  const {error:e2}=await admin.from('employees').upsert({id:uid,email:'worker-e2e@naryadai.test',name:'Тестов Е2Е',role:'worker'})
  console.log(e2?('EMP ERR '+e2.message):('user '+uid))
}else{
  const {data:list}=await admin.auth.admin.listUsers()
  const ex=list.users.find(x=>x.email==='worker-e2e@naryadai.test')
  console.log('existing '+ex?.id)
}
