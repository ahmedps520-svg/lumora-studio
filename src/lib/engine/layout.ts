/**
 * Keeps a Fabric group exactly on its element box. (Fabric's default layout
 * fits the group to its children's bounds, strokes included, which would drift.)
 */
import {
  LayoutStrategy,
  Point,
  type FabricObject,
  type LayoutStrategyResult,
  type StrictLayoutContext,
} from "fabric";

export class ElementBoxLayout extends LayoutStrategy {
  static override type = "lumora-element-box";

  constructor(private readonly box: { x: number; y: number; width: number; height: number }) {
    super();
  }

  override calcBoundingBox(
    _objects: FabricObject[],
    context: StrictLayoutContext,
  ): LayoutStrategyResult | undefined {
    if (context.type !== "initialization") return undefined;
    const { x, y, width, height } = this.box;
    return {
      center: new Point(x + width / 2, y + height / 2),
      relativeCorrection: new Point(0, 0),
      size: new Point(width, height),
    };
  }
}
