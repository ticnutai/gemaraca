import { test, expect } from "@playwright/test";

test.describe("Cloud Scan EmbedPDF Debug", () => {
  test("sugya cloud scan embedpdf should resolve (iframe or actionable error)", async ({ page }, testInfo) => {
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];
    const requestFails: string[] = [];

    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on("pageerror", (err) => {
      pageErrors.push(String(err));
    });

    page.on("requestfailed", (req) => {
      requestFails.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText || "failed"}`);
    });

    await page.goto("/sugya/berakhot_2a", { waitUntil: "domcontentloaded" });

    const viewModeButton = page
      .locator("button")
      .filter({ hasText: /תצוגת ספריא|טקסט מעוצב|תמונה סרוקה|אתר E-Daf|גמרא מהענן/ })
      .first();
    await expect(viewModeButton).toBeVisible({ timeout: 20_000 });
    await viewModeButton.click();

    const cloudModeItem = page.getByText("גמרא מהענן", { exact: true }).first();
    await expect(cloudModeItem).toBeVisible({ timeout: 10_000 });
    await cloudModeItem.click();

    const embedBtn = page.locator("button:has-text('EmbedPDF')").first();
    await expect(embedBtn).toBeVisible({ timeout: 20_000 });
    await embedBtn.click();

    const embedIframe = page.locator("iframe[title='EmbedPDF - דף גמרא סרוק מהענן']");
    const prepError = page.locator("text=לא הצלחתי להכין את קובץ הסריקה ל-EmbedPDF");
    const loginError = page.locator("text=יש להתחבר כדי לשמור הערות וסימניות ל-EmbedPDF בענן");
    const spinnerText = page.locator("text=מכין את הסריקה ל-EmbedPDF עם כל כלי ההערות והעריכה");

    let resolved: "iframe" | "prepError" | "loginError" | null = null;

    for (let i = 0; i < 30; i += 1) {
      if (await embedIframe.isVisible()) {
        resolved = "iframe";
        break;
      }
      if (await prepError.isVisible()) {
        resolved = "prepError";
        break;
      }
      if (await loginError.isVisible()) {
        resolved = "loginError";
        break;
      }
      await page.waitForTimeout(1000);
    }

    await testInfo.attach("console.log", {
      body: consoleLogs.join("\n") || "(no console logs)",
      contentType: "text/plain",
    });

    await testInfo.attach("page-errors.log", {
      body: pageErrors.join("\n") || "(no page errors)",
      contentType: "text/plain",
    });

    await testInfo.attach("request-failures.log", {
      body: requestFails.join("\n") || "(no failed requests)",
      contentType: "text/plain",
    });

    if (!resolved) {
      const spinnerStillVisible = await spinnerText.isVisible().catch(() => false);
      throw new Error(
        `EmbedPDF cloud scan did not resolve within timeout. spinnerStillVisible=${spinnerStillVisible}`
      );
    }

    expect(resolved).toBeTruthy();
  });
});
