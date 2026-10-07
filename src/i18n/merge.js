const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Накладає переклад (override) на базові дані (українська версія).
 * - об'єкт + об'єкт → рекурсивне злиття за ключами;
 * - масив + масив → злиття за індексом;
 * - масив + об'єкт → злиття елементів за полем `id` ({ [id]: override });
 * - примітив → значення з перекладу.
 * Усе, чого немає в перекладі, лишається українським (fallback).
 */
export function mergeTranslation(base, override) {
  if (override === undefined || override === null) return base;

  if (Array.isArray(base)) {
    if (Array.isArray(override)) {
      return base.map((item, index) => mergeTranslation(item, override[index]));
    }

    if (isPlainObject(override)) {
      return base.map((item) =>
        isPlainObject(item) && item.id !== undefined
          ? mergeTranslation(item, override[item.id])
          : item,
      );
    }

    return override;
  }

  if (isPlainObject(base) && isPlainObject(override)) {
    const result = { ...base };

    Object.keys(override).forEach((key) => {
      result[key] = mergeTranslation(base[key], override[key]);
    });

    return result;
  }

  return override;
}
