const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', err => { console.log('PAGEERROR:', err.message); console.log(err.stack || ''); });
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text()); });

  await page.goto('http://localhost:5173/sugya/bava_batra_2a', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const textTab = page.getByRole('tab', { name: 'טקסט מקורי' });
  if (await textTab.count()) await textTab.first().click();
  await page.waitForTimeout(4000);

  const errBlock = page.getByText(/שגיאה בטעינת טקסט גמרא/);
  console.log('ERR_BLOCK_COUNT:', await errBlock.count());
  if (await errBlock.count()) {
    console.log('ERR_BLOCK_VISIBLE:', await errBlock.first().isVisible().catch(() => false));
  }

  await browser.close();
})();
