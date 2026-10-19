/**
 * Builds a download of some (or all) pages of a design: PNG, JPG, PDF
 * (standard or print), SVG or video. Several pages of a picture format come
 * as one ZIP. Browser only.
 */
import { flattenElements } from "@/lib/document/tree";
import { clampScale, renderPageToCanvas, renderPageToSvg } from "@/lib/engine/render";
import { googleFontsCssUrl, isWebFont } from "@/lib/fonts/loader";
import type { Design, Page } from "@/lib/schema";
import { buildPdf, pxToPt, type PdfPage } from "./pdf";
import { planVideo, renderVideo } from "./video";
import { buildZip, type ZipEntry } from "./zip";

export const DOWNLOAD_TYPES = ["png", "jpg", "pdf", "pdf-print", "svg", "video"] as const;
export type DownloadType = (typeof DOWNLOAD_TYPES)[number];

export const VIDEO_SIZES = [720, 1080, 2160] as const;
export type VideoSize = (typeof VIDEO_SIZES)[number];

export interface DownloadOptions {
  type: DownloadType;
  /** Pages to include, in design order. */
  pageIds: string[];
  /** PNG/JPG size multiplier (1 = design size). */
  scale: number;
  /** JPG quality, 0.1–1. */
  quality: number;
  /** PNG/SVG without the page background. */
  transparent: boolean;
  /** Video: the short side in px (720p, 1080p, 4K). */
  videoSize: VideoSize;
}

export const DEFAULT_DOWNLOAD: Omit<DownloadOptions, "pageIds"> = {
  type: "png",
  scale: 1,
  quality: 0.9,
  transparent: false,
  videoSize: 1080,
};

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

export class VideoUnsupportedError extends Error {
  constructor() {
    super("This browser can't make videos.");
  }
}

/** A file-system-safe base name for downloads. */
export function fileBaseName(name: string): string {
  const clean = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || "design";
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be made."))),
      type,
      quality,
    ),
  );
}

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** zlib-compressed RGB rows (alpha flattened onto white) for a lossless PDF image. */
async function flateRgb(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array((data.length / 4) * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    const a = data[i + 3]! / 255;
    rgb[j] = data[i]! * a + 255 * (1 - a);
    rgb[j + 1] = data[i + 1]! * a + 255 * (1 - a);
    rgb[j + 2] = data[i + 2]! * a + 255 * (1 - a);
  }
  const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"));
  return bytes(await new Response(stream).blob());
}

/** PDF pages are pictures; this many pixels per page is plenty and stays light on memory. */
const PDF_PRINT_MAX_PIXELS = 36_000_000;

function pdfScale(design: Design, print: boolean): number {
  const { width, height } = design.format;
  if (!print)
    return clampScale(design.format, Math.max(1, Math.min(2, 2_400 / Math.max(width, height))));
  // Print: the design's dpi, at least 300 dpi worth of pixels.
  const wanted = Math.max(design.format.dpi, 300) / 96;
  const budget = Math.sqrt(PDF_PRINT_MAX_PIXELS / (width * height));
  return clampScale(design.format, Math.min(wanted, budget));
}

/** Makes an SVG self-contained: pictures inline, fonts linked from Google Fonts. */
async function finishSvg(svg: string, page: Page): Promise<string> {
  const urls = [...new Set(svg.match(/blob:[^"'\s)]+/g) ?? [])];
  for (const url of urls) {
    const blob = await fetch(url).then((r) => r.blob());
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
    svg = svg.split(url).join(dataUrl);
  }
  const families = new Set<string>();
  for (const el of flattenElements(page.elements)) {
    if (el.type !== "text") continue;
    families.add(el.fontFamily);
    for (const run of el.runs) if (run.style.fontFamily) families.add(run.style.fontFamily);
  }
  const imports = [...families]
    .filter(isWebFont)
    .map((f) => `@import url("${googleFontsCssUrl(f)}");`)
    .join("\n");
  if (!imports) return svg;
  const open = svg.indexOf(">", svg.indexOf("<svg"));
  return `${svg.slice(0, open + 1)}\n<style><![CDATA[\n${imports}\n]]></style>${svg.slice(open + 1)}`;
}

export async function createDownload(
  design: Design,
  options: DownloadOptions,
  hooks: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<DownloadResult> {
  const chosen = new Set(options.pageIds);
  const pages = design.pages
    .map((page, index) => ({ page, number: index + 1 }))
    .filter(({ page }) => chosen.has(page.id));
  if (pages.length === 0) throw new Error("Pick at least one page.");
  const base = fileBaseName(design.name);
  const single = pages.length === 1;
  const progress = (done: number) => hooks.onProgress?.(done / pages.length);
  const checkAbort = () => {
    if (hooks.signal?.aborted) throw new DOMException("Download cancelled", "AbortError");
  };
  const pictures = async (
    make: (page: Page) => Promise<Blob>,
    extension: string,
  ): Promise<DownloadResult> => {
    const files: { blob: Blob; name: string }[] = [];
    for (const [i, { page, number }] of pages.entries()) {
      checkAbort();
      files.push({ blob: await make(page), name: `${base}-${number}.${extension}` });
      progress(i + 1);
    }
    if (single) return { blob: files[0]!.blob, filename: `${base}.${extension}` };
    const entries: ZipEntry[] = [];
    for (const file of files) entries.push({ name: file.name, data: await bytes(file.blob) });
    return {
      blob: new Blob([buildZip(entries) as BlobPart], { type: "application/zip" }),
      filename: `${base}.zip`,
    };
  };

  switch (options.type) {
    case "png":
      return pictures(async (page) => {
        const canvas = await renderPageToCanvas(page, design.format, {
          scale: options.scale,
          transparent: options.transparent,
        });
        return canvasBlob(canvas, "image/png");
      }, "png");

    case "jpg":
      return pictures(async (page) => {
        const canvas = await renderPageToCanvas(page, design.format, { scale: options.scale });
        return canvasBlob(canvas, "image/jpeg", options.quality);
      }, "jpg");

    case "svg":
      return pictures(async (page) => {
        const svg = await renderPageToSvg(page, design.format, {
          transparent: options.transparent,
        });
        return new Blob([await finishSvg(svg, page)], { type: "image/svg+xml" });
      }, "svg");

    case "pdf":
    case "pdf-print": {
      const print = options.type === "pdf-print";
      const scale = pdfScale(design, print);
      const pdfPages: PdfPage[] = [];
      for (const [i, { page }] of pages.entries()) {
        checkAbort();
        const canvas = await renderPageToCanvas(page, design.format, { scale });
        pdfPages.push({
          widthPt: pxToPt(design.format.width),
          heightPt: pxToPt(design.format.height),
          image: {
            width: canvas.width,
            height: canvas.height,
            filter: print ? "FlateDecode" : "DCTDecode",
            data: print
              ? await flateRgb(canvas)
              : await bytes(await canvasBlob(canvas, "image/jpeg", 0.92)),
          },
        });
        progress(i + 1);
      }
      return {
        blob: new Blob([buildPdf(pdfPages, { title: design.name }) as BlobPart], {
          type: "application/pdf",
        }),
        filename: `${base}.pdf`,
      };
    }

    case "video": {
      const { width, height } = design.format;
      // `videoSize` is the short side (720p etc.); work out the long side from it.
      const maxSide = (options.videoSize * Math.max(width, height)) / Math.min(width, height);
      const plan = await planVideo(design.format, maxSide);
      if (!plan) throw new VideoUnsupportedError();
      const blob = await renderVideo(
        pages.map((p) => p.page),
        design.format,
        plan,
        hooks,
      );
      return { blob, filename: `${base}.${plan.container}` };
    }
  }
}

/** Hands a file to the browser's download manager. */
export function saveFile({ blob, filename }: DownloadResult) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
