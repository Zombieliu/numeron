#!/usr/bin/env node

import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "output", "playwright", "smoke-web");
const staticDir = path.join(repoRoot, "apps", "web", "out");
const configuredSmokeUrl = process.env.SMOKE_WEB_URL ?? null;
const configuredPort = configuredSmokeUrl ? Number(new URL(configuredSmokeUrl).port || "80") : 3100;
const configuredHostname = configuredSmokeUrl ? new URL(configuredSmokeUrl).hostname : "127.0.0.1";
const remoteBackendUrl = process.env.SMOKE_REMOTE_BACKEND_URL ?? null;

async function main() {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "smoke-web.log"), "");

  if (process.env.SMOKE_WEB_SKIP_BUILD !== "1") {
    await runCommand("pnpm", ["build"], path.join(outputDir, "build.log"));
  } else {
    await ensureStaticBuildExists();
  }

  const { server, url } = await startStaticServer();

  try {
    await waitForServer(url, 120_000);
    await runSmoke(url);
  } finally {
    await stopStaticServer(server);
  }
}

async function ensureStaticBuildExists() {
  const indexPath = path.join(staticDir, "index.html");
  try {
    await stat(indexPath);
  } catch {
    throw new Error(
      "apps/web/out is missing. Run `pnpm build` first or omit SMOKE_WEB_SKIP_BUILD.",
    );
  }
}

async function runCommand(command, args, logFile) {
  await writeFile(logFile, "");

  await new Promise((resolve, reject) => {
    const child = spawn(resolveCommand(command), args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const appendLog = async (chunk) => {
      await writeFile(logFile, chunk, { flag: "a" });
    };

    child.stdout.on("data", (chunk) => {
      void appendLog(chunk);
    });
    child.stderr.on("data", (chunk) => {
      void appendLog(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function startStaticServer() {
  await ensureStaticBuildExists();

  const logFile = path.join(outputDir, "static-server.log");
  await writeFile(logFile, "");

  const server = createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const relativePath = normalizeRequestPath(requestPath);
      let filePath = path.join(staticDir, relativePath);

      const fileStat = await statMaybe(filePath);
      if (fileStat?.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      const file = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-cache",
      });
      response.end(file);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  const address = await listenForSmoke(server);
  const url = `http://${configuredHostname}:${address.port}`;
  await writeFile(logFile, `Listening on ${url}\n`, { flag: "a" });

  return { server, url };
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function runSmoke(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    const pageErrors = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        pageErrors.push(message.text());
      }
    });

    await page.goto(url, { waitUntil: "domcontentloaded" });
    const launchButton = page.getByRole("button", { name: "Launch Runtime" });
    await launchButton.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (candidate) => candidate.textContent?.trim() === "Launch Runtime",
      );
      return button instanceof HTMLButtonElement && !button.disabled;
    });

    if (remoteBackendUrl) {
      await page.getByRole("button", { name: "Remote", exact: true }).click();
      await page.locator('input[placeholder="http://127.0.0.1:8787"]').fill(remoteBackendUrl);
      await page.getByRole("button", { name: "Pull Remote", exact: true }).click();
      await page.locator("section.panel").filter({ hasText: /Pulled/i }).first().waitFor({
        timeout: 10_000,
      });
    }

    await launchButton.click();

    await page.locator("text=/scene-ready/i").first().waitFor({ timeout: 30_000 });

    const rightButton = page.getByRole("button", { name: "Right" });
    await rightButton.dispatchEvent("pointerdown");
    await sleep(1_000);
    await rightButton.dispatchEvent("pointerup");
    await sleep(500);

    const statusPanel = page.locator("section.panel").filter({ hasText: "Status" }).first();
    const statusText = await statusPanel.innerText();
    const progressionPanel = page
      .locator("section.panel")
      .filter({ hasText: "Progression Meta" })
      .first();
    const progressionText = await progressionPanel.innerText();
    const sessionPanel = page
      .locator("section.panel")
      .filter({ hasText: "Match Contract" })
      .first();
    const sessionText = await sessionPanel.innerText();
    const dataModePanel = page
      .locator("section.panel")
      .filter({ hasText: "Data Mode" })
      .first();
    const dataModeText = await dataModePanel.innerText();

    if (!/Runtime active:\s+yes/i.test(statusText)) {
      throw new Error(`Smoke failed: runtime never became active.\n${statusText}`);
    }

    if (/Position:\s+0\.0,\s+0\.0/i.test(statusText) || /Position:\s+waiting/i.test(statusText)) {
      throw new Error(`Smoke failed: runtime position never changed.\n${statusText}`);
    }

    if (!/Total launches:\s+1/i.test(progressionText) || !/Level/i.test(progressionText)) {
      throw new Error(`Smoke failed: progression panel did not update.\n${progressionText}`);
    }

    if (!/Status/i.test(sessionText) || !/slot-1-run-1-round-1/i.test(sessionText)) {
      throw new Error(`Smoke failed: session contract did not materialize.\n${sessionText}`);
    }

    if (remoteBackendUrl && !/Remote/i.test(dataModeText)) {
      throw new Error(`Smoke failed: remote mode did not stay active.\n${dataModeText}`);
    }

    await page.getByRole("button", { name: "Copy Save Matrix" }).click();
    const profileJson = await page.locator("textarea.profile-textarea").inputValue();

    if (
      !/"activeSlotId": "slot-1"/.test(profileJson) ||
      !/"runsLaunched": 1/.test(profileJson) ||
      !/"totalRuns": 1/.test(profileJson)
    ) {
      throw new Error(`Smoke failed: save export payload is incomplete.\n${profileJson}`);
    }

    if (pageErrors.length > 0) {
      throw new Error(`Smoke failed with browser errors:\n${pageErrors.join("\n")}`);
    }

    await page.screenshot({ path: path.join(outputDir, "smoke-web.png"), fullPage: true });
    await writeFile(
      path.join(outputDir, "smoke-web.txt"),
      `${statusText}\n\nSESSION\n${sessionText}\n\nPROGRESSION\n${progressionText}\n\nDATA MODE\n${dataModeText}\n`,
    );
  } finally {
    await browser.close();
  }
}

async function stopStaticServer(server) {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function resolveCommand(command) {
  if (process.platform === "win32" && command === "pnpm") {
    return "pnpm.cmd";
  }

  return command;
}

async function listenForSmoke(server) {
  const preferredPort = configuredPort;
  const host = configuredHostname;

  try {
    return await listenOnce(server, preferredPort, host);
  } catch (error) {
    if (configuredSmokeUrl || error?.code !== "EADDRINUSE") {
      throw error;
    }

    return listenOnce(server, 0, host);
  }
}

async function listenOnce(server, port, host) {
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve smoke server address"));
        return;
      }

      resolve(address);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, host);
  });
}

function normalizeRequestPath(requestPath) {
  const sanitized = requestPath === "/" ? "/index.html" : requestPath;
  return sanitized.replace(/^\/+/, "");
}

async function statMaybe(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

function contentType(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".wasm":
      return "application/wasm";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

await main();
