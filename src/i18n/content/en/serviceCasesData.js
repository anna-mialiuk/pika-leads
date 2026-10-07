/* Переклад src/data/serviceCasesData.js англійською. Лише текстові поля; масиви з id — за id. */

export const caseSources = {
  meta: {
    buttonText: "All Meta cases",
  },
  google: {
    buttonText: "All Google Ads cases",
  },
  tiktok: {
    buttonText: "All TikTok Ads cases",
  },
  x: {
    buttonText: "All X Ads cases",
  },
  linkedin: {
    buttonText: "All LinkedIn Ads cases",
  },
  website: {
    buttonText: "All cases",
  },
};

export const previewCases = {
  tiktok: {
    "tiktok-clothing-store": {
      title: "Clothing store",
      description:
        "Scaled media buying while keeping ROAS, through tests of 40+ creatives.",
      metrics: [
        null,
        {
          label: "volume",
        },
      ],
    },
    "tiktok-aesthetic-clinic": {
      category: "Medicine",
      title: "Aesthetic clinic",
      description:
        "A flow of qualified bookings from TikTok with a lower cost per lead.",
      metrics: [
        null,
        {
          label: "leads",
        },
      ],
    },
    "tiktok-online-school": {
      category: "Online education",
      title: "Online school",
      description:
        "A steady stream of webinar sign-ups through ad funnels and lead forms.",
      metrics: [
        {
          label: "per lead",
        },
        {
          value: "8,200",
          label: "leads",
        },
      ],
    },
  },
  x: {
    "x-clothing-store": {
      title: "Clothing store",
      description:
        "Scaled media buying while keeping ROAS, through tests of 40+ creatives.",
      metrics: [
        null,
        {
          label: "volume",
        },
      ],
    },
    "x-aesthetic-clinic": {
      category: "Medicine",
      title: "Aesthetic clinic",
      description:
        "A flow of qualified bookings from X (Twitter) with a lower cost per lead.",
      metrics: [
        null,
        {
          label: "leads",
        },
      ],
    },
    "x-online-school": {
      category: "Online education",
      title: "Online school",
      description:
        "A steady stream of webinar sign-ups through ad funnels and lead forms.",
      metrics: [
        {
          label: "per lead",
        },
        {
          value: "8,200",
          label: "leads",
        },
      ],
    },
  },
  website: {
    "website-corporate": {
      category: "Corporate",
      title: "Corporate website",
      description:
        "A multi-page website with a blog, services and lead capture forms.",
    },
    "website-landing": {
      category: "Landing page",
      title: "Landing page for paid traffic",
      description: "A fast-loading, high-converting one-page website.",
    },
    "website-ecommerce": {
      title: "Online store",
      description: "Catalog, cart, payments and CRM integration.",
    },
    "website-services": {
      category: "Services",
      title: "Service company website",
      description: "A services website with online booking and a calculator.",
    },
    "website-promo": {
      category: "Promo",
      title: "Promo / event",
      description: "A bold promo website for a product launch or an event.",
    },
    "website-webapp": {
      title: "Web service / SaaS",
      description: "A user account area and dashboard for an online service.",
    },
  },
};
