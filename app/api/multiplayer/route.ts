import { getDb } from "../../../db";
import type { RoomRow, RoomUpdate } from "../../../db";
import { activatePendingTransferLoans, addHistory, addStarXIPlayer, advanceCupMatch, applyCupSubstitution, beginCupMatch, beginSeasonCupMatch, canStarXIPlayerFillSlot, completeTournamentRun, CUP_STRATEGIES, drawRandomStarXICustomCard, finishActiveTransferLoans, getCupStrategy, getGoalBoostedPassiveReward, getGoalBoostMultiplier, getMissionProgress, getOpenTransferSquadVacancies, getRandomEventDelay, getStarFormation, getStarPack, getStarXIEffectiveMatchRating, getStarXIPlayer, getStarXIPositions, getStarXISelection, getStarXIRating, getTournament, getTournamentGoalBoostMultiplier, getTransferBonuses, getUnavailableStarXIPlayerIds, initialGameFeatures, normalizeGameFeatures, openStarPack, pauseGameFeatureTimers, recordSeasonModeMatch, resolveCupPenalty, resolveRandomEvent, resolveTransferInsiderEvent, resolveVarEvent, restoreStarXIAfterMatch, resumeCupMatch, setBestStarXI, setStarXIBenchPlayer, setStarXIFormation, setStarXIStarter, shouldTriggerPackTroll, startSeasonPrestige, startTournamentGoalBoost, STAR_FORMATIONS, STAR_XI_BENCH_SIZE, STAR_XI_MAX_SUBSTITUTIONS, STAR_XI_RANDOM_CUSTOM_CARD_COST, STAR_XI_SQUAD_SIZE } from "../../feature-data";
import type { GameFeatures, PenaltyDirection, StarFormationId, StarPackReveal } from "../../feature-data";
import { isSupportedMultiplayerProtocol, MULTIPLAYER_UPDATE_MESSAGE } from "../../multiplayer-protocol";
import { getFormationUnlockSeason, getPackUnlockSeason, getTournamentUnlockSeason, getUpgradeUnlockSeason, isSeasonContentUnlocked, MAX_CAREER_SEASON } from "../../season-progression";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "../../upgrade-purchase";

const MAX_NAME_LENGTH = 18;
const MAX_ROOM_NAME_LENGTH = 28;
const MAX_PLAYER_ID_LENGTH = 80;
const MAX_MULTIPLIER_LEVEL = 8;
const MAX_SEASON_STARS = 20;
const BALANCE_VERSION = 4;
const MINI_GAME_COOLDOWN_SECONDS: Record<string, number> = { penalty: 60, dribble: 75, crossbar: 90, prediction: 120 };
const PRESENCE_TIMEOUT_MS = 180000;
const SIMULATION_LEADER_TIMEOUT_MS = 5000;
const PASSIVE_BACKGROUND_GRACE_MS = 24 * 60 * 60 * 1000;
const TRANSFER_MARKET_CLOSED_MESSAGE = "Der Transfermarkt ist geschlossen. Fabrizio Romario bleibt aktiv.";
// Temporärer Schalter: auf true setzen, um neue AZB Einlösungen wieder zu erlauben.
const AZB_CODE_ENABLED = false;

const UPGRADES: Record<string, { name: string; description: string; baseCost: number; scale: number; kind: string }> = {
  boots: { name: "Schnellere Stiefel", description: "+1 Tor pro Klick", baseCost: 25, scale: 1.22, kind: "click" },
  ballboy: { name: "Balljunge", description: "+1 Tor pro Sekunde", baseCost: 120, scale: 1.2, kind: "auto" },
  technique: { name: "Schusstechnik", description: "+3 Tore pro Klick", baseCost: 260, scale: 1.24, kind: "click" },
  instinct: { name: "Torinstinkt", description: "+5 Tore pro Klick", baseCost: 1400, scale: 1.26, kind: "click" },
  coach: { name: "Taktiktafel", description: "+15 Tore pro Sekunde", baseCost: 3500, scale: 1.23, kind: "auto" },
  striker: { name: "Killerstürmer", description: "+10 Tore pro Klick", baseCost: 7500, scale: 1.28, kind: "click" },
  academy: { name: "Nachwuchsakademie", description: "+60 Tore pro Sekunde", baseCost: 12500, scale: 1.25, kind: "auto" },
  floodlight: { name: "Flutlichtanlage", description: "+300 Tore pro Sekunde", baseCost: 55000, scale: 1.27, kind: "auto" },
  longshot: { name: "Distanzschütze", description: "+25 Tore pro Klick", baseCost: 75000, scale: 1.3, kind: "click" },
  scout: { name: "Talent-Scouting", description: "+1.200 Tore pro Sekunde", baseCost: 200000, scale: 1.29, kind: "auto" },
  var: { name: "VAR 2.0", description: "+10.000 Tore pro Sekunde", baseCost: 400000, scale: 1.3, kind: "auto" },
  freekick: { name: "Freistoss-Spezialist", description: "+50 Tore pro Klick", baseCost: 750000, scale: 1.32, kind: "click" },
  stadium: { name: "Arena-Ausbau", description: "+50.000 Tore pro Sekunde", baseCost: 2000000, scale: 1.32, kind: "auto" },
  worldclass: { name: "Weltklasse-Abschluss", description: "+100 Tore pro Klick", baseCost: 7500000, scale: 1.34, kind: "click" },
  broadcast: { name: "Weltweite Übertragung", description: "+250.000 Tore pro Sekunde", baseCost: 8000000, scale: 1.34, kind: "auto" },
  sponsor: { name: "Globaler Sponsor", description: "+1,2 Millionen Tore pro Sekunde", baseCost: 35000000, scale: 1.36, kind: "auto" },
  ballondor: { name: "Ballon-d'Or-Angreifer", description: "+250 Tore pro Klick", baseCost: 75000000, scale: 1.38, kind: "click" },
  superclub: { name: "Superclub-Netzwerk", description: "+6 Millionen Tore pro Sekunde", baseCost: 180000000, scale: 1.38, kind: "auto" },
  captain: { name: "Kapitänsbinde", description: "+500 Tore pro Klick", baseCost: 350000000, scale: 1.42, kind: "click" },
  golden: { name: "Goldener Schuh", description: "+10% Klickpower", baseCost: 900000000, scale: 1.58, kind: "multiplier" },
  legacy: { name: "Vereins-Dynastie", description: "+5% auf alle Einnahmen", baseCost: 6000000000, scale: 1.68, kind: "multiplier" },
};

const ACHIEVEMENT_THRESHOLDS: Record<string, number> = {
  first: 1,
  hundred: 100,
  thousand: 1000,
  tenK: 10000,
  hundredK: 100000,
  million: 1000000,
  tenMillion: 10000000,
  hundredMillion: 100000000,
  billion: 1000000000,
  tenBillion: 10000000000,
  hundredBillion: 100000000000,
  trillion: 1000000000000,
  dynasty: 1000000000000000,
};

type MiniGameCooldowns = Record<string, number>;
type CoopGameState = {
  goals: number;
  totalGoals: number;
  seasonGoals: number;
  clicks: number;
  upgrades: Record<string, number>;
  achievements: string[];
  stars: number;
  seasons: number;
  balanceVersion: number;
  sound: boolean;
  lastSaved: number;
  miniGameCooldowns: MiniGameCooldowns;
  minigameWins: number;
  features: GameFeatures;
};
const COOP_ROLES = ["host", "guest", "player3", "player4"] as const;
type CoopRole = typeof COOP_ROLES[number];
type CoopRoomUpdate = RoomUpdate;

function getRoomPlayer(room: RoomRow, role: CoopRole) {
  if (role === "host") return { role, playerId: room.hostPlayerId, name: room.hostName, lastSeenAt: room.hostLastSeenAt, goals: room.hostGoals, clicks: room.hostClicks };
  if (role === "guest") return { role, playerId: room.guestPlayerId, name: room.guestName, lastSeenAt: room.guestLastSeenAt, goals: room.guestGoals, clicks: room.guestClicks };
  if (role === "player3") return { role, playerId: room.player3PlayerId, name: room.player3Name, lastSeenAt: room.player3LastSeenAt, goals: room.player3Goals, clicks: room.player3Clicks };
  return { role, playerId: room.player4PlayerId, name: room.player4Name, lastSeenAt: room.player4LastSeenAt, goals: room.player4Goals, clicks: room.player4Clicks };
}

function getRoomPlayers(room: RoomRow) {
  return COOP_ROLES.map((role) => getRoomPlayer(room, role));
}

function getOccupiedRoomPlayers(room: RoomRow) {
  return getRoomPlayers(room).filter((player) => Boolean(player.playerId));
}

function roleIdentityUpdate(role: CoopRole, playerId: string, name: string, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostPlayerId: playerId, hostName: name, hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestPlayerId: playerId, guestName: name, guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3PlayerId: playerId, player3Name: name, player3LastSeenAt: lastSeenAt };
  return { player4PlayerId: playerId, player4Name: name, player4LastSeenAt: lastSeenAt };
}

function rolePresenceUpdate(role: CoopRole, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3LastSeenAt: lastSeenAt };
  return { player4LastSeenAt: lastSeenAt };
}

function roomPlayerName(room: RoomRow, role: CoopRole) {
  return getRoomPlayer(room, role).name ?? "Mitspieler";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH) : "";
}

function cleanRoomName(value: unknown, fallback = "Meine Welt") {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_ROOM_NAME_LENGTH) : "";
  return cleaned || fallback;
}

function cleanPlayerId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_PLAYER_ID_LENGTH) : "";
}

function cleanCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 6) : "";
}

function makeRoomCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function initialCooldowns(): MiniGameCooldowns {
  return { penalty: 0, dribble: 0, crossbar: 0, prediction: 0 };
}

function normalizeCooldowns(value: unknown): MiniGameCooldowns {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = initialCooldowns();
  for (const id of Object.keys(result)) result[id] = Math.max(0, finite(source[id]));
  return result;
}

function normalizeUpgrades(value: unknown): Record<string, number> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, number> = {};
  for (const [id, rawLevel] of Object.entries(source)) {
    const level = Math.max(0, Math.floor(finite(rawLevel)));
    result[id] = id === "golden" || id === "legacy" ? Math.min(MAX_MULTIPLIER_LEVEL, level) : level;
  }
  return result;
}

function initialGame(): CoopGameState {
  return {
    goals: 0,
    totalGoals: 0,
    seasonGoals: 0,
    clicks: 0,
    upgrades: {},
    achievements: [],
    stars: 0,
    seasons: 0,
    balanceVersion: BALANCE_VERSION,
    sound: true,
    lastSaved: Date.now(),
    miniGameCooldowns: initialCooldowns(),
    minigameWins: 0,
    features: initialGameFeatures(),
  };
}

function readGame(row: RoomRow): CoopGameState {
  const storedUpgrades = parseJson<Record<string, number>>(row.sharedUpgradesJson, {});
  const storedCooldowns = parseJson<MiniGameCooldowns>(row.sharedMiniGameCooldownsJson, {});
  const backupGame = parseJson<Partial<CoopGameState>>(row.sharedStateBackupJson, {});
  const primaryFeatures = parseJson<unknown>(row.sharedFeaturesJson, undefined);
  const primaryFeatureRecord = primaryFeatures && typeof primaryFeatures === "object" && !Array.isArray(primaryFeatures) ? primaryFeatures as Record<string, unknown> : {};
  const storedFeatures = Object.keys(primaryFeatureRecord).length ? primaryFeatures : backupGame.features;
  const legacyRoom = row.sharedUpgradesJson === "{}" && row.sharedTotalGoals === 0 && row.sharedSeasonGoals === 0 && row.sharedCoins > 0;
  const legacyTotal = Math.max(row.sharedCoins, row.hostGoals + row.guestGoals + row.player3Goals + row.player4Goals);
  const game = initialGame();
  game.goals = Math.max(0, finite(row.sharedCoins));
  game.totalGoals = Math.max(0, finite(row.sharedTotalGoals || (legacyRoom ? legacyTotal : 0)));
  game.seasonGoals = Math.max(0, finite(row.sharedSeasonGoals || (legacyRoom ? legacyTotal : 0)));
  game.clicks = Math.max(0, Math.floor(row.hostClicks + row.guestClicks + row.player3Clicks + row.player4Clicks));
  game.upgrades = normalizeUpgrades(storedUpgrades);
  const storedAchievements = parseJson<unknown>(row.sharedAchievementsJson, []);
  game.achievements = Array.isArray(storedAchievements) ? storedAchievements.filter((value): value is string => typeof value === "string") : [];
  game.stars = Math.max(0, Math.min(MAX_SEASON_STARS, Math.floor(finite(row.sharedStars))));
  game.seasons = Math.max(0, Math.floor(finite(row.sharedSeasons)));
  game.miniGameCooldowns = normalizeCooldowns(storedCooldowns);
  game.minigameWins = Math.max(0, Math.floor(finite(row.sharedMinigameWins)));
  game.features = normalizeGameFeatures(storedFeatures);
  unlockAchievements(game);
  return game;
}

function unlockAchievements(game: CoopGameState) {
  const unlocked = new Set(game.achievements);
  for (const [id, threshold] of Object.entries(ACHIEVEMENT_THRESHOLDS)) if (game.totalGoals >= threshold) unlocked.add(id);
  game.achievements = [...unlocked];
}

function getLevel(upgrades: Record<string, number>, id: string) {
  return upgrades[id] ?? 0;
}

function getCostAtLevel(id: string, level: number) {
  const upgrade = UPGRADES[id];
  if (!upgrade) return Infinity;
  return getUpgradeCostAtLevel(upgrade, level, MAX_MULTIPLIER_LEVEL);
}

function getIncomeMultiplier(upgrades: Record<string, number>, stars: number) {
  return (1 + Math.min(MAX_SEASON_STARS, Math.max(0, stars)) * 0.02) * 1.05 ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, "legacy"));
}

function getBaseClickPower(upgrades: Record<string, number>, stars: number, features: GameFeatures) {
  const flat = 1 + getLevel(upgrades, "boots") + getLevel(upgrades, "technique") * 3 + getLevel(upgrades, "instinct") * 5 + getLevel(upgrades, "striker") * 10 + getLevel(upgrades, "longshot") * 25 + getLevel(upgrades, "freekick") * 50 + getLevel(upgrades, "worldclass") * 100 + getLevel(upgrades, "ballondor") * 250 + getLevel(upgrades, "captain") * 500;
  const transfer = getTransferBonuses(features.transferMarket.ownedIds);
  return (flat + transfer.clickBonus) * 1.1 ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, "golden")) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

function getClickPower(upgrades: Record<string, number>, stars: number, features: GameFeatures, now = Date.now()) {
  return getBaseClickPower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

function getBasePassivePower(upgrades: Record<string, number>, stars: number, features: GameFeatures) {
  const base = getLevel(upgrades, "ballboy") + getLevel(upgrades, "coach") * 15 + getLevel(upgrades, "academy") * 60 + getLevel(upgrades, "floodlight") * 300 + getLevel(upgrades, "scout") * 1200 + getLevel(upgrades, "var") * 10000 + getLevel(upgrades, "stadium") * 50000 + getLevel(upgrades, "broadcast") * 250000 + getLevel(upgrades, "sponsor") * 1200000 + getLevel(upgrades, "superclub") * 6000000;
  const transfer = getTransferBonuses(features.transferMarket.ownedIds);
  return (base + transfer.passiveBonus) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

function getBulkPurchase(id: string, game: CoopGameState, requestedCount: number, unlimitedMoney = false) {
  const upgrade = UPGRADES[id];
  if (!upgrade) return { count: 0, totalCost: 0 };
  return calculateBulkUpgradePurchase(upgrade, getLevel(game.upgrades, id), game.goals, requestedCount, {
    unlimitedMoney,
    maxMultiplierLevel: MAX_MULTIPLIER_LEVEL,
  });
}

function startSeasonCupMatch(game: CoopGameState, now: number) {
  if (game.features.seasonMode.hallOfFame) return "Die Hall of Fame ist erreicht. Starte zuerst Prestige.";
  if (game.features.cup.active) return "Es läuft bereits ein Saisonspiel.";
  const openTransferVacancies = getOpenTransferSquadVacancies(game.features);
  if (openTransferVacancies.length > 0) {
    const location = game.features.starXI.lineupIds.filter(Boolean).length < STAR_XI_SQUAD_SIZE ? "in der Startelf" : "auf der Bank";
    return `Besetze zuerst den freien Platz ${location}. Verkaufte oder verliehene Spieler werden nicht automatisch ersetzt.`;
  }
  if (getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE) return "Für das Saisonspiel brauchst du 11 passende Spieler in der Startelf.";
  const suspendedOnSquad = game.features.cup.suspendedPlayerIds.some((playerId) => game.features.starXI.lineupIds.includes(playerId) || game.features.starXI.benchIds.includes(playerId));
  if (suspendedOnSquad) return "Ein Spieler mit Roter Karte muss vor dem Anpfiff ersetzt werden und darf nicht auf der Bank sitzen.";
  game.features = activatePendingTransferLoans(game.features, "stadium");
  const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
  game.features.cup = beginSeasonCupMatch(game.features.cup, game.features.seasonMode, now, homePlayers, game.features.starXI.formationPositions, game.features.starXI.lineupIds, game.features.starXI.benchIds);
  return null;
}

function recordMultiplayerSeasonMatch(game: CoopGameState, now: number) {
  const result = recordSeasonModeMatch(game.features.seasonMode, game.features.cup.homeScore, game.features.cup.awayScore, game.features.club.name, now, Math.random, game.features.cup.opponentIds[0]);
  if (!result.played || !result.entry) return;
  game.features.seasonMode = result.state;
  game.features.seasonMode.table = game.features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
  game.features = finishActiveTransferLoans(game.features, now).features;
  game.seasons = Math.max(game.seasons, result.state.highestDivision - 1);
  if (result.entry.seasonOutcome === "promoted") game.stars = Math.min(MAX_SEASON_STARS, game.stars + 1);
  if (result.entry.seasonOutcome === "hall-of-fame") game.stars = Math.min(MAX_SEASON_STARS, game.stars + 2);
  const outcomeLabel = result.entry.seasonOutcome === "promoted" ? "Aufstieg" : result.entry.seasonOutcome === "relegated" ? "Abstieg" : result.entry.seasonOutcome === "hall-of-fame" ? "Hall of Fame" : result.entry.completedSeason ? "Klassenerhalt" : result.entry.outcome === "win" ? "Sieg" : result.entry.outcome === "loss" ? "Niederlage" : "Remis";
  addHistory(game.features, { title: `Saisonspiel · ${outcomeLabel}`, detail: result.state.lastResult, tone: result.entry.seasonOutcome === "relegated" || result.entry.outcome === "loss" ? "negative" : result.entry.outcome === "win" || result.entry.seasonOutcome === "promoted" || result.entry.seasonOutcome === "hall-of-fame" ? "positive" : "neutral" });
}

function gameColumns(game: CoopGameState, timestamp: string, previousRevision = 0) {
  unlockAchievements(game);
  return {
    sharedCoins: game.goals,
    sharedUpgradeLevel: Object.values(game.upgrades).reduce((total, level) => total + level, 0),
    sharedTotalGoals: game.totalGoals,
    sharedSeasonGoals: game.seasonGoals,
    sharedUpgradesJson: JSON.stringify(game.upgrades),
    sharedAchievementsJson: JSON.stringify(game.achievements),
    sharedStars: game.stars,
    sharedSeasons: game.seasons,
    sharedMinigameWins: game.minigameWins,
    sharedMiniGameCooldownsJson: JSON.stringify(game.miniGameCooldowns),
    sharedFeaturesJson: JSON.stringify(game.features),
    sharedStateBackupJson: JSON.stringify(game),
    sharedStateVersion: Math.max(0, Math.floor(previousRevision)) + 1,
    lastPassiveAt: timestamp,
    pendingPlayerId: null,
    pendingUpgradeId: null,
    pendingUpgradeName: null,
    pendingCost: null,
    pendingUpgradeCount: null,
    updatedAt: timestamp,
  };
}

async function persistGameResponse(
  db: ReturnType<typeof getDb>,
  room: RoomRow,
  game: CoopGameState,
  timestamp: string,
  playerId: string,
  role: CoopRole,
  extraColumns: CoopRoomUpdate = {},
  responseExtras: Record<string, unknown> = {},
) {
  const updated = await db.updateRoom(
    room.code,
    { ...gameColumns(game, timestamp, room.sharedStateVersion), ...extraColumns },
    { sharedStateVersion: room.sharedStateVersion },
  );
  if (updated) return Response.json({ room: shapeRoom(updated, playerId), role, ...responseExtras });

  const latest = await db.getRoom(room.code);
  if (!latest) return jsonError("Dieser Raum wurde gelöscht.", 404);
  return Response.json({
    error: "Der gemeinsame Spielstand wurde gleichzeitig geändert. Die Aktion wird automatisch nochmals ausgeführt.",
    errorCode: "STALE_STATE",
    room: shapeRoom(latest, playerId),
    role,
  }, { status: 409 });
}

function isOnline(lastSeenAt: string | null | undefined) {
  const lastSeen = Date.parse(lastSeenAt || "");
  return Number.isFinite(lastSeen) && Date.now() - lastSeen <= PRESENCE_TIMEOUT_MS;
}

function getSimulationLeaderRole(room: RoomRow, now = Date.now()) {
  return getOccupiedRoomPlayers(room).find((player) => {
    const lastSeen = Date.parse(player.lastSeenAt || "");
    return Number.isFinite(lastSeen) && now - lastSeen <= SIMULATION_LEADER_TIMEOUT_MS;
  })?.role ?? null;
}

function shapeRoom(row: RoomRow, viewerId?: string) {
  const game = readGame(row);
  const redeemedCodes = parseJson<string[]>(row.redeemedBonusCodesJson, []);
  const roomPlayers = getRoomPlayers(row);
  const occupiedPlayers = roomPlayers.filter((player) => Boolean(player.playerId));
  const viewerRole = viewerId ? roomPlayers.find((player) => player.playerId === viewerId)?.role : undefined;
  return {
    code: row.code,
    roomName: row.roomName,
    status: occupiedPlayers.length >= 2 ? "live" : "waiting",
    playerCount: occupiedPlayers.length,
    maxPlayers: COOP_ROLES.length,
    players: roomPlayers.map((player) => ({
      role: player.role,
      name: player.name,
      online: Boolean(player.playerId && isOnline(player.lastSeenAt)),
      occupied: Boolean(player.playerId),
      goals: player.goals,
      clicks: player.clicks,
    })),
    hostName: row.hostName,
    guestName: row.guestName,
    hostOnline: isOnline(row.hostLastSeenAt),
    guestOnline: Boolean(row.guestPlayerId && isOnline(row.guestLastSeenAt)),
    viewerRole,
    canDelete: viewerRole === "host",
    sharedCoins: game.goals,
    hostGoals: row.hostGoals,
    guestGoals: row.guestGoals,
    player3Goals: row.player3Goals,
    player4Goals: row.player4Goals,
    hostClicks: row.hostClicks,
    guestClicks: row.guestClicks,
    player3Clicks: row.player3Clicks,
    player4Clicks: row.player4Clicks,
    sharedUpgradeLevel: Object.values(game.upgrades).reduce((total, level) => total + level, 0),
    revision: Math.max(0, Math.floor(row.sharedStateVersion)),
    testMode: redeemedCodes.includes("AZB"),
    game: { ...game, lastSaved: Date.now(), sound: true },
  };
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Serverfehler";
  if (message.includes("no such table") || message.includes("no such column") || message.includes("Failed query")) return "Die Koop-Datenbank wird gerade aktualisiert. Bitte lade die Seite in einem Moment nochmals.";
  return message;
}

async function loadRoom(code: string) {
  const db = getDb();
  const room = await db.getRoom(code);
  return { db, room };
}

async function refreshPassive(db: ReturnType<typeof getDb>, room: RoomRow) {
  const now = Date.now();
  const last = Date.parse(room.lastPassiveAt || room.updatedAt) || now;
  const fullElapsed = Math.max(0, now - last);
  const game = readGame(room);
  const latestSeenAt = Math.max(...getOccupiedRoomPlayers(room).map((player) => Date.parse(player.lastSeenAt || "") || 0), 0);
  const activeLeaseEndsAt = latestSeenAt + PASSIVE_BACKGROUND_GRACE_MS;
  const activeUntil = getOccupiedRoomPlayers(room).length >= 2 ? Math.min(now, Math.max(last, activeLeaseEndsAt)) : last;
  const activeElapsed = Math.max(0, Math.min(fullElapsed, activeUntil - last));
  const inactiveElapsed = Math.max(0, fullElapsed - activeElapsed);
  const passiveReward = getGoalBoostedPassiveReward(getBasePassivePower(game.upgrades, game.stars, game.features), game.features, last, last + activeElapsed);
  if (passiveReward > 0) {
    game.goals += passiveReward;
    game.seasonGoals += passiveReward;
    game.totalGoals += passiveReward;
  }
  if (inactiveElapsed > 0) {
    const inactiveStartedAt = last + activeElapsed;
    game.features = pauseGameFeatureTimers(game.features, inactiveElapsed, now);
    for (const id of Object.keys(game.miniGameCooldowns)) {
      if (game.miniGameCooldowns[id] > inactiveStartedAt) game.miniGameCooldowns[id] += inactiveElapsed;
    }
  }
  const timestamp = new Date(now).toISOString();
  const updated = await db.updateRoom(
    room.code,
    gameColumns(game, timestamp, room.sharedStateVersion),
    { lastPassiveAt: room.lastPassiveAt, sharedStateVersion: room.sharedStateVersion },
  );
  if (updated) return updated;
  const current = await db.getRoom(room.code);
  return current ?? room;
}

function roomRole(room: RoomRow, playerId: string) {
  return getRoomPlayers(room).find((player) => player.playerId === playerId)?.role ?? null;
}

function requireLive(room: RoomRow) {
  return getOccupiedRoomPlayers(room).length >= 2 ? null : jsonError("Warte, bis der zweite Spieler beigetreten ist.", 409);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (!isSupportedMultiplayerProtocol(url.searchParams.get("protocol"))) return jsonError(MULTIPLAYER_UPDATE_MESSAGE, 426);
    const playerId = cleanPlayerId(url.searchParams.get("playerId"));
    if (!playerId) return jsonError("Spieler-ID fehlt.");
    if (url.searchParams.get("list") === "1") {
      const db = getDb();
      const rooms = await db.listRoomsForPlayer(playerId);
      return Response.json({ rooms: rooms.map((item) => shapeRoom(item, playerId)) });
    }
    const code = cleanCode(url.searchParams.get("code"));
    if (!code) return jsonError("Raumcode fehlt.");
    const { db, room } = await loadRoom(code);
    if (!room) return jsonError("Raum nicht gefunden.", 404);
    const role = roomRole(room, playerId);
    if (!role) return jsonError("Du bist nicht in diesem Raum.", 403);
    const refreshed = await refreshPassive(db, room);
    const touched = await db.updateRoom(code, rolePresenceUpdate(role, new Date().toISOString()));
    return Response.json({ room: shapeRoom(touched ?? refreshed, playerId), role });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: unknown;
      code?: unknown;
      playerId?: unknown;
      nickname?: unknown;
      amount?: unknown;
      clickCount?: unknown;
      upgradeId?: unknown;
      count?: unknown;
      reward?: unknown;
      minigameId?: unknown;
      transferId?: unknown;
      packId?: unknown;
      lineupIndex?: unknown;
      benchIndex?: unknown;
      starPlayerId?: unknown;
      formationId?: unknown;
      strategy?: unknown;
      direction?: unknown;
      expectedPenaltyStep?: unknown;
      tournamentId?: unknown;
      missionId?: unknown;
      name?: unknown;
      badge?: unknown;
      color?: unknown;
      roomName?: unknown;
      bonusCode?: unknown;
      preferredRole?: unknown;
      protocol?: unknown;
    };
    if (!isSupportedMultiplayerProtocol(payload.protocol)) return jsonError(MULTIPLAYER_UPDATE_MESSAGE, 426);
    const action = typeof payload.action === "string" ? payload.action : "";
    const playerId = cleanPlayerId(payload.playerId);
    const nickname = cleanName(payload.nickname);
    if (playerId.length < 8) return jsonError("Spieler-ID fehlt.");

    if (action === "create") {
      if (nickname.length < 2) return jsonError("Der Spielername muss mindestens 2 Zeichen haben.");
      const db = getDb();
      let code = makeRoomCode();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const existing = await db.getRoom(code);
        if (!existing) break;
        code = makeRoomCode();
      }
      const now = new Date().toISOString();
      const roomName = cleanRoomName(payload.roomName, `${nickname}s Welt`);
      const room = await db.insertRoom({ code, roomName, hostPlayerId: playerId, hostName: nickname, hostLastSeenAt: now, lastPassiveAt: now, updatedAt: now });
      return Response.json({ room: shapeRoom(room, playerId), role: "host" }, { status: 201 });
    }

    const code = cleanCode(payload.code);
    if (!code) return jsonError("Raumcode fehlt.");
    const loaded = await loadRoom(code);
    let room = loaded.room;
    const db = loaded.db;
    if (!room) return jsonError("Raum nicht gefunden.", 404);

    if (action === "join") {
      if (nickname.length < 2) return jsonError("Der Spielername muss mindestens 2 Zeichen haben.");
      const now = new Date().toISOString();
      const requestedRole = typeof payload.preferredRole === "string" && COOP_ROLES.includes(payload.preferredRole as CoopRole) ? payload.preferredRole as CoopRole : null;
      const directRole = roomRole(room, playerId);
      const matchingNameRoles = getOccupiedRoomPlayers(room)
        .filter((player) => player.name?.localeCompare(nickname, "de-CH", { sensitivity: "base" }) === 0)
        .map((player) => player.role);
      const requestedPlayer = requestedRole ? getRoomPlayer(room, requestedRole) : null;
      const restoredRole = requestedPlayer?.playerId && requestedPlayer.name?.localeCompare(nickname, "de-CH", { sensitivity: "base" }) === 0
        ? requestedRole
        : matchingNameRoles.length === 1
          ? matchingNameRoles[0]
          : null;
      const reconnectRole = directRole ?? restoredRole;
      if (reconnectRole) {
        room = await refreshPassive(db, room);
        const reconnected = await db.updateRoom(code, { ...roleIdentityUpdate(reconnectRole, playerId, nickname, now), updatedAt: now });
        return Response.json({ room: shapeRoom(reconnected ?? room, playerId), role: reconnectRole });
      }

      const openRole = (["guest", "player3", "player4"] as const).find((role) => !getRoomPlayer(room, role).playerId);
      if (!openRole) return jsonError("Dieser Raum ist bereits voll. Maximal vier Spieler können gemeinsam spielen.", 409);
      const wasWaiting = getOccupiedRoomPlayers(room).length < 2;
      const joined = await db.updateRoom(code, {
        ...roleIdentityUpdate(openRole, playerId, nickname, now),
        ...(wasWaiting ? { lastPassiveAt: now } : {}),
        updatedAt: now,
      });
      return Response.json({ room: shapeRoom(joined ?? room, playerId), role: openRole });
    }

    const role = roomRole(room, playerId);
    if (!role) return jsonError("Du bist nicht in diesem Raum.", 403);
    if (action === "delete") {
      if (role !== "host") return jsonError("Nur der Host kann diesen Raum löschen.", 403);
      await db.deleteRoom(code);
      return Response.json({ deleted: true, role });
    }
    if (action === "rename-room") {
      if (role !== "host") return jsonError("Nur der Host kann den Namen dieser Welt ändern.", 403);
      const roomName = cleanRoomName(payload.roomName, room.roomName);
      const renamed = await db.updateRoom(code, { roomName, updatedAt: new Date().toISOString() });
      return Response.json({ room: shapeRoom(renamed ?? room, playerId), role });
    }
    if (action === "presence-offline") {
      room = await refreshPassive(db, room);
      const offlineAt = "1970-01-01T00:00:00.000Z";
      const offlineRoom = await db.updateRoom(code, rolePresenceUpdate(role, offlineAt));
      return Response.json({ room: shapeRoom(offlineRoom ?? room, playerId), role });
    }
    const isBackgroundAction = action === "tick" || action === "cup-tick";
    if (isBackgroundAction) {
      const presenceTimestamp = new Date().toISOString();
      const presenceUpdated = await db.updateRoom(code, rolePresenceUpdate(role, presenceTimestamp));
      room = presenceUpdated ?? room;
      if (getSimulationLeaderRole(room, Date.parse(presenceTimestamp)) !== role) return Response.json({ room: shapeRoom(room, playerId), role });
      room = await refreshPassive(db, room);
      if (action === "tick") return Response.json({ room: shapeRoom(room, playerId), role });
    } else {
      room = await refreshPassive(db, room);
      const presenceUpdated = await db.updateRoom(code, rolePresenceUpdate(role, new Date().toISOString()));
      room = presenceUpdated ?? room;
    }
    const game = readGame(room);
    if (action === "redeem-lobby-code") {
      const bonusCode = typeof payload.bonusCode === "string" ? payload.bonusCode.trim().toUpperCase() : "";
      if (bonusCode !== "AZB" && bonusCode !== "SILVAN") return jsonError("Dieser Lobby Code ist ungültig.", 409);
      if (bonusCode === "AZB" && !AZB_CODE_ENABLED) return jsonError("Der AZB Testcode ist momentan deaktiviert.", 409);
      const redeemedCodes = parseJson<string[]>(room.redeemedBonusCodesJson, []).filter((value) => typeof value === "string");
      if (redeemedCodes.includes(bonusCode)) return jsonError("Dieser Code wurde in dieser Welt bereits eingelöst.", 409);
      let packReveal: StarPackReveal | undefined;
      if (bonusCode === "AZB") {
        addHistory(game.features, { title: "AZB Testmodus aktiviert", detail: "Unbegrenztes Guthaben und alle Saison Inhalte sind in dieser Multiplayer Welt aktiv.", tone: "positive" });
      } else {
        const silvuz = getStarXIPlayer("star-silvuz");
        if (!silvuz) return jsonError("Silvuz ist gerade nicht verfügbar.", 409);
        const alreadyOwned = game.features.starXI.ownedIds.includes(silvuz.id);
        if (!alreadyOwned) {
          game.features.starXI = addStarXIPlayer(game.features.starXI, silvuz.id);
          packReveal = {
            packId: "legend",
            packName: "Silvan Code",
            player: silvuz,
            duplicate: false,
            fragmentCompensation: 0,
            openedAt: Date.now(),
            openedBy: roomPlayerName(room, role),
            troll: false,
          };
          game.features.starPackReveal = packReveal;
        }
        addHistory(game.features, { title: "Silvuz freigeschaltet", detail: alreadyOwned ? "Silvuz war bereits im gemeinsamen Club." : "100 Rating · LF / LM / RF · Schweiz", tone: "positive" });
      }
      const timestamp = new Date().toISOString();
      return persistGameResponse(db, room, game, timestamp, playerId, role, { redeemedBonusCodesJson: JSON.stringify([...redeemedCodes, bonusCode]) }, { packReveal });
    }
    const liveError = requireLive(room);
    if (liveError) return liveError;
    const timestamp = new Date().toISOString();
    const testMode = parseJson<string[]>(room.redeemedBonusCodesJson, []).includes("AZB");

    if (action === "click") {
      const clickPower = getClickPower(game.upgrades, game.stars, game.features, Date.parse(timestamp));
      const clickCount = Math.max(1, Math.min(50, Math.floor(finite(payload.clickCount, 1))));
      const maxAmount = Math.max(clickCount, Math.floor(clickPower * clickCount * 2.2));
      const amount = Math.max(clickCount, Math.min(maxAmount, Math.floor(finite(payload.amount, clickPower * clickCount))));
      const updated = await db.applyClick(code, role, amount, clickCount, timestamp);
      if (!updated) return jsonError("Dieser Raum wurde gelöscht.", 404);
      return Response.json({ room: shapeRoom(updated, playerId), role });
    }

    if (action === "transfer-insider-event") {
      const transferNow = Date.now();
      if (game.features.transferSaga.nextAt > transferNow) return Response.json({ room: shapeRoom(room, playerId), role });
      if (game.features.cup.active) return Response.json({ room: shapeRoom(room, playerId), role });
      const result = resolveTransferInsiderEvent(game.features, Math.random, transferNow);
      game.features = result.features;
      game.goals += result.goalDelta;
      game.seasonGoals += result.goalDelta;
      game.totalGoals += result.goalDelta;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "event") {
      if (game.features.nextEventAt > Date.now()) return Response.json({ room: shapeRoom(room, playerId), role });
      const event = resolveRandomEvent(game.goals);
      game.goals = Math.max(0, game.goals + event.amount);
      game.seasonGoals = Math.max(0, game.seasonGoals + event.amount);
      game.totalGoals = Math.max(0, game.totalGoals + Math.max(0, event.amount));
      game.features.randomEvent = event;
      game.features.nextEventAt = Date.now() + getRandomEventDelay();
      addHistory(game.features, { title: event.title, detail: event.message, tone: event.tone });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "var-event") {
      if (game.features.nextVarAt > Date.now()) return Response.json({ room: shapeRoom(room, playerId), role });
      const event = resolveVarEvent(game.goals);
      game.goals = Math.max(0, game.goals + event.amount);
      game.seasonGoals = Math.max(0, game.seasonGoals + event.amount);
      game.totalGoals = Math.max(0, game.totalGoals + Math.max(0, event.amount));
      game.features.randomEvent = event;
      game.features.nextVarAt = Date.now() + getRandomEventDelay();
      addHistory(game.features, { title: event.title, detail: event.message, tone: event.tone });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "buy") {
      const upgradeId = typeof payload.upgradeId === "string" ? payload.upgradeId : "";
      if (!UPGRADES[upgradeId]) return jsonError("Dieses Upgrade gibt es nicht.");
      const requestedCount = finite(payload.count, 1);
      let purchaseRoom = room;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const purchaseGame = readGame(purchaseRoom);
        const upgradeUnlockSeason = getUpgradeUnlockSeason(upgradeId);
        if (getLevel(purchaseGame.upgrades, upgradeId) === 0 && !isSeasonContentUnlocked(upgradeUnlockSeason, purchaseGame.seasons, testMode)) return jsonError(`Dieses Upgrade wird in Saison ${upgradeUnlockSeason} freigeschaltet.`, 409);
        const purchase = getBulkPurchase(upgradeId, purchaseGame, requestedCount, testMode);
        if (purchase.count === 0) {
          const price = getCostAtLevel(upgradeId, getLevel(purchaseGame.upgrades, upgradeId));
          return jsonError(`${UPGRADES[upgradeId].name} kostet ${price.toLocaleString("de-CH")} Tore.`);
        }
        if (!testMode) purchaseGame.goals -= purchase.totalCost;
        purchaseGame.upgrades[upgradeId] = getLevel(purchaseGame.upgrades, upgradeId) + purchase.count;
        const purchaseTimestamp = new Date().toISOString();
        const updated = await db.updateRoom(
          purchaseRoom.code,
          gameColumns(purchaseGame, purchaseTimestamp, purchaseRoom.sharedStateVersion),
          { sharedStateVersion: purchaseRoom.sharedStateVersion },
        );
        if (updated) return Response.json({ room: shapeRoom(updated, playerId), role });
        const latest = await db.getRoom(purchaseRoom.code);
        if (!latest) return jsonError("Dieser Raum wurde gelöscht.", 404);
        purchaseRoom = latest;
      }
      return Response.json({
        error: "Der gemeinsame Spielstand wurde gleichzeitig geändert. Der Kauf wird automatisch nochmals ausgeführt.",
        errorCode: "STALE_STATE",
        room: shapeRoom(purchaseRoom, playerId),
        role,
      }, { status: 409 });
    }

    if (action === "transfer-buy") return jsonError(TRANSFER_MARKET_CLOSED_MESSAGE, 410);
    if (action === "transfer-refresh") return jsonError(TRANSFER_MARKET_CLOSED_MESSAGE, 410);

    if (action === "profile") {
      const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ").slice(0, 22) : "FC Goal";
      const badge = typeof payload.badge === "string" && ["⚽", "🦅", "🔥", "🦁", "⭐", "🛡️"].includes(payload.badge) ? payload.badge : "⚽";
      const color = typeof payload.color === "string" && ["#0071e3", "#1d1d1f", "#e85d04", "#16845b", "#8b5cf6", "#d12c54"].includes(payload.color) ? payload.color : "#0071e3";
      game.features.club = { name: name || "FC Goal", badge, color };
      game.features.seasonMode.table = game.features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
      game.features.seasonMode.lastTable = game.features.seasonMode.lastTable.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
      addHistory(game.features, { title: "Clubprofil aktualisiert", detail: `${badge} ${game.features.club.name} ist bereit.`, tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-formation") {
      const formationId = typeof payload.formationId === "string" ? payload.formationId as StarFormationId : "433";
      if (game.features.cup.active) return jsonError("Während eines laufenden Spiels kann die Formation nicht geändert werden.", 409);
      if (!STAR_FORMATIONS.some((formation) => formation.id === formationId)) return jsonError("Diese Formation ist ungültig.", 409);
      const formationUnlockSeason = getFormationUnlockSeason(formationId);
      if (!isSeasonContentUnlocked(formationUnlockSeason, game.seasons, testMode)) return jsonError(`Diese Formation wird in Saison ${formationUnlockSeason} freigeschaltet.`, 409);
      const formation = getStarFormation(formationId);
      game.features.starXI = setStarXIFormation(game.features.starXI, formationId, getUnavailableStarXIPlayerIds(game.features));
      addHistory(game.features, { title: "Formation angepasst", detail: `Die Startelf spielt jetzt im ${formation.label}.`, tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-lineup") {
      const lineupIndex = Number(payload.lineupIndex);
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      const starPlayer = getStarXIPlayer(starPlayerId);
      if (!Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE) return jsonError("Dieser Aufstellungsplatz ist ungültig.", 409);
      if (!starPlayer || !game.features.starXI.ownedIds.includes(starPlayerId)) return jsonError("Dieser Spieler gehört noch nicht zum Kader.", 409);
      if (game.features.transferSaga.loans.some((loan) => loan.playerId === starPlayerId)) return jsonError(`${starPlayer.name} ist ausgeliehen und aktuell nicht im Team.`, 409);
      if (game.features.cup.suspendedPlayerIds.includes(starPlayerId)) return jsonError(`${starPlayer.name} ist nach der Roten Karte für die nächste Partie gesperrt.`, 409);
      if (!canStarXIPlayerFillSlot(starPlayerId, lineupIndex, game.features.starXI.formationPositions)) return jsonError(`${starPlayer.name} kann auf dieser Position nicht spielen.`, 409);
      const comesFromBench = game.features.starXI.benchIds.includes(starPlayerId);
      if (game.features.cup.active && !comesFromBench) return jsonError("Im laufenden Spiel darf nur von der Bank gewechselt werden.", 409);
      if (game.features.cup.active && game.features.cup.substitutionsUsed >= STAR_XI_MAX_SUBSTITUTIONS) return jsonError("Alle fünf Wechsel sind bereits gebraucht.", 409);
      if (game.features.cup.active && game.features.cup.playerExitedAt[starPlayerId]) return jsonError(`${starPlayer.name} wurde bereits ausgewechselt und darf nicht zurück aufs Feld.`, 409);
      const outgoingPlayerId = game.features.starXI.lineupIds[lineupIndex];
      if (game.features.cup.active && outgoingPlayerId && game.features.cup.sentOffPlayerIds.includes(outgoingPlayerId)) {
        const outgoingPlayer = getStarXIPlayer(outgoingPlayerId);
        return jsonError(`${outgoingPlayer?.name ?? "Dieser Spieler"} kann nach einer Roten Karte nicht ausgewechselt werden.`, 409);
      }
      game.features.starXI = setStarXIStarter(game.features.starXI, lineupIndex, starPlayerId, getUnavailableStarXIPlayerIds(game.features));
      if (game.features.cup.active) {
        const substitutionMinute = Math.min(120, Math.max(1, Math.floor((Date.now() - game.features.cup.matchStartedAt) / 2000) + 1));
        game.features.cup = applyCupSubstitution(game.features.cup, outgoingPlayerId, starPlayerId, substitutionMinute).cup;
        if (outgoingPlayerId) game.features.cup.playerExitedAt[outgoingPlayerId] = Math.min(game.features.cup.playerExitedAt[outgoingPlayerId] ?? substitutionMinute, substitutionMinute);
        game.features.cup.playerEnteredAt[starPlayerId] = substitutionMinute;
        game.features.cup.playerMatchPositions[starPlayerId] = game.features.starXI.formationPositions[lineupIndex] ?? starPlayer.position;
        game.features.cup.substitutionsUsed += 1;
      }
      addHistory(game.features, { title: game.features.cup.active ? `${starPlayer.name} eingewechselt` : "Star XI umgestellt", detail: `${starPlayer.name} spielt jetzt auf Platz ${lineupIndex + 1}.`, tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-best-lineup") {
      if (game.features.cup.active) return jsonError("Während eines Pokalspiels kann die Startelf nicht automatisch geändert werden.", 409);
      game.features.starXI = setBestStarXI(game.features.starXI, getUnavailableStarXIPlayerIds(game.features));
      const selectedCount = game.features.starXI.lineupIds.filter(Boolean).length;
      if (!selectedCount) return jsonError("Du hast noch keine passenden Spieler im Kader.", 409);
      addHistory(game.features, { title: "Beste Startelf aufgestellt", detail: `${selectedCount} von ${STAR_XI_SQUAD_SIZE} Positionen mit den stärksten passenden Spielern besetzt.`, tone: "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-bench") {
      const benchIndex = Number(payload.benchIndex);
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      const starPlayer = getStarXIPlayer(starPlayerId);
      if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE) return jsonError("Dieser Bankplatz ist ungültig.", 409);
      if (!starPlayer || !game.features.starXI.ownedIds.includes(starPlayerId) || game.features.starXI.lineupIds.includes(starPlayerId)) return jsonError("Dieser Spieler kann nicht auf die Bank verschoben werden.", 409);
      if (game.features.transferSaga.loans.some((loan) => loan.playerId === starPlayerId)) return jsonError(`${starPlayer.name} ist ausgeliehen und aktuell nicht im Team.`, 409);
      if (game.features.cup.suspendedPlayerIds.includes(starPlayerId)) return jsonError(`${starPlayer.name} darf nach einer Roten Karte nicht auf die Bank.`, 409);
      if (game.features.cup.active) return jsonError("Während des Spiels kann die Bank nicht neu zusammengestellt werden.", 409);
      game.features.starXI = setStarXIBenchPlayer(game.features.starXI, benchIndex, starPlayerId, getUnavailableStarXIPlayerIds(game.features));
      addHistory(game.features, { title: "Bank umgestellt", detail: `${starPlayer.name} sitzt jetzt auf Bankplatz ${benchIndex + 1}.`, tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-pack") {
      const packId = typeof payload.packId === "string" ? payload.packId : "";
      const pack = getStarPack(packId);
      if (!pack) return jsonError("Dieses Pack gibt es nicht.");
      const packUnlockSeason = getPackUnlockSeason(pack.id);
      if (!isSeasonContentUnlocked(packUnlockSeason, game.seasons, testMode)) return jsonError(`Dieses Pack wird in Saison ${packUnlockSeason} freigeschaltet.`, 409);
      if (game.features.cup.active) return jsonError("Während eines Pokalspiels keine Packs öffnen.", 409);
      if (!testMode && game.goals < pack.price) return jsonError(`${pack.label} kostet ${pack.price.toLocaleString("de-CH")} Tore.`);
      const opening = openStarPack(pack.id, game.features.starXI.ownedIds);
      const openedAt = Date.now();
      const openedBy = roomPlayerName(room, role);
      const reveal = { ...opening, openedAt, openedBy, troll: shouldTriggerPackTroll(opening.player) };
      if (!testMode) game.goals -= pack.price;
      game.features.starPackReveal = reveal;
      if (!opening.duplicate) game.features.starXI = addStarXIPlayer(game.features.starXI, opening.player.id);
      if (opening.fragmentCompensation > 0) {
        game.features.starXI.fragments += opening.fragmentCompensation;
      }
      const historyTitle = opening.duplicate ? `Doppelter Star: ${opening.player.name}` : `${opening.player.name} in die Star XI gezogen`;
      const historyDetail = opening.duplicate ? `+${opening.fragmentCompensation.toLocaleString("de-CH")} Fragmente · nur für Custom-Karten.` : `${getStarXIPositions(opening.player).join(" / ")} · Rating ${opening.player.rating}`;
      addHistory(game.features, { title: historyTitle, detail: historyDetail, tone: opening.duplicate ? "neutral" : "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { packReveal: reveal });
    }

    if (action === "star-custom-draw" || action === "star-custom-buy") {
      const cost = STAR_XI_RANDOM_CUSTOM_CARD_COST;
      if (game.features.cup.active) return jsonError("Während eines Pokalspiels können keine Karten freigeschaltet werden.", 409);
      if (!testMode && game.features.starXI.fragments < cost) return jsonError(`Ein Spezialkarten-Zug kostet ${cost.toLocaleString("de-CH")} Fragmente.`, 409);
      if (testMode) game.features.starXI.fragments = Math.max(game.features.starXI.fragments, cost);
      const opening = drawRandomStarXICustomCard(game.features.starXI);
      if (!opening.drawn || !opening.player) return jsonError("Der Spezialkarten-Zug konnte nicht ausgeführt werden.", 409);
      const reveal: StarPackReveal = { packId: opening.packId, packName: opening.packName, player: opening.player, duplicate: opening.duplicate, fragmentCompensation: opening.fragmentCompensation, source: opening.source, openedAt: Date.now(), openedBy: roomPlayerName(room, role), troll: shouldTriggerPackTroll(opening.player) };
      game.features.starXI = opening.state;
      game.features.starPackReveal = reveal;
      addHistory(game.features, { title: opening.duplicate ? `Doppelter Spezialspieler: ${opening.player.name}` : `${opening.player.name} als Spezialkarte gezogen`, detail: opening.duplicate ? `+${opening.fragmentCompensation.toLocaleString("de-CH")} Fragmente zurück.` : `${getStarXIPositions(opening.player).join(" / ")} · Rating ${opening.player.rating}`, tone: opening.duplicate ? "neutral" : "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { packReveal: reveal });
    }

    if (action === "cup-start") {
      if (payload.mode === "season" || typeof payload.tournamentId !== "string") {
        const seasonStartError = startSeasonCupMatch(game, Date.now());
        if (seasonStartError) return jsonError(seasonStartError, 409);
        return persistGameResponse(db, room, game, timestamp, playerId, role);
      }
      const tournamentId = typeof payload.tournamentId === "string" ? payload.tournamentId : "stadium";
      const tournament = getTournament(tournamentId);
      if (!tournament) return jsonError("Dieses Turnier gibt es nicht.", 409);
      const cupNow = Date.now();
      if (!game.features.cup.pendingNextRound && game.features.cup.nextTournamentAt > cupNow) {
        const remainingSeconds = Math.max(0, Math.ceil((game.features.cup.nextTournamentAt - cupNow) / 1000));
        const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
        return jsonError(`Neues Turnier in ${remainingLabel}.`, 409);
      }
      const openTransferVacancies = getOpenTransferSquadVacancies(game.features);
      if (openTransferVacancies.length > 0) {
        const location = game.features.starXI.lineupIds.filter(Boolean).length < STAR_XI_SQUAD_SIZE ? "in der Startelf" : "auf der Bank";
        return jsonError(`Besetze zuerst den freien Platz ${location}. Verkaufte oder verliehene Spieler werden nicht automatisch ersetzt.`, 409);
      }
      if (game.features.cup.pendingNextRound && tournament.id !== game.features.cup.tournamentId) return jsonError("Ersetze den gesperrten Spieler zuerst für die nächste Partie dieses Turniers.", 409);
      if (getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE) return jsonError("Für den Pokal brauchst du 11 passende Spieler in der Startelf.", 409);
      const suspendedOnSquad = game.features.cup.suspendedPlayerIds.some((playerId) => game.features.starXI.lineupIds.includes(playerId) || game.features.starXI.benchIds.includes(playerId));
      if (suspendedOnSquad) return jsonError("Ein Spieler mit Roter Karte muss vor dem Anpfiff ersetzt werden und darf nicht auf der Bank sitzen.", 409);
      const tournamentUnlockSeason = getTournamentUnlockSeason(tournament.id);
      if (!isSeasonContentUnlocked(tournamentUnlockSeason, game.seasons, testMode)) return jsonError(`${tournament.label} wird in Saison ${tournamentUnlockSeason} freigeschaltet.`, 409);
      const starRating = getStarXIRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds);
      if (starRating < tournament.minimumRating) return jsonError(`${tournament.label} braucht mindestens ${tournament.minimumRating} OVR.`, 409);
      if (!game.features.cup.active) {
        if (!game.features.cup.pendingNextRound) game.features = activatePendingTransferLoans(game.features, tournament.id);
        const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
        game.features.cup = beginCupMatch(game.features.cup, cupNow, tournament.id, homePlayers, game.features.starXI.formationPositions, game.features.starXI.lineupIds, game.features.starXI.benchIds);
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-play") {
      if (!game.features.cup.active) return jsonError("Der Pokal ist gerade nicht aktiv.", 409);
      if (game.features.cup.phase === "penalties") return jsonError("Im Elfmeterschiessen gibt es keine Taktikwechsel.", 409);
      const strategy = typeof payload.strategy === "string" && CUP_STRATEGIES.some((item) => item.id === payload.strategy) ? payload.strategy : "konter";
      game.features.cup.strategyId = getCupStrategy(strategy).id;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-resume") {
      if (!game.features.cup.active || !game.features.cup.matchPaused) return jsonError(`${game.features.cup.mode === "season" ? "Das Saisonspiel" : "Das Pokalspiel"} ist gerade nicht pausiert.`, 409);
      game.features.cup = resumeCupMatch(game.features.cup);
      addHistory(game.features, { title: "Verletzungspause beendet", detail: "Der verletzte Spieler bleibt draußen; die Partie läuft ohne Wechsel weiter.", tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-penalty") {
      if (!game.features.cup.active || game.features.cup.phase !== "penalties") return jsonError("Gerade läuft kein Elfmeterschiessen.", 409);
      const direction = payload.direction === "left" || payload.direction === "center" || payload.direction === "right" ? payload.direction as PenaltyDirection : null;
      if (!direction) return jsonError("Wähle links, Mitte oder rechts.", 409);
      const expectedPenaltyStep = Number(payload.expectedPenaltyStep);
      const currentPenaltyStep = game.features.cup.penaltyHomeTaken + game.features.cup.penaltyAwayTaken;
      if (!Number.isInteger(expectedPenaltyStep) || expectedPenaltyStep < 0) return jsonError("Der Elfmeterstand ist ungültig.", 409);
      if (expectedPenaltyStep !== currentPenaltyStep) return Response.json({ room: shapeRoom(room, playerId), role });
      const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
      const effectiveRating = getStarXIEffectiveMatchRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds, game.features.cup, 120);
      const cupNow = Date.now();
      const result = resolveCupPenalty(game.features.cup, effectiveRating, direction, cupNow, Math.random, homePlayers, game.features.starXI.formationPositions);
      game.features.cup = result.cup;
      if (result.finished) {
        game.features.starXI = restoreStarXIAfterMatch(game.features.starXI, game.features.cup);
        if (game.features.cup.mode === "season") {
          recordMultiplayerSeasonMatch(game, cupNow);
        } else {
          if (result.tournamentWon) game.features.goalBoost = startTournamentGoalBoost(game.features.cup.tournamentId, cupNow);
          const tournament = getTournament(game.features.cup.tournamentId);
          const tournamentBoost = getTournamentGoalBoostMultiplier(game.features.cup.tournamentId);
          addHistory(game.features, {
            title: result.tournamentWon ? `${tournament?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Elfmeterschiessen gewonnen · Trophäe erhalten · ${String(tournamentBoost).replace(".", ",")}× Goalboost für 03:00` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Elfmeterschiessen gewonnen · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Elfmeterschiessen gewonnen · Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Elfmeterschiessen gewonnen · Runde ${result.completedRound + 1} läuft bereits` : "Im Elfmeterschiessen ausgeschieden.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) game.features = completeTournamentRun(game.features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, cupNow);
        }
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-tick") {
      if (!game.features.cup.active) return Response.json({ room: shapeRoom(room, playerId), role });
      if (game.features.cup.phase === "penalties") return Response.json({ room: shapeRoom(room, playerId), role });
      const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
      const cupNow = Date.now();
      const matchMinute = Math.min(120, Math.max(1, Math.floor((cupNow - game.features.cup.matchStartedAt) / 2000) + 1));
      const effectiveRating = getStarXIEffectiveMatchRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds, game.features.cup, matchMinute);
      const result = advanceCupMatch(game.features.cup, effectiveRating, cupNow, Math.random, homePlayers, game.features.starXI.formationPositions);
      game.features.cup = result.cup;
      if (result.finished) {
        game.features.starXI = restoreStarXIAfterMatch(game.features.starXI, game.features.cup);
        if (game.features.cup.mode === "season") {
          recordMultiplayerSeasonMatch(game, cupNow);
        } else {
          if (result.tournamentWon) game.features.goalBoost = startTournamentGoalBoost(game.features.cup.tournamentId, cupNow);
          const tournament = getTournament(game.features.cup.tournamentId);
          const tournamentBoost = getTournamentGoalBoostMultiplier(game.features.cup.tournamentId);
          addHistory(game.features, {
            title: result.tournamentWon ? `${tournament?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Trophäe erhalten · ${String(tournamentBoost).replace(".", ",")}× Goalboost für 03:00` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Rote Karte · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Runde ${result.completedRound + 1} läuft bereits` : "Der nächste Turnierlauf kommt bestimmt.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) game.features = completeTournamentRun(game.features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, cupNow);
        }
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "mission-claim") {
      const missionId = typeof payload.missionId === "string" ? payload.missionId : "";
      const mission = game.features.missions.find((item) => item.id === missionId);
      if (!mission) return jsonError("Diese Mission gibt es nicht.");
      const progress = getMissionProgress(mission, { seasonGoals: game.seasonGoals, clicks: game.clicks, minigameWins: game.minigameWins, cupWins: game.features.cup.wins });
      if (mission.claimed) return jsonError("Diese Mission wurde bereits abgeholt.", 409);
      if (progress < mission.target) return jsonError("Die Mission ist noch nicht abgeschlossen.", 409);
      mission.claimed = true;
      game.goals += mission.reward;
      game.seasonGoals += mission.reward;
      game.totalGoals += mission.reward;
      addHistory(game.features, { title: `${mission.title} abgeschlossen`, detail: `+${mission.reward.toLocaleString("de-CH")} Tore Teamprämie`, tone: "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "season-match" || action === "season") {
      const seasonStartError = startSeasonCupMatch(game, Date.now());
      if (seasonStartError) return jsonError(seasonStartError, 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "season-prestige") {
      if (!game.features.seasonMode.hallOfFame) return jsonError("Prestige wird erst nach der Hall of Fame freigeschaltet.", 409);
      game.features.seasonMode = startSeasonPrestige(game.features.seasonMode, game.features.club.name, Date.now());
      game.seasons = Math.max(game.seasons, MAX_CAREER_SEASON - 1);
      game.stars = Math.min(MAX_SEASON_STARS, game.stars + 2);
      addHistory(game.features, { title: `Prestige ${game.features.seasonMode.prestigeCount} gestartet`, detail: "Die Hall-of-Fame-Jagd beginnt erneut in Saison 1.", tone: "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "reset") {
      const sound = game.sound;
      Object.assign(game, initialGame(), { sound });
      return persistGameResponse(db, room, game, timestamp, playerId, role, { hostGoals: 0, guestGoals: 0, player3Goals: 0, player4Goals: 0, hostClicks: 0, guestClicks: 0, player3Clicks: 0, player4Clicks: 0 });
    }

    if (action === "minigame") {
      const minigameId = typeof payload.minigameId === "string" ? payload.minigameId : "";
      if (!MINI_GAME_COOLDOWN_SECONDS[minigameId]) return jsonError("Dieses Minigame gibt es nicht.");
      if (game.miniGameCooldowns[minigameId] > Date.now()) return jsonError("Dieses Minigame ist noch nicht bereit.", 409);
      const reward = Math.max(0, Math.min(1000000, Math.floor(finite(payload.reward))));
      game.goals += reward;
      game.seasonGoals += reward;
      game.totalGoals += reward;
      game.minigameWins += 1;
      game.miniGameCooldowns[minigameId] = Date.now() + MINI_GAME_COOLDOWN_SECONDS[minigameId] * 1000;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    return jsonError("Unbekannte Aktion.");
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
