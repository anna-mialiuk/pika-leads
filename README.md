# Pika Leads

Сайт агентства performance-маркетингу Pika Leads. React 19 + Vite + SASS, три мови (UA / RU / EN).

## Команди

| Команда | Що робить |
|---|---|
| `npm run dev` | локальна розробка |
| `npm run build` | перевірка перекладів → sitemap → збірка в `dist/` → пререндер усіх сторінок у статичний HTML |
| `npm run preview` | перегляд зібраної версії |
| `npm run i18n:check` | перевірка перекладів |
| `npm run sitemap` | генерація `public/sitemap.xml` і `robots.txt` |
| `npm run export:content` | експорт кейсів і статей у JSON для CMS |
| `npm run lint` | ESLint |

## Структура

- `src/pages`, `src/sections`, `src/components` — сторінки, секції, компоненти
- `src/data` — дані сайту (українська — базова мова)
- `src/i18n` — мультимовність: маршрути, рядки інтерфейсу (`locales/`), переклади даних (`content/`), SEO
- `src/content` — кейси, статті блогу, юридичні сторінки (шар під майбутню CMS), див. `src/content/README.md`
- `src/services/leads.js` — відправка заявок з усіх форм

## Змінні оточення

Див. `.env.example`: `VITE_SITE_URL` (домен для SEO/sitemap), `VITE_LEADS_ENDPOINT` (куди надсилати заявки).

## Деплой

Див. [DEPLOY.md](DEPLOY.md): GitHub Actions збирає сайт і копіює на VPS при кожному push у `main`.
