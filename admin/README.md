# Pikaleads Admin (app.pika-leads.com)

Панель агентства: CRM заявок з сайту, команда, профіль. React 19 + Vite.
Бекенд — `server/leads` (API `/api/admin/*`), без зовнішніх залежностей.

## Розробка локально

```bash
# 1. бекенд (з папки server/leads), файл .env — за зразком .env.example
cd server/leads
node --env-file=.env index.mjs

# 2. перший користувач
node --env-file=.env cli.mjs create-user --email you@mail.com --name "Анна" --role admin

# 3. адмінка (інший термінал) → http://localhost:5174
cd admin
npm install
npm run dev
```

Для локальної роботи по http додайте в `.env` рядок `COOKIE_SECURE=0`.

## Структура

- `src/pages` — Вхід (`Login`), Заявки (`Leads`: таблиця + воронка), Команда, Профіль
- `src/components` — макет з меню, картка ліда, нова заявка, спільні елементи
- `src/lib` — запити до API, сесія, довідники (статуси, співробітники)

Статуси заявок задаються на сервері (`server/leads/statuses.mjs`) — той самий список, що й кнопки в Telegram.
