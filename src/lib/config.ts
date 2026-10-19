/** App-wide constants that are safe to ship to the browser. */
export const APP_NAME = "Lumora Studio";
export const APP_TAGLINE = "Design anything. Let AI do the heavy lifting.";
/** From package.json (set in next.config.ts). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
