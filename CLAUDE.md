# TutorSpace (job_sites)

Репетиторская CRM для одного пользователя (Anna Pazhukova): ученики, расписание,
домашние задания, методика, статистика, личный кабинет ученика. Весь код — в
каталоге `TutorApp/` (Vite + React + TypeScript + Tailwind + Supabase). Корень
репозитория `job_sites/` кроме `TutorApp/` больше ничего значимого не содержит.

## Рабочая ветка и деплой

- Разработка ведётся в ветке `claude/math-tutor-website-r3cw3x`.
- Сайт деплоится на GitHub Pages workflow'ом `.github/workflows/deploy-tutorapp.yml`.
  **Реально публикует только `main`** (GitHub Pages environment protection) —
  пуш в рабочую ветку саму по себе ничего не выкатывает.
- Поэтому для каждого изменения: закоммитить в рабочую ветку → запушить →
  открыть PR в `main` → смержить (squash) → подождать деплой.
- После squash-мержа у рабочей ветки «расходится» история с `main` (новый хэш
  коммита). Перед следующим коммитом сбросить ветку на свежий `main`:
  ```
  git fetch origin main
  git checkout -B claude/math-tutor-website-r3cw3x origin/main
  # при наличии незакоммиченных изменений — git stash -u перед checkout, git stash pop после
  git push --force-with-lease -u origin claude/math-tutor-website-r3cw3x
  ```
- GitHub Actions иногда подолгу (несколько минут) висит в статусе `pending`/`queued`
  перед стартом джобы — это нормальная задержка очереди раннеров, не сбой.
  Не нужно ничего чинить, просто подождать.

## Сборка и локальный запуск

- Все команды — из `TutorApp/`.
- `npm run build` — сборка (`tsc -b && vite build`). В свежем контейнере сначала
  нужен `npm ci` (node_modules отсутствует после чистого клона).
- `npm run dev -- --port XXXX` — локальный дев-сервер. Без `.env.local` работает
  в режиме localStorage (без Supabase, без логина) — удобно для UI-тестов без
  живых данных.
- `.env.example` описывает опциональные переменные: `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` (бэкенд), `VITE_GOOGLE_CLIENT_ID` (Google Calendar),
  `VITE_SENTRY_DSN` (мониторинг ошибок). Все четыре уже заведены как секреты
  GitHub Actions для прод-сборки.

## Данные (Supabase)

- Project id: `ycwwbifcogoisnxkkgtw`. Единственный пользователь-репетитор,
  `user_id = 'b5002d4f-fde1-4ae1-8408-ba5fe950e012'`.
- Таблица `app_kv` — вся прикладная данные одним key-value хранилищем. Ключи:
  `students`, `lessons`, `homework`, `methodology-notes`, `groups`, `tasks`,
  `messages`, `seed-flags`, `monthly-reports`. Это **продакшен**, не тестовая база.
- `app_kv_history` — автоматический архив предыдущих версий (триггер перед
  UPDATE/DELETE) — полезно для восстановления данных и расследования багов.
- `student_invites` — отдельная таблица: коды доступа в личный кабинет ученика
  (`code`, `tutor_id`, `student_id`). Несколько кодов на одного ученика не
  конфликтуют; старый код перестаёт работать только если его явно удалить.
- В сторе (`lib/storage.ts`) все изменяющие вызовы должны передавать функцию
  `(prev) => next`, а не готовое значение — это даёт retry-safe поведение при
  конкурентной записи (например, ученик параллельно отменяет урок через
  кабинет). Готовое значение вместо функции — частый источник багов потери
  данных в этом проекте, уже чинилось несколько раз.

## Тестирование UI

- Playwright доступен напрямую:
  `const { chromium } = require('/opt/node22/lib/node_modules/playwright')`,
  запуск с `executablePath: '/opt/pw-browsers/chromium-*/chrome-linux/chrome'`
  (точный путь — см. `ls /opt/pw-browsers/`).
- Сидирование данных для теста — через `localStorage`, ключи с префиксом
  `tutorapp:` (например `tutorapp:students`, `tutorapp:lessons`).
- Прямой доступ к живому Supabase/продакшен-сайту из песочницы обычно
  заблокирован сетевым прокси — для проверки реального бэкенда лучше
  использовать Supabase MCP-инструмент (`execute_sql` и т.п.), а не браузер.

## Стиль работы

- Перед каждым пушем — `npm run build`, чтобы не ловить поломки на проде.
- Для визуальных/UX-правок — короткий Playwright-прогон со скриншотом до/после,
  не полагаться только на чтение кода.
- Код и комментарии — на английском (так уже написан весь проект), общение с
  пользователем — на русском.
