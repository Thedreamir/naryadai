import {useLocale} from '../lib/locale'
import LanguageToggle from '../components/LanguageToggle'
import DemoTour from '../components/DemoTour'
import {useState} from 'react'
import * as H from '../lib/data'
import {Button} from '../components/ui/button'
import type {Actor} from '../App'
export default function Login({onLogin}:{onLogin:(a:Actor)=>void}){
  const {t,locale}=useLocale()

  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false)
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setErr('')
    try{await H.login(email,password);const st=await H.state();onLogin((st as any).actor)}catch(ex){setErr((ex as Error).message)}finally{setBusy(false)}}
  return <div className="tekton-login">
    <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-border rounded-[22px] p-6 space-y-4">
      <div><div className="flex items-center gap-2.5"><img src="/tekton-symbol.svg" alt="" className="w-9 h-9"/><div className="text-[28px] font-bold tracking-[-1px]">Tekton OS</div></div>
      <div className="text-muted text-[13px] mt-1">{t("Наряд выдан. Смена под контролем.")}</div></div>
      <LanguageToggle/><DemoTour/><p className="text-[11px] text-muted" role="note">{locale==='kz'&&t('Казахский перевод: черновик, производственные тексты требуют проверки.')}</p><label className="block text-[13px] font-medium text-muted">{t("Логин")}<input className="mt-1 w-full h-12 px-3 rounded-[13px] border border-border bg-bg text-[16px]" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username"/></label>
      <label className="block text-[13px] font-medium text-muted">{t("Пароль")}<input className="mt-1 w-full h-12 px-3 rounded-[13px] border border-border bg-bg text-[16px]" type="password" required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
      {err&&<div className="text-danger text-[13px]">{err}</div>}
      <Button size="big" className="w-full" disabled={busy}>{busy?t("Вход…"):t("Войти")}</Button>
    </form>
  </div>
}
