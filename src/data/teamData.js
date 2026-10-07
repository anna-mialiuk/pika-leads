import vadymPhoto from "../assets/images/team/vadym-lebediev.webp";
import sofiiaPhoto from "../assets/images/team/sofiia-hrybuk.webp";
import annaPhoto from "../assets/images/team/anna-mialiuk.webp";
import oksanaPhoto from "../assets/images/team/oksana-tkachuk.webp";

/**
 * Команда. Один список для головної (перші 3) і сторінки «Команда» (усі).
 * image — імпорт фото (import photo from "../assets/images/team/...") або null:
 * тоді на картці показуються ініціали.
 */
export const team = [
  {
    id: "vadym-lebediev",
    name: "Вадим Лебедєв",
    position: "Native Media Buyer",
    description:
      "Запускає, оптимізує та масштабує Native-кампанії у вертикалях Crypto, Gambling і Nutra.",
    bio: "Media Buyer із досвідом роботи з нативною рекламою та high-risk вертикалями. Спеціалізується на запуску, оптимізації та масштабуванні рекламних кампаній у напрямах Crypto/FFX, Gambling і Nutra.",
    image: vadymPhoto,
    experience: [
      {
        id: "crypto",
        title: "3 роки — Crypto / FFX",
        note: "High-Risk Verticals",
      },
      {
        id: "gambling",
        title: "4 роки — Gambling Native",
        note: "White Hat / Licensed",
      },
      { id: "nutra", title: "1 рік — Nutra Native", note: "MediaGo / Bing" },
    ],
    skillsTitle: "Спеціалізація",
    skills: [
      "Native Advertising",
      "Media Buying",
      "Campaign Optimization",
      "Campaign Scaling",
      "Crypto / FFX",
      "Gambling",
      "Nutra",
      "MediaGo",
      "Bing",
    ],
    education: [],
  },
  {
    id: "sofiia-hrybuk",
    name: "Софія Грибук",
    position: "Графічна дизайнерка",
    description:
      "Створює рекламні креативи, дизайн для соціальних мереж та вебсайтів.",
    bio: "Графічна дизайнерка з 2 роками досвіду роботи в агенції та 4 роками роботи у Figma. Спеціалізується на створенні рекламних креативів, банерів, контенту для Instagram (дописів, каруселей і Stories) та дизайні вебсайтів. Здобуває профільну освіту, має знання з композиції та теорії кольору, працює в Adobe Photoshop. Має досвід командної роботи та виконання дизайн-завдань у межах спільних проєктів.",
    image: sofiiaPhoto,
    experience: [],
    skillsTitle: "Навички",
    skills: [
      "UI/UX & Web Design",
      "Верстка та типографіка",
      "Figma",
      "Adobe Photoshop",
      "Адаптація дизайну під різні формати",
      "Рекламні креативи",
      "Дизайн для соціальних мереж",
      "AI Image Generation",
    ],
    education: [
      {
        id: "figma-basic",
        title: "Базовий курс із Figma",
        year: "2022",
        note: "Початковий рівень",
      },
      {
        id: "figma-web",
        title: "Figma для вебдизайнера",
        year: "2022",
        note: "Професійний рівень",
      },
      {
        id: "photoshop",
        title: "Базовий курс із Photoshop",
        year: "2022",
        note: "Вебдизайн",
      },
      {
        id: "uiux",
        title: "UI/UX Design у Figma",
        year: "2024",
        note: "Вебдизайн",
      },
      {
        id: "lntu",
        title: "ЛНТУ, бакалаврат",
        year: "2024–2028",
        note: "Графічний дизайн",
      },
      {
        id: "design-inspire",
        title: "Design Inspire",
        year: "2025–2026",
        note: "Курс із вебдизайну",
      },
    ],
  },
  {
    id: "anna-mialiuk",
    name: "Анна М’ялюк",
    position: "Web Developer",
    description:
      "Розробляє сайти та вебінтерфейси на React і підключає необхідні інтеграції.",
    bio: "Розробляє сучасні адаптивні вебсайти та вебінтерфейси. Працює з React і JavaScript, створює адмінпанелі, підключає форми, CRM-системи та сторонні сервіси, а також займається розгортанням і технічною оптимізацією сайтів.",
    image: annaPhoto,
    experience: [],
    skillsTitle: "Навички",
    skills: [
      "React",
      "JavaScript",
      "HTML / CSS",
      "SCSS / SASS",
      "Адаптивна верстка",
      "REST API та інтеграції",
      "Розробка адмінпанелей",
      "CRM-інтеграції",
      "Git / GitHub",
      "Deployment",
      "SEO та технічна оптимізація",
      "Figma",
    ],
    education: [
      {
        id: "tilda",
        title: "Створення сайтів і вебдизайн у Tilda. З нуля до результату",
        year: "2023",
        note: "Udemy · Дмитро Фокєєв",
      },
      {
        id: "wordpress",
        title: "Курс із WordPress. З нуля до результату",
        year: "2024",
        note: "Udemy · Дмитро Фокєєв",
      },
      {
        id: "layout-basic",
        title: "Верстка та створення вебсайтів — з нуля до результату",
        year: "2024",
        note: "Udemy · Дмитро Фокєєв",
      },
      {
        id: "layout-advanced",
        title: "Верстка та створення вебсайтів — просунутий рівень",
        year: "2025",
        note: "Udemy · Дмитро Фокєєв",
      },
      {
        id: "javascript",
        title: "Повний курс із JavaScript — з нуля до результату",
        year: "2025",
        note: "Udemy · Дмитро Фокєєв",
      },
      {
        id: "javascript-react-node",
        title: "JavaScript — майстер-клас із веброзробки, React і Node.js",
        year: "2026",
        note: "Udemy · Богдан Стащук",
      },
      {
        id: "react",
        title: "Повний курс із React JS (Redux / Router / Tailwind CSS)",
        year: "2026",
        note: "Udemy · Дмитро Фокєєв",
      },
    ],
  },
  {
    id: "oksana-tkachuk",
    name: "Оксана Ткачук",
    position: "Project Manager",
    description:
      "Координує роботу команди, контролює виконання завдань і дотримання дедлайнів.",
    bio: "Координує роботу команди та організовує робочі процеси в межах проєктів. Контролює виконання завдань і дотримання дедлайнів, забезпечує ефективну комунікацію між учасниками команди.",
    image: oksanaPhoto,
    experience: [],
    skillsTitle: "Навички",
    skills: [
      "Project Management",
      "Task Management",
      "Team Coordination",
      "Планування та пріоритизація",
      "Контроль дедлайнів",
      "Організація робочих процесів",
      "Комунікація з командою",
      "Контроль виконання завдань",
    ],
    education: [],
  },
];
