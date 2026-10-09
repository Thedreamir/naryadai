import {brigadeFactors, BRIGADE_FACTORS, type RatingFactorRow, type BrigadeEmployee} from '../lib/brigade-factors.mjs'

export interface BrigadeRatingChartProps {
  ratings: readonly RatingFactorRow[] | null
  employees: readonly BrigadeEmployee[]
  brigade?: string | null
  loading?: boolean
  error?: boolean
  theme?: 'light' | 'dark'
  t?: (text: string) => string
}
const number = (v:number) => v.toLocaleString('ru-RU', {maximumFractionDigits:1})
export default function BrigadeRatingChart({ratings,employees,brigade=null,loading=false,error=false,theme='light',t=(s)=>s}:BrigadeRatingChartProps) {
  const dark=theme==='dark', ink=dark?'#f3f4f6':'#20242b', muted=dark?'#bec4ce':'#505966', line=dark?'#59616f':'#c8cdd4', track=dark?'#353c47':'#e8ebef', fill=dark?'#f6b958':'#915400'
  const model=brigadeFactors(ratings,employees,{brigade})
  return <section aria-label={t('Факторы бригад')} style={{color:ink,background:dark?'#20242b':'#fff',border:`1px solid ${line}`,borderRadius:16,padding:18,fontFamily:'Inter, system-ui, sans-serif',minWidth:0}}>
    <h2 style={{fontSize:19,margin:'0 0 8px'}}>{t('Факторы бригад')}</h2>
    <p style={{fontSize:13,lineHeight:1.5,color:muted,margin:'0 0 16px'}}>{t('Учебный набор, не аттестация. Среднее по исполнителям с известным фактором; каждый имеет одинаковый вес. Нет данных не означает ноль.')}</p>
    {loading ? <p role="status">{t('Загрузка факторов…')}</p> : error || ratings===null ? <p role="status">{t('Факторы недоступны. Данные не показаны.')}</p> : <>
      {model.brigades.length===0 && <p>{t('Нет данных по бригадам за выбранный период.')}</p>}
      {model.brigades.map(group=><article key={group.name} style={{borderTop:`1px solid ${line}`,paddingTop:16,marginTop:16}}>
        <h3 style={{fontSize:16,margin:'0 0 6px',overflowWrap:'anywhere'}}>{group.name}</h3>
        <p style={{fontSize:12,color:muted,margin:'0 0 14px',lineHeight:1.5}}>{t('Исполнителей в полученных строках рейтинга')}: {group.workerCount}. {t('Не полная численность бригады; принадлежность текущая, не историческая.')}</p>
        <dl style={{margin:0,display:'grid',gap:14}}>{group.factors.map(f=><div key={f.key}>
          <dt style={{fontSize:13,display:'flex',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}><span>{t(f.label)}</span><strong>{f.mean===null?t('Нет данных'):number(f.mean)+' / 100'}</strong></dt>
          <dd style={{margin:'6px 0 0'}}>
            {f.mean!==null && <div aria-hidden="true" style={{height:9,borderRadius:8,background:track,overflow:'hidden'}}><div style={{height:'100%',width:f.mean+'%',background:fill,borderRadius:8}}/></div>}
            <div style={{fontSize:12,color:muted,marginTop:5,lineHeight:1.4}}>{t('Данные')}: {f.available}/{group.workerCount}; {t('нет данных')}: {f.missing}{f.min!==null && f.max!==null ? `; ${t('диапазон')}: ${number(f.min)}–${number(f.max)}`:''}</div>
          </dd>
        </div>)}</dl>
        {group.heterogeneousWeights && <p style={{fontSize:12,lineHeight:1.5,fontWeight:600,marginTop:16}}>{t('У исполнителей разные доступные факторы и веса. Общий балл бригады не рассчитан; средние факторов нельзя складывать в рейтинг.')}</p>}
        <details style={{fontSize:12,marginTop:16,lineHeight:1.6}}><summary style={{cursor:'pointer',minHeight:32}}>{t('Веса и ограничения')}</summary>
          <p>{t('Базовые веса')}: {BRIGADE_FACTORS.map(f=>`${t(f.label)} ${f.weight}%`).join(', ')}. {t('У каждого исполнителя известные веса перенормированы. Это веса его рейтинга, не веса столбцов.')}</p>
          {group.weightProfiles.map(p=><p key={p.profile}>{t('Исполнителей')}: {p.workerCount}. {p.activeWeight===0?t('Нет доступных факторов.'):BRIGADE_FACTORS.map(f=>`${t(f.label)} ${number(p.weights[f.key])}%`).join('; ')}</p>)}
          <p>{t('Объём зависит от максимума за выбранный период и приближения по приоритету, не замеренной трудоёмкости. Окно повторов может быть неполным. График не доказывает качество ремонта и не сравнивает разные периоды или составы бригад.')}</p>
        </details>
      </article>)}
      {model.omittedRows>0 && <p style={{fontSize:12,color:muted}}>{t('Не показаны строки с неизвестной бригадой, ролью или неоднозначным идентификатором')}: {model.omittedRows}.</p>}
      {model.invalidFactors>0 && <p style={{fontSize:12,color:muted}}>{t('Некорректные факторы исключены, не заменены нулём')}: {model.invalidFactors}.</p>}
    </>}
  </section>
}
