/**
 * PagePlayer — shows one page, scaled to fit, on a read-only canvas. Used by
 * Present mode (and later for animated exports). Everything is prepared off
 * screen (fonts, images) before it's swapped in, so slides appear complete.
 */
import { Rect, StaticCanvas, type FabricObject } from "fabric";
import type { Page } from "@/lib/schema";
import { playEntrance, type Playback } from "./animate";
import { createObject, whenImagesLoaded } from "./mapping";
import { createBackground, ensureFonts } from "./render";

export class PagePlayer {
  readonly canvas: StaticCanvas;
  private objects: FabricObject[] = [];
  private playback: Playback | null = null;
  private token = 0;
  private disposed = false;

  constructor(
    element: HTMLCanvasElement,
    private readonly format: { width: number; height: number },
    /** `retina: false` keeps the canvas at exactly the size given (video export). */
    options: { retina?: boolean } = {},
  ) {
    this.canvas = new StaticCanvas(element, {
      renderOnAddRemove: false,
      enableRetinaScaling: options.retina ?? true,
    });
    const { width, height } = format;
    // Nothing outside the page is ever shown.
    this.canvas.clipPath = new Rect({
      left: width / 2,
      top: height / 2,
      width,
      height,
      absolutePositioned: true,
    });
  }

  /** Fits the page inside width × height (letterboxed, centred). */
  resize(width: number, height: number) {
    if (this.disposed || width < 1 || height < 1) return;
    this.canvas.setDimensions({ width, height });
    const zoom = Math.min(width / this.format.width, height / this.format.height);
    this.canvas.setViewportTransform([
      zoom,
      0,
      0,
      zoom,
      (width - this.format.width * zoom) / 2,
      (height - this.format.height * zoom) / 2,
    ]);
    this.canvas.requestRenderAll();
  }

  /**
   * Builds the page off screen, waits for fonts and images, then shows it.
   * With `animate`, elements enter with their animations (`manual` leaves the
   * clock to the caller — see `animation`).
   */
  async show(
    page: Pick<Page, "background" | "elements" | "animation">,
    options: { animate?: boolean; manual?: boolean } = {},
  ): Promise<FabricObject[]> {
    const token = ++this.token;
    await ensureFonts(page.elements);
    const background = createBackground(page.background, this.format);
    const objects = page.elements.filter((e) => e.visible).map(createObject);
    await Promise.race([
      Promise.all([...objects.map(whenImagesLoaded), background.ready]),
      new Promise((resolve) => setTimeout(resolve, 8_000)),
    ]);
    // A newer slide was requested meanwhile — drop this one.
    if (token !== this.token || this.disposed) return [];
    this.playback?.finish();
    this.playback = null;
    this.canvas.remove(...this.canvas.getObjects());
    this.canvas.add(background, ...objects);
    this.objects = objects;
    // Start states are set before the first frame is drawn.
    if (options.animate)
      this.playback = playEntrance(this.canvas, objects, page, this.format, {
        manual: options.manual,
      });
    this.canvas.requestRenderAll();
    return objects;
  }

  /** The objects of the slide on screen (bottom → top, background excluded). */
  get current(): FabricObject[] {
    return this.objects;
  }

  /** The entrance animation of the slide on screen, if it has one. */
  get animation(): Playback | null {
    return this.playback;
  }

  snapshot(): string {
    return this.canvas.toDataURL({ format: "png", multiplier: 1 });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.playback?.finish();
    void this.canvas.dispose();
  }
}
