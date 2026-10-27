import type { Kit } from "../kit";
import { DECK_BLUEPRINTS } from "./decks";
import { LANDSCAPE_BLUEPRINTS } from "./landscape";
import { PHOTO_BLUEPRINTS } from "./photo";
import { PRINT_DECKS, PRINT_SINGLE } from "./print";
import { SOCIAL_BLUEPRINTS } from "./social";
import type { GenBlueprint } from "./gen-types";

/** One page (`draw`) or several (`deck`, which asks for each new page). */
export type Blueprint = { draw: (k: Kit) => void } | { deck: (page: () => Kit) => void };

const single = (fns: Record<string, (k: Kit) => void>) =>
  Object.fromEntries(Object.entries(fns).map(([id, draw]) => [id, { draw }]));
const multi = (fns: Record<string, (page: () => Kit) => void>) =>
  Object.fromEntries(Object.entries(fns).map(([id, deck]) => [id, { deck }]));

export const BLUEPRINTS: Record<string, Blueprint> = {
  ...single(SOCIAL_BLUEPRINTS),
  ...single(LANDSCAPE_BLUEPRINTS),
  ...single(PHOTO_BLUEPRINTS),
  ...single(PRINT_SINGLE),
  ...multi(DECK_BLUEPRINTS),
  ...multi(PRINT_DECKS),
};

const generated = new Map<string, GenBlueprint>();

/** The generated layouts added so far, by id (for the catalogue's size and word rules). */
export const GEN_BY_ID: ReadonlyMap<string, GenBlueprint> = generated;

/** Adds generated layouts (`loadTemplateLibrary` does; an id that already exists is skipped). */
export function addBlueprints(list: readonly GenBlueprint[]) {
  for (const b of list) {
    if (BLUEPRINTS[b.id]) continue;
    generated.set(b.id, b);
    BLUEPRINTS[b.id] = b.deck ? { deck: b.deck } : { draw: b.draw! };
  }
}
