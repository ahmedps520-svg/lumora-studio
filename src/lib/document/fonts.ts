/** Which font faces a design needs (text, tables and charts all draw text). */
import type { Element } from "@/lib/schema";
import { flattenElements } from "./tree";

export interface FontFace {
  family: string;
  weight: number;
  italic: boolean;
}

export function fontFacesOf(element: Element): FontFace[] {
  if (element.type === "text") {
    const faces: FontFace[] = [
      { family: element.fontFamily, weight: element.fontWeight, italic: element.italic },
    ];
    for (const run of element.runs) {
      faces.push({
        family: run.style.fontFamily ?? element.fontFamily,
        weight: run.style.fontWeight ?? element.fontWeight,
        italic: run.style.italic ?? element.italic,
      });
    }
    return faces;
  }
  if (element.type === "table") {
    return [400, 700].map((weight) => ({ family: element.fontFamily, weight, italic: false }));
  }
  if (element.type === "chart") {
    return [400, 700].map((weight) => ({ family: element.fontFamily, weight, italic: false }));
  }
  if (element.type === "group") return element.children.flatMap(fontFacesOf);
  return [];
}

/** Every distinct face used by `elements` (groups included). */
export function fontFaces(elements: Element[]): FontFace[] {
  const faces = new Map<string, FontFace>();
  for (const el of flattenElements(elements)) {
    if (el.type === "group") continue;
    for (const face of fontFacesOf(el)) {
      faces.set(`${face.family}|${face.weight}|${face.italic}`, face);
    }
  }
  return [...faces.values()];
}

/** True when the element (or anything inside it) draws text in `family`. */
export function usesFontFamily(element: Element, family: string): boolean {
  return fontFacesOf(element).some((f) => f.family === family);
}
