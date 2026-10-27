/**
 * The photo editor tour: every area and every tool, one step at a time.
 * Tool steps pick the tool (so its options show) and point at its button;
 * the user can try it on the photo before moving on.
 */
import { get, set, TOOL_GROUPS, type PanelId, type ToolId } from "@/lib/photo/store";
import { selectTool } from "@/lib/photo/tools";

export const TOUR_CHAPTERS = [
  "start",
  "workspace",
  "select",
  "crop",
  "retouch",
  "paint",
  "local",
  "type",
  "pen",
  "navigate",
  "layers",
  "edit",
  "ai",
  "finish",
] as const;
export type TourChapter = (typeof TOUR_CHAPTERS)[number];

/** Area steps (their text lives under photo.tour.steps.<id>). */
export const TOUR_AREAS = [
  "welcome",
  "menubar",
  "options",
  "toolbar",
  "canvas",
  "panels",
  "status",
  "quickMask",
  "colors",
  "layers",
  "groups",
  "masks",
  "adjustments",
  "properties",
  "paths",
  "history",
  "imageMenu",
  "filterMenu",
  "transform",
  "selectMenu",
  "taskBar",
  "save",
  "done",
] as const;
export type TourArea = (typeof TOUR_AREAS)[number];

export interface TourStep {
  id: string;
  chapter: TourChapter;
  /** Either a tool (title/hint from the tool) or an area step. */
  tool?: ToolId;
  area?: TourArea;
  /** What to spotlight (CSS selector); several are cut out of the dimming. */
  targets: string[];
  /** Readies the screen: picks the tool, shows a panel tab… */
  prepare?: () => void;
}

const showTab = (panel: PanelId, group: string) => () => {
  const s = get();
  set({
    panels: { ...s.panels, [panel]: true },
    panelTabs: { ...s.panelTabs, [group]: panel },
    hidePanels: false,
  });
};

const tool = (id: ToolId, chapter: TourChapter): TourStep => ({
  id: `tool-${id}`,
  chapter,
  tool: id,
  targets: [
    `[data-testid="tool-${id}"]`,
    '[data-testid="photo-options"]',
    '[data-testid="photo-viewport"]',
  ],
  prepare: () => selectTool(id),
});

const area = (
  id: TourArea,
  chapter: TourChapter,
  targets: string[],
  prepare?: () => void,
): TourStep => ({
  id,
  chapter,
  area: id,
  targets,
  prepare,
});

export const TOUR_STEPS: TourStep[] = [
  area("welcome", "start", []),
  area("menubar", "workspace", ['[data-tour="menubar"]']),
  area("options", "workspace", ['[data-testid="photo-options"]']),
  area("toolbar", "workspace", ['[data-tour="toolbar"]']),
  area("canvas", "workspace", ['[data-testid="photo-viewport"]']),
  area("panels", "workspace", ['[data-tour="panels"]']),
  area("status", "workspace", ['[data-testid="photo-status"]']),

  tool("move", "select"),
  tool("marqueeRect", "select"),
  tool("marqueeEllipse", "select"),
  tool("lasso", "select"),
  tool("polyLasso", "select"),
  tool("magicWand", "select"),
  area("quickMask", "select", ['[data-tour="quickmask"]', '[data-testid="photo-viewport"]']),

  tool("crop", "crop"),
  tool("eyedropper", "crop"),
  tool("ruler", "crop"),

  tool("spotHeal", "retouch"),
  tool("heal", "retouch"),
  tool("redEye", "retouch"),
  tool("clone", "retouch"),
  tool("historyBrush", "retouch"),

  tool("brush", "paint"),
  tool("pencil", "paint"),
  tool("colorReplace", "paint"),
  tool("eraser", "paint"),
  tool("magicEraser", "paint"),
  tool("gradient", "paint"),
  tool("bucket", "paint"),
  area("colors", "paint", ['[data-tour="colors"]']),

  tool("blur", "local"),
  tool("sharpen", "local"),
  tool("smudge", "local"),
  tool("liquify", "local"),
  tool("dodge", "local"),
  tool("burn", "local"),
  tool("sponge", "local"),

  tool("type", "type"),
  tool("rectangle", "type"),
  tool("ellipse", "type"),
  tool("triangle", "type"),
  tool("polygon", "type"),
  tool("line", "type"),

  tool("pen", "pen"),
  tool("freeformPen", "pen"),
  tool("pathSelect", "pen"),
  area("paths", "pen", ['[data-testid="panel-group-bottom"]'], showTab("paths", "bottom")),

  tool("hand", "navigate"),
  tool("zoom", "navigate"),

  area("layers", "layers", ['[data-testid="panel-group-bottom"]'], showTab("layers", "bottom")),
  area(
    "groups",
    "layers",
    ['[data-testid="new-group"]', '[data-testid="panel-group-bottom"]'],
    showTab("layers", "bottom"),
  ),
  area("masks", "layers", ['[data-testid="add-mask"]'], showTab("layers", "bottom")),
  area(
    "adjustments",
    "layers",
    ['[data-testid="panel-group-middle"]'],
    showTab("adjustments", "middle"),
  ),
  area(
    "properties",
    "layers",
    ['[data-testid="panel-group-middle"]'],
    showTab("properties", "middle"),
  ),

  area("imageMenu", "edit", ['[data-testid="menu-image"]']),
  area("filterMenu", "edit", ['[data-testid="menu-filter"]']),
  area("transform", "edit", ['[data-testid="menu-edit"]']),
  area("selectMenu", "edit", ['[data-testid="menu-select"]']),
  area("history", "edit", ['[data-testid="panel-group-bottom"]'], showTab("history", "bottom")),

  area("taskBar", "ai", ['[data-testid="task-bar"]']),

  area("save", "finish", ['[data-testid="menu-file"]', '[data-testid="photo-save-status"]']),
  area("done", "finish", []),
];

/** Every tool in the toolbar has a step (checked by a unit test). */
export const TOURED_TOOLS = new Set(TOUR_STEPS.flatMap((s) => (s.tool ? [s.tool] : [])));
export const ALL_TOOLS: ToolId[] = TOOL_GROUPS.flatMap((g) => g.tools);
