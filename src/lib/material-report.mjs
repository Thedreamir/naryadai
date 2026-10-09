// Lane 06: material consumption report model. Pure, no I/O.
// Rules: unit spelling is normalised only within the same unit (no conversion between units);
// unknown units and invalid quantities are excluded and listed; no anomaly or fraud conclusions.
const UNIT_ALIASES={
 'шт':'шт','шт.':'шт','штука':'шт','штук':'шт','pcs':'шт',
 'кг':'кг','кг.':'кг','kg':'кг',
 'г':'г','г.':'г','гр':'г','гр.':'г',
 'л':'л','л.':'л','литр':'л','литров':'л',
 'м':'м','м.':'м','метр':'м','метров':'м',
 'м2':'м2','м²':'м2',
 'м3':'м3','м³':'м3',
 'компл':'компл','компл.':'компл','комплект':'компл',
 'пар':'пар','пара':'пар','уп':'уп','уп.':'уп','упак':'уп','упаковка':'уп',
 'рул':'рул','рулон':'рул','бух':'бух','бухта':'бух'
};
export const KNOWN_UNITS=Object.freeze([...new Set(Object.values(UNIT_ALIASES))]);
export function normalizeUnit(u){
 if(typeof u!=='string')return null;
 const k=u.trim().toLowerCase().replace(/\s+/g,'');
 return Object.prototype.hasOwnProperty.call(UNIT_ALIASES,k)?UNIT_ALIASES[k]:null;
}
function ms(v){if(v==null||v==='')return null;const t=typeof v==='number'?v:Date.parse(v);return Number.isFinite(t)?t:null}
function orderTime(o){return ms(o.closed_at??o.completed_at??o.closure?.closed_at??o.closure?.at)}
export function materialReport(orders,options={}){
 const list=Array.isArray(orders)?orders:[];
 const since=ms(options.since),until=ms(options.until);
 const bounded=since!=null||until!=null;
 const groups=new Map(),excluded=[],outOfPeriod=[];
 let ordersWithMaterials=0,linesSeen=0;
 for(const o of list){
  if(!o||typeof o!=='object')continue;
  const mats=Array.isArray(o.closure?.materials)?o.closure.materials:[];
  if(!mats.length)continue;
  if(bounded){const t=orderTime(o);
   if(t==null){outOfPeriod.push({order_id:o.id??null,reason:'no_date'});continue}
   if((since!=null&&t<since)||(until!=null&&t>=until)){outOfPeriod.push({order_id:o.id??null,reason:'outside_period'});continue}}
  ordersWithMaterials++;
  for(const m of mats){
   linesSeen++;
   const name=typeof m?.name==='string'?m.name.trim():'';
   const base={order_id:o.id??null,name:name||null,unit:m?.unit??null,quantity:m?.quantity??null};
   if(!name){excluded.push({...base,reason:'missing_name'});continue}
   const unit=normalizeUnit(m.unit);
   if(!unit){excluded.push({...base,reason:'unknown_unit'});continue}
   const q=typeof m.quantity==='number'?m.quantity:(typeof m.quantity==='string'&&m.quantity.trim()!==''?Number(m.quantity.replace(',','.')):NaN);
   if(!Number.isFinite(q)||q<=0){excluded.push({...base,reason:'invalid_quantity'});continue}
   const key=name.toLowerCase()+'\u0000'+unit;
   let g=groups.get(key);
   if(!g){g={name,unit,total:0,lines:0,order_ids:new Set(),equipment:new Set()};groups.set(key,g)}
   g.total+=q;g.lines++;if(o.id!=null)g.order_ids.add(o.id);if(o.equipment)g.equipment.add(String(o.equipment));
  }
 }
 const rows=[...groups.values()].map(g=>({name:g.name,unit:g.unit,total:Math.round(g.total*1e6)/1e6,lines:g.lines,orders:g.order_ids.size,order_ids:[...g.order_ids],equipment:[...g.equipment].sort()}))
  .sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.unit.localeCompare(b.unit,'ru'));
 const reasons={};for(const e of excluded)reasons[e.reason]=(reasons[e.reason]||0)+1;
 return{rows,excluded,excluded_by_reason:reasons,skipped_orders:outOfPeriod,
  counts:{orders_with_materials:ordersWithMaterials,lines_seen:linesSeen,lines_included:linesSeen-excluded.length,lines_excluded:excluded.length},
  complete:excluded.length===0,
  caveats:['Единицы не пересчитываются: один материал в разных единицах показан отдельными строками.','Строки с неизвестной единицей или неверным количеством исключены и перечислены.','Сумма — по данным закрытия нарядов; это не складской учёт и не оценка расхода.']};
}
