import {createClient} from '@supabase/supabase-js'
const admin=createClient(process.env.SUPABASE_URL,process.env.SB_SERVICE)
const email='master-b@naryadai.test'
const pw=process.env.PW_MASTERB
const {data:u,error}=await admin.auth.admin.createUser({email,password:pw,email_confirm:true})
if(error&&!error.message.includes('already')){console.log('ERR',error.message);process.exit(1)}
let uid=u?.user?.id
if(!uid){const {data:list}=await admin.auth.admin.listUsers();uid=list.users.find(x=>x.email===email)?.id}
const {error:e2}=await admin.from('employees').upsert({id:uid,email,name:'Мастер смены Сидорова Демо-учётка',role:'master'})
console.log(e2?('EMP ERR '+e2.message):('master-b ready '+uid))
