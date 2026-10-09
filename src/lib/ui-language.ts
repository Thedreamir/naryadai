import dictionary from './kz-ui.json'
export type UiLanguage='ru'|'kz'
export function getUiLanguage():UiLanguage {try{return localStorage.getItem('tekton-language')==='kz'?'kz':'ru'}catch{return 'ru'}}
export function setUiLanguage(language:UiLanguage){try{localStorage.setItem('tekton-language',language)}catch{};document.documentElement.lang=language==='kz'?'kk':'ru';window.dispatchEvent(new Event('tekton-language'))}
const entries=Object.entries(dictionary).filter(([key])=>key.length>3).sort((a,b)=>b[0].length-a[0].length)
const escapeRegex=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const copyPattern=new RegExp('(?<![\\p{L}])('+entries.map(([key])=>escapeRegex(key.trim())).join('|')+')(?![\\p{L}])','gu')
export function translateUi<T>(value:T):T|string {
 if(typeof value!=='string'||getUiLanguage()!=='kz')return value
 const trimmed=value.trim();const translated=(dictionary as Record<string,string>)[value]||(dictionary as Record<string,string>)[trimmed]
 if(translated)return value===trimmed?translated:value.replace(trimmed,translated.trim())
 // Interpolated display metadata only. Inputs and fetched repair content never call this function.
 return value.replace(copyPattern,source=>(dictionary as Record<string,string>)[source]||source)
}
export function dateLocale(){return getUiLanguage()==='kz'?'kk-KZ':'ru-RU'}
