/**
 * "Safari" and "iPhone" from a browser's User-Agent, for sign-in emails.
 * Names only: nothing is looked up or stored.
 */
export function describeDevice(
  userAgent: string | null | undefined,
): { browser: string | null; os: string | null } | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const os = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Macintosh|Mac OS X/.test(ua)
              ? "Mac"
              : /Linux/.test(ua)
                ? "Linux"
                : null;
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  return os || browser ? { browser, os } : null;
}
