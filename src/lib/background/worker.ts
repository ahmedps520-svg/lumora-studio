/// <reference lib="webworker" />
/**
 * Background-removal worker. Runs an open-source segmentation model with
 * Transformers.js (ONNX Runtime Web) — on the GPU via WebGPU when available,
 * otherwise on the CPU via WebAssembly. Model files are downloaded once from
 * the Hugging Face Hub and cached by the browser.
 */
import { RawImage, env, pipeline, type ProgressInfo } from "@huggingface/transformers";
import {
  BACKGROUND_MODELS,
  type BackgroundModel,
  type Device,
  type WorkerProgress,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
// Use the WebAssembly runtime bundled with the app instead of a third-party CDN.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = undefined;

type Runner = (image: RawImage) => Promise<RawImage>;

const runners = new Map<string, Promise<Runner>>();
let devicePromise: Promise<Device> | null = null;

function detectDevice(): Promise<Device> {
  devicePromise ??= (async () => {
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      return gpu && (await gpu.requestAdapter()) ? "webgpu" : "wasm";
    } catch {
      return "wasm";
    }
  })();
  return devicePromise;
}

function post(message: WorkerResponse) {
  self.postMessage(message);
}

/** Byte progress across every file a model needs. */
function progressReporter(report: (p: WorkerProgress) => void) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info: ProgressInfo) => {
    if (info.status === "progress_total") {
      report({ stage: "download", loaded: info.loaded, total: info.total });
    } else if (info.status === "progress") {
      files.set(info.file, { loaded: info.loaded, total: info.total });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      report({ stage: "download", loaded, total });
    }
  };
}

function getRunner(model: BackgroundModel, device: Device, report: (p: WorkerProgress) => void) {
  const key = `${model}:${device}`;
  let runner = runners.get(key);
  if (!runner) {
    runner = (async (): Promise<Runner> => {
      const segmenter = await pipeline("background-removal", BACKGROUND_MODELS[model].repo, {
        device,
        // Half precision on the GPU; the small 8-bit MODNet on the CPU.
        dtype: device === "webgpu" ? "fp16" : "uint8",
        progress_callback: progressReporter(report),
      });
      return async (image) => (await segmenter(image)) as RawImage;
    })();
    runners.set(key, runner);
    // A failed download can be retried next time.
    runner.catch(() => runners.delete(key));
  }
  return runner;
}

class GpuUnavailable extends Error {}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const { id, image, model } = event.data;
  const report = (progress: WorkerProgress) => post({ id, type: "progress", progress });
  const device = event.data.device ?? (await detectDevice());
  let downloading = true;
  try {
    if (device !== "webgpu" && BACKGROUND_MODELS[model].needsGpu) {
      throw new GpuUnavailable("This device has no WebGPU graphics support.");
    }
    const input = await RawImage.fromBlob(image);
    const run = await getRunner(model, device, report);
    downloading = false;
    report({ stage: "processing" });
    const output = await run(input);
    const blob = (await output.toBlob("image/png")) as Blob;
    post({ id, type: "done", image: blob, device });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const network = downloading && /fetch|network|locate file|load failed/i.test(message);
    const gpuProblem = error instanceof GpuUnavailable || (device === "webgpu" && !network);
    post({ id, type: gpuProblem ? "gpu-failed" : "error", message });
  }
});
