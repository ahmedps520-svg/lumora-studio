import type Anthropic from "@anthropic-ai/sdk";
import {
  assistantToolDefinitions,
  parseAssistantAction,
  type AssistantAction,
} from "@/lib/ai/assistant-tools";
import { AssistantRequestSchema } from "@/lib/ai/contract";
import { ASSISTANT_PROMPT_VERSION, ASSISTANT_SYSTEM } from "@/lib/ai/prompts/assistant";
import { asData, prefsGuidance, sanitize } from "@/lib/ai/prompts/shared";
import { toErrorResponse } from "@/lib/ai/server/errors";
import { guard, json, readJson, runTools } from "@/lib/ai/server/run";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Design Assistant: natural-language edits → validated tool calls for the browser to apply. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, AssistantRequestSchema);
    const ctx = guard(request, "assistant", input.prefs, input.scene.length + input.message.length);

    const history: Anthropic.Beta.BetaMessageParam[] = input.history.map((turn) => ({
      role: turn.role,
      content: sanitize(turn.text, 4_000) || "…",
    }));
    const guidance = prefsGuidance(input.prefs);
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history,
      {
        role: "user",
        content: [
          `Current page (${Math.round(input.format.width)}×${Math.round(input.format.height)}):`,
          asData("scene", input.scene, 60_000),
          input.selection.length > 0
            ? `Selected ids: ${input.selection.join(", ")}`
            : "Nothing is selected.",
          guidance ? `Preferences:\n${guidance}` : "",
          `Request:\n${asData("user_request", input.message, 2_000)}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ];

    const { text, toolCalls, usage } = await runTools(ctx, {
      task: "assistant",
      prefs: input.prefs,
      system: ASSISTANT_SYSTEM,
      tools: assistantToolDefinitions(),
      messages,
    });

    const actions: AssistantAction[] = [];
    let rejected = 0;
    for (const call of toolCalls) {
      const action = parseAssistantAction(call.name, call.input);
      if (action) actions.push(action);
      else rejected++;
    }
    // When edits were made, show only the opening summary (any working-out after it is noise).
    // Pure answers (no edits) are kept in full.
    const reply = actions.length > 0 ? (text.split(/\n\s*\n/)[0] ?? "").slice(0, 300) : text;
    return json({
      reply: reply.slice(0, 2_000),
      actions,
      rejected,
      usage,
      promptVersion: ASSISTANT_PROMPT_VERSION,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
