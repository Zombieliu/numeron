import { expect, test } from "@playwright/test";

import {
  advanceToNextRound,
  deployBenchUnitAtIndex,
  ensureOperationsDrawerOpen,
  launchRuntime,
  openShell,
  playUntilRunEnds,
  readSaveDraft,
  switchToChinese,
  waitForRoundResolution,
} from "./helpers";

test("save matrix persists locale, profile, and import flow", async ({
  page,
}) => {
  await openShell(page);
  await switchToChinese(page);

  await page.getByTestId("player-name-input").fill("QA Pilot");
  await expect(page.getByTestId("player-name-input")).toHaveValue("QA Pilot");

  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("slot-label-input").fill("Delta QA");
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Delta QA");

  const rawSave = await readSaveDraft(page);
  const saveMatrix = JSON.parse(rawSave);
  expect(saveMatrix.slots[0].profile.preferredPlayerName).toBe("QA Pilot");
  expect(saveMatrix.slots[0].profile.preferredLocale).toBe("zh-CN");

  saveMatrix.slots[0].label = "Imported QA";
  await page
    .getByTestId("save-draft")
    .fill(JSON.stringify(saveMatrix, null, 2));
  await page.getByTestId("load-snapshot").click();
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Imported QA");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("player-name-input")).toHaveValue("QA Pilot");
  await ensureOperationsDrawerOpen(page);
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Imported QA");
});

test("local save slot resumes an in-progress run after reload", async ({
  page,
}) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);

  await expect(page.getByTestId("augment-choice-0")).toBeVisible();
  await expect(page.getByTestId("board-slot-0")).not.toContainText(
    /Empty Slot|空槽位/
  );
  const modifierText = await page.getByTestId("run-modifier-panel").innerText();

  await page.reload({ waitUntil: "domcontentloaded" });
  await launchRuntime(page);

  await expect(page.getByTestId("augment-choice-0")).toBeVisible();
  await expect(page.getByTestId("board-slot-0")).not.toContainText(
    /Empty Slot|空槽位/
  );
  await expect(page.getByTestId("status-panel")).toContainText(
    /Round 2|第 2 回合/
  );
  await expect(page.getByTestId("run-modifier-panel")).toContainText(
    modifierText.split("\n")[1] ?? modifierText,
  );
});

test("reloading during combat restores the live round state", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await deployBenchUnitAtIndex(page, 0, 1);
  await page.getByTestId("start-combat").click();
  await expect(page.getByTestId("status-panel")).toContainText(
    /Combat underway|战斗进行中/
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await launchRuntime(page);

  await expect(page.getByTestId("status-panel")).toContainText(
    /Combat underway|战斗进行中|Victory|Defeat|胜利|失败/
  );
  await expect(page.getByTestId("board-slot-0")).not.toContainText(
    /Empty Slot|空槽位/
  );
});

test("invalid snapshot import is rejected without mutating the active slot", async ({
  page,
}) => {
  await openShell(page);
  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("slot-label-input").fill("Stable Slot");
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Stable Slot");

  await page.getByTestId("save-draft").fill("{ definitely-not-json");
  await page.getByTestId("load-snapshot").click();

  await expect(page.getByText(/import failed|导入失败/i)).toBeVisible();
  await expect(page.getByTestId("slot-label-input")).toHaveValue("Stable Slot");
});

test("completed runs do not auto-resume after restart and reload", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await deployBenchUnitAtIndex(page, 0, 1);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);
  await playUntilRunEnds(page, { startRound: 2 });

  await expect(page.getByTestId("restart-run")).toBeEnabled();
  await page.getByTestId("restart-run").click();
  await expect(page.getByTestId("status-panel")).toContainText(/Run 2|局数 2/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("boot-overlay")).toBeVisible();
  await launchRuntime(page);
  await expect(page.getByTestId("status-panel")).toContainText(/Run 2|局数 2/);
  await expect(page.getByTestId("session-panel")).toContainText(/slot-1-run-2/);
});
