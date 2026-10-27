/** The shape of a generated layout file (see docs/templates/authoring.md). */
import type { Kit } from "../kit";
import type { Copy, TemplateKind } from "../types";

export interface GenBlueprint {
  /** Unique camelCase id, e.g. "neonFrame". */
  id: string;
  /** The sizes this layout is drawn for. */
  kinds: TemplateKind[];
  /** Words the layout needs from a theme (it is skipped for themes without them). */
  needs?: (c: Copy) => boolean;
  /** A one-page layout… */
  draw?: (k: Kit) => void;
  /** …or several pages (decks, two-sided cards): ask `page()` for each one. */
  deck?: (page: () => Kit) => void;
}
