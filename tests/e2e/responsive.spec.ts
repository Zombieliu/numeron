import { expect, test } from "@playwright/test";

import {
  clickByTestId,
  deployBenchUnitAtIndex,
  launchRuntime,
  openShell,
} from "./helpers";

test.describe("responsive shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile layout still exposes the primary play loop", async ({ page }) => {
    await openShell(page);
    await launchRuntime(page);

    await expect(page.locator(".stage-column")).toBeVisible();
    await expect(page.getByTestId("battle-controls-panel")).toBeVisible();
    await expect(page.getByTestId("draft-shop")).toBeVisible();

    await deployBenchUnitAtIndex(page, 0, 0);
    await expect(page.getByTestId("deployment-cap-stat")).toContainText(/1\/2/);

    await clickByTestId(page, "start-combat");
    await expect(page.getByTestId("status-panel")).toContainText(/Combat|战斗|Round|回合/);
  });
});
