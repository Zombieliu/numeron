import { expect, Page } from "@playwright/test";

export const REMOTE_BACKEND_URL =
  process.env.PLAYWRIGHT_REMOTE_BACKEND_URL ?? "http://127.0.0.1:8787";

const EMPTY_BENCH_PATTERNS = ["Empty Bench Slot", "空备战槽"];
const EMPTY_BOARD_PATTERNS = ["Empty Slot", "空槽位"];
const SHOP_BUY_COST = 3;

export async function openShell(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

export async function switchToChinese(page: Page) {
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
}

export async function switchToEnglish(page: Page) {
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

export async function launchRuntime(page: Page) {
  const overlayLaunchVisible = await page
    .getByTestId("canvas-launch-runtime")
    .isVisible()
    .catch(() => false);
  await clickByTestId(
    page,
    overlayLaunchVisible ? "canvas-launch-runtime" : "launch-runtime",
  );
  await expect(page.getByTestId("status-panel")).toContainText(/Runtime active|Runtime 状态/);
  await waitForShopOffers(page);
  await chooseFirstOperationIfPending(page);
}

export async function selectStarterDoctrine(
  page: Page,
  doctrine:
    | "balanced"
    | "dawn-relay"
    | "dusk-raid"
    | "iron-wall"
    | "open-market",
) {
  await ensureOperationsDrawerOpen(page);
  await page.getByTestId(`starter-doctrine-${doctrine}`).click();
}

export async function buyFirstOffer(page: Page) {
  await buyOfferAtIndex(page, 0);
}

export async function clickByTestId(page: Page, testId: string) {
  await expect
    .poll(() => isTestIdClickable(page, testId), {
      timeout: 10_000,
      intervals: [100, 250, 500],
    })
    .toBe(true);
  await dispatchTestIdClick(page, testId);
}

export async function deployFirstBenchUnit(page: Page) {
  const benchIndex = await firstOccupiedIndex(page, "bench-slot", EMPTY_BENCH_PATTERNS);
  const boardIndex = await firstEmptyIndex(page, "board-slot", EMPTY_BOARD_PATTERNS);

  await deployBenchUnitAtIndex(page, benchIndex, boardIndex);
}

export async function deployBenchUnitAtIndex(
  page: Page,
  benchIndex: number,
  boardIndex?: number,
) {
  const nextBoardIndex =
    boardIndex ?? (await firstEmptyIndex(page, "board-slot", EMPTY_BOARD_PATTERNS));
  const boardSlotId = `board-slot-${nextBoardIndex}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await triggerElementClick(page, `bench-slot-${benchIndex}`);
    await page.waitForTimeout(750);
    await triggerElementClick(page, boardSlotId);
    await page.waitForTimeout(1_500);

    const boardText = await page.getByTestId(boardSlotId).innerText();
    if (!/Empty Slot|空槽位/.test(boardText)) {
      return;
    }
  }

  await expect(page.getByTestId(boardSlotId)).not.toContainText(/Empty Slot|空槽位/);
}

export async function ensureOperationsDrawerOpen(page: Page) {
  const drawer = page.getByTestId("operations-drawer");
  const expanded = await drawer.evaluate((element) => {
    return element instanceof HTMLDetailsElement && element.open;
  });

  if (!expanded) {
    await drawer.locator("summary").click();
  }
}

export async function waitForRoundResolution(page: Page) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const resolved = await page.evaluate(() => {
      const nextRound = document.querySelector<HTMLButtonElement>(
        '[data-testid="next-round"]',
      );
      const restartRun = document.querySelector<HTMLButtonElement>(
        '[data-testid="restart-run"]',
      );
      const status = document.querySelector<HTMLElement>(
        '[data-testid="status-panel"]',
      )?.textContent;

      return Boolean(
        (nextRound && !nextRound.disabled) ||
          (restartRun && !restartRun.disabled) ||
          status?.match(
            /Round resolved|本回合已结算|Click Next Round|点击“下一回合”|Run over|通关|本局结束/,
          ),
      );
    });

    if (resolved) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error("Round did not resolve within 30s");
}

export async function advanceToNextRound(page: Page, round?: number) {
  const previousRound = await readVisibleRound(page);
  await clickByTestId(page, "next-round");
  await waitForRoundReady(page, round ?? previousRound + 1);
  await chooseFirstOperationIfPending(page);
}

export async function waitForRoundReady(page: Page, round: number) {
  await expect(page.getByTestId("status-panel")).toContainText(
    new RegExp(`Round ${round}|第 ${round} 回合`),
  );
}

export async function playUntilRunEnds(
  page: Page,
  options: { startRound?: number; maxRounds?: number } = {},
) {
  const startRound = options.startRound ?? 2;
  const maxRounds = options.maxRounds ?? 10;
  let roundCursor = startRound;

  while (roundCursor <= maxRounds) {
    if (await page.getByTestId("restart-run").isEnabled()) {
      return;
    }

    if (await tryClickByTestId(page, "augment-choice-0")) {
      await page.waitForTimeout(250);
    }

    await topOffBoardBeforeCombat(page);

    if (await page.getByTestId("start-combat").isEnabled()) {
      await clickByTestId(page, "start-combat");
      await waitForRoundResolution(page);
    }

    if (await page.getByTestId("restart-run").isEnabled()) {
      return;
    }

    if (await page.getByTestId("next-round").isEnabled()) {
      await advanceToNextRound(page);
      roundCursor += 1;
    } else {
      roundCursor += 1;
    }
  }
}

async function topOffBoardBeforeCombat(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { deployed, cap } = await readDeploymentCap(page);
    if (deployed >= cap) {
      return;
    }

    const benchCount = await occupiedSlotCount(
      page,
      "bench-slot",
      EMPTY_BENCH_PATTERNS,
    );
    if (benchCount > 0) {
      await deployFirstBenchUnit(page);
      continue;
    }

    const canBuyUnit = await isTestIdClickable(page, "shop-offer-0");
    if (!canBuyUnit || (await readGold(page)) < SHOP_BUY_COST) {
      return;
    }

    await buyFirstOffer(page);
    await deployFirstBenchUnit(page);
  }
}

export async function readVisibleRound(page: Page) {
  const topbarRound = page.getByTestId("topbar-round");
  if (await topbarRound.isVisible().catch(() => false)) {
    const topbarText = await topbarRound.innerText();
    const topbarMatch = topbarText.match(/(?:^|\n)(\d+)\s*$/m);
    if (topbarMatch) {
      return Number(topbarMatch[1]);
    }
  }

  const statusText = await page.getByTestId("status-panel").innerText();
  const statusMatch = statusText.match(/Round\s+(\d+)|第\s+(\d+)\s+回合/i);
  if (statusMatch) {
    return Number(statusMatch[1] ?? statusMatch[2]);
  }

  const sessionText = await page.getByTestId("session-panel").innerText();
  const sessionMatch = sessionText.match(/(?:^|\n)R\s+(\d+)|回合\s+(\d+)/im);
  if (sessionMatch) {
    return Number(sessionMatch[1] ?? sessionMatch[2]);
  }

  throw new Error(
    `Failed to parse current round from panels:\nSTATUS:\n${statusText}\nSESSION:\n${sessionText}`,
  );
}

export async function setRemoteMode(page: Page, backendUrl = REMOTE_BACKEND_URL) {
  await clickByTestId(page, "data-mode-remote");
  await page.getByTestId("backend-url-input").fill(backendUrl);
  await clickByTestId(page, "pull-remote");
  await expect(
    page.getByText(/Pulled|已从远端拉取|Remote profile synced|远端资料已同步/).first(),
  ).toBeVisible();
}

export async function pushRemoteProfile(page: Page) {
  await clickByTestId(page, "push-remote");
  await expect(page.getByText(/Remote push complete|远端推送完成/)).toBeVisible();
}

export async function readSaveDraft(page: Page) {
  await ensureOperationsDrawerOpen(page);
  await clickByTestId(page, "copy-snapshot");
  return page.getByTestId("save-draft").inputValue();
}

export async function readGold(page: Page) {
  const text = await page.getByTestId("battle-controls-panel").innerText();
  const match = text.match(/gold\s+(\d+)|金币\s+(\d+)/i);

  if (!match) {
    throw new Error(`Failed to parse gold from panel:\n${text}`);
  }

  return Number(match[1] ?? match[2]);
}

export async function readShopOfferTitles(page: Page) {
  await waitForShopOffers(page);
  const titles = [];
  const count = await page.locator('[data-testid^="shop-offer-"]').count();

  for (let index = 0; index < count; index += 1) {
    const text = await page.getByTestId(`shop-offer-${index}`).innerText();
    titles.push(text.split("\n")[0]?.trim() ?? "");
  }

  return titles;
}

export async function buyOfferAtIndex(page: Page, index: number) {
  await waitForShopOffers(page);
  const previousGold = await readGold(page);
  const previousBenchCount = await occupiedSlotCount(
    page,
    "bench-slot",
    EMPTY_BENCH_PATTERNS,
  );
  const previousStatus = await page.getByTestId("status-panel").innerText();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await triggerElementClick(page, `shop-offer-${index}`);
    await page.waitForTimeout(2_500);

    const nextGold = await readGold(page);
    const nextBenchCount = await occupiedSlotCount(
      page,
      "bench-slot",
      EMPTY_BENCH_PATTERNS,
    );
    const nextStatus = await page.getByTestId("status-panel").innerText();
    if (
      nextGold !== previousGold ||
      nextBenchCount !== previousBenchCount ||
      nextStatus !== previousStatus
    ) {
      return;
    }

    if (attempt === 2) {
      throw new Error(
        `Buying shop offer ${index} did not change runtime state. ` +
          `gold=${nextGold}, bench=${nextBenchCount}, status=${JSON.stringify(nextStatus)}`,
      );
    }
  }
}

export async function rerollShop(page: Page) {
  await waitForShopOffers(page);
  const previousGold = await readGold(page);
  await clickByTestId(page, "reroll-shop");
  await expect.poll(() => readGold(page), { timeout: 10_000 }).toBe(previousGold - 1);
}

async function waitForShopOffers(page: Page) {
  await expect(page.getByTestId("shop-offer-0")).toBeVisible({ timeout: 20_000 });
}

async function chooseFirstOperationIfPending(page: Page) {
  const firstOperation = page.getByTestId("operation-choice-0");
  if (!(await firstOperation.isVisible().catch(() => false))) {
    return;
  }

  await firstOperation.click();
  await expect(firstOperation).toBeHidden({ timeout: 10_000 });
}

async function firstOccupiedIndex(page: Page, prefix: string, emptyPatterns: string[]) {
  const count = await page.locator(`[data-testid^="${prefix}-"]`).count();

  for (let index = 0; index < count; index += 1) {
    const text = await page.getByTestId(`${prefix}-${index}`).innerText();
    if (!emptyPatterns.some((pattern) => text.includes(pattern))) {
      return index;
    }
  }

  throw new Error(`No occupied slot found for ${prefix}`);
}

async function firstEmptyIndex(page: Page, prefix: string, emptyPatterns: string[]) {
  const count = await page.locator(`[data-testid^="${prefix}-"]`).count();

  for (let index = 0; index < count; index += 1) {
    const text = await page.getByTestId(`${prefix}-${index}`).innerText();
    if (emptyPatterns.some((pattern) => text.includes(pattern))) {
      return index;
    }
  }

  throw new Error(`No empty slot found for ${prefix}`);
}

async function occupiedSlotCount(
  page: Page,
  prefix: string,
  emptyPatterns: string[],
) {
  const count = await page.locator(`[data-testid^="${prefix}-"]`).count();
  let occupied = 0;

  for (let index = 0; index < count; index += 1) {
    const text = await page.getByTestId(`${prefix}-${index}`).innerText();
    if (!emptyPatterns.some((pattern) => text.includes(pattern))) {
      occupied += 1;
    }
  }

  return occupied;
}

async function readDeploymentCap(page: Page) {
  const text = await page.getByTestId("deployment-cap-stat").innerText();
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);

  if (!match) {
    throw new Error(`Failed to parse deployment cap from panel:\n${text}`);
  }

  return {
    deployed: Number(match[1]),
    cap: Number(match[2]),
  };
}

async function triggerElementClick(page: Page, testId: string) {
  await clickByTestId(page, testId);
}

async function tryClickByTestId(page: Page, testId: string) {
  const runtimeAction =
    testId === "start-combat"
      ? "startCombat"
      : testId === "next-round"
        ? "nextRound"
        : testId === "restart-run"
          ? "restartRun"
          : null;

  if (runtimeAction) {
    if (!(await isTestIdClickable(page, testId))) {
      return false;
    }

    await dispatchTestIdClick(page, testId);
    return true;
  }

  return page.evaluate((id) => {
    const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const disabled =
      (element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement)
        ? element.disabled
        : element.hasAttribute("disabled");

    if (
      disabled ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none" ||
      element.getClientRects().length === 0
    ) {
      return false;
    }

    element.click();
    return true;
  }, testId);
}

async function isTestIdClickable(page: Page, testId: string) {
  return page.evaluate((id) => {
    const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none" ||
      element.getClientRects().length === 0
    ) {
      return false;
    }

    if (
      element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    ) {
      return !element.disabled;
    }

    return !element.hasAttribute("disabled");
  }, testId);
}

async function dispatchTestIdClick(page: Page, testId: string) {
  const runtimeAction =
    testId === "start-combat"
      ? "startCombat"
      : testId === "next-round"
        ? "nextRound"
        : testId === "restart-run"
          ? "restartRun"
          : null;

  if (runtimeAction) {
    await page.evaluate((action) => {
      const api = (window as Window & {
        __NUMERON_TEST_API__?: Record<string, () => void>;
      }).__NUMERON_TEST_API__;
      if (!api || typeof api[action] !== "function") {
        throw new Error(`Missing test runtime action: ${action}`);
      }

      window.setTimeout(() => {
        api[action]();
      }, 0);
    }, runtimeAction);
    return;
  }

  await page.evaluate((id) => {
    const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) {
      throw new Error(`Missing element: ${id}`);
    }

    element.click();
  }, testId);
}
