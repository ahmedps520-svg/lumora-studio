/**
 * Builds the Content-Security-Policy header value.
 *
 * Scripts are locked down with a per-request nonce + 'strict-dynamic', so an
 * injected <script> tag can never run. Styles allow 'unsafe-inline' because
 * server-rendered UI primitives use inline style attributes (a nonce cannot
 * cover those), which is the standard trade-off for React apps.
 */

/** Hosts that serve stock photos we display (Unsplash, Pexels, Pixabay). */
export const IMAGE_HOSTS = [
  "https://images.unsplash.com",
  "https://plus.unsplash.com",
  "https://images.pexels.com",
  "https://pixabay.com",
  "https://cdn.pixabay.com",
] as const;

/** Hosts the browser fetches from directly (fonts, in-browser AI model files). */
export const CONNECT_HOSTS = [
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
  // Open-source background-removal models (downloaded once, then cached).
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
] as const;

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  /** Only ask browsers to upgrade http→https when we are actually served over https. */
  https: boolean;
}

export function buildCsp({ nonce, isDev, https }: CspOptions): string {
  const directives: Record<string, readonly string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // WebAssembly is needed for the in-browser background remover.
      "'wasm-unsafe-eval'",
      // React uses eval() in development only, for better error stacks.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": ["'self'", "data:", "blob:", ...IMAGE_HOSTS],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    // blob: lets downloads read pictures the page already made (e.g. SVG export).
    "connect-src": ["'self'", "blob:", ...CONNECT_HOSTS],
    "media-src": ["'self'", "data:", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Cryptographically random, base64 nonce. Works in both Edge and Node runtimes. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
