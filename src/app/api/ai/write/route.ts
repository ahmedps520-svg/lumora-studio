import { WriteRequestSchema, WriteResultSchema } from "@/lib/ai/contract";
import { buildWriteUser, WRITE_PROMPT_VERSION, WRITE_SYSTEM } from "@/lib/ai/prompts/write";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { guard, json, readJson, runStructured } from "@/lib/ai/server/run";

export const runtime = "nodejs";

/** Magic Write: rewrite / shorten / translate / headlines… for a piece of text. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, WriteRequestSchema);
    if (input.action !== "write" && !input.text.trim()) {
      throw new AiError("invalid_request", "Select some text first.", 400);
    }
    const ctx = guard(request, "write", input.prefs, input.text.length + input.instruction.length);
    const { text, count } = buildWriteUser(input);
    const { data, usage } = await runStructured(ctx, {
      task: "write",
      prefs: input.prefs,
      system: WRITE_SYSTEM,
      user: text,
      schema: WriteResultSchema,
    });
    const results = data.results
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(0, count);
    if (results.length === 0) throw new AiError("invalid_output", "No suggestions came back.", 502);
    return json({ results, usage, promptVersion: WRITE_PROMPT_VERSION });
  } catch (error) {
    return toErrorResponse(error);
  }
}
