import { test, expect, Page } from "@playwright/test";

async function goHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
}

async function openPsakeiDinTab(page: Page) {
  const btn = page.getByRole("navigation").getByRole("button", { name: "פסקי דין", exact: true });
  await btn.waitFor({ state: "attached", timeout: 10_000 });
  await btn.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    el.click();
  });
  await page.waitForSelector("text=פסקי דין", { timeout: 10_000 });
}

test.describe("כלי תבניות מעוצבות — E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await goHome(page);
    await openPsakeiDinTab(page);
  });

  test("מופיעים כלי חיפוש וניווט בתצוגה מעוצבת", async ({ page }) => {
    const firstOpenBtn = page.locator("button:has-text('פתח')").first();
    if (!(await firstOpenBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "אין רשומות פסק דין זמינות לבדיקה בסביבה זו");
    }

    await firstOpenBtn.click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const formattedToggle = dialog.getByRole("button", { name: /תצוגה מעוצבת/ });
    await expect(formattedToggle).toBeVisible({ timeout: 10_000 });
    await formattedToggle.click();

    const formattedFrame = dialog.frameLocator("iframe[title$='- formatted']");
    await expect(formattedFrame.locator("[data-testid='psak-doc-widget']")).toBeVisible({ timeout: 15_000 });

    await expect(formattedFrame.locator("[data-testid='psak-search-input']")).toBeVisible();
    await expect(formattedFrame.locator("[data-testid='psak-prev-sec']")).toBeVisible();
    await expect(formattedFrame.locator("[data-testid='psak-next-sec']")).toBeVisible();
    await expect(formattedFrame.locator("[data-testid='psak-breadcrumbs']")).toContainText("מיקום נוכחי");
  });

  test("אפשר לבצע חיפוש פנימי בתוך המסמך המעוצב", async ({ page }) => {
    const firstOpenBtn = page.locator("button:has-text('פתח')").first();
    if (!(await firstOpenBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "אין רשומות פסק דין זמינות לבדיקה בסביבה זו");
    }

    await firstOpenBtn.click();

    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByRole("button", { name: /תצוגה מעוצבת/ }).click();

    const formattedFrame = dialog.frameLocator("iframe[title$='- formatted']");
    const searchInput = formattedFrame.locator("[data-testid='psak-search-input']");

    await expect(searchInput).toBeVisible({ timeout: 15_000 });
    await searchInput.fill("פסק");
    await searchInput.press("Enter");

    await expect(formattedFrame.locator("[data-testid='psak-search-count']")).not.toHaveText("0/0");
  });
});
