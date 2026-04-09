import { expect, Page } from "@playwright/test";

export const REMOTE_BACKEND_URL =
  process.env.PLAYWRIGHT_REMOTE_BACKEND_URL ?? "http://127.0.0.1:8787";

const EMPTY_BENCH_PATTERNS = ["Empty Bench Slot", "空备战槽"];
const EMPTY_BOARD_PATTERNS = ["Empty Slot", "空槽位"];

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
  const overlayLaunchButton = page.getByTestId("canvas-launch-runtime");
  const launchButton =
    (await overlayLaunchButton.isVisible().catch(() => false))
      ? overlayLaunchButton
      : page.getByTestId("launch-runtime");
  await expect(launchButton).toBeVisible();
  await expect(launchButton).toBeEnabled();
  await launchButton.click();
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

  await page.getByTestId(`bench-slot-${benchIndex}`).click();
  await page.getByTestId(`board-slot-${nextBoardIndex}`).click();
  await expect(page.getByTestId(`board-slot-${nextBoardIndex}`)).not.toContainText(
    /Empty Slot|空槽位/,
  );
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
  await expect
    .poll(
      async () => {
        const nextRoundEnabled = await page.getByTestId("next-round").isEnabled();
        const restartEnabled = await page.getByTestId("restart-run").isEnabled();
        return nextRoundEnabled || restartEnabled;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
}

export async function advanceToNextRound(page: Page, round?: number) {
  const previousRound = await readVisibleRound(page);
  await page.getByTestId("next-round").click();
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

    const augmentChoices = page.locator('[data-testid^="augment-choice-"]');
    if ((await augmentChoices.count()) > 0) {
      await augmentChoices.first().click();
    }

    if (await page.getByTestId("start-combat").isEnabled()) {
      await page.getByTestId("start-combat").click();
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
  await page.getByTestId("data-mode-remote").click();
  await page.getByTestId("backend-url-input").fill(backendUrl);
  await page.getByTestId("pull-remote").click();
  await expect(
    page.getByText(/Pulled|已从远端拉取|Remote profile synced|远端资料已同步/).first(),
  ).toBeVisible();
}

export async function pushRemoteProfile(page: Page) {
  await page.getByTestId("push-remote").click();
  await expect(page.getByText(/Remote push complete|远端推送完成/)).toBeVisible();
}

export async function readSaveDraft(page: Page) {
  await ensureOperationsDrawerOpen(page);
  await page.getByTestId("copy-snapshot").click();
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
  const previousOffers = (await readShopOfferTitles(page)).join("|");
  const previousBench = await page.getByTestId("bench-panel").innerText();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByTestId(`shop-offer-${index}`).click();

    try {
      await expect
        .poll(
          async () => {
            const nextGold = await readGold(page);
            const nextOffers = (await readShopOfferTitles(page)).join("|");
            const nextBench = await page.getByTestId("bench-panel").innerText();
            return (
              nextGold !== previousGold ||
              nextOffers !== previousOffers ||
              nextBench !== previousBench
            );
          },
          { timeout: 3_000 },
        )
        .toBe(true);
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }
}

export async function rerollShop(page: Page) {
  await waitForShopOffers(page);
  const previousGold = await readGold(page);
  await page.getByTestId("reroll-shop").click();
  await expect.poll(() => readGold(page), { timeout: 10_000 }).toBe(previousGold - 1);
}

async function waitForShopOffers(page: Page) {
  await expect(page.getByTestId("shop-offer-0")).toBeVisible({ timeout: 10_000 });
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
