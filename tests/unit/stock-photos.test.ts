import { beforeEach, describe, expect, it } from "vitest";
import { coverCrop, createDesign, createImage } from "@/lib/document/factory";
import { createFrame } from "@/lib/document/elements";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { flattenElements } from "@/lib/document/tree";
import {
  allPhotos,
  photoAttribution,
  photoUrl,
  PHOTO_TOPICS,
  resizePhotoUrl,
  scalePhotos,
  searchTopics,
  stockPhotoId,
  topicPhotos,
} from "@/lib/photos";
import { ImageSrcSchema } from "@/lib/schema";
import { editorActions } from "@/lib/store/actions";
import { useEditorStore } from "@/lib/store/editor-store";
import { buildTemplate, catalog } from "@/lib/templates";
import { THEMES } from "@/lib/templates/content";

describe("photo library", () => {
  it("has hundreds of free photos in every topic", () => {
    expect(PHOTO_TOPICS.length).toBeGreaterThanOrEqual(100);
    expect(allPhotos().length).toBeGreaterThan(900);
    for (const topic of PHOTO_TOPICS) {
      const photos = topicPhotos(topic);
      expect(photos.length, topic).toBeGreaterThanOrEqual(4);
      for (const p of photos) {
        expect(p.id).toMatch(/^\d{9,13}-[0-9a-f]{12}$/);
        expect(p.author).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    }
  });

  it("builds Unsplash image URLs at a few cached widths", () => {
    const url = photoUrl("1509042239860-f550ce710b93", 1000);
    expect(url).toBe(
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
    );
    expect(ImageSrcSchema.safeParse(url).success).toBe(true);
    expect(stockPhotoId(url)).toBe("1509042239860-f550ce710b93");
    expect(resizePhotoUrl(url, 300)).toContain("w=400");
    expect(resizePhotoUrl("asset:abc", 300)).toBe("asset:abc");
    expect(photoUrl("x", 9999)).toContain("w=2400");
  });

  it("credits the photographer on Unsplash", () => {
    const credit = photoAttribution({ author: "nate_dumlao" });
    expect(credit.provider).toBe("unsplash");
    expect(credit.url).toMatch(/^https:\/\/unsplash\.com\/@nate_dumlao\?utm_source=/);
  });

  it("finds topics by name or slug", () => {
    const names = (t: string) => (t === "coffee-shop" ? "Coffee shop مقهى" : "");
    expect(searchTopics("coffee", names)).toContain("coffee-shop");
    expect(searchTopics("مقهى", names)).toEqual(["coffee-shop"]);
    expect(searchTopics("beach", () => "")).toContain("tropical-beach");
    expect(searchTopics("  ", () => "")).toEqual([]);
  });

  it("shrinks built-in photos for small previews", () => {
    const frame = {
      type: "frame",
      width: 500,
      height: 500,
      image: { src: photoUrl("1509042239860-f550ce710b93", 800) },
    };
    const [small] = scalePhotos([frame], 0.3);
    expect(small!.image!.src).toContain("w=400");
    expect(frame.image.src).toContain("w=800");
  });
});

describe("templates come with photos", () => {
  it("gives every theme photo topics that exist", () => {
    for (const theme of THEMES) {
      expect(theme.photos.length, theme.id).toBeGreaterThan(0);
      for (const topic of theme.photos) expect(PHOTO_TOPICS, theme.id).toContain(topic);
    }
  });

  it("fills frames with credited photos, never the same one twice in a design", () => {
    const withFrames = catalog().filter((d) =>
      ["photoGrid", "collage", "deckClean"].includes(d.blueprint),
    );
    expect(withFrames.length).toBeGreaterThan(10);
    for (const def of withFrames.slice(0, 40)) {
      const built = buildTemplate(def, "en");
      const frames = built.pages
        .flatMap((p) => flattenElements(p.elements))
        .filter((e) => e.type === "frame");
      expect(frames.length, def.id).toBeGreaterThan(0);
      const srcs = frames.map((f) => (f.type === "frame" ? f.image?.src : null));
      expect(srcs.every(Boolean), def.id).toBe(true);
      expect(new Set(srcs).size, def.id).toBe(srcs.length);
      for (const f of frames)
        if (f.type === "frame") expect(f.image?.attribution?.provider).toBe("unsplash");
    }
  });

  it("uses the same photos in English and Arabic", () => {
    const def = catalog().find((d) => d.blueprint === "photoFull")!;
    const src = (locale: "en" | "ar") =>
      buildTemplate(def, locale).pages[0]!.elements.find((e) => e.type === "frame");
    const [en, ar] = [src("en"), src("ar")];
    expect(en?.type === "frame" && en.image?.src).toBe(ar?.type === "frame" && ar.image?.src);
  });
});

describe("placing and replacing photos", () => {
  const format = formatFromPreset(getPreset("instagramPost")!);
  const s = () => useEditorStore.getState();
  const page = () => s().design!.pages[0]!;
  const photo = {
    src: photoUrl("1509042239860-f550ce710b93"),
    width: 1200,
    height: 800,
    attribution: photoAttribution({ author: "nate_dumlao" }),
  };

  beforeEach(() => s().load(createDesign({ format })));

  it("crops a photo to cover a box, centred", () => {
    expect(coverCrop({ width: 1200, height: 800 }, { width: 100, height: 100 })).toEqual({
      x: 200,
      y: 0,
      width: 800,
      height: 800,
    });
    expect(coverCrop({ width: 800, height: 1200 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 400,
      width: 800,
      height: 400,
    });
  });

  it("adds a new photo when nothing is selected", () => {
    expect(editorActions.placePhoto(photo)).toBe("added");
    const [el] = page().elements;
    expect(el?.type).toBe("image");
    expect(el?.type === "image" && el.attribution?.author).toBe("nate_dumlao");
    expect(el!.width / el!.height).toBeCloseTo(1.5, 1);
  });

  it("fills the selected frame", () => {
    const frame = createFrame(format, "square", null);
    editorActions.addElements([frame]);
    s().select([frame.id]);
    expect(editorActions.selectedPhoto()).toEqual({ id: frame.id, type: "frame" });
    expect(editorActions.placePhoto(photo)).toBe("filled");
    const el = page().elements[0]!;
    expect(el.type === "frame" && el.image?.src).toBe(photo.src);
    expect(el.type === "frame" && el.image?.attribution?.author).toBe("nate_dumlao");
  });

  it("replaces the selected photo in the same box, cropped to fit, in one undo step", () => {
    const image = createImage(format, { src: "asset:old", width: 400, height: 400 });
    editorActions.addElements([image]);
    s().select([image.id]);
    const before = page().elements[0]!;
    expect(editorActions.placePhoto(photo)).toBe("replaced");
    const after = page().elements[0]!;
    expect(after.type === "image" && after.src).toBe(photo.src);
    expect([after.x, after.y, after.width, after.height]).toEqual([
      before.x,
      before.y,
      before.width,
      before.height,
    ]);
    expect(after.type === "image" && after.crop).toEqual({ x: 200, y: 0, width: 800, height: 800 });
    s().undo();
    const undone = page().elements[0]!;
    expect(undone.type === "image" && undone.src).toBe("asset:old");
  });

  it("finds the photo under a drop point", () => {
    const image = createImage(format, { src: "asset:old", width: 400, height: 400 });
    editorActions.addElements([image]);
    const centre = { x: image.x + image.width / 2, y: image.y + image.height / 2 };
    expect(editorActions.photoAt(centre)).toEqual({ id: image.id, type: "image" });
    expect(editorActions.photoAt({ x: -50, y: -50 })).toBeNull();
  });
});
