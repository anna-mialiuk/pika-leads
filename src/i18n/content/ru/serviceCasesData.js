/* Переклад src/data/serviceCasesData.js російською. Лише текстові поля; масиви з id — за id. */

export const caseSources = {
  meta: {
    buttonText: "Все кейсы Meta",
  },
  google: {
    buttonText: "Все кейсы Google Ads",
  },
  tiktok: {
    buttonText: "Все кейсы TikTok Ads",
  },
  x: {
    buttonText: "Все кейсы X Ads",
  },
  linkedin: {
    buttonText: "Все кейсы LinkedIn Ads",
  },
  website: {
    buttonText: "Все кейсы",
  },
};

export const previewCases = {
  tiktok: {
    "tiktok-clothing-store": {
      title: "Магазин одежды",
      description:
        "Масштабировали закупку с сохранением ROAS через тесты 40+ креативов.",
      metrics: [
        null,
        {
          label: "объём",
        },
      ],
    },
    "tiktok-aesthetic-clinic": {
      category: "Медицина",
      title: "Клиника эстетики",
      description: "Поток целевых записей из TikTok со снижением цены заявки.",
      metrics: [
        null,
        {
          label: "заявок",
        },
      ],
    },
    "tiktok-online-school": {
      category: "Инфобизнес",
      title: "Онлайн-школа",
      description:
        "Стабильный набор на вебинары через рекламные связки и лид-формы.",
      metrics: [
        {
          label: "за лид",
        },
        {
          label: "заявок",
        },
      ],
    },
  },
  x: {
    "x-clothing-store": {
      title: "Магазин одежды",
      description:
        "Масштабировали закупку с сохранением ROAS через тесты 40+ креативов.",
      metrics: [
        null,
        {
          label: "объём",
        },
      ],
    },
    "x-aesthetic-clinic": {
      category: "Медицина",
      title: "Клиника эстетики",
      description:
        "Поток целевых записей из X (Twitter) со снижением цены заявки.",
      metrics: [
        null,
        {
          label: "заявок",
        },
      ],
    },
    "x-online-school": {
      category: "Инфобизнес",
      title: "Онлайн-школа",
      description:
        "Стабильный набор на вебинары через рекламные связки и лид-формы.",
      metrics: [
        {
          label: "за лид",
        },
        {
          label: "заявок",
        },
      ],
    },
  },
  website: {
    "website-corporate": {
      category: "Корпоративный",
      title: "Корпоративный сайт",
      description: "Многостраничный сайт с блогом, услугами и формами захвата.",
    },
    "website-landing": {
      category: "Лендинг",
      title: "Лендинг под трафик",
      description:
        "Одностраничный сайт с быстрой загрузкой и высокой конверсией.",
    },
    "website-ecommerce": {
      title: "Интернет-магазин",
      description: "Каталог, корзина, оплата и интеграция с CRM.",
    },
    "website-services": {
      category: "Услуги",
      title: "Сайт компании услуг",
      description: "Сайт услуг с онлайн-заявкой и калькулятором.",
    },
    "website-promo": {
      category: "Промо",
      title: "Промо / event",
      description: "Яркий промо-сайт под запуск продукта или событие.",
    },
    "website-webapp": {
      title: "Веб-сервис / SaaS",
      description: "Личный кабинет и дашборд для онлайн-сервиса.",
    },
  },
};
