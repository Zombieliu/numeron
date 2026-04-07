import { expect, test } from "@playwright/test";

import {
  advanceToNextRound,
  deployBenchUnitAtIndex,
  ensureOperationsDrawerOpen,
  launchRuntime,
  openShell,
  readGold,
  readShopOfferTitles,
  switchToChinese,
  switchToEnglish,
  waitForRoundResolution,
} from "./helpers";

test("lock shop carries the same offers into the next round", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  const initialOffers = await readShopOfferTitles(page);
  await page.getByTestId("lock-shop").click();
  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);

  expect(await readShopOfferTitles(page)).toEqual(initialOffers);
  await expect(page.getByTestId("draft-shop")).toContainText(
    /Unlock Shop|Locked offers carry|锁定/,
  );
});

test("withdraw and sell flows return units and gold cleanly", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  const startingGold = await readGold(page);
  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("board-slot-0").click();
  await page.getByTestId("withdraw-board").click();

  await expect(page.getByTestId("board-slot-0")).toContainText(/Empty Slot|空槽位/);
  await expect(page.getByTestId("bench-slot-0")).not.toContainText(/Empty Bench Slot|空备战槽/);

  await page.getByTestId("bench-slot-0").click();
  await page.getByTestId("sell-bench").click();

  await expect(page.getByTestId("bench-slot-0")).toContainText(/Empty Bench Slot|空备战槽/);
  expect(await readGold(page)).toBe(startingGold + 2);
});

test("buying the third matching copy merges into a two-star unit", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);

  await expect(page.getByTestId("shop-offer-1")).toContainText(
    /Verdant Bruiser|翠卫斗士/,
  );
  await page.getByTestId("shop-offer-1").click();
  await expect(page.getByTestId("shop-offer-1")).toContainText(
    /Verdant Bruiser|翠卫斗士/,
  );
  await page.getByTestId("shop-offer-1").click();

  await expect(page.getByTestId("board-slot-0")).toContainText(
    /Verdant Bruiser II|翠卫斗士 II/,
  );
  await expect(page.getByTestId("status-panel")).toContainText(/Merged three|已将三个/);
});

test("switching save slots restores slot-scoped locale and player profile", async ({
  page,
}) => {
  await openShell(page);

  await switchToChinese(page);
  await page.getByTestId("player-name-input").fill("Alpha QA");
  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("save-slot-slot-2").click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("player-name-input")).toHaveValue("Pilot");

  await switchToEnglish(page);
  await page.getByTestId("player-name-input").fill("Bravo QA");
  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("save-slot-slot-1").click();

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("player-name-input")).toHaveValue("Alpha QA");

  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("save-slot-slot-2").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("player-name-input")).toHaveValue("Bravo QA");
});
