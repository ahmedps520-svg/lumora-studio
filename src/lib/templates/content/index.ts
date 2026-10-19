import type { Theme } from "../types";
import { BUSINESS } from "./business";
import { CREATORS } from "./creators";
import { DINING } from "./dining";
import { EVENTS } from "./events";
import { FOOD } from "./food";
import { GATHERINGS } from "./gatherings";
import { HOLIDAYS } from "./holidays";
import { LIFESTYLE } from "./lifestyle";
import { MARKETING } from "./marketing";
import { SEASONS } from "./seasons";
import { SHOPS } from "./shops";
import { WELLBEING } from "./wellbeing";
import { WORK } from "./work";

export const THEMES: Theme[] = [
  ...MARKETING,
  ...EVENTS,
  ...FOOD,
  ...LIFESTYLE,
  ...BUSINESS,
  ...HOLIDAYS,
  ...CREATORS,
  ...SHOPS,
  ...DINING,
  ...GATHERINGS,
  ...WELLBEING,
  ...WORK,
  ...SEASONS,
];

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string): Theme {
  const theme = BY_ID.get(id);
  if (!theme) throw new Error(`Unknown template theme: ${id}`);
  return theme;
}
