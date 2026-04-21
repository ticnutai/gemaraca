import { test, expect } from "@playwright/test";

const SUGYA_PATHS = [
  "/sugya/berakhot_2a",
  "/sugya/berakhot_2b",
];

for (const path of SUGYA_PATHS) {
  test(`cloud scan embedpdf resolves for ${path}`, async ({ page }, testInfo) => {
    const consoleLogs: string[] = [];

    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(path, { waitUntil: "domcontentloaded" });

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
    const scanIframe = page.locator("iframe[title='דף גמרא סרוק מהענן']");
    const prepError = page.locator("text=לא הצלחתי להכין את קובץ הסריקה ל-EmbedPDF");
    const fallbackNotice = page.locator("text=טעינת EmbedPDF התעכבה. עברנו אוטומטית לסריקה כדי למנוע תקיעה.");
    const spinnerText = page.locator("text=מכין את הסריקה ל-EmbedPDF עם כל כלי ההערות והעריכה");
    const spinnerText2 = page.locator("text=טוען את EmbedPDF");

    let resolved: "iframe" | "prepError" | "scanFallback" | null = null;

    for (let i = 0; i < 30; i += 1) {
      if (await embedIframe.isVisible()) {
        resolved = "iframe";
        break;
      }
      if (await prepError.isVisible()) {
        resolved = "prepError";
        break;
      }
      if ((await fallbackNotice.isVisible()) || (await scanIframe.isVisible())) {
        resolved = "scanFallback";
        break;
      }
      await page.waitForTimeout(1000);
    }

    await testInfo.attach(`console-${path.replace(/[^a-z0-9]/gi, "_")}.log`, {
      body: consoleLogs.join("\n") || "(no console logs)",
      contentType: "text/plain",
    });

    expect(resolved).toBeTruthy();
  });
}
