/**
 * Free, private background removal: talks to the model worker (see worker.ts).
 * One worker is shared by the whole app and started on first use.
 *
 * If this device's GPU can't run a model, the job is retried in a fresh worker:
 * the high-quality model falls back to the fast one, and the fast one to the
 * CPU. Both decisions are remembered so later runs go straight there.
 */
import type {
  BackgroundModel,
  Device,
  WorkerProgress,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

export interface RemovalResult {
  image: Blob;
  device: Device;
  /** The model that actually ran (differs from the request after a fallback). */
  model: BackgroundModel;
}

interface Pending {
  request: WorkerRequest;
  resolve: (value: RemovalResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: WorkerProgress) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

// ─── Remembered device limits (per browser) ──────────────────────────────────

const QUALITY_UNAVAILABLE = "lumora-bg-no-gpu-quality";
const FAST_ON_CPU = "lumora-bg-cpu-fast";

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Not remembered — the GPU is simply tried again next time.
  }
}

/** False once this browser has shown it can't run the high-quality model. */
export const qualityModelAvailable = () => !flag(QUALITY_UNAVAILABLE);

/** Applies what we know about this device to a request. */
function adapt(request: WorkerRequest): WorkerRequest {
  const model = request.model === "quality" && flag(QUALITY_UNAVAILABLE) ? "fast" : request.model;
  const device = model === "fast" && flag(FAST_ON_CPU) ? "wasm" : request.device;
  return { ...request, model, device };
}

// ─── Worker ──────────────────────────────────────────────────────────────────

function resetWorker() {
  worker?.terminate();
  worker = null;
}

function send(job: Pending) {
  job.request = adapt(job.request);
  getWorker().postMessage(job.request);
}

function getWorker(): Worker {
  if (worker) return worker;
  const created = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "lumora-background-removal",
  });
  created.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const job = pending.get(message.id);
    if (!job) return;
    switch (message.type) {
      case "progress":
        job.onProgress?.(message.progress);
        break;
      case "done":
        pending.delete(message.id);
        job.resolve({ image: message.image, device: message.device, model: job.request.model });
        break;
      case "error":
        pending.delete(message.id);
        job.reject(new Error(message.message));
        break;
      case "gpu-failed": {
        console.warn("Background removal: falling back after a GPU problem.", message.message);
        if (job.request.model === "quality") setFlag(QUALITY_UNAVAILABLE);
        else setFlag(FAST_ON_CPU);
        // That worker is unusable now: move every waiting job to a fresh one.
        resetWorker();
        for (const other of pending.values()) send(other);
        break;
      }
    }
  });
  created.addEventListener("error", (event) => {
    for (const job of pending.values()) {
      job.reject(new Error(event.message || "The background remover stopped unexpectedly."));
    }
    pending.clear();
    resetWorker();
  });
  worker = created;
  return created;
}

export function removeBackground(
  image: Blob,
  options: {
    model: BackgroundModel;
    onProgress?: (progress: WorkerProgress) => void;
    signal?: AbortSignal;
  },
): Promise<RemovalResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const id = nextId++;
    const request: WorkerRequest = { id, type: "remove", image, model: options.model };
    const job: Pending = { request, resolve, reject, onProgress: options.onProgress };
    pending.set(id, job);
    // The model can't be interrupted mid-run; a cancelled result is simply dropped.
    options.signal?.addEventListener("abort", () => {
      if (pending.delete(id)) reject(new DOMException("Cancelled", "AbortError"));
    });
    send(job);
  });
}
