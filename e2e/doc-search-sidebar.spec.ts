import { test, expect, Page } from "@playwright/test";

const SAMPLE_URL =
  "/embedpdf-viewer?url=https%3A%2F%2Fjaotdqumpcfhcbkgtfib.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fpsakei-din-files%2Fbeautified%2F4e9adba6-4dd7-49d2-a538-9c5175b8b5b6-1773676483817.html&psakId=4e9adba6-4dd7-49d2-a538-9c5175b8b5b6";

async function openViewer(page: Page) {
  await page.goto(SAMPLE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('iframe[title="HTML Viewer"]')).toBeVisible({ timeout: 20000 });
}

async function openDocSearchPanel(page: Page) {
  const docSearchButton = page.locator('button[title="חיפוש במסמך"]');
  await expect(docSearchButton).toBeVisible({ timeout: 15000 });
  await docSearchButton.click();

  await expect(page.getByText("חיפוש במסמך המעוצב", { exact: false })).toBeVisible({ timeout: 10000 });
  await expect(page.getByPlaceholder("חפש בתוך פסק הדין...")).toBeVisible({ timeout: 10000 });
}

test.describe("EmbedPDF doc-search sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page);
  });

  test("opens doc-search panel", async ({ page }) => {
    await openDocSearchPanel(page);
  });

  test("search input works and updates state", async ({ page }) => {
    await openDocSearchPanel(page);

    const searchInput = page.getByPlaceholder("חפש בתוך פסק הדין...");
    await searchInput.fill("תקציר");
    await expect(searchInput).toHaveValue("תקציר");

    const count = page.locator("text=/\\d+\\/\\d+ תוצאות/").first();
    await expect(count).toBeVisible({ timeout: 10000 });

    const noResults = page.getByText("לא נמצאו תוצאות", { exact: false });
    const hasNoResults = await noResults.isVisible().catch(() => false);

    if (!hasNoResults) {
      const prev = page.locator('button[title="קודם"]');
      const next = page.locator('button[title="הבא"]');
      await expect(prev).toBeVisible();
      await expect(next).toBeVisible();
    }
  });

  test("clear button clears search query", async ({ page }) => {
    await openDocSearchPanel(page);

    const searchInput = page.getByPlaceholder("חפש בתוך פסק הדין...");
    await searchInput.fill("פסק דין");

    const clear = page.locator('button[title="נקה"]');
    await expect(clear).toBeVisible({ timeout: 10000 });
    await clear.click();

    await expect(searchInput).toHaveValue("");
    await expect(page.locator("text=0/0").first()).toBeVisible();
  });

  test("section navigation controls are visible", async ({ page }) => {
    await openDocSearchPanel(page);

    await expect(page.getByRole("button", { name: "← סעיף קודם" })).toBeVisible();
    await expect(page.getByRole("button", { name: "סעיף הבא →" })).toBeVisible();
    await expect(page.getByRole("button", { name: "פתח הכל" })).toBeVisible();
    await expect(page.getByRole("button", { name: "כווץ הכל" })).toBeVisible();
  });

  test("url keeps psakId and url params", async ({ page }) => {
    const current = new URL(page.url());
    expect(current.searchParams.get("psakId")).toBeTruthy();
    expect(current.searchParams.get("url")).toBeTruthy();
  });
});
