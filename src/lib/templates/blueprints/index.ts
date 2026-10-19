import type { Kit } from "../kit";
import { DECK_BLUEPRINTS } from "./decks";
import { LANDSCAPE_BLUEPRINTS } from "./landscape";
import { PHOTO_BLUEPRINTS } from "./photo";
import { PRINT_DECKS, PRINT_SINGLE } from "./print";
import { SOCIAL_BLUEPRINTS } from "./social";

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
