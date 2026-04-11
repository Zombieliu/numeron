import { expect, test } from "@playwright/test";

import {
  REMOTE_BACKEND_URL,
  buyFirstOffer,
  clickByTestId,
  deployFirstBenchUnit,
  launchRuntime,
  openShell,
  pushRemoteProfile,
  setRemoteMode,
  switchToChinese,
  waitForRoundResolution,
} from "./helpers";

test("remote profile and session sync stays intact @remote", async ({ page }) => {
  await openShell(page);
  await setRemoteMode(page);
  await switchToChinese(page);

  await page.getByTestId("player-name-input").fill("Remote QA");
  await pushRemoteProfile(page);

  await expect.poll(fetchBackendSnapshot).toMatchObject({
    profiles: {
      "slot-1": {
        player_name: "Remote QA",
        locale: "zh-CN",
      },
    },
  });

  let snapshot = await fetchBackendSnapshot();
  expect(snapshot.profiles["slot-1"].player_name).toBe("Remote QA");
  expect(snapshot.profiles["slot-1"].locale).toBe("zh-CN");

  await launchRuntime(page);
  await buyFirstOffer(page);
  await deployFirstBenchUnit(page);
  await clickByTestId(page, "start-combat");
  await waitForRoundResolution(page);

  await expect.poll(fetchBackendSnapshot).toMatchObject({
    profiles: {
      "slot-1": {
        player_name: "Remote QA",
        locale: "zh-CN",
      },
    },
  });

  snapshot = await fetchBackendSnapshot();
  expect(snapshot.sessions.length).toBeGreaterThan(0);
  const activeSession = snapshot.sessions.find((session) => session.slot_id === "slot-1");
  expect(activeSession).toBeDefined();
  expect(activeSession?.player_name).toBe("Remote QA");
  expect(activeSession?.locale).toBe("zh-CN");
  expect(activeSession?.objective).toMatch(/[\u4e00-\u9fff]/);
  expect(snapshot.mode).toBe("headless-bevy");
});

async function fetchBackendSnapshot() {
  const response = await fetch(`${REMOTE_BACKEND_URL}/snapshot`);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote snapshot: ${response.status}`);
  }

  return response.json() as Promise<{
    mode: string;
    profiles: Record<string, { player_name: string; locale: string }>;
    sessions: Array<{
      slot_id: string;
      player_name: string;
      locale: string;
      objective: string;
    }>;
  }>;
}
