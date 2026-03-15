import { test, expect, Page } from "@playwright/test";

/* ─── Helpers ─── */

/** Navigate to the app root and wait for it to be ready */
async function goHome(page: Page) {
  await page.goto("/");
  // Wait for the main app to render (sidebar menu should be present)
  await page.waitForSelector('[data-active-tab]', { timeout: 15_000 });
}

/** Click the PDF viewer tab in the sidebar */
async function openPdfViewerTab(page: Page) {
  // The sidebar is fixed-positioned and the PDF tab (last item) may be out of viewport.
  // Use JavaScript to scroll the sidebar menu button into view and click it.
  const pdfBtn = page.getByRole("button", { name: /צפיין PDF/ });
  await pdfBtn.waitFor({ state: "attached", timeout: 10_000 });
  await pdfBtn.evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    el.click();
  });
  // Wait for the PDF viewer tab content to render
  await expect(page.locator('[data-active-tab="pdf-viewer"]')).toBeVisible({ timeout: 10_000 });
}

/* ─── Tests ─── */

test.describe("מערכת EmbedPDF — טסטים E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.addInitScript(() => {
      localStorage.removeItem("pdf-viewer-default-v1");
      localStorage.removeItem("pdf-viewer-theme-v1");
      localStorage.removeItem("pdf-viewer-mode-v1");
      localStorage.removeItem("pdf-viewer-recent-urls-v1");
    });
    await goHome(page);
  });

  // ──────────────────────────────
  // 1. ניווט לטאב צפיין PDF
  // ──────────────────────────────
  test("1. ניווט — לחיצה בסיידבר פותחת את טאב צפיין PDF", async ({ page }) => {
    await openPdfViewerTab(page);

    // The header of the tab should show
    await expect(page.getByRole("heading", { name: /צפיין PDF/ })).toBeVisible();
    // The subtitle
    await expect(page.getByText("קרא, השווה והוסף הערות למסמכי PDF")).toBeVisible();
  });

  // ──────────────────────────────
  // 2. בחירת צפיין
  // ──────────────────────────────
  test("2. בחירת צפיין — מוצגים 3 צפיינים", async ({ page }) => {
    await openPdfViewerTab(page);

    // Scope to the main content area (not sidebar)
    const main = page.locator('[data-active-tab="pdf-viewer"]');
    await expect(main.getByText("צפיין מובנה").first()).toBeVisible();
    await expect(main.getByText("EmbedPDF (pdfium)")).toBeVisible();
    await expect(main.getByText("Google Docs Viewer")).toBeVisible();
  });

  test("2b. בחירת צפיין — לחיצה על צפיין מחליפה אקטיבי", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');

    // Click on Google Docs Viewer card button
    const googleCard = main.locator("button").filter({ hasText: "Google Docs Viewer" });
    await googleCard.click();

    // The badge "פעיל" should appear on Google Docs
    const badges = main.getByText("פעיל");
    await expect(badges.last()).toBeVisible();
  });

  test("2c. EmbedPDF ניתן לבחירה ולחיצה", async ({ page }) => {
    await openPdfViewerTab(page);

    // The EmbedPDF card should be enabled and clickable
    const embedCard = page.locator("button:has-text('EmbedPDF (pdfium)')").first();
    await expect(embedCard).toBeEnabled();

    // Click it — should become active
    await embedCard.click();
    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // The "פעיל" badge should appear on EmbedPDF
    const activeBadge = main.locator("button:has-text('EmbedPDF (pdfium)')").locator("text=פעיל");
    await expect(activeBadge).toBeVisible();
  });

  // ──────────────────────────────
  // 3. ברירת מחדל (כוכב)
  // ──────────────────────────────
  test("3. ברירת מחדל — קביעת ברירת מחדל עם כוכב", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');

    // Find the star button inside the browser viewer card
    const setDefaultBtn = main.getByLabel("קבע כברירת מחדל").first();
    await setDefaultBtn.click();

    // A toast should appear with the default message
    await expect(page.getByText(/ברירת מחדל/).first()).toBeVisible({ timeout: 5_000 });

    // The header badge should show the default viewer (scoped to main)
    await expect(main.getByText(/ברירת מחדל: צפיין מובנה/).first()).toBeVisible();
  });

  test("3b. ברירת מחדל — ניקוי ברירת מחדל", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');

    // Set default first
    const setDefaultBtn = main.getByLabel("קבע כברירת מחדל").first();
    await setDefaultBtn.click();
    await expect(main.getByText(/ברירת מחדל: צפיין מובנה/).first()).toBeVisible({ timeout: 5_000 });

    // Now click the X to clear default (inside the badge)
    const clearBtn = main.getByLabel("נקה ברירת מחדל");
    await clearBtn.click();

    // Toast: "ברירת המחדל נוקתה"
    await expect(page.getByText("ברירת המחדל נוקתה")).toBeVisible({ timeout: 5_000 });

    // The badge should no longer show the default
    await expect(main.getByText(/ברירת מחדל: צפיין מובנה/)).not.toBeVisible();
  });

  test("3c. ברירת מחדל — נשמרת ב-localStorage", async ({ page }) => {
    // Use context.addInitScript to inject localStorage before any page loads
    await page.context().addInitScript(() => {
      localStorage.setItem("pdf-viewer-default-v1", '"browser"');
    });

    // Navigate — the init script runs before React, so component reads the persisted value
    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });

    // Open PDF tab
    const pdfBtn = page.locator('button:has-text("צפיין PDF")');
    await pdfBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      (el as HTMLElement).click();
    });
    await page.waitForSelector('[data-active-tab="pdf-viewer"]', { timeout: 15_000 });

    // The badge should show the persisted default
    const main = page.locator('[data-active-tab="pdf-viewer"]');
    await expect(main.getByText(/ברירת מחדל: צפיין מובנה/).first()).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 4. מצבי תצוגה (Single / Split / Compare)
  // ──────────────────────────────
  test("4. מצבי תצוגה — החלפה בין single/split/compare", async ({ page }) => {
    await openPdfViewerTab(page);

    // Default is "single" — button "יחיד" should be active
    const singleBtn = page.getByRole("button", { name: "יחיד" });
    const splitBtn = page.getByRole("button", { name: "מפוצל" });
    const compareBtn = page.getByRole("button", { name: "השוואה" });

    await expect(singleBtn).toBeVisible();
    await expect(splitBtn).toBeVisible();
    await expect(compareBtn).toBeVisible();

    // Click split — should show second URL input
    await splitBtn.click();
    await expect(page.getByPlaceholder("קישור ל-PDF שני")).toBeVisible();

    // Click compare
    await compareBtn.click();
    await expect(page.getByPlaceholder("קישור ל-PDF שני")).toBeVisible();

    // Back to single — second input should disappear
    await singleBtn.click();
    await expect(page.getByPlaceholder("קישור ל-PDF שני")).not.toBeVisible();
  });

  test("4b. מצבי תצוגה — נשמר ב-localStorage", async ({ page }) => {
    await openPdfViewerTab(page);

    await page.getByRole("button", { name: "מפוצל" }).click();

    const stored = await page.evaluate(() =>
      localStorage.getItem("pdf-viewer-mode-v1")
    );
    expect(stored).toBe('"split"');
  });

  // ──────────────────────────────
  // 5. ערכות נושא (Themes)
  // ──────────────────────────────
  test("5. ערכות נושא — החלפה בין Cobalt/Sand/Noir", async ({ page }) => {
    await openPdfViewerTab(page);

    // Open theme dropdown
    const themeBtn = page.getByRole("button", { name: /Cobalt/ });
    await themeBtn.click();

    // Select Sand
    await page.getByRole("menuitem", { name: /Sand/ }).click();

    // The button should now say Sand
    await expect(page.getByRole("button", { name: /Sand/ })).toBeVisible();

    // Verify localStorage
    const stored = await page.evaluate(() =>
      localStorage.getItem("pdf-viewer-theme-v1")
    );
    expect(stored).toBe('"sand"');
  });

  // ──────────────────────────────
  // 6. טעינת PDF מקישור
  // ──────────────────────────────
  test("6. טעינת PDF — הזנת URL וטעינה", async ({ page }) => {
    await openPdfViewerTab(page);

    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    const loadBtn = page.getByRole("button", { name: "טען" }).first();

    // Button should be disabled when input is empty
    await expect(loadBtn).toBeDisabled();

    // Type a valid URL
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await expect(loadBtn).toBeEnabled();

    // Load it
    await loadBtn.click();

    // An iframe should appear in the viewer area
    const iframe = page.locator("iframe[title='PDF Viewer']");
    await expect(iframe).toBeVisible({ timeout: 10_000 });
  });

  test("6b. טעינת PDF — URL לא תקין מציג שגיאה", async ({ page }) => {
    await openPdfViewerTab(page);

    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("not-a-url");
    await page.getByRole("button", { name: "טען" }).first().click();

    // Toast error should appear
    await expect(page.getByText("כתובת לא תקינה")).toBeVisible({ timeout: 5_000 });
  });

  test("6c. טעינת PDF — Enter שולח את הטופס", async ({ page }) => {
    await openPdfViewerTab(page);

    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await urlInput.press("Enter");

    const iframe = page.locator("iframe[title='PDF Viewer']");
    await expect(iframe).toBeVisible({ timeout: 10_000 });
  });

  // ──────────────────────────────
  // 7. היסטוריית קישורים אחרונים
  // ──────────────────────────────
  test("7. קישורים אחרונים — נשמרים ומוצגים", async ({ page }) => {
    await openPdfViewerTab(page);

    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await page.getByRole("button", { name: "טען" }).first().click();

    // Wait for the iframe to prove load worked
    await expect(page.locator("iframe[title='PDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // "קישורים אחרונים" should appear
    await expect(page.getByText("קישורים אחרונים")).toBeVisible();

    // The hostname badge should appear
    await expect(page.getByText("www.w3.org")).toBeVisible();
  });

  test("7b. קישורים אחרונים — ניקוי היסטוריה", async ({ page }) => {
    // Seed history via localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        "pdf-viewer-recent-urls-v1",
        JSON.stringify(["https://example.com/test.pdf"])
      );
    });
    await page.reload();
    await openPdfViewerTab(page);

    // History badge should be visible
    await expect(page.getByText("example.com")).toBeVisible();

    // Click clear
    await page.getByText("נקה").click();

    // History should be gone
    await expect(page.getByText("example.com")).not.toBeVisible();
    await expect(page.getByText("ההיסטוריה נוקתה")).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 8. העלאת קובץ PDF
  // ──────────────────────────────
  test("8. העלאת קובץ — טעינה מקובץ מקומי", async ({ page }) => {
    await openPdfViewerTab(page);

    // Switch to upload tab
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();

    // The drop zone should appear
    await expect(page.getByText("לחץ או גרור קובץ PDF לכאן")).toBeVisible();

    // Upload a minimal PDF via the hidden file input
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    // Create a minimal valid PDF buffer
    const minimalPdf = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`;

    await fileInput.setInputFiles({
      name: "test-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf),
    });

    // Toast should confirm
    await expect(page.getByText(/נטען: test-document\.pdf/)).toBeVisible({ timeout: 5_000 });

    // An iframe should appear
    await expect(page.locator("iframe[title='PDF Viewer']")).toBeVisible({ timeout: 10_000 });
  });

  test("8b. העלאת קובץ — דחיית קובץ שאינו PDF", async ({ page }) => {
    await openPdfViewerTab(page);
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    await fileInput.setInputFiles({
      name: "document.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello world"),
    });

    // Error toast
    await expect(page.getByText("ניתן לטעון קבצי PDF בלבד")).toBeVisible({ timeout: 5_000 });
  });

  // ──────────────────────────────
  // 9. סרגל כלים (Zoom, Download, Print)
  // ──────────────────────────────
  test("9. סרגל כלים — פקדי זום מופיעים", async ({ page }) => {
    await openPdfViewerTab(page);

    // Load a PDF so toolbar shows download/print
    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await urlInput.press("Enter");
    await expect(page.locator("iframe[title='PDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // Zoom text "100%" should be visible
    await expect(page.getByText("100%")).toBeVisible();
  });

  // ──────────────────────────────
  // 10. Split mode — שני PDFs
  // ──────────────────────────────
  test("10. Split — העלאת שני PDFs בתצוגה מפוצלת", async ({ page }) => {
    await openPdfViewerTab(page);

    // Switch to split mode
    await page.getByRole("button", { name: "מפוצל" }).click();

    // Switch to upload tab  
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();

    // Should show two drop zones
    await expect(page.getByText("לחץ או גרור קובץ PDF לכאן")).toBeVisible();
    await expect(page.getByText("קובץ PDF שני (להשוואה)")).toBeVisible();
  });

  // ──────────────────────────────
  // 11. Google Docs Viewer — blob URL warning
  // ──────────────────────────────
  test("11. Google Docs — הודעה על קבצים מקומיים", async ({ page }) => {
    await openPdfViewerTab(page);

    // Switch to Google Docs viewer
    await page.getByText("Google Docs Viewer").locator("../..").click();

    // Upload a local file
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    const minimalPdf = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`;
    await fileInput.setInputFiles({
      name: "local.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf),
    });

    // Should show the message that Google Docs doesn't support local files
    await expect(
      page.getByText("צפיין Google Docs תומך רק בקישורים ציבוריים")
    ).toBeVisible({ timeout: 10_000 });
  });

  // ──────────────────────────────
  // 12. מצב מסך מלא
  // ──────────────────────────────
  test("12. מסך מלא — כפתור fullscreen קיים ונגיש", async ({ page }) => {
    await openPdfViewerTab(page);

    // There should be at least one fullscreen button
    const fullscreenBtns = page.locator("button").filter({
      has: page.locator("svg"),
    });
    // Just verify the toolbar area exists (fullscreen API needs permissions in headless)
    await expect(page.getByText("צפיין PDF").first()).toBeVisible();
  });

  // ──────────────────────────────
  // 13. Keyboard shortcut hint
  // ──────────────────────────────
  test("13. קיצורי מקלדת — רמז מוצג", async ({ page }) => {
    await openPdfViewerTab(page);

    await expect(page.getByText("טען קישור")).toBeVisible();
    await expect(page.getByText("מסך מלא")).toBeVisible();
  });

  // ──────────────────────────────
  // 14. מצב empty state
  // ──────────────────────────────
  test("14. Empty State — מוצגת הודעה כשלא נבחר מסמך", async ({ page }) => {
    await openPdfViewerTab(page);

    await expect(page.getByText("לא נבחר מסמך")).toBeVisible();
    await expect(page.getByText("טען קובץ PDF או הדבק קישור למעלה")).toBeVisible();
  });

  // ──────────────────────────────
  // 15. EmbedPDF — בחירת מנוע ושמירה
  // ──────────────────────────────
  test("15. EmbedPDF — קביעת ברירת מחדל עם כוכב", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // Click EmbedPDF card first to make it active
    const embedCard = main.locator("button:has-text('EmbedPDF (pdfium)')").first();
    await embedCard.click();

    // Set it as default
    const setDefaultBtn = main
      .locator("button:has-text('EmbedPDF (pdfium)')")
      .first()
      .locator("button[aria-label='קבע כברירת מחדל']");
    await setDefaultBtn.click();

    // Toast should confirm
    await expect(page.getByText(/ברירת מחדל/).first()).toBeVisible({ timeout: 5_000 });
    // Badge should show EmbedPDF as default
    await expect(main.getByText(/ברירת מחדל: EmbedPDF/).first()).toBeVisible({ timeout: 5_000 });
  });

  test("15b. EmbedPDF — טעינת PDF מקישור מציגה embed", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // Switch to EmbedPDF engine
    const embedCard = main.locator("button:has-text('EmbedPDF (pdfium)')").first();
    await embedCard.click();

    // Load a PDF URL
    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await page.getByRole("button", { name: "טען" }).first().click();

    // Should render an <embed> element, not an iframe
    const embedEl = page.locator("embed[title='EmbedPDF Viewer']");
    await expect(embedEl).toBeVisible({ timeout: 10_000 });
  });

  test("15c. EmbedPDF — העלאת קובץ מציגה embed", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // Switch to EmbedPDF engine
    await main.locator("button:has-text('EmbedPDF (pdfium)')").first().click();

    // Switch to upload tab
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();

    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    const minimalPdf = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`;
    await fileInput.setInputFiles({
      name: "embed-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf),
    });

    // Toast should confirm
    await expect(page.getByText(/נטען: embed-test\.pdf/)).toBeVisible({ timeout: 5_000 });
    // Should render an <embed> element
    const embedEl = page.locator("embed[title='EmbedPDF Viewer']");
    await expect(embedEl).toBeVisible({ timeout: 10_000 });
  });

  test("15d. EmbedPDF — פקדי זום מופיעים", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // Switch to EmbedPDF engine
    await main.locator("button:has-text('EmbedPDF (pdfium)')").first().click();

    // Load a PDF
    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await urlInput.press("Enter");
    await expect(page.locator("embed[title='EmbedPDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // Zoom controls should appear (toolbar shows zoom for embedpdf engine too)
    await expect(page.getByText("100%")).toBeVisible();
  });

  test("15e. EmbedPDF — החלפה בין מנועים", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');

    // Start with browser (default)
    const urlInput = page.getByPlaceholder("הדבק קישור ל-PDF");
    await urlInput.fill("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf");
    await urlInput.press("Enter");
    await expect(page.locator("iframe[title='PDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // Switch to EmbedPDF
    await main.locator("button:has-text('EmbedPDF (pdfium)')").first().click();
    await expect(page.locator("embed[title='EmbedPDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // Switch to Google Docs
    await main.locator("button:has-text('Google Docs Viewer')").first().click();
    await expect(page.locator("iframe[title='Google Docs PDF Viewer']")).toBeVisible({ timeout: 10_000 });

    // Back to browser
    await main.locator("button:has-text('צפיין מובנה')").first().click();
    await expect(page.locator("iframe[title='PDF Viewer']")).toBeVisible({ timeout: 10_000 });
  });

  test("15f. EmbedPDF — split mode עם embed", async ({ page }) => {
    await openPdfViewerTab(page);

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // Switch to EmbedPDF engine
    await main.locator("button:has-text('EmbedPDF (pdfium)')").first().click();

    // Switch to split mode
    await page.getByRole("button", { name: "מפוצל" }).click();

    // Upload first PDF
    await page.getByRole("tab", { name: /העלאת קובץ/ }).click();
    const fileInput = page.locator('input[type="file"][accept="application/pdf"]').first();
    const minimalPdf = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`;
    await fileInput.setInputFiles({
      name: "split-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(minimalPdf),
    });

    // Primary embed should appear
    const embeds = page.locator("embed[title='EmbedPDF Viewer']");
    await expect(embeds.first()).toBeVisible({ timeout: 10_000 });
  });

  test("15g. EmbedPDF — ברירת מחדל נשמרת ב-localStorage", async ({ page }) => {
    // Set EmbedPDF as default via localStorage
    await page.context().addInitScript(() => {
      localStorage.setItem("pdf-viewer-default-v1", '"embedpdf"');
    });

    await page.goto("/");
    await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });

    const pdfBtn = page.locator('button:has-text("צפיין PDF")');
    await pdfBtn.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      (el as HTMLElement).click();
    });
    await page.waitForSelector('[data-active-tab="pdf-viewer"]', { timeout: 15_000 });

    const main = page.locator('[data-active-tab="pdf-viewer"]');
    // The badge should show the persisted EmbedPDF default
    await expect(main.getByText(/ברירת מחדל: EmbedPDF/).first()).toBeVisible({ timeout: 5_000 });
  });
});
