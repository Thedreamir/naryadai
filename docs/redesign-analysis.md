
## Token spec v8 «Zavod» (from 16 refs: 4 desktop dashboards, 2 profile cards, mabida.tj mobile RU app x5, QAMCORE mobile RU x2, iDraft, learning dashboard, chat UI)
Colors:
- bg: #F2F2EF (warm neutral, all refs); surface #FFFFFF; border #E4E4DE
- primary dark plant green: #16402F (buttons, hero cards, sidebar active) — matches refs PinenMFB/QAMCORE and current brand
- primary-ink text on primary: #FFFFFF; accent green #1F9D63 (positive deltas, LIVE chips)
- status: red #D23B3B (overdue/emergency), amber #C77E1F (pending/queued), teal #0E7C6B (info), gray #6B6B66 (closed)
- chips: tinted bg (status at 12% alpha) + status-dark text, pill radius (mabida/QAMCORE pattern)
Type (Cyrillic-safe, bundled @fontsource/inter — offline PWA):
- display KPI: 40-56px/700 tabular; page title 28/700; card title 17/600; body 15/400; caption 13/500 #6B6B66; overline 11/700 caps tracking .08em (mabida "СЛЕДУЮЩИЙ ШАГ")
Shape/space:
- card radius 18px; big buttons radius 14px height 60-64px (worker) / 44px (master desktop); chips pill; icon tile 48px radius 14 tinted
- card = white + 1px border, NO heavy shadows; hero/dark card = primary bg
- worker mobile: single column, bottom tab bar (Главная · Наряды · [current-order FAB] · Отчёт · Профиль)
- master desktop: left sidebar 240px (groups + badges, refs 1/2/12) + header (search, user chip) + card grid 12-col
Components (shadcn/Radix): Button, Card, Badge, Avatar, Tabs, Dialog/Sheet, Select, Progress, Tooltip, DropdownMenu, Sonner toasts; Recharts (bar/donut/line, green family); Framer Motion (screen transitions, count-up); magicui точечно (e.g. shimmer on AI live card)
Patterns lifted:
- mabida "следующий шаг" → worker current-order hero (overline, big title, 1 primary CTA 64px)
- mabida 2x2 tiles → worker home quick actions; QAMCORE dark status card → master AI/anomaly strip
- profile refs → Профиль screen (avatar, role, stats row: закрыто/в срок/оценка)
- iDraft dark KPI card → master shift summary card; dashed tile → empty states
Honesty labels stay visible: ИИ-tag on AI cards, "индикаторы, не доказано" on anomaly strip.

## Scaffold decision
Branch `redesign` off main; REPLACE src/ with new app (React Router, Tailwind v3 + shadcn, Framer, Recharts); supabase/ Edge Functions untouched (same backend, same demo data). v7.css archived to docs/legacy/. Build/deploy pipeline unchanged (vite → surge v2 URL).
