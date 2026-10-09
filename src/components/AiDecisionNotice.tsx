/** AI advice is never a production-accuracy guarantee or a human decision. */
export default function AiDecisionNotice(){
  return <aside aria-label="ИИ и решение мастера" className="ai-decision-notice rounded-xl border border-border bg-surface p-3 space-y-1.5">
    <p className="text-[13px] font-medium leading-5">AI-рекомендация. Окончательное решение принимает мастер.</p>
    <p className="text-[12px] text-muted leading-[18px]">Human in the loop · проверка не заменяет осмотр и ответственность специалиста.</p>
    <p className="text-[12px] text-muted leading-[18px]">На тестовом наборе из 48 синтетических пар: 95.8% (46/48) совпадений с предварительной разметкой. Защитное правило настроено на этом же наборе. Это не точность на производстве.</p>
  </aside>
}
