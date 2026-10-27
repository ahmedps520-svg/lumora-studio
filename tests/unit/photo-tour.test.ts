/**
 * The photo editor tutorial covers every tool and every area, in English and Arabic.
 */
import { describe, expect, it } from "vitest";
import ar from "@messages/ar.json";
import en from "@messages/en.json";
import {
  ALL_TOOLS,
  TOUR_AREAS,
  TOUR_CHAPTERS,
  TOUR_STEPS,
  TOURED_TOOLS,
} from "@/components/photo/tour/steps";

describe("photo tutorial", () => {
  it("has a step for every tool in the toolbar", () => {
    expect(ALL_TOOLS.filter((t) => !TOURED_TOOLS.has(t))).toEqual([]);
  });

  it("explains every tool and area in both languages", () => {
    for (const messages of [en, ar]) {
      const tour = messages.photo.tour;
      for (const tool of ALL_TOOLS) {
        expect(tour.tools[tool as keyof typeof tour.tools], tool).toBeTruthy();
        expect(messages.photo.hints[tool as keyof typeof messages.photo.hints], tool).toBeTruthy();
      }
      for (const area of TOUR_AREAS) {
        const step = tour.steps[area as keyof typeof tour.steps];
        expect(step?.title, area).toBeTruthy();
        expect(step?.body, area).toBeTruthy();
      }
      for (const c of TOUR_CHAPTERS) expect(tour.chapters[c], c).toBeTruthy();
    }
  });

  it("starts with a welcome, ends with a goodbye, and every chapter has steps", () => {
    expect(TOUR_STEPS[0]!.area).toBe("welcome");
    expect(TOUR_STEPS.at(-1)!.area).toBe("done");
    for (const c of TOUR_CHAPTERS)
      expect(
        TOUR_STEPS.some((s) => s.chapter === c),
        c,
      ).toBe(true);
    // Chapters come in order (the chapter picker jumps to the first step of each).
    const order = TOUR_STEPS.map((s) => TOUR_CHAPTERS.indexOf(s.chapter));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });
});
