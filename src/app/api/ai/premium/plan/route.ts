import { PremiumPlanRequestSchema, PremiumPlanSchema } from "@/lib/ai/premium";
import { ART_DIRECT_SYSTEM, buildPlanUser, PREMIUM_PROMPT_VERSION } from "@/lib/ai/prompts/premium";
import { toErrorResponse } from "@/lib/ai/server/errors";
import { sanitizePlan } from "@/lib/ai/server/premium-finish";
import { guard, json, readJson, runRich } from "@/lib/ai/server/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Premium step 1 — art direction: copy, fonts, palette and the artwork prompt. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, PremiumPlanRequestSchema);
    const ctx = guard(request, "artDirect", input.prefs, input.prompt.length);
    const { data, usage } = await runRich(ctx, {
      task: "artDirect",
      prefs: input.prefs,
      system: ART_DIRECT_SYSTEM,
      content: [{ type: "text", text: buildPlanUser(input) }],
      schema: PremiumPlanSchema,
    });
    return json({ plan: sanitizePlan(data), usage, promptVersion: PREMIUM_PROMPT_VERSION });
  } catch (error) {
    return toErrorResponse(error);
  }
}
