import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

const checks = [
  {
    file: "Cargo.toml",
    pattern: /^version = "([^"]+)"/m,
    expected: version,
  },
  {
    file: "server/headless_runtime/Cargo.toml",
    pattern: /^version = "([^"]+)"/m,
    expected: version,
  },
  {
    file: "mobile/Cargo.toml",
    pattern: /^version = "([^"]+)"/m,
    expected: version,
  },
  {
    file: "build/windows/installer/Package.wxs",
    pattern: /Version="([^"]+)"/,
    expected: version,
  },
  {
    file: "build/macos/src/Game.app/Contents/Info.plist",
    pattern: /<key>CFBundleShortVersionString<\/key>\s*<!-- Version -->\s*<string>([^<]+)<\/string>/m,
    expected: version,
  },
  {
    file: "mobile/ios-src/Info.plist",
    pattern: /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/m,
    expected: version,
  },
  {
    file: "mobile/ios-src/Info.plist",
    pattern: /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/m,
    expected: version,
  },
];

const mismatches = [];

for (const check of checks) {
  const source = fs.readFileSync(path.join(root, check.file), "utf8");
  const match = source.match(check.pattern);
  if (!match) {
    mismatches.push(`${check.file}: pattern not found`);
    continue;
  }

  const actual = match[1]?.trim();
  if (actual !== check.expected) {
    mismatches.push(`${check.file}: expected ${check.expected}, found ${actual}`);
  }
}

if (mismatches.length > 0) {
  console.error(`Version alignment failed for VERSION=${version}`);
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
}

console.log(`Version alignment OK for ${version}`);
