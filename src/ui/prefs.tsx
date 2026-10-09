import '../styles/glove-mode.css'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
type Theme='dark'|'light'|'system'; type Scale='100'|'130'|'160'
type Prefs={theme:Theme;scale:Scale;glove:boolean;setTheme:(t:Theme)=>void;setScale:(s:Scale)=>void;setGlove:(g:boolean)=>void}
const Ctx=createContext<Prefs>(null as any)
const read=()=>{try{return JSON.parse(localStorage.getItem('tk-prefs')||'{}')}catch{return{}}}
export function UiPrefsProvider({children}:{children:ReactNode}){
  const saved=read()
  const [theme,setTheme]=useState<Theme>(['light','dark','system'].includes(saved.theme)?saved.theme:'light')
  const [scale,setScale]=useState<Scale>(['100','130','160'].includes(saved.scale)?saved.scale:'100')
  const [glove,setGlove]=useState<boolean>(!!saved.glove)
  const [systemDark,setSystemDark]=useState(()=>matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(()=>{const mq=matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(mq.matches);mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[])
  useEffect(()=>{
    const b=document.body, h=document.documentElement
    b.classList.remove('theme-dark','theme-light','glove-mode')
    h.classList.remove('fs-100','fs-130','fs-160')
    b.classList.add('theme-'+(theme==='system'?(systemDark?'dark':'light'):theme))
    h.classList.add('fs-'+scale)
    if(glove)b.classList.add('glove-mode')
    localStorage.setItem('tk-prefs',JSON.stringify({theme,scale,glove}))
  },[theme,systemDark,scale,glove])
  return <Ctx.Provider value={{theme,scale,glove,setTheme,setScale,setGlove}}>{children}</Ctx.Provider>
}
export const usePrefs=()=>useContext(Ctx)
