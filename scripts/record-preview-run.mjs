import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const EMPTY_BENCH_PATTERNS = ["Empty Bench Slot", "空备战槽"];
const EMPTY_BOARD_PATTERNS = ["Empty Slot", "空槽位"];
const SHOP_BUY_COST = 3;
const DEFAULT_URL = "http://127.0.0.1:3100";
const DEFAULT_STAMP = "2026-04-11";

const MODES = {
  human: {
    label: "真人试玩版",
    introWaitMs: 900,
    afterActionMs: 260,
    afterRoundMs: 1100,
    beforeLaunchMs: 900,
    betweenRoundsMs: 520,
    summaryPauseMs: 5200,
    cursorSettleMs: 90,
    hoverPauseMs: 130,
    moveStepDivisor: 24,
    captions: {
      boot: "切到简体中文，开始录制完整一局。",
      doctrine: "选择开放黑市开局。",
      launch: "启动 Runtime，进入首局战斗。",
      operation: "先锁定这一回合的行动节点。",
      buy: "从商店购买第一个可用单位。",
      deploy: "把单位部署到棋盘空位。",
      fight: "开始战斗，观察回合结果。",
      augment: "出现强化，先拿一个继续往下打。",
      topOff: "补齐阵容，尽量站满当前人口。",
      nextRound: (round) => `进入第 ${round} 回合。`,
      resolved: (round) => `第 ${round} 回合结算完成。`,
      summary: "本局结束，停在结算面板。",
    },
  },
  guided: {
    label: "讲解验收版",
    introWaitMs: 2200,
    afterActionMs: 1300,
    afterRoundMs: 3000,
    beforeLaunchMs: 2400,
    betweenRoundsMs: 1800,
    summaryPauseMs: 9000,
    cursorSettleMs: 200,
    hoverPauseMs: 420,
    moveStepDivisor: 14,
    captions: {
      boot: "先切到简体中文，后面的整局录像都以中文界面验收。",
      doctrine: "这里选择开放黑市开局。它会给更宽松的前期经济，便于更快买子和补阵容。",
      launch: "现在启动 Runtime，正式进入对局。",
      operation: "如果本回合有行动节点，就先锁定它，避免开战前还有未处理选项。",
      buy: "从商店先买下第一个可用单位，确认招募流程可用。",
      deploy: "把新买的单位放到棋盘上，确认部署交互和阵容统计都正常。",
      fight: "开始战斗，等这回合完整结算。",
      augment: "出现强化时先选一个，继续推进完整一局。",
      topOff: "如果场上没站满，就继续买人上人，把当前人口尽量补满。",
      nextRound: (round) => `现在进入第 ${round} 回合，继续检查强化、商店、部署和开战链路。`,
      resolved: (round) => `第 ${round} 回合已经结算，可以继续往后推进。`,
      summary:
        "本局结束后停在结算面板，方便直接检查路线、强化、最终阵容和输出复盘。",
    },
  },
};

function parseArgs(argv) {
  const values = {
    mode: "human",
    stamp: DEFAULT_STAMP,
    url: DEFAULT_URL,
    timeoutMs: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];
    const consumeNext = inlineValue == null;

    if (rawKey === "mode" && nextValue) {
      values.mode = nextValue;
      if (consumeNext) {
        index += 1;
      }
      continue;
    }

    if (rawKey === "stamp" && nextValue) {
      values.stamp = nextValue;
      if (consumeNext) {
        index += 1;
      }
      continue;
    }

    if (rawKey === "url" && nextValue) {
      values.url = nextValue;
      if (consumeNext) {
        index += 1;
      }
      continue;
    }

    if (rawKey === "timeout-ms" && nextValue) {
      const parsed = Number(nextValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${nextValue}`);
      }
      values.timeoutMs = parsed;
      if (consumeNext) {
        index += 1;
      }
    }
  }

  if (!MODES[values.mode]) {
    throw new Error(`Unsupported mode: ${values.mode}`);
  }

  return values;
}

function waitForProcess(child, label) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

function formatTimestamp(seconds) {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

function escapeSubtitleText(text) {
  return text.replace(/\r?\n/g, "\n");
}

class SubtitleRecorder {
  constructor() {
    this.startedAt = Date.now();
    this.cues = [];
    this.activeCue = null;
  }

  now() {
    return (Date.now() - this.startedAt) / 1000;
  }

  cue(text) {
    const now = this.now();
    if (this.activeCue) {
      this.activeCue.end = Math.max(this.activeCue.start + 0.5, now);
    }
    this.activeCue = {
      start: now,
      end: now + 1,
      text,
    };
    this.cues.push(this.activeCue);
  }

  finish() {
    const now = this.now();
    if (this.activeCue) {
      this.activeCue.end = Math.max(this.activeCue.start + 1, now);
      this.activeCue = null;
    }
  }

  toSrt() {
    return this.cues
      .map((cue, index) => {
        return [
          String(index + 1),
          `${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}`,
          escapeSubtitleText(cue.text),
          "",
        ].join("\n");
      })
      .join("\n");
  }
}

function buildPaths(mode, stamp) {
  const outputDir = path.resolve("output/playwright");
  const stem = `runtime-full-run-zh-${mode}-${stamp}`;
  return {
    outputDir,
    rawVideoDir: path.join(outputDir, `.tmp-video-${mode}-${stamp}`),
    rawVideoPath: path.join(outputDir, `${stem}.webm`),
    subtitlePath: path.join(outputDir, `${stem}.srt`),
    finalVideoPath: path.join(outputDir, `${stem}.mp4`),
  };
}

async function ensureCleanOutput(paths) {
  await fs.mkdir(paths.outputDir, { recursive: true });
  await fs.rm(paths.rawVideoDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(paths.rawVideoDir, { recursive: true });
  await Promise.all([
    fs.rm(paths.rawVideoPath, { force: true }).catch(() => {}),
    fs.rm(paths.subtitlePath, { force: true }).catch(() => {}),
    fs.rm(paths.finalVideoPath, { force: true }).catch(() => {}),
  ]);
}

async function installCursorOverlay(page) {
  await page.evaluate(() => {
    const key = "__codexCursorOverlayInstalled__";
    if (window[key]) {
      return;
    }

    window[key] = true;

    const style = document.createElement("style");
    style.textContent = `
      #codex-fake-cursor {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.95);
        background: rgba(255, 139, 61, 0.9);
        box-shadow: 0 0 0 8px rgba(255, 139, 61, 0.16), 0 10px 30px rgba(0,0,0,0.28);
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-50%, -50%);
        transition: width 0.12s ease, height 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
      }

      #codex-fake-cursor.down {
        width: 26px;
        height: 26px;
        background: rgba(255, 209, 102, 0.95);
        box-shadow: 0 0 0 12px rgba(255, 209, 102, 0.18), 0 12px 28px rgba(0,0,0,0.3);
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement("div");
    cursor.id = "codex-fake-cursor";
    cursor.style.left = "80px";
    cursor.style.top = "80px";
    document.documentElement.appendChild(cursor);

    const setPosition = (clientX, clientY) => {
      cursor.style.left = `${clientX}px`;
      cursor.style.top = `${clientY}px`;
    };

    document.addEventListener(
      "mousemove",
      (event) => {
        setPosition(event.clientX, event.clientY);
      },
      true,
    );
    document.addEventListener(
      "mousedown",
      () => {
        cursor.classList.add("down");
      },
      true,
    );
    document.addEventListener(
      "mouseup",
      () => {
        cursor.classList.remove("down");
      },
      true,
    );

    window.__codexMoveCursor = setPosition;
  });
}

async function locatorCenter(locator) {
  const handle = await locator.elementHandle();
  if (!handle) {
    return null;
  }
  const box = await handle.boundingBox();
  if (!box) {
    return null;
  }
  return {
    x: box.x + Math.min(box.width / 2, Math.max(8, box.width - 8)),
    y: box.y + Math.min(box.height / 2, Math.max(8, box.height - 8)),
  };
}

async function run() {
  const { mode, stamp, url, timeoutMs } = parseArgs(process.argv.slice(2));
  const profile = MODES[mode];
  const paths = buildPaths(mode, stamp);

  await ensureCleanOutput(paths);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: paths.rawVideoDir,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  const subtitles = new SubtitleRecorder();
  let mousePosition = { x: 80, y: 80 };
  const overallStartedAt = Date.now();
  const overallTimeoutMs = timeoutMs ?? (mode === "guided" ? 900_000 : 720_000);

  async function wait(ms) {
    await page.waitForTimeout(ms);
  }

  function log(message, extra = null) {
    if (extra == null) {
      console.log(`[record:${mode}] ${message}`);
      return;
    }
    console.log(`[record:${mode}] ${message} ${JSON.stringify(extra)}`);
  }

  async function assertOverallTime(label) {
    const elapsed = Date.now() - overallStartedAt;
    if (elapsed <= overallTimeoutMs) {
      return;
    }

    const round = await readVisibleRound().catch(() => null);
    const status = await readStatusLine().catch(() => "");
    throw new Error(
      `Exceeded overall recording timeout at ${label}. ` +
        `elapsedMs=${elapsed} round=${round ?? "unknown"} status=${JSON.stringify(status)}`,
    );
  }

  async function moveCursor(x, y) {
    const distance = Math.hypot(x - mousePosition.x, y - mousePosition.y);
    const steps = Math.max(10, Math.ceil(distance / profile.moveStepDivisor));
    await page.mouse.move(x, y, { steps });
    await page.evaluate(
      ([nextX, nextY]) => {
        if (typeof window.__codexMoveCursor === "function") {
          window.__codexMoveCursor(nextX, nextY);
        }
      },
      [x, y],
    );
    mousePosition = { x, y };
    await wait(profile.cursorSettleMs);
  }

  async function pulseCursorClick() {
    await page.evaluate(() => {
      const cursor = document.getElementById("codex-fake-cursor");
      cursor?.classList.add("down");
    });
    await wait(90);
    await page.evaluate(() => {
      const cursor = document.getElementById("codex-fake-cursor");
      cursor?.classList.remove("down");
    });
  }

  async function isTestIdClickable(testId) {
    return page.evaluate((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
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

  async function waitForLocatorReady(locator, timeout = 15_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) {
        await wait(250);
        continue;
      }

      const handle = await locator.elementHandle();
      if (!handle) {
        await wait(250);
        continue;
      }

      const clickable = await handle.evaluate((element) => {
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
      });

      if (clickable) {
        return;
      }

      await wait(250);
    }

    throw new Error("Locator did not become ready within timeout");
  }

  async function clickLocator(locator, options = {}) {
    const {
      timeout = 15_000,
      postClickMs = profile.afterActionMs,
      runtimeAction = null,
    } = options;

    await waitForLocatorReady(locator, timeout);
    const center = await locatorCenter(locator);
    if (!center) {
      throw new Error("Could not resolve locator center");
    }

    await moveCursor(center.x, center.y);
    await wait(profile.hoverPauseMs);
    await pulseCursorClick();

    if (runtimeAction) {
      await page.evaluate((action) => {
        const api = window.__NUMERON_TEST_API__;
        if (!api || typeof api[action] !== "function") {
          throw new Error(`Missing test runtime action: ${action}`);
        }
        window.setTimeout(() => {
          api[action]();
        }, 0);
      }, runtimeAction);
    } else {
      await locator.evaluate((element) => {
        element.click();
      });
    }

    await wait(postClickMs);
  }

  async function clickRoleButton(name, timeout = 15_000) {
    await clickLocator(page.getByRole("button", { name, exact: true }), {
      timeout,
    });
  }

  async function testIdCenter(testId) {
    return page.evaluate((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }

      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }, testId);
  }

  async function dispatchTestIdClick(testId) {
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
        const api = window.__NUMERON_TEST_API__;
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
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (!element) {
        throw new Error(`Missing element: ${id}`);
      }
      element.click();
    }, testId);
  }

  async function clickWhenClickable(
    testId,
    timeout = 15_000,
    postClickMs = profile.afterActionMs,
  ) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await isTestIdClickable(testId)) {
        const center = await testIdCenter(testId);
        if (center) {
          await moveCursor(center.x, center.y);
          await wait(profile.hoverPauseMs);
          await pulseCursorClick();
        }
        await dispatchTestIdClick(testId);
        await wait(postClickMs);
        return;
      }
      await wait(250);
    }

    throw new Error(`Timed out waiting for clickable element: ${testId}`);
  }

  async function tryClickTestId(testId, postClickMs = profile.afterActionMs) {
    if (!(await isTestIdClickable(testId))) {
      return false;
    }

    const center = await testIdCenter(testId);
    if (center) {
      await moveCursor(center.x, center.y);
      await wait(profile.hoverPauseMs);
      await pulseCursorClick();
    }
    await dispatchTestIdClick(testId);
    await wait(postClickMs);
    return true;
  }

  async function readGold() {
    const text = await page.evaluate(() => {
      return (
        document.querySelector('[data-testid="battle-controls-panel"]')
          ?.textContent ?? ""
      );
    });
    const match = text.match(/gold\s*(\d+)|金币\s*(\d+)/i);
    if (!match) {
      throw new Error(`Failed to parse gold from panel:\n${text}`);
    }
    return Number(match[1] ?? match[2]);
  }

  async function readDeploymentCap() {
    const text = await page.evaluate(() => {
      return (
        document.querySelector('[data-testid="deployment-cap-stat"]')
          ?.textContent ?? ""
      );
    });
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) {
      throw new Error(`Failed to parse deployment cap from panel:\n${text}`);
    }

    return {
      deployed: Number(match[1]),
      cap: Number(match[2]),
    };
  }

  async function occupiedSlotCount(prefix, emptyPatterns) {
    return page.evaluate(
      ({ nextPrefix, nextEmptyPatterns }) => {
        const nodes = Array.from(
          document.querySelectorAll(`[data-testid^="${nextPrefix}-"]`),
        );
        return nodes.reduce((occupied, node) => {
          const text = node.textContent ?? "";
          return nextEmptyPatterns.some((pattern) => text.includes(pattern))
            ? occupied
            : occupied + 1;
        }, 0);
      },
      { nextPrefix: prefix, nextEmptyPatterns: emptyPatterns },
    );
  }

  async function firstOccupiedIndex(prefix, emptyPatterns) {
    const index = await page.evaluate(
      ({ nextPrefix, nextEmptyPatterns }) => {
        const nodes = Array.from(
          document.querySelectorAll(`[data-testid^="${nextPrefix}-"]`),
        );
        return nodes.findIndex((node) => {
          const text = node.textContent ?? "";
          return !nextEmptyPatterns.some((pattern) => text.includes(pattern));
        });
      },
      { nextPrefix: prefix, nextEmptyPatterns: emptyPatterns },
    );
    if (index >= 0) {
      return index;
    }
    throw new Error(`No occupied slot found for ${prefix}`);
  }

  async function firstEmptyIndex(prefix, emptyPatterns) {
    const index = await page.evaluate(
      ({ nextPrefix, nextEmptyPatterns }) => {
        const nodes = Array.from(
          document.querySelectorAll(`[data-testid^="${nextPrefix}-"]`),
        );
        return nodes.findIndex((node) => {
          const text = node.textContent ?? "";
          return nextEmptyPatterns.some((pattern) => text.includes(pattern));
        });
      },
      { nextPrefix: prefix, nextEmptyPatterns: emptyPatterns },
    );
    if (index >= 0) {
      return index;
    }
    throw new Error(`No empty slot found for ${prefix}`);
  }

  async function readVisibleRound() {
    return page.evaluate(() => {
      const topbarText =
        document.querySelector('[data-testid="topbar-round"]')?.textContent ?? "";
      const topbarMatch = topbarText.match(/(?:^|\n)(\d+)\s*$/m);
      if (topbarMatch) {
        return Number(topbarMatch[1]);
      }

      const statusText =
        document.querySelector('[data-testid="status-panel"]')?.textContent ?? "";
      const statusMatch = statusText.match(/Round\s+(\d+)|第\s+(\d+)\s+回合/i);
      if (statusMatch) {
        return Number(statusMatch[1] ?? statusMatch[2]);
      }

      const sessionText =
        document.querySelector('[data-testid="session-panel"]')?.textContent ?? "";
      const sessionMatch = sessionText.match(/(?:^|\n)R\s+(\d+)|回合\s+(\d+)/im);
      if (sessionMatch) {
        return Number(sessionMatch[1] ?? sessionMatch[2]);
      }

      return null;
    });
  }

  async function readStatusLine() {
    const text = await page.evaluate(() => {
      return (
        document.querySelector('[data-testid="status-panel"]')?.textContent ?? ""
      );
    });
    return text.replace(/\s+/g, " ").trim();
  }

  async function isRunOver() {
    if (await isTestIdClickable("restart-run")) {
      return true;
    }
    const statusText = await readStatusLine();
    return /Run clear|Run over|通关|本局结束/.test(statusText);
  }

  async function buyOfferAtIndex(index) {
    const previousGold = await readGold();
    const previousBenchCount = await occupiedSlotCount(
      "bench-slot",
      EMPTY_BENCH_PATTERNS,
    );
    const previousStatus = await readStatusLine();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clickWhenClickable(
        `shop-offer-${index}`,
        10_000,
        profile.afterActionMs + 600,
      );
      const nextGold = await readGold();
      const nextBenchCount = await occupiedSlotCount(
        "bench-slot",
        EMPTY_BENCH_PATTERNS,
      );
      const nextStatus = await readStatusLine();

      if (
        nextGold !== previousGold ||
        nextBenchCount !== previousBenchCount ||
        nextStatus !== previousStatus
      ) {
        return;
      }
    }

    throw new Error(`Buying shop offer ${index} did not change runtime state`);
  }

  async function buyFirstClickableOffer() {
    const count = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid^="shop-offer-"]').length;
    });
    for (let index = 0; index < count; index += 1) {
      if (await isTestIdClickable(`shop-offer-${index}`)) {
        subtitles.cue(profile.captions.buy);
        log("buy-offer", { index });
      await buyOfferAtIndex(index);
      return;
      }
    }
    throw new Error("No clickable shop offer found");
  }

  async function deployBenchUnitAtIndex(benchIndex, boardIndex) {
    const boardSlotId = `board-slot-${boardIndex}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      subtitles.cue(profile.captions.deploy);
      log("deploy-unit", { benchIndex, boardIndex, attempt });
      await clickWhenClickable(`bench-slot-${benchIndex}`, 8_000, profile.afterActionMs);
      await clickWhenClickable(boardSlotId, 8_000, profile.afterActionMs + 500);
      const boardText = await page.evaluate((id) => {
        return document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";
      }, boardSlotId);
      if (!/Empty Slot|空槽位/.test(boardText)) {
        return;
      }
    }

    throw new Error(
      `Failed to deploy bench unit ${benchIndex} to board slot ${boardIndex}`,
    );
  }

  async function deployFirstBenchUnit() {
    const benchIndex = await firstOccupiedIndex(
      "bench-slot",
      EMPTY_BENCH_PATTERNS,
    );
    const boardIndex = await firstEmptyIndex("board-slot", EMPTY_BOARD_PATTERNS);
    await deployBenchUnitAtIndex(benchIndex, boardIndex);
  }

  async function chooseFirstOperationIfPending() {
    if (!(await isTestIdClickable("operation-choice-0"))) {
      return false;
    }
    subtitles.cue(profile.captions.operation);
    log("pick-operation");
    await clickWhenClickable("operation-choice-0", 10_000, profile.afterActionMs);
    return true;
  }

  async function chooseFirstAugmentIfPending() {
    if (!(await isTestIdClickable("augment-choice-0"))) {
      return false;
    }
    subtitles.cue(profile.captions.augment);
    log("pick-augment");
    await clickWhenClickable("augment-choice-0", 10_000, profile.afterActionMs);
    return true;
  }

  async function waitForRoundResolution() {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const resolved = await page.evaluate(() => {
        const nextRound = document.querySelector('[data-testid="next-round"]');
        const restartRun = document.querySelector('[data-testid="restart-run"]');
        const status = document.querySelector('[data-testid="status-panel"]')
          ?.textContent;
        const nextReady =
          nextRound instanceof HTMLButtonElement && !nextRound.disabled;
        const restartReady =
          restartRun instanceof HTMLButtonElement && !restartRun.disabled;
        return Boolean(
          nextReady ||
            restartReady ||
            status?.match(
              /Round resolved|本回合已结算|Click Next Round|点击“下一回合”|Run over|通关|本局结束/,
            ),
        );
      });
      if (resolved) {
        return;
      }
      await wait(500);
    }
    throw new Error("Round did not resolve within 30s");
  }

  async function waitForRoundReady(round) {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const currentRound = await readVisibleRound();
      const statusText = await readStatusLine();
      const operationReady = await isTestIdClickable("operation-choice-0");
      if (
        currentRound === round ||
        /Prep|准备/.test(statusText) ||
        operationReady
      ) {
        return;
      }
      await wait(250);
    }
    throw new Error(`Round ${round} did not become ready`);
  }

  async function advanceToNextRound(round) {
    subtitles.cue(profile.captions.nextRound(round));
    log("next-round", { round });
    await clickWhenClickable("next-round", 15_000, profile.betweenRoundsMs);
    await waitForRoundReady(round);
    await chooseFirstOperationIfPending();
  }

  async function topOffBoardBeforeCombat() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { deployed, cap } = await readDeploymentCap();
      if (deployed >= cap) {
        return;
      }

      subtitles.cue(profile.captions.topOff);
      const benchCount = await occupiedSlotCount(
        "bench-slot",
        EMPTY_BENCH_PATTERNS,
      );
      if (benchCount > 0) {
        await deployFirstBenchUnit();
        continue;
      }

      const gold = await readGold();
      if (gold < SHOP_BUY_COST) {
        return;
      }

      await buyFirstClickableOffer();
      await deployFirstBenchUnit();
    }
  }

  async function startCombat() {
    subtitles.cue(profile.captions.fight);
    const round = await readVisibleRound().catch(() => null);
    log("start-combat", { round });
    await clickWhenClickable("start-combat", 15_000, profile.afterActionMs);
    await waitForRoundResolution();
    await wait(profile.afterRoundMs);
  }

  async function playUntilRunEnds(maxRounds = 10) {
    let roundCursor = 3;
    while (roundCursor <= maxRounds) {
      await assertOverallTime(`playUntilRunEnds:${roundCursor}`);
      log("round-loop", {
        roundCursor,
        visibleRound: await readVisibleRound().catch(() => null),
      });
      if (await isRunOver()) {
        return;
      }

      await chooseFirstAugmentIfPending();
      await topOffBoardBeforeCombat();

      if (await isTestIdClickable("start-combat")) {
        await startCombat();
      }

      const resolvedRound = await readVisibleRound();
      if (resolvedRound != null) {
        subtitles.cue(profile.captions.resolved(resolvedRound));
        await wait(profile.afterActionMs);
      }

      if (await isRunOver()) {
        return;
      }

      if (await isTestIdClickable("next-round")) {
        await advanceToNextRound(roundCursor + 1);
      } else {
        await wait(profile.betweenRoundsMs);
      }

      roundCursor += 1;
    }
  }

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    log("open-page", { url });
    await installCursorOverlay(page);
    await page.evaluate(() => {
      if (typeof window.__codexMoveCursor === "function") {
        window.__codexMoveCursor(80, 80);
      }
    });
    await wait(profile.introWaitMs);

    subtitles.cue(profile.captions.boot);
    await clickRoleButton("简体中文", 10_000);
    log("switch-language", { locale: "zh-CN" });
    await wait(profile.afterActionMs);

    subtitles.cue(profile.captions.doctrine);
    await clickWhenClickable(
      "starter-doctrine-open-market",
      10_000,
      profile.beforeLaunchMs,
    );
    log("pick-doctrine", { doctrine: "open-market" });

    subtitles.cue(profile.captions.launch);
    await clickWhenClickable("canvas-launch-runtime", 15_000, profile.beforeLaunchMs);
    log("launch-runtime");

    await page
      .getByTestId("boot-overlay")
      .waitFor({ state: "hidden", timeout: 30_000 });
    await page.getByTestId("shop-offer-0").waitFor({
      state: "visible",
      timeout: 30_000,
    });
    log("runtime-ready");
    await wait(profile.afterActionMs + 900);

    await chooseFirstOperationIfPending();
    await buyFirstClickableOffer();
    await deployFirstBenchUnit();
    await startCombat();

    const roundOne = await readVisibleRound();
    if (roundOne != null) {
      subtitles.cue(profile.captions.resolved(roundOne));
      await wait(profile.afterActionMs);
    }

    if (!(await isRunOver())) {
      await advanceToNextRound(2);
      await wait(profile.betweenRoundsMs);
      await playUntilRunEnds(10);
    }

    const endDeadline = Date.now() + 25_000;
    while (Date.now() < endDeadline) {
      await assertOverallTime("final-drain");
      if (await isRunOver()) {
        break;
      }

      if (await isTestIdClickable("next-round")) {
        const nextRound = ((await readVisibleRound()) ?? 1) + 1;
        log("final-drain-next-round", { nextRound });
        await advanceToNextRound(nextRound);
        await chooseFirstAugmentIfPending();
        await topOffBoardBeforeCombat();
        if (await isTestIdClickable("start-combat")) {
          await startCombat();
        }
        continue;
      }

      await wait(1_000);
    }

    subtitles.cue(profile.captions.summary);
    log("summary");
    await page.getByTestId("run-summary-panel").scrollIntoViewIfNeeded();
    await moveCursor(1120, 660);
    await wait(profile.summaryPauseMs);
    subtitles.finish();

    await context.close();
    const source = await video.path();
    await fs.copyFile(source, paths.rawVideoPath);

    const srt = subtitles.toSrt();
    await fs.writeFile(paths.subtitlePath, srt, "utf8");

    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        paths.rawVideoPath,
        "-i",
        paths.subtitlePath,
        "-map",
        "0:v:0",
        "-map",
        "1:s:0",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:s",
        "mov_text",
        "-metadata:s:s:0",
        "language=zho",
        "-metadata:s:s:0",
        "handler_name=Chinese Subtitle",
        "-an",
        paths.finalVideoPath,
      ],
      {
        stdio: "inherit",
      },
    );
    log("burn-subtitles", { finalVideoPath: paths.finalVideoPath });
    await waitForProcess(ffmpeg, "ffmpeg");
  } finally {
    await browser.close().catch(() => {});
  }

  console.log(JSON.stringify({
    mode,
    label: profile.label,
    rawVideoPath: paths.rawVideoPath,
    subtitlePath: paths.subtitlePath,
    finalVideoPath: paths.finalVideoPath,
  }));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
