/** Icon markup for templates (Lucide outlines, recoloured through `currentColor`). */
import { ICON_SVG } from "./icons.generated";

export function templateIcon(name: string, strokeWidth = 2): string | null {
  const inner = ICON_SVG[name];
  if (!inner) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  );
}

export const hasTemplateIcon = (name: string) => name in ICON_SVG;
