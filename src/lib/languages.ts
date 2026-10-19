/** Languages offered for AI writing/translation (ISO codes; names come from the browser, localised). */
export const LANGUAGE_CODES = [
  "en",
  "ar",
  "fr",
  "es",
  "de",
  "pt",
  "it",
  "tr",
  "ur",
  "hi",
  "id",
  "zh",
  "ja",
  "ko",
] as const;

export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
