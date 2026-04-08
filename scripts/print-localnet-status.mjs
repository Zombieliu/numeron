#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const deployment = require("../packages/contracts/deployment.ts");
const { SuiClient, getFullnodeUrl } = await import(
  "../packages/contracts/node_modules/@0xobelisk/sui-client/dist/index.mjs"
);

const { Network, PackageId, DappStorageId, DappHubId, FrameworkPackageId } =
  deployment;

const client = new SuiClient({ url: getFullnodeUrl(Network) });

async function summarizeObject(id, label) {
  try {
    const result = await client.getObject({
      id,
      options: {
        showType: true,
        showOwner: true,
      },
    });
    const data = result?.data;
    const status = data ? "found" : "missing";
    const type = data?.type || data?.owner || "unknown";
    return `${label}: ${status}\n  id: ${id}\n  type: ${String(type)}`;
  } catch (error) {
    return `${label}: query failed\n  id: ${id}\n  error: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

const [packageSummary, storageSummary, hubSummary] = await Promise.all([
  summarizeObject(PackageId, "Package"),
  summarizeObject(DappStorageId, "DappStorage"),
  summarizeObject(DappHubId, "DappHub"),
]);

console.log(`[local:status] network: ${Network}`);
console.log(`[local:status] web: http://localhost:3000`);
console.log(`[local:status] framework: ${FrameworkPackageId}`);
console.log("");
console.log(packageSummary);
console.log("");
console.log(storageSummary);
console.log("");
console.log(hubSummary);
console.log("");
console.log("[local:status] handy checks:");
console.log(`  sui client object ${DappStorageId}`);
console.log(`  sui client object ${DappHubId}`);
console.log("  sui client object <UserStorageId>");
