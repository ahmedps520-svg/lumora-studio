"use client";

/**
 * A script that runs once during HTML parsing (first page load) and is inert
 * afterwards. On the client it renders as text/plain, so React never creates
 * a live <script> during re-renders (which it warns about and wouldn't run).
 * The nonce lets it pass our Content-Security-Policy.
 */
export function InlineScript({ html, nonce }: { html: string; nonce?: string }) {
  return (
    <script
      nonce={nonce}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
