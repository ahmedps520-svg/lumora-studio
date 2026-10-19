/**
 * Messages between the editor and the background-removal worker.
 * Everything runs on the user's device — images never leave the browser.
 */

/**
 * "quality": BEN2 — any subject, fine edges; needs a WebGPU graphics card.
 * "fast": MODNet — small and quick, best for people; runs on any device.
 */
export type BackgroundModel = "quality" | "fast";

export const BACKGROUND_MODELS: Record<
  BackgroundModel,
  { repo: string; license: string; approxMb: number; needsGpu: boolean }
> = {
  quality: { repo: "onnx-community/BEN2-ONNX", license: "MIT", approxMb: 219, needsGpu: true },
  fast: { repo: "Xenova/modnet", license: "Apache-2.0", approxMb: 13, needsGpu: false },
};

export type Device = "webgpu" | "wasm";

export type WorkerRequest = {
  id: number;
  type: "remove";
  image: Blob;
  model: BackgroundModel;
  /** "wasm" forces the CPU (after this GPU failed to run the model once). */
  device?: Device;
};

export type WorkerProgress =
  | { stage: "download"; loaded: number; total: number }
  /** The HD model is being loaded on the Lumora server (first time only). */
  | { stage: "preparing" }
  | { stage: "processing" };

export type WorkerResponse =
  | { id: number; type: "progress"; progress: WorkerProgress }
  | { id: number; type: "done"; image: Blob; device: Device }
  /**
   * This device's GPU can't run the model (or there is no WebGPU). After a
   * failed run Transformers.js stays broken in that worker, so the editor
   * retries in a fresh one — on the CPU, or with the fast model.
   */
  | { id: number; type: "gpu-failed"; message: string }
  | { id: number; type: "error"; message: string };
