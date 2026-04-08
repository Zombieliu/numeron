import { expect, test } from "@playwright/test";

import {
  advanceToNextRound,
  buyFirstOffer,
  deployFirstBenchUnit,
  readVisibleRound,
  launchRuntime,
  openShell,
  playUntilRunEnds,
  switchToChinese,
  switchToEnglish,
  waitForRoundResolution,
} from "./helpers";

test("core gameplay loop runs from launch to restart", async ({ page }) => {
  await openShell(page);

  await switchToChinese(page);
  await expect(page.getByTestId("boot-overlay")).toContainText(
    /先启动 Runtime，再进入首局战斗/,
  );
  await switchToEnglish(page);
  await expect(page.getByTestId("boot-overlay")).toContainText(
    /Launch the runtime to enter your first match/,
  );

  await launchRuntime(page);
  await expect(page.getByTestId("run-modifier-panel")).toContainText(
    /Rich Opening|Thin Bench|Dawn Surge|Dusk Surge|Glass Cannon|Augment Storm|富集开局|短备战席|黎明激涌|黄昏激涌|高压脆皮|强化风暴/,
  );
  await page.getByTestId("lock-shop").click();
  await expect(page.getByTestId("draft-shop")).toContainText(
    /Unlock Shop|Locked offers will carry into the next round/,
  );

  await buyFirstOffer(page);
  await deployFirstBenchUnit(page);
  await deployFirstBenchUnit(page);
  await expect(page.getByTestId("deployment-panel")).toContainText(/atk|hp|Sell/);
  await expect(page.getByTestId("deployment-cap-stat")).toContainText(/2\/2/);

  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await expect(page.getByTestId("status-panel")).toContainText(/Round state/i);
  await expect(page.getByTestId("combat-feed")).not.toContainText(
    /Recent hits, heals|最近几条命中/,
  );

  await advanceToNextRound(page, 2);
  await expect(page.getByTestId("status-panel")).toContainText(/Round 2|第 2 回合/);

  await playUntilRunEnds(page, { startRound: 3 });
  await expect(page.getByTestId("restart-run")).toBeEnabled();
  await expect(page.getByTestId("run-summary-panel")).toContainText(
    /Build Route|Build 路线|Augments|强化|Final Board|最终阵容/,
  );
  expect(await readVisibleRound(page)).toBeGreaterThanOrEqual(3);

  await page.getByTestId("restart-run").click();
  await expect(page.getByTestId("session-panel")).toContainText(/slot-1-run-2/);
  await expect(page.getByTestId("status-panel")).toContainText(/Run 2|局数 2/);
});
