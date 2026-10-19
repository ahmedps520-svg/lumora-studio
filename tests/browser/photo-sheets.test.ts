/**
 * A contact sheet of built-in photos, for checking them by eye (no logos,
 * right topic). Off by default; run with:
 *   VITE_TOPICS=perfume,sneakers npx vitest run --project browser tests/browser/photo-sheets.test.ts
 * Writes .lumora-cache/sheets/photos.png.
 */
import { describe, it } from "vitest";
import { commands } from "vitest/browser";
import { photoUrl, topicPhotos, type PhotoTopic } from "@/lib/photos";

const env = import.meta.env as unknown as Record<string, string | undefined>;
const TOPICS = (env.VITE_TOPICS ?? "").split(",").filter(Boolean) as PhotoTopic[];

describe.skipIf(TOPICS.length === 0)("photo contact sheet", () => {
  it("draws the photos of the chosen topics", async () => {
    const photos = TOPICS.flatMap((t) => topicPhotos(t));
    const C = 200;
    const cols = 10;
    const canvas = document.createElement("canvas");
    canvas.width = cols * C;
    canvas.height = Math.ceil(photos.length / cols) * (C + 16);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#888";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await Promise.all(
      photos.map(
        (p, i) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const s = Math.min(C / img.width, C / img.height);
              ctx.drawImage(
                img,
                (i % cols) * C,
                Math.floor(i / cols) * (C + 16),
                img.width * s,
                img.height * s,
              );
              resolve();
            };
            img.onerror = () => resolve();
            img.src = photoUrl(p.id, 400);
          }),
      ),
    );
    ctx.fillStyle = "#000";
    ctx.font = "11px sans-serif";
    photos.forEach((p, i) =>
      ctx.fillText(
        `${i} ${p.topic.slice(0, 10)} ${p.id.slice(0, 13)}`,
        (i % cols) * C + 2,
        Math.floor(i / cols) * (C + 16) + C + 12,
      ),
    );
    await commands.writeFile(
      ".lumora-cache/sheets/photos.png",
      canvas.toDataURL("image/png").split(",")[1]!,
      "base64",
    );
  }, 120_000);
});
