import { expect, test } from "@playwright/test";

/**
 * AI surfaces without spending money: settings are customisable and persist,
 * and AI explains how to connect when no key is configured.
 */
test("AI settings are saved in the browser", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByTestId("app-version")).toContainText(/\d+\.\d+\.\d+/);
  await page.getByTestId("settings-tab-ai").click();
  await page.getByTestId("quality-best").click();
  await expect(page.getByTestId("quality-best")).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Brand voice").fill("Warm, confident, no jargon");
  // The open tab is kept in the address, so a reload comes back to it.
  await page.reload();
  await expect(page.getByTestId("quality-best")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Brand voice")).toHaveValue("Warm, confident, no jargon");
});

test("status endpoint never exposes keys", async ({ request }) => {
  const res = await request.get("/api/ai/status");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty("ownerKey");
  expect(JSON.stringify(body)).not.toContain("sk-ant");
});

test("AI routes reject cross-site callers", async ({ request }) => {
  const res = await request.post("/api/ai/write", {
    headers: { origin: "https://evil.example" },
    data: { action: "rewrite", text: "hi" },
  });
  expect(res.status()).toBe(403);
});

test("editor shows the AI studio (or how to connect it)", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await page.getByTestId("quick-instagramPost").click();
  await page.waitForURL(/\/editor\//);
  const status = await (await page.request.get("/api/ai/status")).json();
  if (status.ownerKey) {
    await expect(page.getByTestId("ai-tab-assistant")).toBeVisible();
  } else {
    await expect(page.getByTestId("ai-setup")).toBeVisible();
  }
});
