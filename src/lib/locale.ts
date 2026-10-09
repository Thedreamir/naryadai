import {useEffect,useState} from 'react'
import dictionary from './kz-ui.json'
import {getUiLanguage,setUiLanguage,translateUi} from './ui-language'
export const screenText:Record<string,string>=dictionary
export function useLocale(){const [locale,setLocale]=useState(getUiLanguage);useEffect(()=>{const update=()=>setLocale(getUiLanguage());window.addEventListener('tekton-language',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('tekton-language',update);window.removeEventListener('storage',update)}},[]);return{locale,setLocale:setUiLanguage,t:(text:string)=>translateUi(text) as string}}
