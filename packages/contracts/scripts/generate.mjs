import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, schemaGen } from "@0xobelisk/sui-common";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const configPath = path.join(packageRoot, "dubhe.config.ts");

const networkArg = process.argv[2];
const network =
  networkArg && networkArg !== "default"
    ? networkArg
    : process.env.DUBHE_NETWORK || "testnet";

const config = await loadConfig(configPath);
await schemaGen(packageRoot, config, network);

const dubheBin = path.join(packageRoot, "node_modules", ".bin", "dubhe");
execFileSync(
  dubheBin,
  [
    "convert-json",
    "--config-path",
    configPath,
    "--output-path",
    path.join(packageRoot, "dubhe.config.json"),
  ],
  {
    cwd: packageRoot,
    stdio: "inherit",
  },
);
