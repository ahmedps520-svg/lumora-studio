/** Magic Write prompt — v1 */
import type { WriteAction } from "../contract";
import type { z } from "zod";
import type { WriteRequestSchema } from "../contract";
import { asData, DATA_RULE, prefsGuidance, sanitize } from "./shared";

export const WRITE_PROMPT_VERSION = "write@1";

export const WRITE_SYSTEM = `You are Lumora's writing assistant. You write copy that will be placed inside graphic designs: social posts, slides, posters, flyers, invitations and ads.

Principles:
- Design copy is short and scannable. Prefer strong verbs and concrete words. No filler.
- Keep the user's facts (names, dates, prices, places, numbers) exactly as given.
- Never add claims, prices or promises the user did not provide.
- Match the language of the source text unless told otherwise. For Arabic, write natural Modern Standard Arabic unless the source is dialect.
- Return plain text only in each result: no quotation marks around it, no markdown, no labels like "Option 1".
- Each result is a complete alternative the user can drop straight into their design.

${DATA_RULE}`;

type WriteInput = z.output<typeof WriteRequestSchema>;

/** Actions that only make sense with a single answer. */
export const SINGLE_RESULT_ACTIONS: ReadonlySet<WriteAction> = new Set([
  "fix",
  "translate",
  "emojify",
]);

function task(input: WriteInput, count: number): string {
  const n = count === 1 ? "one version" : `${count} different versions`;
  switch (input.action) {
    case "write":
      return `Write ${n} of design copy for this request.`;
    case "rewrite":
      return `Rewrite the source text as ${n}, keeping the meaning and roughly the same length.`;
    case "shorten":
      return `Make the source text about half as long. Give ${n}.`;
    case "expand":
      return `Expand the source text with useful, specific detail (at most twice as long). Give ${n}.`;
    case "fix":
      return "Fix spelling, grammar and punctuation in the source text. Change nothing else.";
    case "simplify":
      return `Rewrite the source text in plain, simple words a 12-year-old would understand. Give ${n}.`;
    case "tone":
      return `Rewrite the source text in a ${input.targetTone ?? "friendly"} tone. Give ${n}.`;
    case "translate":
      return `Translate the source text into ${sanitize(input.targetLanguage ?? "English", 40)}. Keep line breaks, names, numbers and emojis. Sound natural, not literal.`;
    case "continue":
      return `Continue the source text naturally with one or two more sentences. Each result is the full text including the original. Give ${n}.`;
    case "headlines":
      return `Write ${count} catchy headline options (max 8 words each) for the topic of the source text.`;
    case "hashtags":
      return `Suggest ${count} alternative sets of 5–10 relevant hashtags for the source text. Each result is one line of space-separated hashtags.`;
    case "caption":
      return `Write ${count} social media captions for a post about the source text. Use 1–2 emojis only where natural, and end with a light call to action.`;
    case "cta":
      return `Write ${count} short call-to-action button labels (2–5 words) that fit the source text.`;
    case "emojify":
      return "Add a few fitting emojis to the source text without changing its words.";
  }
}

export function buildWriteUser(input: WriteInput): { text: string; count: number } {
  const count = SINGLE_RESULT_ACTIONS.has(input.action) ? 1 : input.count;
  const parts = [`Task: ${task(input, count)}`];
  if (input.action === "write" || input.instruction) {
    parts.push(
      `What the user wants:\n${asData("user_request", input.instruction || "Short, catchy design copy.", 600)}`,
    );
  }
  if (input.text.trim()) parts.push(`Source text:\n${asData("source_text", input.text)}`);
  const guidance = prefsGuidance(input.prefs, { includeTone: input.action !== "tone" });
  if (guidance) parts.push(`Preferences:\n${guidance}`);
  parts.push(`Return exactly ${count} result${count === 1 ? "" : "s"} in the "results" array.`);
  return { text: parts.join("\n\n"), count };
}
