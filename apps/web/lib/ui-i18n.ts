import type {
  MatchSessionStatus,
  ProgressionBadge,
  RuntimeSnapshot,
  RuntimeTraitView,
  RuntimeUnitView,
} from "@/lib/types";

export type UiLocale = "en" | "zh-CN";

type UiCopy = {
  brand: string;
  title: string;
  subtitle: string;
  language: string;
  english: string;
  chineseSimplified: string;
  dataMode: string;
  backendUrl: string;
  pullRemote: string;
  pushActiveSlot: string;
  local: string;
  remote: string;
  localModeHint: string;
  remoteModeHint: string;
  launcher: string;
  playerName: string;
  touchHudEnabled: string;
  launchRuntime: string;
  battleControls: string;
  phase: string;
  gold: string;
  reroll: string;
  buyXp: string;
  bench: string;
  shop: string;
  deployCap: string;
  boardSlots: string;
  startCombat: string;
  nextRound: string;
  restartRun: string;
  prepHint: string;
  roundResolvedHint: string;
  runClosedHint: string;
  draftShop: string;
  rerollShop: string;
  lockShop: string;
  unlockShop: string;
  draftHint: string;
  lockedShopHint: string;
  openShopHint: string;
  benchPanel: string;
  sellBenchUnit: string;
  benchSelectedHint: string;
  benchIdleHint: string;
  deployCapReached: string;
  deployment: string;
  withdrawToBench: string;
  sellDeployedUnit: string;
  activeBoard: string;
  economy: string;
  nextIncome: string;
  baseIncome: string;
  interestIncome: string;
  streakIncome: string;
  streak: string;
  economyHint: string;
  synergies: string;
  enemyLineup: string;
  threat: string;
  intent: string;
  roster: string;
  rosterHint: string;
  status: string;
  statusSummary: string;
  runtimeActive: string;
  commander: string;
  boardSeed: string;
  boardObjective: string;
  roundState: string;
  runLabel: string;
  activeRun: string;
  result: string;
  sessionId: string;
  window: string;
  hp: string;
  sessionClosedHint: string;
  sessionRoundResolvedHint: string;
  sessionProgressingHint: string;
  runMeta: string;
  level: string;
  xp: string;
  battles: string;
  runsLaunched: string;
  bestBoardScore: string;
  noMilestones: string;
  operationsAndSaves: string;
  saveSlots: string;
  activeSlotLabel: string;
  lastRun: string;
  noArchivedSessions: string;
  runSnapshot: string;
  copySnapshot: string;
  loadSnapshot: string;
  resetActiveSlot: string;
  resetAllSaves: string;
  snapshotJson: string;
  snapshotPlaceholder: string;
  bootHistory: string;
  projection: string;
  ready: string;
  booting: string;
  boardSlice: string;
  activeUnits: string;
  activeSlot: string;
  quickActions: string;
  buy: string;
  best: string;
  roundShort: string;
  pointsShort: string;
  bootAwaitingRuntime: string;
  inProgress: string;
  remoteProfileSynced: (slotLabel: string) => string;
  remoteProfileSyncFailed: string;
  remoteSessionSynced: (sessionId: string) => string;
  remoteSessionSyncFailed: string;
  remotePullSummary: (sessions: number, profiles: number) => string;
  remotePullFailed: string;
  remotePushSummary: (tick: number, profiles: number, sessions: number) => string;
  remotePushFailed: string;
  activeSlotSwitched: (slotLabel: string) => string;
  resetSlot: (slotLabel: string) => string;
  resetAllSlots: string;
  snapshotCopied: string;
  snapshotPrepared: string;
  snapshotImported: string;
  snapshotImportFailed: string;
};

export const UI_COPY: Record<UiLocale, UiCopy> = {
  en: {
    brand: "Numeron",
    title: "Board Auto-Battler",
    subtitle:
      "React drives the product shell while Bevy owns the shared combat runtime for web and native.",
    language: "Language",
    english: "English",
    chineseSimplified: "简体中文",
    dataMode: "Data Mode",
    backendUrl: "Backend URL",
    pullRemote: "Pull Remote",
    pushActiveSlot: "Push Active Slot",
    local: "Local",
    remote: "Remote",
    localModeHint: "Shell data stays browser-local.",
    remoteModeHint:
      "Shell profile and session state sync with the optional headless backend.",
    launcher: "Launcher",
    playerName: "Player Name",
    touchHudEnabled: "Touch HUD enabled",
    launchRuntime: "Launch Runtime",
    battleControls: "Battle Controls",
    phase: "Phase",
    gold: "Gold",
    reroll: "Reroll",
    buyXp: "Buy XP",
    bench: "Bench",
    shop: "Shop",
    deployCap: "Deploy Cap",
    boardSlots: "board slots",
    startCombat: "Start Combat",
    nextRound: "Next Round",
    restartRun: "Restart Run",
    prepHint: "Build during prep, then hand the board to combat.",
    roundResolvedHint: "Round resolved. Advance when you are ready.",
    runClosedHint: "This climb is over. Start a new run to continue testing.",
    draftShop: "Draft Shop",
    rerollShop: "Reroll Shop",
    lockShop: "Lock Shop",
    unlockShop: "Unlock Shop",
    draftHint:
      "Buying sends units to the bench. Deploy them into open board slots before combat.",
    lockedShopHint: "Locked offers carry into the next round.",
    openShopHint: "Open shops refresh when the next round begins.",
    benchPanel: "Bench",
    sellBenchUnit: "Sell Bench Unit",
    benchSelectedHint:
      "Bench unit selected. Click an empty deployment slot to place it.",
    benchIdleHint: "Select a benched unit to prepare a deployment.",
    deployCapReached: "Level up first to deploy another unit.",
    deployment: "Deployment",
    withdrawToBench: "Withdraw To Bench",
    sellDeployedUnit: "Sell Deployed Unit",
    activeBoard: "Active board",
    economy: "Economy",
    nextIncome: "Next Income",
    baseIncome: "Base",
    interestIncome: "Interest",
    streakIncome: "Streak Bonus",
    streak: "Streak",
    economyHint:
      "Interest previews off current gold, and streak bonus grows on both wins and losses.",
    synergies: "Synergies",
    enemyLineup: "Enemy Lineup",
    threat: "Threat",
    intent: "Intent",
    roster: "Roster",
    rosterHint:
      "Numeron now runs an eight-unit opening pool so real shop and composition decisions show up early.",
    status: "Status",
    statusSummary:
      "Current runtime supports lockable shops, leveling, streak/interest economy, visible skill cadence, and restartable runs.",
    runtimeActive: "Runtime active",
    commander: "Commander",
    boardSeed: "Board Seed",
    boardObjective: "Board objective",
    roundState: "Round state",
    runLabel: "Run",
    activeRun: "Active Run",
    result: "Result",
    sessionId: "Session id",
    window: "Window",
    hp: "HP",
    sessionClosedHint: "The current run is closed. Restart to open a fresh session.",
    sessionRoundResolvedHint: "Round resolved but the run is still live.",
    sessionProgressingHint: "Current session is still progressing.",
    runMeta: "Run Meta",
    level: "Level",
    xp: "XP",
    battles: "Battles",
    runsLaunched: "Runs launched",
    bestBoardScore: "Best board score",
    noMilestones: "No milestones unlocked yet.",
    operationsAndSaves: "Operations & Saves",
    saveSlots: "Save Slots",
    activeSlotLabel: "Active Slot Label",
    lastRun: "Last run",
    noArchivedSessions: "No archived sessions yet.",
    runSnapshot: "Run Snapshot",
    copySnapshot: "Copy Snapshot",
    loadSnapshot: "Load Snapshot",
    resetActiveSlot: "Reset Active Slot",
    resetAllSaves: "Reset All Saves",
    snapshotJson: "Snapshot JSON",
    snapshotPlaceholder:
      "Exported Numeron run snapshot JSON appears here. Paste a payload to import.",
    bootHistory: "Boot History",
    projection: "Projection",
    ready: "ready",
    booting: "booting",
    boardSlice: "Board Slice",
    activeUnits: "active units",
    activeSlot: "Active Slot",
    quickActions: "Quick Actions",
    buy: "Buy",
    best: "Best",
    roundShort: "R",
    pointsShort: "pts",
    bootAwaitingRuntime: "awaiting runtime",
    inProgress: "in-progress",
    remoteProfileSynced: (slotLabel) => `Remote profile synced for ${slotLabel}.`,
    remoteProfileSyncFailed: "Remote profile sync failed.",
    remoteSessionSynced: (sessionId) => `Remote session synced: ${sessionId}.`,
    remoteSessionSyncFailed: "Remote session sync failed.",
    remotePullSummary: (sessions, profiles) =>
      `Pulled ${sessions} session(s) and ${profiles} profile(s) from remote.`,
    remotePullFailed: "Remote pull failed.",
    remotePushSummary: (tick, profiles, sessions) =>
      `Remote push complete. tick=${tick}, profiles=${profiles}, sessions=${sessions}.`,
    remotePushFailed: "Remote push failed.",
    activeSlotSwitched: (slotLabel) => `Active slot switched to ${slotLabel}.`,
    resetSlot: (slotLabel) => `Reset ${slotLabel} to template defaults.`,
    resetAllSlots: "Reset all save slots and progression data.",
    snapshotCopied: "Save matrix JSON copied to clipboard.",
    snapshotPrepared: "Save matrix JSON prepared below. Copy manually if needed.",
    snapshotImported: "Save matrix imported from JSON.",
    snapshotImportFailed: "Save matrix import failed. Check the JSON payload.",
  },
  "zh-CN": {
    brand: "Numeron",
    title: "自走棋战斗原型",
    subtitle:
      "React 负责产品壳层，Bevy 负责 Web 与 Native 共用的战斗 runtime。",
    language: "语言",
    english: "English",
    chineseSimplified: "简体中文",
    dataMode: "数据模式",
    backendUrl: "后端地址",
    pullRemote: "拉取远端",
    pushActiveSlot: "推送当前存档",
    local: "本地",
    remote: "远端",
    localModeHint: "当前 shell 数据仅保存在浏览器本地。",
    remoteModeHint: "当前 profile 与 session 会同步到可选的 headless 后端。",
    launcher: "启动器",
    playerName: "玩家名称",
    touchHudEnabled: "启用触屏 HUD",
    launchRuntime: "启动 Runtime",
    battleControls: "战斗控制",
    phase: "阶段",
    gold: "金币",
    reroll: "刷新",
    buyXp: "购买经验",
    bench: "备战席",
    shop: "商店",
    deployCap: "人口上限",
    boardSlots: "棋盘槽位",
    startCombat: "开始战斗",
    nextRound: "下一回合",
    restartRun: "重新开局",
    prepHint: "准备阶段先布阵，再把棋盘交给战斗。",
    roundResolvedHint: "本回合已结算，可以继续下一回合。",
    runClosedHint: "这局已经结束，想继续测试请重新开局。",
    draftShop: "招募商店",
    rerollShop: "刷新商店",
    lockShop: "锁定商店",
    unlockShop: "解锁商店",
    draftHint: "购买后的单位会先进入备战席，战斗前再部署到棋盘。",
    lockedShopHint: "锁定后的商店会带到下一回合。",
    openShopHint: "未锁定的商店会在下一回合开始时刷新。",
    benchPanel: "备战席",
    sellBenchUnit: "出售备战单位",
    benchSelectedHint: "已选中备战单位，点击空部署位即可上场。",
    benchIdleHint: "先选择一个备战单位，再准备部署。",
    deployCapReached: "先升级人口上限，才能继续部署。",
    deployment: "部署区",
    withdrawToBench: "撤回到备战席",
    sellDeployedUnit: "出售上场单位",
    activeBoard: "当前上场",
    economy: "经济",
    nextIncome: "下回合收入",
    baseIncome: "基础",
    interestIncome: "利息",
    streakIncome: "连胜连败加成",
    streak: "连胜连败",
    economyHint: "利息按当前金币预览，连胜与连败都会带来额外收入。",
    synergies: "羁绊",
    enemyLineup: "敌方阵容",
    threat: "威胁值",
    intent: "意图",
    roster: "单位池",
    rosterHint: "Numeron 现在有 8 个起始单位，可以开始测试真正的商店与阵容决策。",
    status: "状态",
    statusSummary:
      "当前 runtime 已支持锁店、等级与经济层、敌方预判、技能节奏显示，以及可重开的 run。",
    runtimeActive: "Runtime 状态",
    commander: "指挥官",
    boardSeed: "棋盘单位",
    boardObjective: "当前目标",
    roundState: "回合状态",
    runLabel: "局数",
    activeRun: "当前对局",
    result: "结果",
    sessionId: "会话 ID",
    window: "时间窗口",
    hp: "生命",
    sessionClosedHint: "当前 run 已结束，重新开局后会生成新的 session。",
    sessionRoundResolvedHint: "当前回合已结算，但整局还没有结束。",
    sessionProgressingHint: "当前 session 仍在进行中。",
    runMeta: "成长信息",
    level: "等级",
    xp: "经验",
    battles: "战斗次数",
    runsLaunched: "已开局次数",
    bestBoardScore: "最佳得分",
    noMilestones: "还没有解锁任何里程碑。",
    operationsAndSaves: "运维与存档",
    saveSlots: "存档槽",
    activeSlotLabel: "当前槽位名称",
    lastRun: "上一局",
    noArchivedSessions: "还没有归档的历史局。",
    runSnapshot: "运行快照",
    copySnapshot: "复制快照",
    loadSnapshot: "加载快照",
    resetActiveSlot: "重置当前槽位",
    resetAllSaves: "重置全部存档",
    snapshotJson: "快照 JSON",
    snapshotPlaceholder: "导出的 Numeron 快照会出现在这里。也可以粘贴 JSON 进行导入。",
    bootHistory: "启动历史",
    projection: "投影",
    ready: "已就绪",
    booting: "启动中",
    boardSlice: "棋盘切片",
    activeUnits: "活跃单位",
    activeSlot: "当前槽位",
    quickActions: "快捷操作",
    buy: "购买",
    best: "最佳",
    roundShort: "回合",
    pointsShort: "分",
    bootAwaitingRuntime: "等待 runtime",
    inProgress: "进行中",
    remoteProfileSynced: (slotLabel) => `已将 ${slotLabel} 的 profile 同步到远端。`,
    remoteProfileSyncFailed: "远端 profile 同步失败。",
    remoteSessionSynced: (sessionId) => `远端 session 已同步：${sessionId}。`,
    remoteSessionSyncFailed: "远端 session 同步失败。",
    remotePullSummary: (sessions, profiles) =>
      `已从远端拉取 ${sessions} 个 session 与 ${profiles} 个 profile。`,
    remotePullFailed: "远端拉取失败。",
    remotePushSummary: (tick, profiles, sessions) =>
      `远端推送完成。tick=${tick}，profiles=${profiles}，sessions=${sessions}。`,
    remotePushFailed: "远端推送失败。",
    activeSlotSwitched: (slotLabel) => `当前槽位已切换到 ${slotLabel}。`,
    resetSlot: (slotLabel) => `已将 ${slotLabel} 重置为默认模板。`,
    resetAllSlots: "已重置全部存档与成长数据。",
    snapshotCopied: "存档矩阵 JSON 已复制到剪贴板。",
    snapshotPrepared: "存档矩阵 JSON 已准备好，请手动复制。",
    snapshotImported: "存档矩阵 JSON 已导入。",
    snapshotImportFailed: "存档矩阵导入失败，请检查 JSON 内容。",
  },
};

export function getUiCopy(locale: UiLocale) {
  return UI_COPY[locale];
}

export function formatFactionLabel(
  faction: RuntimeUnitView["faction"] | RuntimeTraitView["key"],
  locale: UiLocale,
) {
  switch (faction) {
    case "dawn":
      return locale === "zh-CN" ? "黎明" : "Dawn";
    case "dusk":
      return locale === "zh-CN" ? "黄昏" : "Dusk";
    case "vanguard":
      return locale === "zh-CN" ? "前排" : "Vanguard";
    case "skirmisher":
      return locale === "zh-CN" ? "游击" : "Skirmisher";
  }
}

export function formatRoleLabel(role: RuntimeUnitView["role"], locale: UiLocale) {
  return role === "vanguard"
    ? locale === "zh-CN"
      ? "前排"
      : "Vanguard"
    : locale === "zh-CN"
      ? "游击"
      : "Skirmisher";
}

export function formatBadgeLabel(badge: ProgressionBadge, locale: UiLocale) {
  if (locale === "zh-CN") {
    switch (badge) {
      case "first-launch":
        return "首次启动";
      case "first-sweep":
        return "首次战斗";
      case "score-300":
        return "300 分";
      case "loop-3":
        return "第 3 轮";
    }
  }

  switch (badge) {
    case "first-launch":
      return "First Launch";
    case "first-sweep":
      return "First Battle";
    case "score-300":
      return "Score 300";
    case "loop-3":
      return "Loop 3";
  }
}

export function formatPhaseLabel(
  phase: RuntimeSnapshot["world"]["slice"]["phase"],
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (phase) {
      case "preparation":
        return "准备";
      case "combat":
        return "战斗";
      case "resolution":
        return "结算";
    }
  }

  switch (phase) {
    case "preparation":
      return "Prep";
    case "combat":
      return "Combat";
    case "resolution":
      return "Resolution";
  }
}

export function formatRunResult(
  result: RuntimeSnapshot["world"]["slice"]["runResult"],
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (result) {
      case "victory":
        return "胜利";
      case "defeat":
        return "失败";
      default:
        return "进行中";
    }
  }

  switch (result) {
    case "victory":
      return "Victory";
    case "defeat":
      return "Defeat";
    default:
      return "Active";
  }
}

export function formatSessionStatus(
  status: MatchSessionStatus,
  locale: UiLocale,
) {
  if (locale === "zh-CN") {
    switch (status) {
      case "staging":
        return "布阵中";
      case "live":
        return "战斗中";
      case "completed":
        return "已结束";
    }
  }

  switch (status) {
    case "staging":
      return "staging";
    case "live":
      return "live";
    case "completed":
      return "completed";
  }
}

export function localizeBootMessage(message: string, locale: UiLocale) {
  return translateExact(message, locale, {
    "Configure the shell, then launch the runtime.": "先配置壳层，再启动 runtime。",
    "Loading Bevy WASM runtime module": "正在加载 Bevy WASM runtime 模块",
    "Initializing generated wasm glue": "正在初始化生成的 wasm glue",
    "Binding shell boot listener to the runtime": "正在把 shell 启动监听器绑定到 runtime",
    "Rust runtime entry reached for the Next.js shell":
      "已进入供 Next.js 壳层使用的 Rust runtime 入口",
    "Bevy app allocated": "Bevy app 已分配",
    "Shared runtime app bootstrap and plugins configured":
      "共享 runtime app 启动和插件已配置",
    "Handing off to the Bevy app loop": "已切入 Bevy app 主循环",
    "Numeron board slice allocated": "Numeron 棋盘切片已分配",
    "Runtime package loaded, but boot entry is missing.":
      "Runtime 包已加载，但缺少启动入口。",
  });
}

export function localizeRuntimeText(text: string, locale: UiLocale) {
  if (locale === "en") {
    return text;
  }

  const exact = translateExact(text, locale, {
    "Stand up the first Numeron board slice.": "先跑通第一版 Numeron 棋盘切片。",
    "Waiting for board allocation.": "等待棋盘分配。",
    "Draft a compact squad, manage a lockable shop, and survive scaling enemy rounds with readable skill cadence.":
      "组建一支紧凑阵容，管理可锁定商店，并在不断增强的敌方回合中依靠可读的技能节奏存活。",
    "Awaiting board allocation.": "等待棋盘分配。",
    "Board ready. Draft another unit or start combat.":
      "棋盘已就绪。可以继续招募单位，或直接开始战斗。",
    "Bench primed. Deploy a unit before opening combat.":
      "备战席已就绪。开始战斗前先部署一个单位。",
    "Shop rerolled. Draft before combat starts.": "商店已刷新。战斗前先完成招募。",
    "Shop lock engaged. Current offers will carry into the next round.":
      "商店已锁定，当前招募项会保留到下一回合。",
    "Shop lock released. Next round will refresh the offers.":
      "商店已解锁，下一回合开始时会刷新。",
    "Scout squad: two bruisers test the board.": "侦查小队：两名前排先来试探棋盘。",
    "Pressure spike: a third body joins the enemy lane.":
      "压力上升：敌方加入第三个单位。",
    "First elite spike: the lead duelist upgrades to two stars.":
      "第一次精英强化：主力决斗者提升到两星。",
    "Frontline hardens: Iron Vanguard upgrades and soaks damage.":
      "前线变硬：钢铁先锋升级后更能抗伤。",
    "Mixed threat: the enemy swaps in a ranged Signal Ranger.":
      "混合威胁：敌方换上远程信号射手。",
    "Veteran warband: upgraded mixed comp with stronger pressure.":
      "老练战帮：升级后的混编阵容会带来更强压力。",
  });

  if (exact !== text) {
    return exact;
  }

  let match = text.match(/^Launching local slice for (.+)$/);
  if (match) {
    return `正在为 ${match[1]} 启动本地切片`;
  }

  match = text.match(/^Combat started\. (\d+) allied units engage (\d+) enemies\.$/);
  if (match) {
    return `战斗开始。${match[1]} 名友军正在迎战 ${match[2]} 名敌军。`;
  }

  match = text.match(
    /^Round (\d+) ready\. Locked shop carried forward\. Draft or reposition before combat\.$/,
  );
  if (match) {
    return `第 ${match[1]} 回合已就绪。锁定商店已保留，战斗前可以继续招募或调整站位。`;
  }

  match = text.match(/^Round (\d+) ready\. Draft, merge, or reposition before combat\.$/);
  if (match) {
    return `第 ${match[1]} 回合已就绪。战斗前可以继续招募、合成或调整站位。`;
  }

  match = text.match(/^Drafted (.+) to bench\. Bench now holds (\d+) units\.(.*)$/);
  if (match) {
    return `已将 ${match[1]} 招募到备战席。当前备战席共有 ${match[2]} 个单位。${translateMergeTail(
      match[3],
    )}`;
  }

  match = text.match(/^Deployed (.+) into slot (\d+)\.(.*)$/);
  if (match) {
    return `已将 ${match[1]} 部署到槽位 ${match[2]}。${translateMergeTail(match[3])}`;
  }

  match = text.match(/^Returned (.+) to bench from slot (\d+)\.(.*)$/);
  if (match) {
    return `已将 ${match[1]} 从槽位 ${match[2]} 撤回到备战席。${translateMergeTail(match[3])}`;
  }

  match = text.match(/^Sold (.+) for (\d+) gold\.$/);
  if (match) {
    return `已出售 ${match[1]}，获得 ${match[2]} 金币。`;
  }

  match = text.match(/^Sold (.+) from slot (\d+) for (\d+) gold\.$/);
  if (match) {
    return `已出售槽位 ${match[2]} 的 ${match[1]}，获得 ${match[3]} 金币。`;
  }

  match = text.match(
    /^Victory\. Enemy board collapsed\. Click Next Round to continue to round (\d+)\.$/,
  );
  if (match) {
    return `胜利。敌方棋盘已崩溃。点击“下一回合”进入第 ${match[1]} 回合。`;
  }

  match = text.match(/^Defeat\. (\d+) enemies survived\. Click Next Round to rebuild\.$/);
  if (match) {
    return `失败。还有 ${match[1]} 个敌人存活。点击“下一回合”重新布阵。`;
  }

  match = text.match(
    /^Run clear\. Round (\d+) collapsed the final enemy squad\. Restart to begin a new climb\.$/,
  );
  if (match) {
    return `通关。第 ${match[1]} 回合击溃了最后一支敌军。重新开局即可开始新的爬塔。`;
  }

  match = text.match(
    /^Run over\. (\d+) enemies survived the last fight and the commander fell\. Restart to try again\.$/,
  );
  if (match) {
    return `本局结束。最后一战仍有 ${match[1]} 个敌人存活，指挥官已经倒下。重新开局后再试一次。`;
  }

  match = text.match(/^Combat underway\. (\d+) allied units vs (\d+) enemies\.(.*)$/);
  if (match) {
    return `战斗进行中。${match[1]} 名友军对阵 ${match[2]} 名敌军。${translateCombatTail(
      match[3],
    )}`;
  }

  return text;
}

function translateExact(
  value: string,
  locale: UiLocale,
  zhMap: Record<string, string>,
) {
  if (locale === "en") {
    return value;
  }

  return zhMap[value] ?? value;
}

function translateMergeTail(tail: string) {
  return tail.replace(
    /Merged three (.+) copies into (.+)\./g,
    "已将三个 $1 合成为 $2。",
  );
}

function translateCombatTail(tail: string) {
  return tail
    .replace(/Verdant Bruiser/g, "翠卫斗士")
    .replace(/Signal Ranger/g, "信号射手")
    .replace(/Ash Duelist/g, "灰烬决斗者")
    .replace(/Iron Vanguard/g, "钢铁先锋")
    .replace(/ hit /g, " 命中 ")
    .replace(/ for /g, " 造成 ")
    .replace(/Bulwark Bash landed heavy\./g, "壁垒重击已触发。")
    .replace(/Piercing Volley broke through\./g, "穿透齐射已打穿前线。")
    .replace(/Execution Arc punished a weakened target\./g, "处决弧刃命中了残血目标。")
    .replace(/Anchor Strike cracked the enemy line\./g, "锚定打击撕开了敌方前线。");
}
