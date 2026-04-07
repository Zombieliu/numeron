#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const staticDir = path.resolve(
  repoRoot,
  process.env.STATIC_SERVER_DIR ?? path.join("apps", "web", "out"),
);
const host = process.env.STATIC_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.STATIC_SERVER_PORT ?? "3100");

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

server.listen(port, host, () => {
  process.stdout.write(`Static shell listening on http://${host}:${port}\n`);
});

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
