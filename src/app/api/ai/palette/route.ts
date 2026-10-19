import { PaletteRequestSchema, PaletteResultSchema } from "@/lib/ai/contract";
import { safeFont, safeHex } from "@/lib/ai/design-format";
import { buildPaletteUser, PALETTE_PROMPT_VERSION, PALETTE_SYSTEM } from "@/lib/ai/prompts/palette";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { guard, json, readJson, runStructured } from "@/lib/ai/server/run";
import { luminance } from "@/lib/engine/paint";

export const runtime = "nodejs";

/** Palette + font pairing ideas from a mood, brand or description. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, PaletteRequestSchema);
    const ctx = guard(request, "palette", input.prefs, input.prompt.length);
    const { data, usage } = await runStructured(ctx, {
      task: "palette",
      prefs: input.prefs,
      system: PALETTE_SYSTEM,
      user: buildPaletteUser(input),
      schema: PaletteResultSchema,
    });
    const palettes = data.palettes
      .map((p) => ({
        name: p.name.trim().slice(0, 60) || "Palette",
        mood: p.mood.trim().slice(0, 200),
        colors: [...new Set(p.colors.map((c) => safeHex(c, "")).filter(Boolean))]
          .slice(0, 6)
          .sort((a, b) => luminance(a) - luminance(b)),
        headingFont: safeFont(p.headingFont, "Sora"),
        bodyFont: safeFont(p.bodyFont, "Inter"),
      }))
      .filter((p) => p.colors.length >= 3)
      .slice(0, input.count);
    if (palettes.length === 0) throw new AiError("invalid_output", "No palettes came back.", 502);
    return json({ palettes, usage, promptVersion: PALETTE_PROMPT_VERSION });
  } catch (error) {
    return toErrorResponse(error);
  }
}
