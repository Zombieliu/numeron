"use client";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function normalizeFlag(value: string | null) {
  return value?.trim().toLowerCase() ?? null;
}

function isTrueFlag(value: string | null) {
  return value !== null && TRUE_VALUES.has(normalizeFlag(value) ?? "");
}

function isFalseFlag(value: string | null) {
  return value !== null && FALSE_VALUES.has(normalizeFlag(value) ?? "");
}

export function isRuntimePreviewMode() {
  if (typeof window === "undefined") {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const explicitPreview =
    params.get("preview") ?? params.get("qa") ?? params.get("shell");
  const explicitChain =
    params.get("chain") ?? params.get("worldCore") ?? params.get("full");

  if (isTrueFlag(explicitChain)) {
    return false;
  }

  if (isTrueFlag(explicitPreview)) {
    return true;
  }

  if (isFalseFlag(explicitPreview)) {
    return false;
  }

  return window.location.port === "3100";
}
