import { expect, test } from "@playwright/test";

test.describe("health", () => {
  test("API reports ok without leaking keys", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(JSON.stringify(body)).not.toContain("sk-ant");
  });

  test("health page loads and browser checks pass", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/health");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("System health");
    await expect(page.getByTestId("check-indexeddb")).toHaveAttribute("data-status", "ok");
    await expect(page.getByTestId("check-canvas")).toHaveAttribute("data-status", "ok");
    expect(errors).toEqual([]);
  });

  test("sends a strict Content-Security-Policy", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  test("switches to Arabic with right-to-left layout", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "lumora-locale", value: "ar", url: baseURL }]);
    await page.goto("/health");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("حالة النظام");
  });
});
