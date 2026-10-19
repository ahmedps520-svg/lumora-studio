import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDesign, createShape } from "@/lib/document/factory";
import { formatFromPreset, getPreset } from "@/lib/document/formats";
import { LumoraDB, setDbForTests } from "@/lib/storage/db";
import {
  deleteForever,
  duplicateDesign,
  listDesigns,
  loadDesign,
  moveToTrash,
  restoreFromTrash,
  saveDesign,
  setStarred,
} from "@/lib/storage/designs";

const format = formatFromPreset(getPreset("a4")!);
let db: LumoraDB;

beforeEach(() => {
  db = new LumoraDB(`test-${Math.random()}`);
  setDbForTests(db);
});

afterEach(async () => {
  await db.delete();
  setDbForTests(null);
});

describe("design storage", () => {
  it("saves and reloads a design exactly", async () => {
    const design = createDesign({ name: "Poster", format });
    design.pages[0]!.elements.push(createShape("star", format));
    const saved = await saveDesign(design, { thumbnail: "data:image/png;base64,AAA" });
    const loaded = await loadDesign(design.id);
    expect(loaded?.design).toEqual(saved);
    expect(loaded?.repaired).toBe(0);

    const [meta] = await listDesigns();
    expect(meta).toMatchObject({ id: design.id, name: "Poster", pageCount: 1, width: 794 });
    expect(meta!.thumbnail).toBe("data:image/png;base64,AAA");
  });

  it("keeps the thumbnail, star and folder when saving again", async () => {
    const design = createDesign({ format });
    await saveDesign(design, { thumbnail: "data:image/png;base64,T" });
    await setStarred(design.id, true);
    await saveDesign({ ...design, name: "Renamed" });
    const [meta] = await listDesigns();
    expect(meta).toMatchObject({
      name: "Renamed",
      starred: 1,
      thumbnail: "data:image/png;base64,T",
    });
  });

  it("lists newest first and separates the trash", async () => {
    const a = createDesign({ name: "A", format });
    const b = createDesign({ name: "B", format });
    await saveDesign(a);
    await new Promise((r) => setTimeout(r, 5));
    await saveDesign(b);
    expect((await listDesigns()).map((d) => d.name)).toEqual(["B", "A"]);

    await moveToTrash(a.id);
    expect((await listDesigns()).map((d) => d.name)).toEqual(["B"]);
    expect((await listDesigns({ trash: true })).map((d) => d.name)).toEqual(["A"]);

    await restoreFromTrash(a.id);
    expect(await listDesigns()).toHaveLength(2);

    await deleteForever(a.id);
    expect(await loadDesign(a.id)).toBeNull();
    expect(await listDesigns()).toHaveLength(1);
  });

  it("recovers a damaged document by dropping broken elements", async () => {
    const design = createDesign({ format });
    const good = createShape("rect", format);
    const raw = JSON.parse(JSON.stringify(design));
    raw.pages[0].elements = [good, { id: "x", type: "shape", width: "broken" }];
    await db.documents.put({ id: design.id, doc: raw });
    const loaded = await loadDesign(design.id);
    expect(loaded?.repaired).toBe(1);
    expect(loaded?.design.pages[0]!.elements.map((e) => e.id)).toEqual([good.id]);
  });

  it("falls back to the latest snapshot when the main copy is unreadable", async () => {
    const design = createDesign({ name: "Snap", format });
    await db.documents.put({ id: design.id, doc: "garbage" });
    await db.versions.put({
      id: "v1",
      designId: design.id,
      createdAt: new Date().toISOString(),
      label: "auto",
      doc: design,
    });
    const loaded = await loadDesign(design.id);
    expect(loaded?.fromSnapshot).toBe(true);
    expect(loaded?.design.name).toBe("Snap");
  });

  it("duplicates a design with a new id", async () => {
    const design = createDesign({ name: "Flyer", format });
    await saveDesign(design);
    const copy = await duplicateDesign(design.id);
    expect(copy?.id).not.toBe(design.id);
    expect(copy?.name).toBe("Flyer (copy)");
    expect(await listDesigns()).toHaveLength(2);
  });
});
