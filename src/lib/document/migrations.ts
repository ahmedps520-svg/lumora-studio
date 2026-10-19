import {
  DesignSchema,
  ElementSchema,
  PageSchema,
  SCHEMA_VERSION,
  type Design,
  type Element,
} from "@/lib/schema";

/**
 * Upgrades saved documents to the current schema version.
 *
 * To change the saved format: bump SCHEMA_VERSION in schema.ts and add an entry
 * here that turns a version-N document into a version-(N+1) document. Migrations
 * work on plain JSON so they never depend on today's types.
 */
type Json = Record<string, unknown>;
type Migration = (doc: Json) => Json;

export const MIGRATIONS: Record<number, Migration> = {
  // Example for the future:
  // 1: (doc) => ({ ...doc, schemaVersion: 2, /* reshape fields here */ }),
};

export class DocumentError extends Error {
  constructor(
    message: string,
    readonly code: "not-an-object" | "newer-version" | "missing-migration" | "invalid",
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Runs migrations only (no validation). */
export function upgradeJson(raw: unknown): Json {
  if (!isObject(raw)) throw new DocumentError("This file is not a Lumora design.", "not-an-object");
  let doc = raw;
  // Pre-release documents had no version number; they match version 1.
  let version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  if (version > SCHEMA_VERSION) {
    throw new DocumentError(
      "This design was made with a newer version of Lumora. Please update the app.",
      "newer-version",
    );
  }
  while (version < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      throw new DocumentError(`No upgrade path from version ${version}.`, "missing-migration");
    }
    doc = migrate(doc);
    version += 1;
  }
  return { ...doc, schemaVersion: SCHEMA_VERSION };
}

/** Upgrade + strict validation. Throws DocumentError when the document is invalid. */
export function migrateDesign(raw: unknown): Design {
  const result = DesignSchema.safeParse(upgradeJson(raw));
  if (!result.success) {
    throw new DocumentError(
      `Design data is invalid: ${result.error.issues[0]?.message}`,
      "invalid",
    );
  }
  return result.data;
}

export interface RepairResult {
  design: Design;
  /** How many broken elements/pages had to be dropped (0 = document was healthy). */
  dropped: number;
}

/**
 * Best-effort recovery of a damaged document: keeps every page and element that
 * is still valid and drops the rest, so one corrupt shape never loses a whole design.
 */
export function repairDesign(raw: unknown): RepairResult {
  const doc = upgradeJson(raw);
  const strict = DesignSchema.safeParse(doc);
  if (strict.success) return { design: strict.data, dropped: 0 };

  let dropped = 0;
  const rawPages = Array.isArray(doc.pages) ? doc.pages : [];
  const pages = rawPages.flatMap((rawPage) => {
    if (!isObject(rawPage)) {
      dropped++;
      return [];
    }
    const rawElements = Array.isArray(rawPage.elements) ? rawPage.elements : [];
    const elements: Element[] = [];
    for (const rawElement of rawElements) {
      const parsed = ElementSchema.safeParse(rawElement);
      if (parsed.success) elements.push(parsed.data);
      else dropped++;
    }
    const page = PageSchema.safeParse({ ...rawPage, elements });
    if (page.success) return [page.data];
    // Page itself is broken (e.g. bad background) — keep its elements on a plain page.
    const fallback = PageSchema.safeParse({ id: rawPage.id, elements });
    if (fallback.success) return [fallback.data];
    dropped++;
    return [];
  });

  const repaired = DesignSchema.safeParse({
    ...doc,
    pages: pages.length > 0 ? pages : [PageSchema.parse({ id: "recovered" })],
  });
  if (!repaired.success) {
    throw new DocumentError("This design is too damaged to open.", "invalid");
  }
  return { design: repaired.data, dropped };
}
