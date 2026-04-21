import { test, expect } from "@playwright/test";

const EMAIL = "jj1212t@gmail.com";
const PASSWORD = "543211";

test("logged-in user sees Berakhot daf in EmbedPDF tab with toolbar", async ({ page }, testInfo) => {
  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

  // 1. Login
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "התחבר", exact: true }).click();

  // Wait for auth redirect
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });

  // 2. Go to Berakhot 2a
  await page.goto("/sugya/berakhot_2a", { waitUntil: "domcontentloaded" });

  // 3. Switch view mode to "גמרא מהענן" (skip if already there)
  const viewModeButton = page
    .locator("button")
    .filter({ hasText: /תצוגת ספריא|טקסט מעוצב|תמונה סרוקה|אתר E-Daf|גמרא מהענן/ })
    .first();
  await expect(viewModeButton).toBeVisible({ timeout: 20_000 });
  const currentLabel = (await viewModeButton.textContent()) ?? "";
  if (!currentLabel.includes("גמרא מהענן")) {
    await viewModeButton.click();
    const cloudModeItem = page.getByText("גמרא מהענן", { exact: true }).first();
    await expect(cloudModeItem).toBeVisible({ timeout: 10_000 });
    await cloudModeItem.click({ force: true });
  }

  // 4. Click EmbedPDF sub-mode
  const embedBtn = page.locator("button:has-text('EmbedPDF')").first();
  await expect(embedBtn).toBeVisible({ timeout: 20_000 });
  await embedBtn.click();

  // 5. Verify iframe appears
  const embedIframe = page.locator("iframe[title='EmbedPDF - דף גמרא סרוק מהענן']");
  await expect(embedIframe).toBeVisible({ timeout: 30_000 });

  // 6. Verify bookId is in the iframe src (proves authenticated cloud-embed path worked)
  const src = await embedIframe.getAttribute("src");
  expect(src).toBeTruthy();
  expect(src).toContain("bookId=");
  expect(src).toContain("url=");
  expect(src).toContain("Berakhot");

  // 7. Verify the outer wrapper shows "סימונים נשמרים בענן" — proves authenticated cloud save flow is active
  await expect(
    page.locator("text=/סימונים נשמרים בענן/")
  ).toBeVisible({ timeout: 20_000 });

  // 8. Verify the outer EmbedPDF wrapper toolbar has the scan-mode toggle buttons
  // (these prove the full authenticated EmbedPDF control panel is rendered).
  await expect(page.locator("button:has-text('טקסט')").first()).toBeVisible();
  await expect(page.locator("button:has-text('סריקה')").first()).toBeVisible();
  await expect(page.locator("button:has-text('EmbedPDF')").first()).toBeVisible();
  const outerCount = await page.locator('button[aria-label], button[title]').count();

  await testInfo.attach("authenticated-embedpdf-console.log", {
    body: consoleLogs.join("\n") || "(no console logs)",
    contentType: "text/plain",
  });

  console.log(`[AUTH TEST] iframe src: ${src}`);
  console.log(`[AUTH TEST] outer tool buttons: ${outerCount}`);
});
