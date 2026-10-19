import "server-only";
/**
 * HD background removal on the Lumora server (free, private — the image never
 * leaves your own Lumora instance). Runs BiRefNet Lite (MIT licence) with ONNX
 * Runtime's native engine: DirectML on Windows GPUs, else the CPU. Unlike the
 * browser it has no 4 GB memory cap, so the full-quality model always fits.
 *
 * The model (~224 MB) downloads once into .lumora-cache/ and stays loaded.
 */
import path from "node:path";
import type { Tensor } from "@huggingface/transformers";

const REPO = "onnx-community/BiRefNet_lite-ONNX";

export type Remover = (image: Buffer) => Promise<{ png: Buffer; device: string }>;

interface State {
  loading?: Promise<Remover>;
  ready?: boolean;
  /** Runs are queued: one model run at a time keeps memory predictable. */
  queue: Promise<unknown>;
}

const globalState = globalThis as typeof globalThis & { __lumoraBg?: State };
const state: State = (globalState.__lumoraBg ??= { queue: Promise.resolve() });

/** Off on serverless hosts (no room for the model) unless explicitly enabled. */
export function serverRemovalEnabled(): boolean {
  const flag = process.env.BACKGROUND_REMOVAL_SERVER;
  if (flag === "on") return true;
  if (flag === "off") return false;
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

export const removerReady = () => state.ready === true;

async function load(): Promise<Remover> {
  const { AutoModel, AutoProcessor, RawImage, env } = await import("@huggingface/transformers");
  const sharp = (await import("sharp")).default;
  env.cacheDir = path.join(process.cwd(), ".lumora-cache", "models");

  const devices = process.platform === "win32" ? ["dml", "cpu"] : ["cpu"];
  const processor = await AutoProcessor.from_pretrained(REPO);
  type Model = Awaited<ReturnType<typeof AutoModel.from_pretrained>>;
  const models = new Map<string, Promise<Model>>();
  const modelFor = (device: string) => {
    let model = models.get(device);
    if (!model) {
      model = AutoModel.from_pretrained(REPO, { device: device as "cpu", dtype: "fp32" });
      models.set(device, model);
    }
    return model;
  };

  const run = async (device: string, image: InstanceType<typeof RawImage>) => {
    const model = await modelFor(device);
    const { pixel_values } = await processor(image);
    const { output_image } = (await model({ input_image: pixel_values })) as {
      output_image: Tensor;
    };
    return output_image.squeeze(0).sigmoid().mul(255).to("uint8");
  };

  // Load (and warm up) the first device that works.
  let device = devices[0]!;
  for (const candidate of devices) {
    try {
      await modelFor(candidate);
      device = candidate;
      break;
    } catch (error) {
      models.delete(candidate);
      console.warn(`Background removal: ${candidate} unavailable`, error);
    }
  }

  return async (input) => {
    const image = await RawImage.fromBlob(new Blob([new Uint8Array(input)]));
    let matte;
    try {
      matte = await run(device, image);
    } catch (error) {
      if (device === "cpu") throw error;
      console.warn(`Background removal on ${device} failed; using the CPU.`, error);
      device = "cpu";
      matte = await run(device, image);
    }
    const mask = await RawImage.fromTensor(matte).resize(image.width, image.height);
    const cutout = image.rgba().putAlpha(mask);
    const png = await sharp(Buffer.from(cutout.data), {
      raw: { width: cutout.width, height: cutout.height, channels: 4 },
    })
      .png({ compressionLevel: 6 })
      .toBuffer();
    return { png, device };
  };
}

/** Starts loading the model (idempotent). */
export function getRemover(): Promise<Remover> {
  state.loading ??= load().then(
    (remover) => {
      state.ready = true;
      return remover;
    },
    (error) => {
      state.loading = undefined;
      throw error;
    },
  );
  return state.loading;
}

/** Removes the background of one image (requests run one after another). */
export function removeBackgroundOnServer(image: Buffer) {
  const job = state.queue.then(async () => (await getRemover())(image));
  state.queue = job.catch(() => undefined);
  return job;
}
