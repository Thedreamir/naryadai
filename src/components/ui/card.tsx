import type {HTMLAttributes} from 'react'
import {cn} from '../../lib/utils'
export function Card({className, ...p}: HTMLAttributes<HTMLDivElement>){
  return <div className={cn('bg-surface border border-border rounded-[18px] p-4', className)} {...p}/>
}
