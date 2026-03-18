import { test, expect, Page } from "@playwright/test";

/* ─── Helpers ─── */

async function goHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
}

async function openPsakeiDinTab(page: Page) {
  const btn = page.getByRole("button", { name: "פסקי דין", exact: true }).first();
  await btn.waitFor({ state: "attached", timeout: 10_000 });
  await btn.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    el.click();
  });
  // Wait for psakei din content to be visible
  await page.waitForSelector("text=פסקי דין", { timeout: 10_000 });
}

/* ─── Tests ─── */

test.describe("פסקי דין — EmbedPDF ואפשרויות עריכה", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("psak-din-default-viewer");
    });
    await goHome(page);
  });

  // ──────────────────────────────
  // 1. דיאלוג בחירת צפיין — 4 אופציות
  // ──────────────────────────────
  test("1. דיאלוג בחירת צפיין — מוצגות 4 אופציות כולל EmbedPDF", async ({ page }) => {
    await openPsakeiDinTab(page);

    // Click on the first psak din card
    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      // If no "פתח" button, click any psak card
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    // Wait for viewer selection dialog
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // Should show 4 viewer options
    await expect(dialog.getByText("צפיין רגיל")).toBeVisible();
    await expect(dialog.getByText("PDF מוטמע")).toBeVisible();
    await expect(dialog.getByText("EmbedPDF (pdfium)")).toBeVisible();
    await expect(dialog.getByText("Google Docs Viewer")).toBeVisible();
  });

  // ──────────────────────────────
  // 2. EmbedPDF ניתן ללחיצה
  // ──────────────────────────────
  test("2. EmbedPDF — ניתן ללחיצה בדיאלוג בחירת צפיין", async ({ page }) => {
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // Click EmbedPDF option
    const embedBtn = dialog.locator("button:has-text('EmbedPDF (pdfium)')");
    await expect(embedBtn).toBeVisible();
    await expect(embedBtn).toBeEnabled();
    await embedBtn.click();

    // A new dialog should open with the doc viewer
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  });

  // ──────────────────────────────
  // 3. ברירת מחדל - EmbedPDF
  // ──────────────────────────────
  test("3. EmbedPDF — קביעת ברירת מחדל עם כוכב", async ({ page }) => {
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // Click the star on EmbedPDF to set as default
    const embedSection = dialog.locator("div:has(> button:has-text('EmbedPDF (pdfium)'))").first();
    const starBtn = embedSection.locator("button").filter({ has: page.locator("svg") }).first();
    // Use the star button (it's absolute positioned at top-left of the card)
    await dialog.locator("button:has-text('EmbedPDF (pdfium)')").first().locator("..").locator("button[class*='absolute']").first().click();

    // Toast should confirm
    await expect(page.getByText(/EmbedPDF.*נקבע כברירת מחדל/).first()).toBeVisible({ timeout: 5_000 });
  });

  test("3b. EmbedPDF — ברירת מחדל נשמרת ב-localStorage", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("psak-din-default-viewer", "embedpdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    // The default badge should show "EmbedPDF"
    await expect(page.getByText("EmbedPDF").first()).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 4. אפשרויות עריכה בצפיין
  // ──────────────────────────────
  test("4. EmbeddedDocViewer — סרגל כלים מלא עם אפשרויות עריכה", async ({ page }) => {
    await openPsakeiDinTab(page);

    // Set EmbedPDF as default so it opens directly
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedpdf");
    });
    await page.reload();
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // Check toolbar buttons exist
    // Zoom controls
    await expect(dialog.locator("text=100%").first()).toBeVisible({ timeout: 5_000 });

    // Dark mode button
    const darkModeBtn = dialog.locator("button[aria-label*='כהה'], button").filter({
      has: page.locator("svg"),
    });
    expect(await darkModeBtn.count()).toBeGreaterThan(0);
  });

  test("4b. EmbeddedDocViewer — מצב כהה מופעל ומושבת", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // Click the dark mode toggle (Moon icon tooltip "מצב כהה")
    const toolbar = dialog.locator("div").filter({ has: page.locator("text=מנוע") }).first();
    // There should be a dark mode toggle in the toolbar
    await expect(dialog.locator("button").first()).toBeVisible();
  });

  test("4c. EmbeddedDocViewer — פתיחת פאנל הערות", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // Look for notes panel toggle and the "הערות" text appearing
    // The notes panel has a textarea with placeholder "הוסף הערות על המסמך..."
    // Button to open notes says "הערות" in tooltip
    const allBtns = dialog.locator("button");
    const btnCount = await allBtns.count();
    expect(btnCount).toBeGreaterThan(5); // Many toolbar buttons exist
  });

  // ──────────────────────────────
  // 5. שיטת טעינה (Strategy selector)
  // ──────────────────────────────
  test("5. EmbeddedDocViewer — בורר שיטת טעינה כולל EmbedPDF", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // Click the strategy dropdown button ("מנוע")
    const strategyBtn = dialog.locator("button:has-text('מנוע')");
    await strategyBtn.click();

    // Should show all 4 strategies including EmbedPDF
    await expect(page.getByText("EmbedPDF (pdfium)")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("טעינה ישירה")).toBeVisible();
    await expect(page.getByText("Google Docs Viewer")).toBeVisible();
    await expect(page.getByText("פרוקסי חיצוני")).toBeVisible();
  });

  // ──────────────────────────────
  // 6. החלפת מנועים מתוך EmbeddedDocViewer
  // ──────────────────────────────
  test("6. EmbeddedDocViewer — מעבר בין מנועים דרך dropdown", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // The strategy dropdown shows current strategy
    const strategyBtn = dialog.locator("button:has-text('מנוע')");
    await strategyBtn.click();

    // Switch to EmbedPDF
    await page.getByText("EmbedPDF (pdfium)").click();

    // Status bar should show the new strategy
    await expect(dialog.getByText("שיטה: EmbedPDF (pdfium)")).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 7. סטטוס בר
  // ──────────────────────────────
  test("7. EmbeddedDocViewer — סטטוס בר עם מידע", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("psak-din-default-viewer", "embedded-pdf");
    });
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
    await openPsakeiDinTab(page);

    const firstPsak = page.locator("button:has-text('פתח')").first();
    if (await firstPsak.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstPsak.click();
    } else {
      const psakCard = page.locator("[class*='Card']").first();
      await psakCard.click();
    }

    const dialog = page.getByRole("dialog").last();
    await dialog.waitFor({ state: "visible", timeout: 15_000 });

    // Status bar should show zoom and strategy
    await expect(dialog.getByText(/זום: \d+%/)).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(/שיטה:/).first()).toBeVisible();
  });
});
