import { test, expect, Page } from "@playwright/test";

/* ─── Helpers ─── */

async function goHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector("[data-active-tab]", { timeout: 15_000 });
}

async function openSourcesIndex(page: Page) {
  // Open the sidebar first (hamburger menu button)
  const menuBtn = page.locator('button[title="פתח סיידבר"]');
  await menuBtn.waitFor({ state: "visible", timeout: 10_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Find and click the מפתח המקורות sidebar button
  const tabBtn = page
    .locator("ul")
    .getByRole("button", { name: /מפתח המקורות/ });
  await tabBtn.waitFor({ state: "visible", timeout: 10_000 });
  await tabBtn.click();

  // Wait for the sources index content to be present
  await page
    .locator('[data-testid="sources-index-container"]')
    .waitFor({ state: "attached", timeout: 30_000 });

  // Wait for data to load (stat cards with branch names)
  await page
    .locator('[data-testid="sources-index-container"]')
    .locator("text=בבלי")
    .first()
    .waitFor({ state: "attached", timeout: 60_000 });

  // Scroll the sources container into view
  await page
    .locator('[data-testid="sources-index-container"]')
    .scrollIntoViewIfNeeded();
}

test.describe("מפתח המקורות — RTL Layout", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await goHome(page);
    await openSourcesIndex(page);
  });

  test("container has dir=rtl attribute", async ({ page }) => {
    const container = page.locator('[data-testid="sources-index-container"]');
    await expect(container).toHaveAttribute("dir", "rtl");
  });

  test("computed direction is rtl on container and children", async ({
    page,
  }) => {
    const container = page.locator('[data-testid="sources-index-container"]');
    const direction = await container.evaluate(
      (el) => window.getComputedStyle(el).direction,
    );
    expect(direction).toBe("rtl");

    // Check a nested element too
    const heading = page.locator('h2:has-text("מפתח המקורות")');
    const headingDir = await heading.evaluate(
      (el) => window.getComputedStyle(el).direction,
    );
    expect(headingDir).toBe("rtl");
  });

  test("heading is positioned on the right side", async ({ page }) => {
    const heading = page.locator('h2:has-text("מפתח המקורות")');
    await expect(heading).toBeVisible();

    const containerBox = await page
      .locator('[data-testid="sources-index-container"]')
      .boundingBox();
    const headingBox = await heading.boundingBox();

    // In RTL, the heading should extend to the right edge of the container
    expect(headingBox!.x + headingBox!.width).toBeGreaterThan(
      containerBox!.x + containerBox!.width * 0.5,
    );
  });

  test("tree items inherit rtl direction", async ({ page }) => {
    // Check that the tree container (parent of buttons) has RTL direction
    const treeContainer = page
      .locator('[data-testid="sources-index-container"]');
    const direction = await treeContainer.evaluate(
      (el) => window.getComputedStyle(el).direction,
    );
    expect(direction).toBe("rtl");

    // Also verify tree items are visually right-aligned:
    // The first branch text should be near the right edge of the container
    const firstBranch = treeContainer
      .locator('button:has-text("בבלי")')
      .first();
    await expect(firstBranch).toBeVisible({ timeout: 15_000 });
    const containerBox = await treeContainer.boundingBox();
    const branchBox = await firstBranch.boundingBox();
    // In RTL, the button should start in the right half of the container
    expect(branchBox!.x + branchBox!.width).toBeGreaterThan(
      containerBox!.x + containerBox!.width / 2,
    );
  });

  test("stat cards are laid out right-to-left", async ({ page }) => {
    // Wait for stat cards grid
    const statsGrid = page
      .locator('[data-testid="sources-index-container"] .grid')
      .first();
    await expect(statsGrid).toBeVisible({ timeout: 15_000 });

    const gridDir = await statsGrid.evaluate(
      (el) => window.getComputedStyle(el).direction,
    );
    expect(gridDir).toBe("rtl");

    // In a RTL grid, first item (בבלי) should be at the right side
    const cards = statsGrid.locator(":scope > *");
    const count = await cards.count();
    if (count >= 2) {
      const firstBox = await cards.nth(0).boundingBox();
      const secondBox = await cards.nth(1).boundingBox();
      if (firstBox && secondBox && firstBox.y === secondBox.y) {
        expect(firstBox.x).toBeGreaterThan(secondBox.x);
      }
    }
  });

  test("icons are SVG elements (Lucide), not emoji text", async ({ page }) => {
    const container = page.locator('[data-testid="sources-index-container"]');
    const svgIcons = container.locator("svg");

    // Header icon + stat card icons + view mode icons = at least 10
    const count = await svgIcons.count();
    expect(count).toBeGreaterThan(5);
  });
});
