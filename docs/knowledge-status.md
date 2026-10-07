# Знания: подготовлено, не развёрнуто

Обычная сборка скрывает функцию. VITE_KNOWLEDGE_PREVIEW=true только для локального QA. Миграция 053 и assistant-chat не применены в live.

- TXT/PDF: локальный PDF.js, 2 МБ, 10 страниц, 12 000 символов. Сканы без OCR отклоняются. Только синтетика.
- Draft -> утверждение увиденной версии -> approved -> revoke. Audit хранит снимки. 11 тестов минимальной локальной схемы, не всей схемы.
- Transformers.js multilingual-e5-small q8, wasm в браузере. Веса скачиваются с Hugging Face; текст локален. Node inference проверен, браузерный ещё требует QA. Score не вероятность достоверности. Это эмбеддинги, не генеративная модель.
- Повторное чтение БД после поиска удаляет устаревшие/отозванные результаты. Это не постоянная синхронизация всех открытых экранов.
- Новая assistant-chat defaults rules-only: regex не даёт гарантии анонимизации. ALLOW_SYNTHETIC_EXTERNAL_CHAT разрешает только отдельный тест после проверки, не реальные материалы. Live-функция не менялась.
- Требуются полный миграционный прогон, live цикл и проверка цитат/отзыва. До них блок не выполнен.

Источники: https://huggingface.co/Xenova/multilingual-e5-small ; https://huggingface.co/intfloat/multilingual-e5-small ; https://huggingface.co/docs/transformers.js/en/pipelines ; https://mozilla.github.io/pdf.js/examples/

Hard-test result: real PDF text extraction passed in local Chromium. In-browser E5 inference crashed the tab in the constrained test environment (about 2 GB total memory); Node success does not establish browser viability. Browser search remains failed/unverified and must not be presented as working. No production route is exposed by default.
