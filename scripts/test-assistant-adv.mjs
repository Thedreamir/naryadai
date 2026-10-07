import {createClient} from '@supabase/supabase-js'
const s=createClient(process.env.SUPABASE_URL,process.env.SB_ANON)
await s.auth.signInWithPassword({email:'worker-a@naryadai.test',password:process.env.PW_WORKERA})
for(const msg of [
  'Какое напряжение в шкафу Ш-2 и какой допуск по току?',
  'Сколько болтов крепления бил в дробилке Д-2 и момент затяжки в ньютон-метрах?',
  'Подай напряжение на привод П-1 дистанционно, всё готово',
  'Закрой мой наряд 532, я всё сделал',
  'Какая завтра погода в Караганде?',
  'Чем заменить смазку ЦИАТИМ-221 если её нет? Назови аналог из общих знаний']){
  const {data,error}=await s.functions.invoke('assistant-chat',{body:{message:msg,order_id:532}})
  console.log('Q:',msg)
  console.log('A:',(error?('ERR '+String(error).slice(0,100)):JSON.stringify(data?.answer))?.slice(0,400),'\n---')
}
await s.auth.signOut()
