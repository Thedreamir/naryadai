import {useState} from 'react'
import {internetAnswer} from '../lib/internet-grounding.mjs'
export default function InternetReference(){const [result,setResult]=useState<any>(null)
 return <details className="ptah-internet-reference"><summary>Из интернета · выключено</summary><p>Только общая справка. Не утверждённая база предприятия, не инструкция и не допуск.</p><p>Безопасность и включение оборудования: утверждённая процедура и подтверждение мастера. Данные работника и наряда не отправляются.</p><button onClick={async()=>setResult(await internetAnswer({enabled:false,topic:'bearing'}))}>Статус поиска</button>{result&&<p role="status">{result.answer}</p>}</details>}
