# Поиск вне браузера: локальный прототип

multilingual-e5-small q8 (MIT по карточке модели), Transformers.js Apache-2.0. Эмбеддинги 384 измерения, не генератор ответов. На CPU Node реальная модель работает. Четыре smoke-теста в docs/knowledge-node-results.json: порядок, исключение draft, версия/цитата, исключение revoked. Маленький авторский набор, не оценка точности.

`node scripts/knowledge-node.mjs` запускает только 127.0.0.1:5188. Файл scripts/knowledge-demo.synthetic.json помечен synthetic; перечитывается на каждом запросе. POST /search {query}. Запрос до 1000 символов. Это локальная демонстрация, не общий сервер: нет Supabase/Auth, не открывать порт публично.

Для общего сервера нужны CPU/memory/cache модели, HTTPS, проверка сессии и RLS перед выдачей, актуальные approved/версия/отзыв, лимиты и журнал без тела запросов. Бесплатный хост и его ёмкость ещё не подтверждены, никто не развёрнут. Документы и вопросы уходят с устройства на этот сервер, но не в hosted inference API; Hugging Face предоставляет веса. Реальные документы запрещены; размещение/обезличивание отдельный этап.

Браузерная модель упала в тестовой среде. Node успех не является успехом на телефоне. Обычная сборка скрывает знания.

https://huggingface.co/Xenova/multilingual-e5-small
https://huggingface.co/intfloat/multilingual-e5-small
https://huggingface.co/docs/transformers.js/en/pipelines
