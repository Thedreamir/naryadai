# v7 -> live app: 1:1 mapping (user requirement: states are real statuses, not a skin)

## Status mapping (v7 board state -> app status)
- "Новое назначение" -> issued
- "В очереди" -> queued
- "Принят" -> accepted
- "В работе" -> in_progress (permit record required first)
- "Приостановлен" -> paused (reason required)
- "Отчёт отправлен" -> completed (receipt line: мастер ещё не открыл)
- "Проверка" -> ai_review (карточка оснований: rules/live/cache)
- "Доработка" -> rework (reason required)
- "Закрыт" -> closed (human_score, executor report, repeat control)
- "Отклонён" -> rejected (reason required)
- "Отчёт получен мастером" -> report_seen event (revision-stamped)

## Screens (4 v7 boards -> live views)
1. Board 1 "Рабочий: сейчас и дальше" -> worker home: current in_progress card + queue section (issued/accepted/paused/rework) + crew line. v7 critic fixes: "Новое назначение" separate from "В очереди · N"; deadline next to priority; no green-shield ambiguity on permit.
2. Board 2 "Отчёт и квитанция" -> worker closure + receipt (report_seen) + executor report block.
3. Board 3 "Мастер: выдача" -> master create-order modal + crew list.
4. Board 4 "Проверка с доказательствами" -> master order detail: closure facts, AI card (reasons + mode), photo evidence, chronology (order_events), master decision buttons.

## Tokens (from v7 source, to extract from zip)
- Colors: TBD from zip (dark "Цех" accents on light "Спокойный" base for demo)
- Typography: TBD; min 14px worker-facing captions (critic P2)
- Touch targets: 64px main actions (CSS px target; verified visually, no ergonomics claim)
- Status colors must map 1:1 to the 10 real statuses above (badge classes already exist: .badge.<status>)

## Plan
1. Extract tokens from v7 source zip -> src/v7-tokens.css, wire into style.css.
2. Rework worker home + master detail to v7 hierarchy (boards 1+4 first).
3. Screenshots per screen vs board, diff-report to parent.
4. Keep every honest label (rules/AI wording, permit, receipt, simulation).
