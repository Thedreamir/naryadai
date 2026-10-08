// Presentation filter for recording surfaces: hides technical fixture titles, never deletes records.
export const TECHNICAL_TITLE=/^(E2E|TEST|QA-|RT |Пуш-тест)|фототест|фото-тест/i
export function isTechnicalTitle(title:string){return TECHNICAL_TITLE.test(title||'')}
export function savedPresentation():boolean{return localStorage.getItem('naryadai.presentation')!=='0'}
export function setPresentation(on:boolean){localStorage.setItem('naryadai.presentation',on?'1':'0');window.dispatchEvent(new Event('naryadai:presentation'))}
