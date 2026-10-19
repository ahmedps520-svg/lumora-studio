/**
 * Turns a freehand brush stroke (page coordinates) into a drawing element: the
 * path is moved so it starts at the element's own top-left, padded by half
 * the stroke width so thick strokes aren't clipped.
 */
import { createId } from "@/lib/id";
import { DrawingElementSchema, type DrawingElement } from "@/lib/schema";

export type DrawTool = "pen" | "marker" | "highlighter";

export interface StrokeStyle {
  tool: DrawTool;
  color: string;
  width: number;
  opacity: number;
}

type Command = (string | number)[];

const round = (n: number) => Math.round(n * 100) / 100;

export function strokeToDrawing(commands: Command[], style: StrokeStyle): DrawingElement | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const command of commands) {
    for (let i = 1; i + 1 < command.length; i += 2) {
      xs.push(Number(command[i]));
      ys.push(Number(command[i + 1]));
    }
  }
  if (xs.length === 0 || xs.some((v) => !Number.isFinite(v))) return null;
  const pad = style.width / 2 + 1;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const height = Math.max(...ys) - Math.min(...ys) + pad * 2;

  const d = commands
    .map((command) => {
      const parts: (string | number)[] = [command[0]!];
      for (let i = 1; i < command.length; i++) {
        const value = Number(command[i]);
        parts.push(round(i % 2 === 1 ? value - minX : value - minY));
      }
      return parts.join(" ");
    })
    .join(" ");

  return DrawingElementSchema.parse({
    id: createId(),
    type: "drawing",
    name: "",
    x: round(minX),
    y: round(minY),
    width: round(width),
    height: round(height),
    sourceWidth: round(width),
    sourceHeight: round(height),
    strokes: [
      {
        d,
        color: style.color,
        width: style.width,
        opacity: style.opacity,
        mode: style.tool === "highlighter" ? "highlighter" : "brush",
      },
    ],
  });
}

/** `#RRGGBB` + opacity → an rgba() colour for the live brush preview. */
export function rgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}
