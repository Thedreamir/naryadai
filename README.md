# НарядAI — MVP (private prototype)

PWA для управления нарядами на ремонт оборудования: выдача нарядов мастером, исполнение с фотоотчётом и материалами, AI-проверка закрытия (Gemini, бесплатный тариф), роли мастер/исполнитель/руководитель/админ.

Синтетические данные. Не для производственного использования.

## Стек
- React + TypeScript + Vite (PWA, Workbox offline shell)
- Supabase: PostgreSQL + RLS, Auth, Storage (приватные фото), Realtime, Edge Function `review-order`
- AI: Gemini (модель выбирается явно, только free tier); rules-only fallback без ключа

## Локальный запуск
Node 22 / npm 10. `npm ci`, затем:
1. `npm run db:start` (изолированный PostgreSQL 5433)
2. `npm run seed`
3. `npm run server` (loopback API 3001)
4. `npm run dev` (Vite 5173)

`npm test` — доменные проверки. `npm run build` — сборка PWA.

Хостинг-сборка требует `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` на этапе build. Секреты не хранятся в репозитории.

Статусы: Выдан, Принят в работу, В очереди, Отклонён, В работе, Приостановлен, Исполнено, Проверка ИИ, На доработку, Закрыт.
