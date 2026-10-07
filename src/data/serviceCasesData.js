/**
 * Дані секції «Кейси» на сторінках послуг.
 * Для джерел без реальних кейсів показуємо превʼю-картки з градієнтом замість фото.
 */
export const caseSources = {
  meta: { name: "Meta", label: "Meta Ads", buttonText: "Усі кейси Meta" },
  google: {
    name: "Google",
    label: "Google Ads",
    buttonText: "Усі кейси Google Ads",
  },
  tiktok: {
    name: "TikTok",
    label: "TikTok Ads",
    buttonText: "Усі кейси TikTok Ads",
  },
  x: { name: "X", label: "X Ads", buttonText: "Усі кейси X Ads" },
  linkedin: {
    name: "LinkedIn",
    label: "LinkedIn Ads",
    buttonText: "Усі кейси LinkedIn Ads",
  },
  website: { name: "Website", label: "Website", buttonText: "Усі кейси" },
};

/** Джерела, для яких замість реальних кейсів рендеримо превʼю */
export const previewSources = ["tiktok", "x", "linkedin", "website"];

export const previewCases = {
  tiktok: [
    {
      id: "tiktok-clothing-store",
      category: "E-commerce",
      title: "Магазин одягу",
      description:
        "Масштабували закупівлю зі збереженням ROAS через тести 40+ креативів.",
      visualGradient:
        "linear-gradient(135deg, #FE2C55 0%, #8B98A5 50%, #25F4EE 100%)",
      metrics: [
        {
          value: "6.4x",
          label: "ROAS",
        },
        {
          value: "×3",
          label: "обсяг",
        },
      ],
    },
    {
      id: "tiktok-aesthetic-clinic",
      category: "Медицина",
      title: "Клініка естетики",
      description: "Потік цільових записів із TikTok зі зниженням ціни заявки.",
      visualGradient:
        "linear-gradient(135deg, #25F4EE 0%, #8B98A5 50%, #FE2C55 100%)",
      metrics: [
        {
          value: "−48%",
          label: "CPL",
        },
        {
          value: "+210%",
          label: "заявок",
        },
      ],
    },
    {
      id: "tiktok-online-school",
      category: "Інфобізнес",
      title: "Онлайн-школа",
      description:
        "Стабільний набір на вебінари через рекламні зв'язки та лід-форми.",
      visualGradient:
        "linear-gradient(135deg, #FE2C55 0%, #8B98A5 50%, #25F4EE 100%)",
      metrics: [
        {
          value: "$1.9",
          label: "за лід",
        },
        {
          value: "8 200",
          label: "заявок",
        },
      ],
    },
  ],

  x: [
    {
      id: "x-clothing-store",
      category: "E-commerce",
      title: "Магазин одягу",
      description:
        "Масштабували закупівлю зі збереженням ROAS через тести 40+ креативів.",
      visualGradient: "linear-gradient(135deg, #1D9BF0 0%, #4DB5F5 100%)",
      metrics: [
        {
          value: "6.4x",
          label: "ROAS",
        },
        {
          value: "×3",
          label: "обсяг",
        },
      ],
    },
    {
      id: "x-aesthetic-clinic",
      category: "Медицина",
      title: "Клініка естетики",
      description:
        "Потік цільових записів із X (Twitter) зі зниженням ціни заявки.",
      visualGradient: "linear-gradient(135deg, #8B98A5 0%, #8B98A5 100%)",
      metrics: [
        {
          value: "−48%",
          label: "CPL",
        },
        {
          value: "+210%",
          label: "заявок",
        },
      ],
    },
    {
      id: "x-online-school",
      category: "Інфобізнес",
      title: "Онлайн-школа",
      description:
        "Стабільний набір на вебінари через рекламні зв'язки та лід-форми.",
      visualGradient: "linear-gradient(135deg, #4DB5F5 0%, #8B98A5 100%)",
      metrics: [
        {
          value: "$1.9",
          label: "за лід",
        },
        {
          value: "8 200",
          label: "заявок",
        },
      ],
    },
  ],
  website: [
    {
      id: "website-corporate",
      category: "Корпоративний",
      title: "Корпоративний сайт",
      description:
        "Багатосторінковий сайт із блогом, послугами та формами захоплення.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
    {
      id: "website-landing",
      category: "Лендинг",
      title: "Лендинг під трафік",
      description:
        "Односторінковий сайт зі швидким завантаженням і високою конверсією.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
    {
      id: "website-ecommerce",
      category: "E-commerce",
      title: "Інтернет-магазин",
      description: "Каталог, кошик, оплата та інтеграція з CRM.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
    {
      id: "website-services",
      category: "Послуги",
      title: "Сайт компанії послуг",
      description: "Сайт послуг з онлайн-заявкою та калькулятором.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
    {
      id: "website-promo",
      category: "Промо",
      title: "Промо / event",
      description: "Яскравий промо-сайт під запуск продукту чи подію.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
    {
      id: "website-webapp",
      category: "Web-app",
      title: "Вебсервіс / SaaS",
      description: "Особистий кабінет і дашборд для онлайн-сервісу.",
      visualGradient: "linear-gradient(135deg, #101720 0%, #17233a 100%)",
      metrics: [],
    },
  ],
};
