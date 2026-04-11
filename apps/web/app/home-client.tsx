"use client";

import { useEffect, useState } from "react";

import { GameShell } from "@/components/game-shell";
import { isRuntimePreviewMode } from "@/lib/preview-mode";

export function HomeClient() {
  const [mounted, setMounted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    setPreviewMode(isRuntimePreviewMode());
    setMounted(true);
  }, []);

  return mounted ? <GameShell previewMode={previewMode} /> : null;
}
