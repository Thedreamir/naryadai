export type VoiceError='unsupported'|'permission'|'microphone'|'network'|'silent'|'language'|'aborted'|'unknown'
export function speechConstructor(host:unknown):any
export function speechLanguage(locale:string):'kk-KZ'|'ru-RU'
export function recognitionError(code:string):VoiceError
export function createDictation(options:{host:unknown,lang:string,onText:(text:string)=>void,onState:(state:boolean)=>void,onError:(code:VoiceError)=>void}):{start:()=>boolean,stop:()=>void,dispose:()=>void}
export function masterVoiceHint(order:unknown):string
