import { test, expect } from "@playwright/test";

test.describe("PlainTerms smoke tests", () => {
  test("homepage loads with hero CTA visible", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/PlainTerms/);
    const cta = page.getByRole("link", { name: /try free scan/i });
    await expect(cta.first()).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /how it works/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /examples/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /pricing/i }).first()).toBeVisible();
  });

  test("insurance vertical page loads", async ({ page }) => {
    await page.goto("/insurance");
    await expect(page.getByText(/insurance policy/i).first()).toBeVisible();
  });

  test("examples page loads with filter tabs", async ({ page }) => {
    await page.goto("/examples");
    await expect(page.getByText(/example clause/i).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /all/i })).toBeVisible();
  });

  test("analyze page has text input and example button", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByPlaceholder(/paste your contract/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /view example report/i })).toBeVisible();
  });

  test("report page renders fixture data", async ({ page }) => {
    await page.goto("/report/demo-insurance");
    await expect(page.getByText(/several clauses need your attention/i)).toBeVisible();
    await expect(page.getByText(/pre-existing/i).first()).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/simple, transparent pricing/i)).toBeVisible();
  });
});
