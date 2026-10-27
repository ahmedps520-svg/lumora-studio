import { expect, test } from "@playwright/test";

// The first-visit tutorial prompt is covered by its own test; keep it out of the way here.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("lumora-photo-tour", JSON.stringify({ prompted: true })),
  );
});

/**
 * The photo editor end to end: choose it on the home page, make a blank
 * canvas, paint, select and fill, add text and a shape, add an adjustment
 * layer, run a filter, undo/redo, then reload and find everything saved.
 */
test("photo editor: create, edit, save and reopen", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.getByTestId("choose-photo").click();
  await page.waitForURL(/\/photo$/);

  await page.getByTestId("photo-new").click();
  await page.getByTestId("preset-square").click();
  await page.getByTestId("new-doc-create").click();
  await page.waitForURL(/\/photo\/[A-Za-z0-9_-]+$/);
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("photo-status")).toContainText("1080 × 1080");

  const viewport = page.getByTestId("photo-viewport");
  const box = (await viewport.boundingBox())!;
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });

  // Brush stroke.
  await page.keyboard.press("b");
  await expect(page.getByTestId("photo-options")).toContainText("Brush");
  let p = at(0.35, 0.4);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = at(0.6, 0.45);
  await page.mouse.move(p.x, p.y, { steps: 12 });
  await page.mouse.up();

  // Marquee selection, then fill it with the foreground colour.
  await page.keyboard.press("m");
  p = at(0.4, 0.55);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = at(0.55, 0.7);
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("task-generative")).toBeVisible();
  await page.getByTestId("menu-edit").click();
  await page.getByTestId("cmd-fill").click();
  await page.getByTestId("fill-dialog").getByRole("combobox").selectOption("foreground");
  await page.getByTestId("dialog-ok").click();
  await page.getByTestId("task-deselect").click();

  // Text and a shape become layers.
  await page.keyboard.press("t");
  p = at(0.3, 0.8);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("textbox", { name: "Type here" })).toBeFocused();
  await page.keyboard.type("Lumora");
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("u");
  p = at(0.65, 0.2);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  p = at(0.8, 0.35);
  await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("layer-row")).toHaveCount(3);

  // Adjustment layer from the Adjustments panel.
  await page.getByTestId("panel-tab-adjustments").click();
  await page.getByTestId("adj-panel-levels").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(4);

  // A filter with its dialog, on the background layer.
  await page.getByTestId("layer-row").last().click();
  await page.getByTestId("menu-filter").click();
  await page.getByRole("menuitem", { name: "Blur", exact: true }).first().hover();
  await page.getByTestId("filter-gaussianBlur").click();
  await expect(page.getByTestId("filter-dialog")).toBeVisible();
  await page.getByTestId("dialog-ok").click();

  // Undo and redo the filter.
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  await page.getByTestId("panel-tab-history").click();
  await expect(page.getByTestId("history-panel")).toContainText("Gaussian blur");

  // Autosave, then reopen.
  await expect(page.getByTestId("photo-save-status")).toHaveAttribute("data-state", "saved", {
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("layer-row")).toHaveCount(4);

  expect(errors).toEqual([]);
});

test("photo editor works in Arabic (right-to-left)", async ({ page, context }) => {
  await context.addCookies([{ name: "lumora-locale", value: "ar", url: "http://localhost:3000" }]);
  await page.goto("/photo");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByTestId("photo-new").click();
  await page.getByTestId("new-doc-create").click();
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("menu-file")).toHaveText("ملف");
  await expect(page.getByTestId("layer-row")).toContainText("الخلفية");
});

test("photo editor: groups, effects, transform modes and paths", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/photo");
  await page.getByTestId("photo-new").click();
  await page.getByTestId("preset-square").click();
  await page.getByTestId("new-doc-create").click();
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });

  const viewport = page.getByTestId("photo-viewport");
  const box = (await viewport.boundingBox())!;
  const at = (fx: number, fy: number) => ({
    x: box.x + box.width * fx,
    y: box.y + box.height * fy,
  });
  const drag = async (a: { x: number; y: number }, b: { x: number; y: number }) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
  };

  // Two shapes, picked together and grouped.
  await page.keyboard.press("u");
  await drag(at(0.3, 0.3), at(0.45, 0.45));
  await drag(at(0.55, 0.3), at(0.7, 0.45));
  const rows = page.getByTestId("layer-row");
  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ["Control"] });
  await page.keyboard.press("Control+g");
  await expect(rows.first()).toHaveAttribute("data-kind", "group");
  await page.getByTestId("group-toggle").click();
  await expect(rows).toHaveCount(2);
  await page.getByTestId("group-toggle").click();
  await expect(rows).toHaveCount(4);

  // Effects on the group.
  await page.getByTestId("menu-layer").click();
  await page.getByTestId("cmd-layerStyle").click();
  await page.getByTestId("style-bevel").check();
  await page.getByTestId("style-innerShadow").check();
  await page.getByTestId("dialog-ok").click();

  // Perspective on the background.
  await rows.last().click();
  await page.getByTestId("menu-edit").click();
  await page.getByRole("menuitem", { name: "Transform", exact: true }).hover();
  await page.getByTestId("cmd-perspective").click();
  await expect(page.getByRole("radio", { name: "Perspective" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByTestId("transform-apply").click();

  // A closed pen path becomes a selection.
  await page.keyboard.press("p");
  for (const [x, y] of [
    [0.3, 0.6],
    [0.6, 0.6],
    [0.5, 0.85],
    [0.3, 0.6],
  ] as const) {
    const p = at(x, y);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByTestId("panel-tab-paths").click();
  await expect(page.getByTestId("path-row")).toHaveCount(1);
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("task-generative")).toBeVisible();

  await page.getByTestId("panel-tab-history").click();
  await expect(page.getByTestId("history-panel")).toContainText("Load path as selection");
  await expect(page.getByTestId("history-panel")).toContainText("Group layers");

  // Everything comes back after a reload.
  await expect(page.getByTestId("photo-save-status")).toHaveAttribute("data-state", "saved", {
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("panel-tab-layers").click();
  await expect(page.getByTestId("layer-row").first()).toHaveAttribute("data-kind", "group");
  await page.getByTestId("panel-tab-paths").click();
  await expect(page.getByTestId("path-row")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("photo tutorial: practice photo, step by step, resume later", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/photo");
  await page.getByTestId("photo-learn").click();
  const card = page.getByTestId("tour-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("tour-title")).toHaveText("Welcome to the photo editor");
  await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("tour-title")).toHaveText("Menus");
  // Jump to a chapter: the first painting step picks the brush.
  await card.getByRole("combobox").selectOption("paint");
  await expect(page.getByTestId("tour-title")).toHaveText("Brush");
  await expect(page.getByTestId("photo-options")).toContainText("Brush");
  // Try it.
  const box = (await page.getByTestId("photo-viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId("tour-tried")).toBeVisible();
  const progress = await page.getByTestId("tour-progress").innerText();
  // Close and come back where we were.
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await page.getByTestId("status-tutorial").click();
  await expect(page.getByTestId("tour-progress")).toHaveText(progress);
  expect(errors).toEqual([]);
});

test("photo editor stays responsive while painting", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/photo");
  await page.getByTestId("photo-new").click();
  await page.getByTestId("preset-hd").click();
  await page.getByTestId("new-doc-create").click();
  await expect(page.getByTestId("photo-editor")).toBeVisible({ timeout: 30_000 });
  // An adjustment layer on top makes every full redraw expensive.
  await page.getByTestId("panel-tab-adjustments").click();
  await page.getByTestId("adj-panel-hueSaturation").click();
  await page.getByTestId("panel-tab-layers").click();
  await page.getByTestId("layer-row").last().click();
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ type: "longtask" });
  });
  await page.keyboard.press("b");
  const box = (await page.getByTestId("photo-viewport").boundingBox())!;
  for (let s = 0; s < 2; s++) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * (0.3 + s * 0.2));
    await page.mouse.down();
    for (let i = 0; i <= 60; i++)
      await page.mouse.move(
        box.x + box.width * (0.2 + i * 0.01),
        box.y + box.height * (0.3 + s * 0.2),
      );
    await page.mouse.up();
  }
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  // Before the fix every pointer move blocked the page (~120 long tasks here).
  expect(long.filter((d) => d > 200).length).toBeLessThan(10);
});

test("first visit: the editor offers the tutorial", async ({ page }) => {
  // Undo the beforeEach: this browser has never seen the editor.
  await page.addInitScript(() => localStorage.removeItem("lumora-photo-tour"));
  await page.goto("/photo");
  await page.getByTestId("photo-new").click();
  await page.getByTestId("new-doc-create").click();
  await expect(page.getByTestId("tour-prompt")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("tour-prompt-start").click();
  await expect(page.getByTestId("tour-card")).toBeVisible();
  await expect(page.getByTestId("tour-progress")).toContainText("1 /");
});
