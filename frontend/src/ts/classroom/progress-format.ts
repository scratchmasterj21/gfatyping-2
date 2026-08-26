/**
 * Shared report formatting helpers.
 *
 * Lives apart from progress-pdf so the CSV path (and anything else that only
 * needs formatting) can reach these without statically pulling jspdf into the
 * bundle - progress-pdf is loaded on demand.
 */

/** Uppercase letters for readability; leave punctuation as-is; name whitespace keys. */
export function displayChar(c: string): string {
  if (c === " ") return "space";
  if (c === "\t") return "tab";
  if (c === "\n") return "enter";
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

/** Top weak keys as a readable comma list, worst first, or "-" if none tracked yet. */
export function formatWeakKeys(
  weakKeys: Record<string, number>,
  limit = 5,
): string {
  const sorted = Object.entries(weakKeys).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "-";
  return sorted
    .slice(0, limit)
    .map(([c]) => displayChar(c))
    .join(", ");
}
