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
  const launchButton = page.getByTestId("launch-runtime");
  await expect(launchButton).toBeVisible();
  await expect(launchButton).toBeEnabled();
  await launchButton.click();
  await page.locator("text=/scene-ready|running/i").first().waitFor({ timeout: 30_000 });
  await expect(page.getByTestId("status-panel")).toContainText(/Runtime active|Runtime 状态/);
}

export async function buyFirstOffer(page: Page) {
  await page.getByTestId("shop-offer-0").click();
}

export async function deployFirstBenchUnit(page: Page) {
  const benchIndex = await firstOccupiedIndex(page, "bench-slot", EMPTY_BENCH_PATTERNS);
  const boardIndex = await firstEmptyIndex(page, "board-slot", EMPTY_BOARD_PATTERNS);

  await page.getByTestId(`bench-slot-${benchIndex}`).click();
  await page.getByTestId(`board-slot-${boardIndex}`).click();
  await expect(page.getByTestId(`board-slot-${boardIndex}`)).not.toContainText(
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

export async function advanceToNextRound(page: Page, round: number) {
  await page.getByTestId("next-round").click();
  await waitForRoundReady(page, round);
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
  const maxRounds = options.maxRounds ?? 8;

  for (let round = startRound; round <= maxRounds; round += 1) {
    if (await page.getByTestId("restart-run").isEnabled()) {
      return;
    }

    if (await page.getByTestId("start-combat").isEnabled()) {
      await page.getByTestId("start-combat").click();
      await waitForRoundResolution(page);
    }

    if (await page.getByTestId("restart-run").isEnabled()) {
      return;
    }

    if (await page.getByTestId("next-round").isEnabled()) {
      await advanceToNextRound(page, round);
    }
  }
}

export async function setRemoteMode(page: Page, backendUrl = REMOTE_BACKEND_URL) {
  await page.getByTestId("data-mode-remote").click();
  await page.getByTestId("backend-url-input").fill(backendUrl);
  await page.getByTestId("pull-remote").click();
  await expect(page.getByText(/Pulled|已从远端拉取/).first()).toBeVisible();
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

async function firstOccupiedIndex(page: Page, prefix: string, emptyPatterns: string[]) {
  for (let index = 0; index < 4; index += 1) {
    const text = await page.getByTestId(`${prefix}-${index}`).innerText();
    if (!emptyPatterns.some((pattern) => text.includes(pattern))) {
      return index;
    }
  }

  throw new Error(`No occupied slot found for ${prefix}`);
}

async function firstEmptyIndex(page: Page, prefix: string, emptyPatterns: string[]) {
  for (let index = 0; index < 4; index += 1) {
    const text = await page.getByTestId(`${prefix}-${index}`).innerText();
    if (emptyPatterns.some((pattern) => text.includes(pattern))) {
      return index;
    }
  }

  throw new Error(`No empty slot found for ${prefix}`);
}
