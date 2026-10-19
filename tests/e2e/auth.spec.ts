import { expect, test } from "@playwright/test";

/**
 * Account pages without creating accounts (the full sign-up → confirm → log in
 * flow is covered by tests/unit/auth.test.ts against a throwaway database).
 */
test("log in, sign up and forgotten password pages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");
  await page.getByTestId("nav-login").click();
  await page.waitForURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill("nobody-e2e@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-right-one");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText(/match/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByTestId("signup-form")).toBeVisible();

  // The same answer whether or not the address has an account.
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("nobody-e2e@example.com");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-success")).toContainText("nobody-e2e@example.com");

  // The account page needs a session.
  await page.goto("/account");
  await page.waitForURL(/\/login\?next=%2Faccount|\/login\?next=\/account/);
  expect(errors).toEqual([]);
});
