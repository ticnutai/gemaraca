import { test, expect, Page } from "@playwright/test";

const TEST_TXT_URL =
  "https://jaotdqumpcfhcbkgtfib.supabase.co/storage/v1/object/public/psakei-din-files/uploads/1765045580857__________________________________________-_____________.txt";

function embedPdfUrl(fileUrl: string) {
  return `/embedpdf-viewer?url=${encodeURIComponent(fileUrl)}`;
}

async function navigateToViewer(page: Page) {
  await page.goto(embedPdfUrl(TEST_TXT_URL));
  await page.waitForSelector("text=EmbedPDF", { timeout: 15_000 });
}

test.describe("EmbedPDF — פיצ'רים חדשים (עמודות, הצמדה, L/R)", () => {
  // ──────────────────────────────
  // 1-3. תבניות — החלת תבנית מייצרת iframe עם תוכן מעוצב
  // (כפתור עמודות מופיע רק בקבצי HTML/beautified ולא בסרגל טקסט)
  // ──────────────────────────────
  test("1. כפתור תבניות מופיע בסרגל טקסט", async ({ page }) => {
    await navigateToViewer(page);
    await page.waitForTimeout(2_000);

    const templateBtn = page.locator('button[title="החלף תבנית עיצוב"]').first();
    await expect(templateBtn).toBeVisible({ timeout: 10_000 });
  });

  test("2. תפריט תבניות — מציג אפשרויות תבנית", async ({ page }) => {
    await navigateToViewer(page);
    await page.waitForTimeout(2_000);

    const templateBtn = page.locator('button[title="החלף תבנית עיצוב"]').first();
    await expect(templateBtn).toBeVisible({ timeout: 10_000 });
    await templateBtn.click();

    // Should show template options including "מקורי" and template names
    await expect(page.getByText("תבניות עיצוב פסק דין")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("מקורי (ללא תבנית)")).toBeVisible();
    await expect(page.getByText("קלאסי", { exact: false }).first()).toBeVisible();
  });

  test("3. החלת תבנית — iframe עם תוכן מעוצב מופיע", async ({ page }) => {
    await navigateToViewer(page);
    await page.waitForTimeout(2_000);

    // Apply a template
    const templateBtn = page.locator('button[title="החלף תבנית עיצוב"]').first();
    await expect(templateBtn).toBeVisible({ timeout: 10_000 });
    await templateBtn.click();

    await page.getByText("קלאסי", { exact: false }).first().click();
    await page.waitForTimeout(2_000);

    // Template iframe should appear with formatted content
    const templateIframe = page.locator('iframe[title="Template View"]');
    await expect(templateIframe).toBeVisible({ timeout: 10_000 });

    // The template button should now show the selected template name
    await expect(page.locator('button').filter({ hasText: 'קלאסי' }).first()).toBeVisible();
  });

  // ──────────────────────────────
  // 4. הצמדת פאנל — Pin
  // ──────────────────────────────
  test("4. כפתור הצמדת פאנל (Pin) מופיע", async ({ page }) => {
    await navigateToViewer(page);

    const pinBtn = page.locator('button[title="הצמד פאנל"]');
    await expect(pinBtn).toBeVisible({ timeout: 10_000 });
  });

  test("5. לחיצה על Pin — מחליף ל-PinOff", async ({ page }) => {
    await navigateToViewer(page);

    const pinBtn = page.locator('button[title="הצמד פאנל"]');
    await expect(pinBtn).toBeVisible({ timeout: 10_000 });
    await pinBtn.click();

    await expect(page.locator('button[title="בטל הצמדת פאנל"]')).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 6. מצב מפוצל L/R toggle
  // ──────────────────────────────
  test("6. כפתור L/R מופיע רק במצב מפוצל", async ({ page }) => {
    await navigateToViewer(page);

    // In single mode, L/R toggle should NOT be visible
    const lrToggle = page.locator('button:has(svg.lucide-arrow-right-left)');
    await expect(lrToggle).not.toBeVisible({ timeout: 3_000 });

    // Click "מפוצל" to switch to split mode
    await page.getByRole("button", { name: "מפוצל" }).click();

    // Now L/R toggle should appear
    await expect(lrToggle).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 7. מרווח שורות — בסרגל טקסט
  // ──────────────────────────────
  test("7. מרווח שורות — סליידר מופיע בסרגל טקסט", async ({ page }) => {
    await navigateToViewer(page);
    await page.waitForTimeout(3_000);

    // The text toolbar's line spacing button shows "1.8" text and MoveVertical icon
    const lineSpacingBtn = page.locator('button:has(svg.lucide-move-vertical)').first();
    await expect(lineSpacingBtn).toBeVisible({ timeout: 10_000 });
    await lineSpacingBtn.click();

    // Popover should show line height controls
    await expect(page.getByText("מרווח בין שורות")).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 8. כפתורי תצוגה
  // ──────────────────────────────
  test("8. כפתורי מצב תצוגה — יחיד, מפוצל, השוואה", async ({ page }) => {
    await navigateToViewer(page);

    await expect(page.getByRole("button", { name: "יחיד" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "מפוצל" })).toBeVisible();
    await expect(page.getByRole("button", { name: "השוואה" })).toBeVisible();
  });

  // ──────────────────────────────
  // 9. סרגל כלים — אייקוני toolbar
  // ──────────────────────────────
  test("9. אייקוני toolbar — הוסף, מסמכים, אנוטציות, סימניות, סטטיסטיקות", async ({ page }) => {
    await navigateToViewer(page);

    await expect(page.locator('button[title="הוסף מסמך"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button[title*="מסמכים"]')).toBeVisible();
    await expect(page.locator('button[title="אנוטציות"]')).toBeVisible();
    await expect(page.locator('button[title*="סימניות"]')).toBeVisible();
    await expect(page.locator('button[title="סטטיסטיקות"]')).toBeVisible();
  });

  // ──────────────────────────────
  // 10. פתיחת קישור חיצוני
  // ──────────────────────────────
  test("10. כפתור פתיחה בחלון חדש מופיע", async ({ page }) => {
    await navigateToViewer(page);

    await expect(page.locator('a[title="פתח בחלון חדש"]')).toBeVisible({ timeout: 10_000 });
  });
});
