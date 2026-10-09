/** Тема панелі: темна (за замовчуванням) або світла. Вибір зберігається в браузері */
const KEY = "admin-theme";

export const THEMES = ["dark", "light"];

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (THEMES.includes(saved)) return saved;
  } catch {
    // приватний режим — лишаємо тему за замовчуванням
  }
  return "dark";
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f5f3ee" : "#121110");
}

export const getTheme = () => document.documentElement.dataset.theme || "dark";

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // не зберегли — тема діє до перезавантаження
  }
  applyTheme(theme);
  window.dispatchEvent(new Event("admin-theme"));
}

// ставимо тему до першого рендеру, щоб не блимало
if (typeof document !== "undefined") applyTheme(detect());

/** Колір тексту з «яскравого» кольору даних: на світлій темі трохи затемнюємо, щоб читався */
export const ink = (color) => `color-mix(in srgb, ${color}, #000 var(--ink-darken, 0%))`;
