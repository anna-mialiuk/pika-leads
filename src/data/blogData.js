import blogCapi from "../assets/images/blog/blog-capi.png";
import blogTools from "../assets/images/blog/blog-tools.png";
import blogBans from "../assets/images/blog/blog-bans.png";
import blogMinusWords from "../assets/images/blog/meta-minus-words.png";
import blogPixelWordpress from "../assets/images/blog/meta-pixel-wordpress.png";
import blogMetaUpdate from "../assets/images/blog/meta-ads-update.png";
import blogDirectLimits from "../assets/images/blog/meta-direct-eu-limits.png";
import blogCyclicRestrictions from "../assets/images/blog/meta-cyclic-restrictions.png";
import blogBusinessTrust from "../assets/images/blog/meta-business-trust.png";
import blogAndromedaGem from "../assets/images/blog/meta-andromeda-gem.png";
import blogAdRejections from "../assets/images/blog/meta-ad-rejections.png";

export const blogArticles = [
  {
    id: "capi-setup",
    featured: true,
    topic: "analytics",
    level: "advanced",
    category: "Аналітика",
    type: "blue",
    image: blogCapi,
    date: "2024-10-08",
    readTime: "11 хв",
    title: "Налаштування CAPI Meta Pixel: повний розбір, помилки та рішення",
    description:
      "Meta переводить трекінг на серверний бік. Розбираємо налаштування Conversions API від створення пікселя до дедуплікації подій.",
    href: "/blog/capi-setup",
  },

  {
    id: "capi-tools",
    featured: true,
    topic: "analytics",
    level: "intermediate",
    category: "Аналітика",
    type: "green",
    image: blogTools,
    date: "2024-10-07",
    readTime: "3 хв",
    title:
      "Сервіси для підключення CAPI: 11 способів налаштувати серверний трекінг",
    description:
      "Якщо web-піксель вимкнуть, залишиться Conversions API. Розбираємо інструменти — від нативної інтеграції Meta до Server-Side GTM.",
    href: "/blog/capi-tools",
  },

  {
    id: "meta-bans",
    featured: true,
    topic: "advertising",
    level: "intermediate",
    category: "Реклама",
    type: "purple",
    image: blogBans,
    date: "2024-10-04",
    readTime: "2 хв",
    title: "Як обійти бани в Meta Ads: креативи, тексти та посадкові",
    description:
      "Відхилення оголошень, реджекти та бани за креативи. Розбираємо три джерела проблем і що з кожним робити.",
    href: "/blog/meta-bans",
  },

  {
    id: "meta-minus-words",
    topic: "advertising",
    level: "basic",
    category: "Реклама",
    type: "yellow",
    image: blogMinusWords,
    date: "2024-10-11",
    readTime: "4 хв",
    title: "Мінус-слова для Meta Ads: як уникнути відхилення реклами",
    description:
      "Зібрали слова, що тригерять модерацію Meta, розбили за вертикалями та пояснили, що саме кожне з них порушує.",
    href: "/blog/meta-minus-words",
  },

  {
    id: "meta-pixel-wordpress-errors",
    topic: "technical",
    level: "intermediate",
    category: "Технічно",
    type: "blue",
    image: blogPixelWordpress,
    date: "2024-10-07",
    readTime: "2 хв",
    title:
      "Помилки Meta Pixel на WordPress: «Оновіть події IPv6 на View Content»",
    description:
      "Рідкісна, але неприємна помилка пікселя. Розбираємо, звідки вона береться і як її закрити за п’ять кроків.",
    href: "/blog/meta-pixel-wordpress-errors",
  },

  {
    id: "meta-ads-update",
    topic: "advertising",
    level: "intermediate",
    category: "Реклама",
    type: "purple",
    image: blogMetaUpdate,
    date: "2024-10-08",
    readTime: "3 хв",
    title:
      "Оновлення Meta Ads: що розповіла підтримка про гео, бюджети й тести",
    description:
      "Розбір прямої розмови з підтримкою Meta: зміни гео-таргетингу, корекція бюджету на +25% і сім днів на стабілізацію.",
    href: "/blog/meta-ads-update",
  },

  {
    id: "meta-direct-eu-limits",
    topic: "advertising",
    level: "advanced",
    category: "Реклама",
    type: "red",
    image: blogDirectLimits,
    date: "2024-01-29",
    readTime: "2 хв",
    title:
      "Обхід європейських обмежень на Direct: як оптимізуватися на повідомлення",
    description:
      "Коли треба гнати на Direct по Європі, а оптимізація на кліки не варіант. Два способи з налаштуванням пікселя на проміжну сторінку.",
    href: "/blog/meta-direct-eu-limits",
  },

  {
    id: "meta-cyclic-restrictions",
    topic: "advertising",
    level: "intermediate",
    category: "Реклама",
    type: "blue",
    image: blogCyclicRestrictions,
    date: "2026-08-04",
    readTime: "12 хв",
    title:
      "Циклічні обмеження Meta: чому Facebook-сторінка стала ключовим рекламним активом",
    description:
      "Блокування в Meta виглядають випадковими лише на одному кабінеті. На десятках проєктів видно іншу картину — і головний висновок у тому, що захищати треба всю екосистему.",
    href: "/blog/meta-cyclic-restrictions",
  },

  {
    id: "meta-business-trust",
    topic: "advertising",
    level: "intermediate",
    category: "Реклама",
    type: "yellow",
    image: blogBusinessTrust,
    date: "2026-08-06",
    readTime: "13 хв",
    title:
      "Як підвищити довіру до бізнесу в Meta: реальні сигнали, практичний аудит і міфи",
    description:
      "Універсального Trust Score у Meta немає. Розбираємо, які фактори підтверджені платформою, які міфи коштують грошей і як зібрати чесний внутрішній аудит із восьми блоків.",
    href: "/blog/meta-business-trust",
  },

  {
    id: "meta-andromeda-gem",
    topic: "analytics",
    level: "advanced",
    category: "Аналітика",
    type: "purple",
    image: blogAndromedaGem,
    date: "2026-08-01",
    readTime: "11 хв",
    title:
      "Andromeda та GEM у Meta Ads: як насправді працюють рекламні AI-моделі",
    description:
      "«GEM шукає людей, Andromeda обирає креатив» — красиве, але хибне формулювання. Розбираємо справжню багаторівневу архітектуру доставки реклами.",

    href: "/blog/meta-andromeda-gem",
  },

  {
    id: "meta-ad-rejections-after-launch",
    topic: "advertising",
    level: "intermediate",
    category: "Реклама",
    type: "red",
    image: blogAdRejections,
    date: "2026-08-08",
    readTime: "14 хв",
    title:
      "Чому Meta відхиляє рекламу після запуску: багаторівнева модерація та безпечна діагностика",
    description:
      "Статус «Активна» — не довічна гарантія. Розбираємо повторну модерацію, ризики домену та покроковий алгоритм діагностики замість масового перезапуску.",
    href: "/blog/meta-ad-rejections-after-launch",
  },
];
