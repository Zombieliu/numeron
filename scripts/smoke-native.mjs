#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "output", "playwright", "smoke-native");
const logFile = path.join(outputDir, "smoke-native.log");

const REQUIRED_PATTERNS = [
  /Creating new window Numeron/i,
  /Loading state 'numeron::GameState::Loading' is done/i,
];

const TIMEOUT_MS = 45_000;

async function main() {
  await mkdir(outputDir, { recursive: true });
  await writeFile(logFile, "", { flag: "w" });

  const child = spawn("cargo", ["run"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      RUST_LOG: process.env.RUST_LOG ?? "info",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let combinedOutput = "";
  let finished = false;

  const append = async (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    await writeFile(logFile, text, { flag: "a" });
  };

  child.stdout.on("data", (chunk) => {
    void append(chunk);
  });
  child.stderr.on("data", (chunk) => {
    void append(chunk);
  });

  const exitPromise = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      finished = true;
      resolve({ code, signal });
    });
  });

  const startedPromise = waitForPatterns(() => combinedOutput, REQUIRED_PATTERNS, TIMEOUT_MS);

  try {
    await startedPromise;
  } catch (error) {
    if (!finished) {
      child.kill("SIGTERM");
    }
    await exitPromise.catch(() => null);
    throw error;
  }

  if (!finished) {
    child.kill("SIGTERM");
  }

  const result = await exitPromise;
  if (result.code != null && result.code !== 0 && result.signal == null) {
    throw new Error(`cargo run exited with code ${result.code}\n${combinedOutput}`);
  }

  console.log("Native smoke passed.");
}

async function waitForPatterns(readOutput, patterns, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const output = readOutput();
    if (patterns.every((pattern) => pattern.test(output))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Timed out waiting for native smoke patterns.\nExpected: ${patterns
      .map((pattern) => pattern.toString())
      .join(", ")}\n\nOutput:\n${readOutput()}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
