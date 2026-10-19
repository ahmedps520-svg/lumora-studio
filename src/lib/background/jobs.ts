/**
 * "Remove background" for image elements. The cut-out is saved as a new upload
 * and swapped into the design as ONE undo step, so the original is never lost.
 * Progress lives in a small store so it survives deselecting the image.
 */
import { create } from "zustand";
import { useAiSettings } from "@/lib/ai/settings-store";
import { findElement } from "@/lib/document/tree";
import { loadImage } from "@/lib/engine/images";
import { assetIdFromSrc, getAsset, importImage } from "@/lib/storage/assets";
import { useEditorStore } from "@/lib/store/editor-store";
import type { WorkerProgress } from "./protocol";
import { removeBackground } from "./remove-background";

export interface BackgroundJob {
  progress: WorkerProgress | null;
  cancel: () => void;
}

export const useBackgroundJobs = create<{ jobs: Record<string, BackgroundJob> }>(() => ({
  jobs: {},
}));

function setJob(id: string, job: BackgroundJob | null) {
  useBackgroundJobs.setState(({ jobs }) => {
    const next = { ...jobs };
    if (job) next[id] = job;
    else delete next[id];
    return { jobs: next };
  });
}

/** The original pixels of an image `src`, as a Blob. */
async function sourceBlob(src: string): Promise<Blob> {
  const assetId = assetIdFromSrc(src);
  if (assetId) {
    const record = await getAsset(assetId);
    if (!record) throw new Error("The original image is missing.");
    return record.blob;
  }
  // Data URLs and stock photos: redraw the loaded image (no extra network rules needed).
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")?.drawImage(img, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't read the image."))),
      "image/png",
    ),
  );
}

const SERVER_ENDPOINT = "/api/image/remove-background";
let warmed = false;

/** Starts loading the HD model on the Lumora server before it's needed (once per session). */
export function warmUpBackgroundRemoval() {
  if (warmed) return;
  warmed = true;
  void fetch(`${SERVER_ENDPOINT}?warm=1`).catch(() => undefined);
}

/**
 * HD removal on the Lumora server. Returns null when this server can't do it
 * (e.g. a serverless host), so the browser models take over.
 */
async function removeOnServer(
  image: Blob,
  signal: AbortSignal,
  report: (p: WorkerProgress) => void,
): Promise<Blob | null> {
  try {
    const status = (await (await fetch(SERVER_ENDPOINT, { signal })).json()) as {
      available: boolean;
      ready: boolean;
    };
    if (!status.available) return null;
    report(status.ready ? { stage: "processing" } : { stage: "preparing" });
    const response = await fetch(SERVER_ENDPOINT, {
      method: "POST",
      body: image,
      headers: { "Content-Type": image.type || "image/png" },
      signal,
    });
    if (response.status === 503) return null;
    if (!response.ok) throw new Error(`The background remover failed (${response.status}).`);
    return await response.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // Server unreachable (offline, static hosting…): fall back to the browser.
    if (error instanceof TypeError) return null;
    throw error;
  }
}

/** "fallback": done, but with the fast model (this device can't run the high-quality one). */
export type RemoveBackgroundOutcome = "done" | "fallback" | "cancelled" | "gone";

export async function removeElementBackground(
  elementId: string,
  options: { assetName: string },
): Promise<RemoveBackgroundOutcome> {
  if (useBackgroundJobs.getState().jobs[elementId]) return "cancelled";
  const { design, pageId } = useEditorStore.getState();
  const page = design?.pages.find((p) => p.id === pageId);
  const element = page ? findElement(page, elementId) : undefined;
  if (element?.type !== "image") return "gone";

  const controller = new AbortController();
  const job: BackgroundJob = { progress: null, cancel: () => controller.abort() };
  setJob(elementId, job);
  try {
    const original = await sourceBlob(element.src);
    const report = (progress: WorkerProgress) => setJob(elementId, { ...job, progress });
    const wanted = useAiSettings.getState().backgroundModel;
    let image = await removeOnServer(original, controller.signal, report);
    let model = wanted;
    if (!image) {
      ({ image, model } = await removeBackground(original, {
        model: wanted,
        signal: controller.signal,
        onProgress: report,
      }));
    }
    if (controller.signal.aborted) return "cancelled";
    const asset = await importImage(image, { name: options.assetName });
    const src = `asset:${asset.id}`;
    await loadImage(src).catch(() => undefined);

    // Swap the pixels wherever the element is now (it may have moved pages).
    let found = false as boolean;
    useEditorStore.getState().change("removeBackground", (draft) => {
      for (const p of draft.pages) {
        const el = findElement(p, elementId);
        if (el?.type === "image") {
          el.src = src;
          el.crop = null;
          found = true;
        }
      }
    });
    if (!found) return "gone";
    return model === wanted ? "done" : "fallback";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  } finally {
    setJob(elementId, null);
  }
}
