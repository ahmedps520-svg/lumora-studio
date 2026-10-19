import "server-only";
import {
  aiDesignToPage,
  autoFixPage,
  safeFont,
  safeHex,
  type AiDesign,
  type FixKind,
} from "../design-format";
import type { PremiumPlan } from "../premium";

/** Claude's layout → real, validated, auto-fixed page elements. */
export function finishDesign(design: AiDesign, format: { width: number; height: number }) {
  const palette = design.palette
    .map((c) => safeHex(c, ""))
    .filter(Boolean)
    .slice(0, 8);
  const converted = aiDesignToPage(design, format);
  const { page, fixes } = autoFixPage(converted, format, palette);
  return { page, fixes: fixes as FixKind[], palette };
}

const NO_TEXT = "No text, letters, numbers, logos, watermarks or UI anywhere in the image.";

/** Cleans a plan: known fonts, valid colours, bounded copy, the no-text rule. */
export function sanitizePlan(plan: PremiumPlan): PremiumPlan {
  const art = plan.artPrompt.trim().slice(0, 5_000);
  return {
    concept: plan.concept.trim().slice(0, 300),
    title: plan.title.trim().slice(0, 80),
    subtitle: plan.subtitle.trim().slice(0, 140),
    extras: plan.extras
      .map((e) => e.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 3),
    artPrompt: art.includes("No text") ? art : `${art}\n\n${NO_TEXT}`,
    textArea: plan.textArea,
    palette: plan.palette
      .map((c) => safeHex(c, ""))
      .filter(Boolean)
      .slice(0, 6),
    headingFont: safeFont(plan.headingFont, "Luckiest Guy"),
    bodyFont: safeFont(plan.bodyFont, "Poppins"),
  };
}
