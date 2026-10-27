/**
 * Local-first storage: everything lives in the browser's IndexedDB (via Dexie).
 * No account and no server database are needed.
 *
 * - designs:   lightweight metadata for lists (name, size, thumbnail, star, trash)
 * - documents: the full design JSON (validated + migrated when loaded)
 * - versions:  snapshots for version history
 * - assets:    uploaded images as Blobs (referenced from designs as `asset:<id>`)
 * - folders:   dashboard folders
 * - kv:        small settings
 * - photos:    photo-editor documents (metadata for lists)
 * - photoData: a photo document's layers (settings + PNG blobs)
 */
import Dexie, { type EntityTable } from "dexie";

export interface DesignRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  presetId: string | null;
  pageCount: number;
  /** Small preview image (data URL). */
  thumbnail: string | null;
  /** IndexedDB can't index booleans, so 0/1. */
  starred: 0 | 1;
  folderId: string | null;
  /** Set when the design is in the trash. */
  deletedAt: string | null;
}

export interface DocumentRecord {
  id: string;
  /** Raw JSON — always passed through migrations + validation when read. */
  doc: unknown;
}

export interface VersionRecord {
  id: string;
  designId: string;
  createdAt: string;
  label: string;
  doc: unknown;
}

export interface AssetRecord {
  id: string;
  blob: Blob;
  mime: string;
  name: string;
  width: number;
  height: number;
  size: number;
  createdAt: string;
}

export interface FolderRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface PhotoRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  layerCount: number;
  thumbnail: string | null;
  deletedAt: string | null;
}

export interface PhotoDataRecord {
  id: string;
  /** The document settings (PhotoDoc as JSON). */
  doc: unknown;
  /** Per layer: content PNG (pixel layers) and mask PNG. */
  pixels: Record<string, { content: Blob | null; mask: Blob | null }>;
}

export interface KvRecord {
  key: string;
  value: unknown;
}

export class LumoraDB extends Dexie {
  designs!: EntityTable<DesignRecord, "id">;
  documents!: EntityTable<DocumentRecord, "id">;
  versions!: EntityTable<VersionRecord, "id">;
  assets!: EntityTable<AssetRecord, "id">;
  folders!: EntityTable<FolderRecord, "id">;
  kv!: EntityTable<KvRecord, "key">;
  photos!: EntityTable<PhotoRecord, "id">;
  photoData!: EntityTable<PhotoDataRecord, "id">;

  constructor(name = "lumora") {
    super(name);
    this.version(1).stores({
      designs: "id, updatedAt, createdAt, name, starred, folderId, deletedAt",
      documents: "id",
      versions: "id, designId, createdAt, [designId+createdAt]",
      assets: "id, createdAt",
      folders: "id, name, createdAt",
      kv: "key",
    });
    this.version(2).stores({
      photos: "id, updatedAt, createdAt, name, deletedAt",
      photoData: "id",
    });
  }
}

let instance: LumoraDB | null = null;

export function getDb(): LumoraDB {
  instance ??= new LumoraDB();
  return instance;
}

/** Test helper: point the app at a fresh database. */
export function setDbForTests(db: LumoraDB | null) {
  instance = db;
}
