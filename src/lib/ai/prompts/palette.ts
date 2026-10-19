/** Palette & font pairing prompt — v1 */
import type { z } from "zod";
import { STARTER_FONTS } from "@/lib/fonts/catalog";
import type { PaletteRequestSchema } from "../contract";
import { asData, DATA_RULE, prefsGuidance } from "./shared";

export const PALETTE_PROMPT_VERSION = "palette@1";

const FONT_LIST = STARTER_FONTS.map(
  (f) => `${f.family}${f.arabic ? " (supports Arabic)" : ""}`,
).join(", ");

export const PALETTE_SYSTEM = `You are a senior brand and colour designer. You create harmonious, usable colour palettes and font pairings for graphic designs.

Rules for every palette:
- Exactly 5 colours as #RRGGBB hex codes, ordered from darkest to lightest.
- Include at least one colour dark enough and one light enough for readable text on it (WCAG AA contrast 4.5:1 between the darkest and lightest).
- Include one vivid accent colour for buttons and highlights.
- Give each palette a short evocative name (2–3 words) and a one-line mood description.
- Choose headingFont and bodyFont ONLY from this list: ${FONT_LIST}.
- If the request is in Arabic or about an Arabic-speaking audience, choose fonts that support Arabic.
- Make the palettes in one answer clearly different from each other.

${DATA_RULE}`;

type PaletteInput = z.output<typeof PaletteRequestSchema>;

export function buildPaletteUser(input: PaletteInput): string {
  const parts = [
    `Create ${input.count} palettes with font pairings for this:`,
    asData("user_request", input.prompt, 600),
  ];
  if (input.currentColors.length > 0) {
    parts.push(
      `The design currently uses: ${input.currentColors.join(", ")}. Palettes should work as a refresh of it.`,
    );
  }
  parts.push(`Preferences:\n${prefsGuidance(input.prefs)}`);
  return parts.join("\n\n");
}
