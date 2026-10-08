import {cn} from '../../lib/utils'
// Operational counts must be correct on first paint, including offscreen/mobile cards.
export function NumberTicker({value,className,decimalPlaces=0}:{value:number,className?:string,decimalPlaces?:number}){
 return <span className={cn('inline-block tabular-nums',className)}>{Intl.NumberFormat('ru-RU',{minimumFractionDigits:decimalPlaces,maximumFractionDigits:decimalPlaces}).format(value)}</span>
}
