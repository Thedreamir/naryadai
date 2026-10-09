import {deadlineProgress, type DeadlineProgressInput} from '../lib/deadline-progress.mjs'

export type DeadlineProgressProps = DeadlineProgressInput & {
  /** Cards share a parent-owned clock; this component does not start timers. */
  now: string | number
  className?: string
  /** Use the application's existing RU/KZ translator when integrating. */
  translate?: (text: string) => string
}

const styles = `
.tk-deadline{--deadline-ink:#334155;--deadline-fill:#475569;--deadline-track:#e2e8f0;min-width:0;color:var(--deadline-ink);font-size:13px;line-height:1.45}
.tk-deadline[data-tone="warning"]{--deadline-ink:#92400e;--deadline-fill:#a16207}
.tk-deadline[data-tone="danger"]{--deadline-ink:#b91c1c;--deadline-fill:#b91c1c}
.tk-deadline[data-tone="neutral"]{--deadline-ink:#475569}
.tk-deadline__label{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-weight:600;overflow-wrap:anywhere}
.tk-deadline__track{height:8px;background:var(--deadline-track);border-radius:4px;overflow:hidden;margin-top:6px}
.tk-deadline__fill{height:100%;background:var(--deadline-fill)}
.tk-deadline__note{margin:5px 0 0;font-size:12px;color:var(--deadline-ink);overflow-wrap:anywhere}
.theme-dark .tk-deadline,[data-theme="dark"] .tk-deadline{--deadline-ink:#cbd5e1;--deadline-fill:#cbd5e1;--deadline-track:#334155}
.theme-dark .tk-deadline[data-tone="warning"],[data-theme="dark"] .tk-deadline[data-tone="warning"]{--deadline-ink:#fcd34d;--deadline-fill:#fcd34d}
.theme-dark .tk-deadline[data-tone="danger"],[data-theme="dark"] .tk-deadline[data-tone="danger"]{--deadline-ink:#fca5a5;--deadline-fill:#fca5a5}
.theme-dark .tk-deadline[data-tone="neutral"],[data-theme="dark"] .tk-deadline[data-tone="neutral"]{--deadline-ink:#cbd5e1}
@media(forced-colors:active){.tk-deadline{color:CanvasText}.tk-deadline__track{outline:1px solid CanvasText;background:Canvas}.tk-deadline__fill{background:Highlight;forced-color-adjust:none}.tk-deadline__note{color:CanvasText}}
`

/** Time budget only. No work completion percentage, downtime estimate, or actions. */
export default function DeadlineProgress({className = '', translate = text => text, ...input}: DeadlineProgressProps) {
  const result = deadlineProgress(input)
  const percentage = result.elapsedPercent
  const icon = result.tone === 'danger' || result.tone === 'warning' ? '!' : result.state === 'unknown' ? '?' : '◷'
  const progressText = percentage === null ? '' : `${translate('Использовано времени до срока')}: ${percentage}%`
  return <div className={`tk-deadline ${className}`} data-tone={result.tone} data-state={result.state}>
    <style>{styles}</style>
    <div className="tk-deadline__label"><span aria-hidden="true">{icon}</span><span>{translate(result.label)}</span></div>
    {percentage !== null && <>
      <div className="tk-deadline__track" role="progressbar" aria-label={translate('Использовано времени до срока')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={progressText}>
        <div className="tk-deadline__fill" style={{width: `${percentage}%`}} />
      </div>
      <p className="tk-deadline__note">{progressText}</p>
    </>}
    {result.reason === 'invalid_window' && <p className="tk-deadline__note">{translate('Нет корректной даты выдачи: доля времени неизвестна')}</p>}
  </div>
}
