import { expect, test } from "@playwright/test";

/**
 * Phase 1 acceptance: create a design, edit it, close the tab, reopen — intact.
 */
test("create, edit, reload and reopen a design", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByTestId("quick-instagramPost").click();
  await page.waitForURL(/\/editor\/[a-z0-9]+$/);
  const url = page.url();

  // Add a star and a heading.
  await page.getByTestId("rail-elements").click();
  await page.getByRole("button", { name: "Add Star", exact: true }).click();
  await page.getByTestId("rail-text").click();
  await page.getByTestId("add-text-heading").click();

  // Move the heading with the X field.
  const x = page.getByTestId("prop-x");
  await x.fill("40");
  await x.press("Enter");

  // Rename the design.
  const name = page.getByTestId("design-name");
  await name.fill("E2E poster");
  await name.press("Enter");

  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", {
    timeout: 10_000,
  });

  // Close the tab, open a fresh one: everything is still there.
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto(url);
  await expect(reopened.getByTestId("design-name")).toHaveValue("E2E poster");
  await reopened.getByTestId("rail-layers").click();
  await expect(reopened.getByTestId("layer-row")).toHaveCount(2);
  await reopened.getByTestId("layer-row").first().getByRole("button").first().click();
  await expect(reopened.getByTestId("prop-x")).toHaveValue("40");

  // And it is listed on the home page.
  await reopened.goto("/");
  await expect(reopened.getByRole("link", { name: "Open E2E poster" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("group and ungroup elements", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await page.getByTestId("quick-instagramPost").click();
  await page.waitForURL(/\/editor\//);
  await page.getByTestId("rail-elements").click();
  await page.getByRole("button", { name: "Add Star", exact: true }).click();
  await page.getByRole("button", { name: "Add Circle", exact: true }).click();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(2);

  // Select both, group with the keyboard.
  await page.getByTestId("canvas-area").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+g");
  await expect(page.getByTestId("layer-row")).toHaveCount(1);
  await expect(page.getByTestId("layer-row")).toContainText("Group");
  await page.getByTestId("layer-expand").click();
  await expect(page.getByTestId("layer-children").getByRole("button")).toHaveCount(4);

  // The group survives a reload.
  await expect(page.getByTestId("save-status")).toHaveAttribute("data-state", "saved", {
    timeout: 10_000,
  });
  await page.reload();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(1);

  // Ungroup from the properties panel.
  await page.getByTestId("layer-row").getByRole("button", { name: /Group/ }).click();
  await page.getByTestId("ungroup-button").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("undo and redo with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("quick-logo").click();
  await page.waitForURL(/\/editor\//);
  await page.getByTestId("rail-elements").click();
  await page.getByRole("button", { name: "Add Circle", exact: true }).click();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(1);

  await page.getByTestId("canvas-area").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(page.getByTestId("layer-row")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByTestId("layer-row")).toHaveCount(1);
});

test("add a chart, animate the page and download a PNG", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByTestId("quick-instagramPost").click();
  await page.waitForURL(/\/editor\//);

  // A chart and a QR code from the Elements panel.
  await page.getByTestId("rail-elements").click();
  await page.getByTestId("chart-bar").click();
  await page.getByTestId("qr-input").fill("https://example.com");
  await page.getByTestId("qr-add").click();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(2);

  // Whole-page animation, previewed.
  await page.keyboard.press("Escape");
  await page.getByTestId("canvas-area").click({ position: { x: 10, y: 10 } });
  await page.getByTestId("animation-pop").click();
  await expect(page.getByTestId("animation-pop")).toHaveAttribute("aria-checked", "true");

  // Download a PNG of the page.
  await page.getByTestId("download-button").click();
  await page.getByTestId("download-type-png").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("download-start").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  expect(errors).toEqual([]);
});

test("start a design from a template", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/templates");
  await expect(page.getByTestId("template-count")).toContainText(/\d{3}/);
  await page.getByTestId("template-kind-instagramStory").click();
  await page.getByTestId("template-search").fill("birthday");
  const first = page.locator('[data-testid^="template-instagramStory-"]').first();
  await first.click();
  await page.waitForURL(/\/editor\//);
  await page.getByTestId("rail-layers").click();
  expect(await page.getByTestId("layer-row").count()).toBeGreaterThan(4);

  // The editor's Templates panel offers more for the same size.
  await page.getByTestId("rail-templates").click();
  await expect(page.getByTestId("templates-panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the full template library loads and its templates open", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/templates");
  // The built-in templates show at once; the rest of the library arrives a moment later.
  await expect(page.getByTestId("template-library-loading")).toBeHidden({ timeout: 60_000 });
  await expect(page.getByTestId("template-count")).toContainText(/\d{2},\d{3}/);
  await page.getByTestId("template-search").fill("chess");
  const chess = page.locator('[data-testid^="template-instagramPost-chess"]').first();
  await chess.click();
  await page.waitForURL(/\/editor\//);
  await page.getByTestId("rail-layers").click();
  expect(await page.getByTestId("layer-row").count()).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test("add a stock photo, then replace it from the Photos panel", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  // Serve a tiny picture for every stock photo, so the test needs no network.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({
      body: png,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    }),
  );

  await page.goto("/");
  await page.getByTestId("quick-instagramPost").click();
  await page.waitForURL(/\/editor\//);
  await page.getByTestId("rail-photos").click();
  const photos = page.getByTestId("stock-photo");
  await photos.nth(0).click();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(1);

  // The new photo stays selected, so the next pick replaces it.
  await page.getByTestId("rail-photos").click();
  await expect(page.getByTestId("photo-target-hint")).toBeVisible();
  await photos.nth(5).click();
  await expect(page.getByTestId("photo-credit")).toBeVisible();
  await page.getByTestId("rail-layers").click();
  await expect(page.getByTestId("layer-row")).toHaveCount(1);
  expect(errors).toEqual([]);
});
