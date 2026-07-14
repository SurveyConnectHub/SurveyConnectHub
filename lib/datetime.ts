/**
 * Returns the current viewer's preferred locale for use with `Intl`
 * constructors (`toLocaleDateString`, `toLocaleString`, etc.).
 *
 * Falls back to `undefined` (which the Intl constructors accept and
 * interpret as the runtime default locale) when `navigator.language`
 * is unavailable, e.g. during SSR.
 */
export function userLocale(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.language || undefined;
}
