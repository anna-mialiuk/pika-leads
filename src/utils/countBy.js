/**
 * Рахує кількість елементів за значенням поля.
 * Повертає об'єкт виду { all: 52, meta: 38, google: 14 }.
 */
export function countBy(items, key) {
  return items.reduce(
    (counts, item) => {
      const value = item[key];

      counts[value] = (counts[value] || 0) + 1;

      return counts;
    },
    { all: items.length },
  );
}

/** Фільтр «усі або конкретне значення» */
export function matches(value, active) {
  return active === "all" || value === active;
}
