import { createId } from "@/lib/id";
import { DocumentError, repairDesign } from "@/lib/document/migrations";
import type { Design } from "@/lib/schema";
import { getDb, type DesignRecord } from "./db";

function metaFor(design: Design, previous?: DesignRecord, thumbnail?: string | null): DesignRecord {
  return {
    id: design.id,
    name: design.name,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
    width: design.format.width,
    height: design.format.height,
    presetId: design.format.presetId,
    pageCount: design.pages.length,
    thumbnail: thumbnail === undefined ? (previous?.thumbnail ?? null) : thumbnail,
    starred: previous?.starred ?? 0,
    folderId: previous?.folderId ?? null,
    deletedAt: previous?.deletedAt ?? null,
  };
}

/**
 * Saves the full design and refreshes its list entry in one transaction.
 * Pass `thumbnail` to update the preview; omit it to keep the old one.
 */
export async function saveDesign(design: Design, options: { thumbnail?: string | null } = {}) {
  const db = getDb();
  const stamped: Design = { ...design, updatedAt: new Date().toISOString() };
  await db.transaction("rw", db.designs, db.documents, async () => {
    const previous = await db.designs.get(design.id);
    await db.documents.put({ id: design.id, doc: stamped });
    await db.designs.put(metaFor(stamped, previous, options.thumbnail));
  });
  return stamped;
}

export interface LoadResult {
  design: Design;
  /** Number of damaged elements that were dropped while recovering (0 = healthy). */
  repaired: number;
  /** True when the main copy was unreadable and the latest snapshot was used. */
  fromSnapshot: boolean;
}

/** Loads, migrates and validates a design. Recovers from damage where possible. */
export async function loadDesign(id: string): Promise<LoadResult | null> {
  const db = getDb();
  const record = await db.documents.get(id);
  if (!record) return null;
  try {
    const { design, dropped } = repairDesign(record.doc);
    return { design, repaired: dropped, fromSnapshot: false };
  } catch (error) {
    if (error instanceof DocumentError && error.code === "newer-version") throw error;
    // Main copy unreadable — fall back to the most recent version snapshot.
    const snapshots = await db.versions.where("designId").equals(id).reverse().sortBy("createdAt");
    for (const snapshot of snapshots) {
      try {
        const { design, dropped } = repairDesign(snapshot.doc);
        return { design, repaired: dropped, fromSnapshot: true };
      } catch {
        // try the next one
      }
    }
    throw error;
  }
}

export async function listDesigns(options: { trash?: boolean } = {}): Promise<DesignRecord[]> {
  const all = await getDb().designs.orderBy("updatedAt").reverse().toArray();
  return all.filter((d) => (options.trash ? d.deletedAt !== null : d.deletedAt === null));
}

export async function getDesignMeta(id: string) {
  return getDb().designs.get(id);
}

export async function setStarred(id: string, starred: boolean) {
  await getDb().designs.update(id, { starred: starred ? 1 : 0 });
}

export async function moveToTrash(id: string) {
  await getDb().designs.update(id, { deletedAt: new Date().toISOString() });
}

export async function restoreFromTrash(id: string) {
  await getDb().designs.update(id, { deletedAt: null });
}

/** Permanently removes a design, its snapshots and its document. */
export async function deleteForever(id: string) {
  const db = getDb();
  await db.transaction("rw", db.designs, db.documents, db.versions, async () => {
    await db.designs.delete(id);
    await db.documents.delete(id);
    await db.versions.where("designId").equals(id).delete();
  });
}

export async function duplicateDesign(id: string, nameSuffix = " (copy)"): Promise<Design | null> {
  const loaded = await loadDesign(id);
  if (!loaded) return null;
  const now = new Date().toISOString();
  const copy: Design = {
    ...structuredClone(loaded.design),
    id: createId(),
    name: `${loaded.design.name}${nameSuffix}`.slice(0, 200),
    createdAt: now,
    updatedAt: now,
  };
  const meta = await getDesignMeta(id);
  await saveDesign(copy, { thumbnail: meta?.thumbnail ?? null });
  return copy;
}
