// Adapted from magicui number-ticker (MIT, pinned snapshot cdb348cb); import path changed to framer-motion.
import {useEffect, useRef} from 'react'
import {useInView, useMotionValue, useSpring} from 'framer-motion'
import {cn} from '../../lib/utils'
export function NumberTicker({value, className, decimalPlaces=0}:{value:number, className?:string, decimalPlaces?:number}){
  const ref=useRef<HTMLSpanElement>(null)
  const motionValue=useMotionValue(0)
  const springValue=useSpring(motionValue,{damping:60,stiffness:100})
  const isInView=useInView(ref,{once:true,margin:'0px'})
  useEffect(()=>{if(isInView) motionValue.set(value)},[motionValue,isInView,value])
  useEffect(()=>springValue.on('change',(latest)=>{
    if(ref.current) ref.current.textContent=Intl.NumberFormat('ru-RU',{minimumFractionDigits:decimalPlaces,maximumFractionDigits:decimalPlaces}).format(Number(latest.toFixed(decimalPlaces)))
  }),[springValue,decimalPlaces])
  return <span ref={ref} className={cn('inline-block tabular-nums',className)}>0</span>
}
