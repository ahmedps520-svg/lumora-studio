/**
 * Generative Fill in the photo editor: the browser sends the area around the
 * selection (the selection painted magenta) and a prompt; Gemini paints the
 * hole and the editor puts the result on a new masked layer.
 */
import { z } from "zod";

export const PHOTO_FILL_MAX_SIDE = 1024;

export const PhotoFillRequestSchema = z.object({
  prompt: z.string().trim().max(400).default(""),
  image: z
    .string()
    .max(6_000_000)
    .regex(
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/,
      "image must be a PNG or JPEG data URL",
    ),
  width: z.number().int().min(16).max(PHOTO_FILL_MAX_SIDE),
  height: z.number().int().min(16).max(PHOTO_FILL_MAX_SIDE),
});

/** What the model sent back, checked before it reaches the browser. */
export const PhotoFillResultSchema = z.object({
  base64: z
    .string()
    .min(100)
    .regex(/^[A-Za-z0-9+/]+=*$/),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  model: z.string().min(1),
});

export function buildFillPrompt(prompt: string) {
  const what =
    prompt.trim() || "whatever naturally belongs there, continuing the surroundings seamlessly";
  return [
    "Edit this photo. The area painted solid magenta (#FF00FF) is a hole to fill.",
    `Replace only the magenta area with: ${what}.`,
    "Match the lighting, perspective, colours, grain, sharpness and depth of field of the rest of the photo.",
    "Keep every pixel outside the magenta area exactly as it is, with the same framing and composition.",
    "No magenta may remain. Return only the edited photo.",
  ].join(" ");
}
