// Browser recognition only. Never records audio or sends app requests itself.
export function speechConstructor(host) { return host?.SpeechRecognition || host?.webkitSpeechRecognition || null }
export function speechLanguage(locale) { return locale === 'kz' ? 'kk-KZ' : 'ru-RU' }
export function recognitionError(code) {
  return ({'not-allowed':'permission','service-not-allowed':'permission','audio-capture':'microphone','network':'network','no-speech':'silent','language-not-supported':'language','aborted':'aborted'})[code] || 'unknown'
}
export function createDictation({host,lang,onText,onState,onError}) {
  let current=null, generation=0
  const detach=r=>{r.onresult=null;r.onend=null;r.onerror=null;r.onstart=null}
  const dispose=()=>{generation++;if(current){const r=current;current=null;detach(r);try{r.abort()}catch{}}}
  return {
    start() {
      if(current)return false
      const C=speechConstructor(host)
      if(!C){onError('unsupported');return false}
      let r
      try{r=new C()}catch{onError('unknown');return false}
      const token=++generation;current=r;const delivered=new Set()
      const active=()=>current===r&&generation===token
      const finish=()=>{if(!active())return;current=null;detach(r);onState(false)}
      r.lang=lang;r.continuous=false;r.interimResults=false;r.maxAlternatives=1
      r.onstart=()=>{if(active())onState(true)}
      r.onresult=e=>{
        if(!active())return
        for(let i=e.resultIndex||0;i<(e.results?.length||0);i++) {
          const result=e.results[i]
          if(!result?.isFinal||delivered.has(i))continue
          delivered.add(i)
          const text=String(result[0]?.transcript||'').trim()
          if(text)onText(text)
        }
      }
      r.onerror=e=>{if(!active())return;const code=recognitionError(e.error);finish();if(code!=='aborted')onError(code)}
      r.onend=finish
      try{onState(true);r.start();return true}catch{finish();try{r.abort()}catch{};onError('unknown');return false}
    },
    stop(){if(current){try{current.stop()}catch{dispose();onState(false)}}},
    dispose
  }
}
export function masterVoiceHint(order) {
  const parts=['Сверьте выполненные работы, материалы и фотографии с заданием.']
  if(!order?.closure?.works)parts.push('Описание выполненных работ отсутствует.')
  if(!order?.closure?.photos?.length)parts.push('Фото после ремонта отсутствует.')
  const reasons=(order?.ai_result?.reasons||[]).filter(x=>typeof x==='string').slice(0,4)
  if(reasons.length)parts.push('Основания проверки: '+reasons.join('. '))
  parts.push('Озвучка не проверяет безопасность и не подтверждает ремонт. Принять или вернуть работу решает мастер.')
  return parts.join(' ')
}
