# Контент сайту (кейси й статті блогу)

Компоненти отримують контент **лише** через хуки з `src/content/hooks.js`:

    const cases = useCases();          // список кейсів поточною мовою
    const caseItem = useCase(slug);    // один кейс
    const articles = useArticles();    // картки статей
    const article = useArticle(slug);  // стаття з текстом: { ...картка, blocks, toc, isFallback }

Звідки береться контент, вирішує `src/content/api.js`. Зараз — з файлів проєкту,
після запуску CMS — переписуються лише функції в `api.js` (наприклад, на
`fetch("/api/articles/" + slug + "?lang=" + lang)`). Компоненти не змінюються.

Для головної: `useFeaturedCases(3)`, `useFeaturedArticles(3)` — спершу записи з
`featured: true`, далі решта.

## Службові поля запису (кейс і стаття)

| Поле          | За замовчуванням | Що робить                                   |
| ------------- | ---------------- | ------------------------------------------- |
| `slug`        | `id`             | адреса сторінки                             |
| `status`      | `"published"`    | `"draft"` — запис не показується ніде і не потрапляє в sitemap |
| `publishedAt` | `date` або null  | дата публікації                             |
| `featured`    | `false`          | показувати на головній                      |
| `order`       | позиція у файлі  | порядок у списках (менше — вище)            |

У файлах ці поля можна не писати — `api.js` підставить значення за замовчуванням.

## Експорт для CMS

    npm run export:content

Створює `content-export/cases.json` і `content-export/articles.json`: один запис —
один кейс/стаття з усіма мовами (`translations: { uk, en, ru }`), для статей разом
із текстом у блоках. Цим файлом наповнюється база CMS.

## Тексти статей

    src/content/blog/uk/<id>.json
    src/content/blog/en/<id>.json
    src/content/blog/ru/<id>.json

Формат — список блоків (як в Editor.js / TipTap):

    { "type": "heading",   "level": 2, "id": "access-token", "text": "Заголовок" }
    { "type": "heading",   "level": 3, "text": "Підзаголовок" }
    { "type": "paragraph", "text": "Текст з <strong>жирним</strong>, <em>курсивом</em>, <a href=\"https://…\">посиланням</a>" }
    { "type": "list",      "style": "unordered", "items": ["Пункт 1", "Пункт 2"] }
    { "type": "note",      "text": "Примітка", "variant": "warning" }
    { "type": "code",      "code": "const a = 1;" }
    { "type": "image",     "src": "https://…/image.webp", "alt": "Опис", "caption": "Підпис" }

- H2 з `id` відкриває секцію; з них автоматично будується зміст статті.
- У `text` дозволені лише `<strong>`, `<em>`, `<code>`, `<a href>`, `<br>` — решта
  виводиться як текст (безпечно для даних з CMS).
- Картка статті (назва, опис, категорія, обкладинка) — у `src/data/blogData.js`
  і перекладах у `src/i18n/content/<мова>/blogData.js`.

Нова стаття: картка в `blogData.js` + файли `uk/en/ru/<id>.json`.
`npm run i18n:check` перевірить, що всі файли на місці й перекладені.
