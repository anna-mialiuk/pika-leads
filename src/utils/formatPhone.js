export function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 9);

  const parts = [];

  if (digits.length > 0) {
    parts.push(digits.slice(0, 2));
  }

  if (digits.length > 2) {
    parts.push(digits.slice(2, 5));
  }

  if (digits.length > 5) {
    parts.push(digits.slice(5, 7));
  }

  if (digits.length > 7) {
    parts.push(digits.slice(7, 9));
  }

  return parts.filter(Boolean).join(" ");
}
