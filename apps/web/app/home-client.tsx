"use client";

import { useEffect, useState } from "react";

import { GameShell } from "@/components/game-shell";

export function HomeClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <GameShell /> : null;
}
