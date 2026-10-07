import {forwardRef, type ButtonHTMLAttributes} from 'react'
import {cn} from '../../lib/utils'
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary'|'outline'|'ghost'|'danger', size?: 'big'|'md'}
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({variant='primary', size='md', className, ...p}, ref){
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-[13px] transition active:scale-[.98] disabled:opacity-50 select-none'
  const sizes = {big: 'h-16 px-6 text-[1.0625rem]', md: 'h-11 px-4 text-[0.9375rem]'}
  const variants = {
    primary: 'bg-primary text-primary-ink',
    outline: 'bg-surface text-ink border border-border',
    ghost: 'bg-transparent text-muted',
    danger: 'bg-danger text-white',
  }
  return <button ref={ref} className={cn(base, sizes[size], variants[variant], className)} {...p}/>
})
