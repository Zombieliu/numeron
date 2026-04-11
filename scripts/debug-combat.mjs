import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
});

async function clickByTestId(testId) {
  await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing element: ${id}`);
    }

    element.click();
  }, testId);
}

async function dump(label) {
  const state = await page.evaluate(() => ({
    topbar: document.querySelector('[data-testid="status-panel"]')?.textContent ?? "",
    controls:
      document.querySelector('[data-testid="battle-controls-panel"]')?.textContent ?? "",
    board0: document.querySelector('[data-testid="board-slot-0"]')?.textContent ?? "",
    bench0: document.querySelector('[data-testid="bench-slot-0"]')?.textContent ?? "",
    gold:
      document
        .querySelector('[data-testid="battle-controls-panel"]')
        ?.textContent?.match(/Gold\\s*(\\d+)/)?.[1] ?? "",
    nextDisabled:
      document.querySelector('[data-testid="next-round"]')?.hasAttribute("disabled") ?? true,
    startDisabled:
      document.querySelector('[data-testid="start-combat"]')?.hasAttribute("disabled") ?? true,
  }));
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(state, null, 2));
}

await page.goto("http://127.0.0.1:3191", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "简体中文", exact: true }).click();
await page.getByRole("button", { name: "English", exact: true }).click();
await page.getByTestId("starter-doctrine-open-market").click();
await page.getByTestId("canvas-launch-runtime").click();
await page.getByTestId("shop-offer-0").waitFor({ state: "visible", timeout: 30000 });
if (await page.getByTestId("operation-choice-0").isVisible().catch(() => false)) {
  await page.getByTestId("operation-choice-0").click();
}
await page.getByTestId("lock-shop").click();

await dump("after-launch");
await clickByTestId("shop-offer-0");
await page.waitForTimeout(2500);
await dump("after-buy");
await clickByTestId("bench-slot-0");
await page.waitForTimeout(750);
await dump("after-select-bench");
await clickByTestId("board-slot-0");
await page.waitForTimeout(1500);
await dump("after-deploy");
await clickByTestId("start-combat");
await page.waitForTimeout(1500);
await dump("after-start");

for (let index = 1; index <= 6; index += 1) {
  await page.waitForTimeout(5000);
  await dump(`combat-${index * 5}s`);
}

await browser.close();
