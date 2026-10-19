import { DesignRequestSchema } from "@/lib/ai/contract";
import {
  aiDesignToPage,
  AiDesignSchema,
  autoFixPage,
  safeFont,
  safeHex,
} from "@/lib/ai/design-format";
import { buildDesignUser, DESIGN_PROMPT_VERSION, DESIGN_SYSTEM } from "@/lib/ai/prompts/design";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { guard, json, readJson, runRich } from "@/lib/ai/server/run";

export const runtime = "nodejs";
/** Generation can take a while on larger models. */
export const maxDuration = 60;

/** Magic Design: brief → complete, editable page (validated + auto-fixed). */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, DesignRequestSchema);
    const ctx = guard(request, "design", input.prefs, input.prompt.length);
    const style = input.style;
    const { data, usage } = await runRich(ctx, {
      task: "design",
      prefs: input.prefs,
      system: DESIGN_SYSTEM,
      content: [{ type: "text", text: buildDesignUser(input, style) }],
      schema: AiDesignSchema,
    });
    if (data.elements.length === 0)
      throw new AiError("invalid_output", "The design came back empty.", 502);

    const palette = data.palette
      .map((c) => safeHex(c, ""))
      .filter(Boolean)
      .slice(0, 8);
    const converted = aiDesignToPage(data, input.format);
    const { page, fixes } = autoFixPage(converted, input.format, palette);

    return json({
      page,
      concept: data.concept.slice(0, 300),
      palette,
      headingFont: safeFont(data.headingFont, "Sora"),
      bodyFont: safeFont(data.bodyFont, "Inter"),
      style,
      fixes,
      usage,
      promptVersion: DESIGN_PROMPT_VERSION,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
