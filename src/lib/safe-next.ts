const APP_PREFIXES = ["/admin", "/learn", "/profile"];
const PARSE_BASE = "https://app.invalid";

/**
 * Validates a post-login redirect (`?next=`): only same-origin paths inside the app are allowed.
 * Parsing (instead of checking the first characters) rejects tricks like `/\evil.com` or `/%09/evil.com`.
 */
export function safeNext(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, PARSE_BASE);
    if (url.origin !== PARSE_BASE) return null;
    const inApp = APP_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    return inApp ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
