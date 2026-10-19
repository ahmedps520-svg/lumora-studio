/**
 * Copied elements travel through the system clipboard as text, so they paste
 * into other tabs, windows and designs (same browser — uploaded images live in
 * this browser's storage). Everything read back is validated with Zod.
 */
import { z } from "zod";
import { ElementSchema, LIMITS, type Element } from "@/lib/schema";

export const CLIPBOARD_PREFIX = "lumora/elements:v1:";
const MAX_CLIPBOARD_CHARS = 5_000_000;

const PayloadSchema = z.object({
  elements: z.array(ElementSchema).min(1).max(LIMITS.elementsPerPage),
});

export function serializeElements(elements: Element[]): string {
  return CLIPBOARD_PREFIX + JSON.stringify({ elements });
}

/** Elements from clipboard text, or null if the text isn't (valid) Lumora elements. */
export function parseClipboardText(text: string): Element[] | null {
  if (!text.startsWith(CLIPBOARD_PREFIX) || text.length > MAX_CLIPBOARD_CHARS) return null;
  try {
    const parsed = PayloadSchema.safeParse(JSON.parse(text.slice(CLIPBOARD_PREFIX.length)));
    return parsed.success ? parsed.data.elements : null;
  } catch {
    return null;
  }
}
