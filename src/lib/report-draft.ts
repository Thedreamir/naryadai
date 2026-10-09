export type ReportDraft={works:string,fault:string,normWorkType?:string,materials:{name:string,quantity:number,unit:string}[],after:string[],savedAt:number}
const key=(actor:string,id:number)=>`tekton-report-draft:${actor}:${id}`
export function loadDraft(actor:string,id:number):ReportDraft|null{try{const d=JSON.parse(localStorage.getItem(key(actor,id))||'null');if(!d)return null;if(Date.now()-d.savedAt>86400000){localStorage.removeItem(key(actor,id));return null}return d}catch{return null}}
export function saveDraft(actor:string,id:number,d:Omit<ReportDraft,'savedAt'>){if(JSON.stringify(d).length>2000000)throw Error('Черновик больше 2 МБ: сократите фотографии');localStorage.setItem(key(actor,id),JSON.stringify({...d,savedAt:Date.now()}))}
export function clearDraft(actor:string,id:number){localStorage.removeItem(key(actor,id))}
export function clearAllDrafts(){for(const k of Object.keys(localStorage))if(k.startsWith('tekton-report-draft:'))localStorage.removeItem(k)}
