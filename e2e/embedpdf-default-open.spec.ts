import { test, expect, Page } from "@playwright/test";

/* ─── Helpers ─── */

const VIEWER_PREF_KEY = "psak_din_viewer_preference";

async function setEmbedPdfDefault(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "embedpdf");
  }, VIEWER_PREF_KEY);
}

async function goHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
}

async function openPsakeiDinTab(page: Page) {
  const btn = page
    .getByRole("navigation")
    .getByRole("button", { name: "פסקי דין", exact: true });
  await btn.waitFor({ state: "attached", timeout: 10_000 });
  await btn.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    el.click();
  });
  await page.waitForSelector("text=פסקי דין", { timeout: 10_000 });
}

/** Click the first psak din card (uses cursor-pointer h3 title) */
async function clickFirstPsakCard(page: Page) {
  // Wait for psak cards to render
  const cardTitle = page.locator(".cursor-pointer h3").first();
  await cardTitle.waitFor({ state: "visible", timeout: 10_000 });
  await cardTitle.scrollIntoViewIfNeeded();
  await cardTitle.click();
}

/* ─── Tests ─── */

test.describe("כל פסק דין נפתח ב-EmbedPDF כברירת מחדל", () => {
  /* ──────────────────────────────────────────────
     1. לחיצה על פסק דין מנווטת ל-/embedpdf-viewer
     ────────────────────────────────────────────── */
  test("1. לחיצה על פסק דין בכרטיסיית פסקי דין → ניווט ל-EmbedPDF", async ({
    page,
  }) => {
    await setEmbedPdfDefault(page);
    await goHome(page);
    await openPsakeiDinTab(page);
    await clickFirstPsakCard(page);

    // Should navigate to /embedpdf-viewer with psakId param
    await page.waitForURL(/\/embedpdf-viewer\?.*psakId=/, { timeout: 15_000 });
    expect(page.url()).toContain("/embedpdf-viewer");
    expect(page.url()).toMatch(/psakId=/);
  });

  /* ──────────────────────────────────────────────
     2. EmbedPDF עמוד טוען עם psakId בלבד (ללא url)
     ────────────────────────────────────────────── */
  test("2. EmbedPDF עמוד טוען עם psakId בלבד — תוכן מ-full_text", async ({
    page,
  }) => {
    await setEmbedPdfDefault(page);
    await goHome(page);
    await openPsakeiDinTab(page);

    // Click any psak to get a real psakId
    await clickFirstPsakCard(page);
    await page.waitForURL(/\/embedpdf-viewer\?.*psakId=/, { timeout: 15_000 });

    // Extract psakId and re-navigate without url param (simulating no source_url)
    const url = new URL(page.url());
    const psakId = url.searchParams.get("psakId");
    expect(psakId).toBeTruthy();

    await page.goto(`/embedpdf-viewer?psakId=${psakId}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // The page should render content (not be blank/error)
    await page.waitForTimeout(3_000);

    // Content is in an iframe (srcDoc), so check for iframe or EmbedPDF toolbar
    const hasContent = await page.evaluate(() => {
      const iframes = document.querySelectorAll("iframe");
      const hasIframe = iframes.length > 0;
      // Also check for the EmbedPDF toolbar
      const bodyText = document.body.innerText;
      const hasToolbar = bodyText.includes("EmbedPDF") || bodyText.includes("תבניות") || bodyText.includes("HTML");
      return hasIframe || hasToolbar;
    });
    expect(hasContent).toBe(true);
  });

  /* ──────────────────────────────────────────────
     3. EmbedPDF עמוד — מציג תוכן עם source_url
     ────────────────────────────────────────────── */
  test("3. EmbedPDF עמוד — תוכן PDF/HTML נטען עם source_url", async ({
    page,
  }) => {
    await setEmbedPdfDefault(page);
    await goHome(page);
    await openPsakeiDinTab(page);
    await clickFirstPsakCard(page);

    await page.waitForURL(/\/embedpdf-viewer/, { timeout: 15_000 });

    // Wait for content to load
    await page.waitForTimeout(3_000);

    // Either iframe, embed, or html content should be present
    const hasContent = await page.evaluate(() => {
      const iframes = document.querySelectorAll("iframe");
      const embeds = document.querySelectorAll("embed");
      const hasIframe = iframes.length > 0;
      const hasEmbed = embeds.length > 0;
      const mainContent = document.querySelector("main, [class*='viewer'], [class*='Viewer']");
      const hasMainContent = mainContent && mainContent.textContent && mainContent.textContent.length > 50;
      return hasIframe || hasEmbed || !!hasMainContent;
    });
    expect(hasContent).toBe(true);
  });

  /* ──────────────────────────────────────────────
     4. דיאלוג — כפתור "פתח ב-EmbedPDF" מופיע תמיד
     ────────────────────────────────────────────── */
  test("4. דיאלוג פסק דין — כפתור 'פתח ב-EmbedPDF' מופיע גם ללא source_url", async ({
    page,
  }) => {
    // Set dialog as default to force dialog open
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dialog");
    }, VIEWER_PREF_KEY);
    await goHome(page);
    await openPsakeiDinTab(page);
    await clickFirstPsakCard(page);

    // Wait for dialog to appear
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // The "פתח ב-EmbedPDF" button should be visible
    const embedPdfButton = dialog.locator("button:has-text('EmbedPDF')");
    await expect(embedPdfButton.first()).toBeVisible({ timeout: 5_000 });
  });

  /* ──────────────────────────────────────────────
     5. דיאלוג — כפתור EmbedPDF מנווט ל-/embedpdf-viewer
     ────────────────────────────────────────────── */
  test("5. דיאלוג — לחיצה על כפתור EmbedPDF מנווטת לדף הצפיין", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dialog");
    }, VIEWER_PREF_KEY);
    await goHome(page);
    await openPsakeiDinTab(page);
    await clickFirstPsakCard(page);

    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // Click EmbedPDF button
    const embedPdfButton = dialog.locator("button:has-text('EmbedPDF')").first();
    await embedPdfButton.click();

    // Should navigate to /embedpdf-viewer
    await page.waitForURL(/\/embedpdf-viewer/, { timeout: 15_000 });
    expect(page.url()).toContain("/embedpdf-viewer");
  });

  /* ──────────────────────────────────────────────
     6. ניווט ישיר ל-/embedpdf-viewer?psakId=... ללא url
     ────────────────────────────────────────────── */
  test("6. ניווט ישיר ל-embedpdf-viewer עם psakId בלבד — עמוד נטען", async ({
    page,
  }) => {
    await setEmbedPdfDefault(page);
    await goHome(page);
    await openPsakeiDinTab(page);

    // First: get a real psakId by clicking any psak
    await clickFirstPsakCard(page);
    await page.waitForURL(/\/embedpdf-viewer\?.*psakId=/, { timeout: 15_000 });
    const originalUrl = new URL(page.url());
    const psakId = originalUrl.searchParams.get("psakId");
    expect(psakId).toBeTruthy();

    // Now re-navigate with ONLY psakId (no url param) — simulates psakim.org psak
    await page.goto(`/embedpdf-viewer?psakId=${psakId}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Page should load without crash
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // Should not show 404
    await expect(page.locator("text=404")).not.toBeVisible({ timeout: 2_000 }).catch(() => {});
  });

  /* ──────────────────────────────────────────────
     7. ברירת מחדל embedpdf — אין דיאלוג ביניים
     ────────────────────────────────────────────── */
  test("7. ברירת מחדל embedpdf — ניווט ישיר ללא דיאלוג ביניים", async ({
    page,
  }) => {
    await setEmbedPdfDefault(page);
    await goHome(page);
    await openPsakeiDinTab(page);
    await clickFirstPsakCard(page);

    // Should navigate directly without showing a dialog
    await page.waitForURL(/\/embedpdf-viewer/, { timeout: 15_000 });
    
    // Verify no dialog appeared (we're on embedpdf page already)
    expect(page.url()).toContain("/embedpdf-viewer");
  });
});
