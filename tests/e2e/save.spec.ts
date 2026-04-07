import { expect, test } from "@playwright/test";

import { openShell, readSaveDraft, switchToChinese } from "./helpers";

test("save matrix persists locale, profile, and import flow", async ({ page }) => {
  await openShell(page);
  await switchToChinese(page);

  await page.getByTestId("player-name-input").fill("QA Pilot");
  await expect(page.getByTestId("player-name-input")).toHaveValue("QA Pilot");

  await page.getByTestId("operations-drawer").locator("summary").click();
  await page.getByTestId("slot-label-input").fill("Delta QA");
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Delta QA");

  const rawSave = await readSaveDraft(page);
  const saveMatrix = JSON.parse(rawSave);
  expect(saveMatrix.slots[0].profile.preferredPlayerName).toBe("QA Pilot");
  expect(saveMatrix.slots[0].profile.preferredLocale).toBe("zh-CN");

  saveMatrix.slots[0].label = "Imported QA";
  await page.getByTestId("save-draft").fill(JSON.stringify(saveMatrix, null, 2));
  await page.getByTestId("load-snapshot").click();
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Imported QA");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("player-name-input")).toHaveValue("QA Pilot");
  await page.getByTestId("operations-drawer").locator("summary").click();
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Imported QA");
});
