# ИИ-проверка наряда (кейс §6.2–6.4) — модуль review-order

## Что построено

**Проверки (§6.2):**
- Полнота закрытия: работы, шифр неисправности, фото «после» для внеплановых.
- Соответствие работ проблеме: Gemini Flash-Lite (free tier), вход — только обезличенный текст
  (описание проблемы, работы, шифр, материалы; имена/телефоны вырезаются `scrubText`).
  Без ключа/при сбое модели — rules-фолбэк (лексическое пересечение) с принудительным
  `needs_master_review`: без модели система не выносит автоматического «принято».
- Логичность материалов: справочные диапазоны по материалу/ед. изм. + исторический медианный
  расход на этом оборудовании (при ≥5 прошлых нарядах). >3× нормы → rework-eligible.
- Время: активные минуты из `order_events` (паузы исключены) против `work_norms` и срока.
  Время само по себе никогда не отправляет на доработку.

**Фото (§6.3 п.1):** наличие; свежесть по `captured_at`/`server_received_at` в окне
«выдача −10 мин … закрытие +30 мин»; точные дубликаты по SHA-256 против чужих нарядов и против
фото «до». Любой жёсткий флаг фото → `needs_master_review`, не авто-rework (кроме отсутствия
фото на внеплановом — это правило полноты).

**Вердикт и оценка (§6.3 п.4, §6.4):** `accepted` / `accepted_with_remarks` / `rework` /
`needs_master_review`; score 1–5 из взвешенных компонентов (semantic 35 / materials 25 /
photo 25 / time 15); при низкой уверенности score = null + `needs_master_review: true`.
Master override: `applyMasterOverride` — оценка/вердикт мастера побеждают, доказательства
модели неизменны (в базе это уже enforced триггером 005).

**Отчёты (§6.4):** `report_worker` (оценка, что хорошо, что улучшить, время vs норматив) и
`report_master` (вердикт+основания, материалы, хронология, простой) — текстом в `ai_result`,
архив в `ai_reviews` (миграция 063).

## Файлы
- `supabase/functions/review-order/review-core.mjs` — вся логика, чистые функции (Deno + Node).
- `supabase/functions/review-order/review-config.mjs` — пороги, веса, нормы материалов.
- `supabase/functions/review-order/index.ts` — edge handler (замена текущего).
- `supabase/migrations/063_ai_reviews.sql` — таблица `ai_reviews`, `order_photos.captured_at`,
  `work_norms` if-not-exists. Добавить `'063_ai_reviews.sql'` в список `scripts/seed.mjs`.
- `tests/review-core.test.mjs` — 19 тестов (`node --test tests/review-core.test.mjs`): good /
  bad / no-photo / old-photo / duplicate / no-model / master-override / photo-layer / scrub.

## Интеграция фото-модуля (Python, photo_review.py)
`reviewOrder` принимает `photoLayer: {verdict, flags, score|null, reasons[], layer2?}` —
нормализованный вывод `photo_review.review(...)` (адаптер `fromPhotoModule` принимает и сырой
формат). Layer-1 флаги (stale, exact_duplicate, near_duplicate, future_time, unreadable)
принудительно ведут к `needs_master_review`. Визуальные утверждения попадают в вердикт
только при наличии `photoLayer.layer2`.

## Что НЕ построено (не заявлять жюри)
- Простой оборудования по наряду: верифицированного источника нет (created→completed — это не
  простой), поэтому handler передаёт downtime_minutes: null и строка в отчёт не попадает.
- Визуальное сравнение «до/после» и оценка аккуратности по фото (§6.3 п.2–3) — запускается
  только при подключённой layer-2 модели фото-модуля; само по себе в этом модуле отсутствует.
  В каждом вердикте это явно написано в `limitations`.
- EXIF-разбор в edge-функции (нет Pillow в Deno) — свежесть по `captured_at`, если клиент его
  передал, иначе по времени загрузки (помечается как более слабое доказательство).

## Деплой (для builder)
1. Применить `063_ai_reviews.sql`.
2. Заменить `supabase/functions/review-order/` тремя файлами выше.
3. Env: `GEMINI_API_KEY` + `GEMINI_MODEL` (free tier; без них — rules-only режим).
4. Прогон: `node --test tests/review-core.test.mjs` (31/31 локально, Node 22).
5. `index.ts` локально не проверен (нет Deno в среде автора): перед деплоем `deno check` +
   один вызов на тестовом проекте. Контракт `{id, version}` и guard-триггеры не менялись.

## Фото: ограничения и вывод «до»
- `order_photos.kind` ('before'/'after') добавлен миграцией 063. ВНИМАНИЕ, builder: фронт
  обязан писать kind при загрузке — «до» определяется ТОЛЬКО по kind='before' и
  orders.before_photos (временная эвристика убрана: after-фото грузятся до перехода
  completed и ложно ловились как «до»). Переиспользование одного фото ловится как
  photo_same_as_before. Дубликаты в чужих нарядах — indexed equality-запрос по хэшам
  текущих after-фото (photos_hash_idx), без ограниченного глобального скана.
- Время закрытия берётся из события completed текущего цикла; если его нет — свежесть и время
  помечаются «не проверено», ревью-время не подставляется.
- Layer-2 фото принимается после строгой валидации схемы: ОБЯЗАТЕЛЬНЫ same_equipment и
  fault_resolved из yes|no|unsure (голый score — не сравнение), score 1..5, confidence 0..1;
  затем confidence >= 0.7 и внутренняя согласованность: любой unsure, балл против результата
  (5 при «не устранено»), другое оборудование — всё это needs_master_review, а не verdict.
  Иначе присланные тексты и баллы игнорируются.

## Атомарность записи
Update наряда и вставка в ai_reviews — два отдельных вызова (триггер 005 требует писать
ai_result через orders). Ответ функции содержит `archived: true|false`; при false ревью в
orders.ai_result сохранено, но строки архива нет — повторите вызов.
