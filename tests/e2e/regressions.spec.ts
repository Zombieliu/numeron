import { expect, test } from "@playwright/test";

import {
  advanceToNextRound,
  buyOfferAtIndex,
  deployBenchUnitAtIndex,
  ensureOperationsDrawerOpen,
  launchRuntime,
  openShell,
  readGold,
  readShopOfferTitles,
  rerollShop,
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

  await page.getByTestId("bench-slot-1").click();
  await page.getByTestId("sell-bench").click();

  await expect(page.getByTestId("bench-slot-1")).toContainText(/Empty Bench Slot|空备战槽/);
  expect(await readGold(page)).toBe(startingGold + 2);
});

test("buying the third matching copy merges into a two-star unit", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);

  let boughtCopies = 0;

  for (let cycle = 0; cycle < 12 && boughtCopies < 2; cycle += 1) {
    const titles = await readShopOfferTitles(page);
    const matchingIndex = titles.findIndex((title) =>
      title.match(/Verdant Bruiser|翠卫斗士/),
    );

    if (matchingIndex >= 0) {
      await buyOfferAtIndex(page, matchingIndex);
      boughtCopies += 1;
      continue;
    }

    await rerollShop(page);
  }

  expect(boughtCopies).toBe(2);

  await expect
    .poll(async () => {
      return `${await page.getByTestId("deployment-panel").innerText()}\n${await page
        .getByTestId("bench-panel")
        .innerText()}`;
    })
    .toMatch(/Verdant Bruiser II|翠卫斗士 II/);
  await expect(page.getByTestId("status-panel")).toContainText(/Merged three|已将三个/);
});

test("buying xp unlocks an extra deployment slot", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await deployBenchUnitAtIndex(page, 0, 1);
  await page.getByTestId("shop-offer-0").click();
  await page.getByTestId("bench-slot-0").click();

  await expect(page.getByTestId("deployment-cap-stat")).toContainText(/2\/2/);
  await expect(page.getByTestId("board-slot-2")).toBeDisabled();

  await page.getByTestId("buy-xp").click();

  await expect(page.getByTestId("deployment-cap-stat")).toContainText(/2\/3/);
  await expect(page.getByTestId("board-slot-2")).toBeEnabled();
  await page.getByTestId("board-slot-2").click();
  await expect(page.getByTestId("board-slot-2")).not.toContainText(/Empty Slot|空槽位/);
});

test("augment draft blocks combat until a choice is locked", async ({ page }) => {
  await openShell(page);
  await launchRuntime(page);

  await deployBenchUnitAtIndex(page, 0, 0);
  await page.getByTestId("start-combat").click();
  await waitForRoundResolution(page);
  await advanceToNextRound(page, 2);

  await expect(page.getByTestId("augment-panel")).toContainText(/Augment Draft|强化选择/);
  await expect(page.getByTestId("augment-choice-0")).toBeVisible();
  await expect(page.getByTestId("start-combat")).toBeDisabled();

  await page.getByTestId("augment-choice-0").click();

  await expect(page.getByTestId("augment-panel")).toContainText(/Locked Augments|已锁定强化/);
  await expect(page.getByTestId("start-combat")).toBeEnabled();
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
