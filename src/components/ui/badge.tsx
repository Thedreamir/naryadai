import type {HTMLAttributes} from 'react'
import {cn} from '../../lib/utils'
const tones: Record<string,string> = {
  green:'bg-accent/12 text-accent', red:'bg-danger/12 text-danger', amber:'bg-warn/12 text-warn',
  teal:'bg-info/12 text-info', gray:'bg-muted/12 text-muted', primary:'bg-primary/10 text-primary',
}
export function Badge({className, tone='gray', ...p}: HTMLAttributes<HTMLSpanElement> & {tone?: keyof typeof tones}){
  return <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-semibold', tones[tone], className)} {...p}/>
}
