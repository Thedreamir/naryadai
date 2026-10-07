import type {HTMLAttributes} from 'react'
import {cn} from '../../lib/utils'
export function Card({className, ...p}: HTMLAttributes<HTMLDivElement>){
  return <div className={cn('bg-surface border border-border rounded-[22px] p-[23px] shadow-[0_7px_23px_rgba(36,65,45,0.02)]', className)} {...p}/>
}
