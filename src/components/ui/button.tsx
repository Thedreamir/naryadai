import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
// shadcn/ui button pattern (MIT): Radix Slot + cva, adapted for glove-size controls.
const variants=cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 min-h-12 px-5',{variants:{variant:{default:'bg-[#222320] text-white hover:bg-black',outline:'border border-neutral-300 bg-white hover:bg-neutral-100',destructive:'bg-red-700 text-white hover:bg-red-800'}},defaultVariants:{variant:'default'}})
type Props=React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>&{asChild?:boolean}
export function Button({className,variant,asChild=false,...props}:Props){const C=asChild?Slot:'button';return <C className={twMerge(clsx(variants({variant}),className))} {...props}/>}
