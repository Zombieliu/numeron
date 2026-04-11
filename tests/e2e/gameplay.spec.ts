import { expect, test } from "@playwright/test";

import {
  advanceToNextRound,
  buyFirstOffer,
  clickByTestId,
  deployFirstBenchUnit,
  readVisibleRound,
  launchRuntime,
  openShell,
  playUntilRunEnds,
  selectStarterDoctrine,
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
  await expect(page.getByTestId("starter-doctrine-preview")).toContainText(
    /Balanced Prep|均衡备战|No extra opener bonus|没有额外开局加成/,
  );

  await selectStarterDoctrine(page, "open-market");
  await expect(page.getByTestId("starter-doctrine-open-market")).toContainText(
    /Open Market|开放黑市|\+2 opening gold|开局金币 \+2/,
  );

  await launchRuntime(page);
  await expect(page.getByTestId("starter-doctrine-panel")).toContainText(
    /Open Market|开放黑市|\+2 opening gold|开局金币 \+2/,
  );
  await expect(page.getByTestId("run-modifier-panel")).toContainText(
    /Rich Opening|Thin Bench|Dawn Surge|Dusk Surge|Glass Cannon|Augment Storm|富集开局|短备战席|黎明激涌|黄昏激涌|高压脆皮|强化风暴/,
  );
  await expect(page.getByTestId("coach-panel")).toContainText(
    /Coach Read|教练读牌|tempo|路线|羁绊/,
  );
  await clickByTestId(page, "lock-shop");
  await expect(page.getByTestId("draft-shop")).toContainText(
    /Unlock Shop|Locked offers will carry into the next round/,
  );

  await buyFirstOffer(page);
  await deployFirstBenchUnit(page);
  await expect(page.getByTestId("deployment-panel")).toContainText(/atk|hp|Sell/);
  await expect(page.getByTestId("deployment-cap-stat")).toContainText(/1\/2|2\/2/);

  await clickByTestId(page, "start-combat");
  await waitForRoundResolution(page);
  await expect(page.getByTestId("status-panel")).toContainText(/Round state/i);
  await expect(page.getByTestId("combat-feed")).not.toContainText(
    /Recent hits, heals|最近几条命中/,
  );
  await expect(page.getByTestId("performance-panel")).toContainText(
    /DMG|输出|KILLS|击杀/,
  );
  await expect(page.getByTestId("build-pack-panel")).toContainText(
    /Recommended|推荐|Core units|核心组件/,
  );

  await advanceToNextRound(page, 2);
  expect(await readVisibleRound(page)).toBe(2);
  await expect(page.getByTestId("round-event-panel")).toContainText(
    /Training Day|训练日/,
  );

  await playUntilRunEnds(page, { startRound: 3 });
  await expect(page.getByTestId("restart-run")).toBeEnabled();
  await expect(page.getByTestId("run-summary-panel")).toContainText(
    /Starter Doctrine|Build Route|Build 路线|Augments|强化|Final Board|最终阵容|Economy Call|经济判断|Round Read|胜负复盘|DMG|输出/,
  );
  expect(await readVisibleRound(page)).toBeGreaterThanOrEqual(3);

  await clickByTestId(page, "restart-run");
  await expect(page.getByTestId("session-panel")).toContainText(/slot-1-run-2/);
  await expect(page.getByTestId("status-panel")).toContainText(/Run 2|局数 2/);
});
