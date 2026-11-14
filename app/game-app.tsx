"use client";
// The game itself: app/page.tsx loads this module as its own chunk (audit P13).
import type { AnimationEvent, CSSProperties, DragEvent, KeyboardEvent, MouseEvent, RefObject, SetStateAction } from "react";
import type { AppMode, CoopRole, CoopRoom, CoopSession, CrossbarGame, CrossbarHeight, DribbleGame, FeedEntry, GameState, IconName, LayoutCardId, MatchPrediction, MiniGameId, PenaltyDirection, PenaltyGame, PredictionGame, PurchaseMode, SquadDragSource, SquadDropTarget, Tab, UpgradeDefinition } from "./game/types";
import type { StarXIState, CupCardEvent, GameFeatures, PenaltyDirection as CupPenaltyDirection, RandomEvent, StarFormationId, StarPackId, StarPackReveal, TournamentGazetteIssue, TournamentId, TransferInsiderEvent } from "./feature-data";
import type { Journey, TravelFixture } from "./travel-data";
import type { MatchDraft } from "./match-commands";
import { RESERVE_SORTS, RESERVE_STATUS_FILTERS, RESERVE_TYPES, filterAndSortReserve, reserveCardType, reserveTypeLabel } from "./game/reserve-filter";
import { ACHIEVEMENTS, BALANCE_VERSION, COMBO_DECAY_MS, COMBO_HOLD_MS, COMBO_MAX_COUNT, COOP_ROOM_KEY, CROSSBAR_HEIGHTS, DEFAULT_LAYOUT_ORDER, GOAL_CONFETTI, GOLD_CONFETTI, LAYOUT_CARD_IDS, LAYOUT_STORAGE_KEY, LEGACY_PLAYER_ID_KEYS, MATCH_PREDICTIONS, MAX_SEASON_STARS, MINI_GAME_COOLDOWN_SECONDS, MINI_GAME_NAMES, NETWORK_RETRY_UNSAFE_COOP_ACTIONS, PACK_TROLL_INTRO_MS, PENALTY_DIRECTIONS, PLAYER_ID_KEY, PLAYER_NAME_KEY, PURCHASE_MODES, RANKS, RESERVE_PAGE_SIZE, SILVER_CONFETTI, STAR_RARE_REVEAL_DURATION_MS, ALBUM_MILESTONES_STORAGE_KEY, STAR_RATING_FILTERS, TUTORIAL_STORAGE_KEY, VIBRATION_STORAGE_KEY, WHATS_NEW_STORAGE_KEY } from "./game/constants";
import { AL, AR, AT, AU, AZ, BA, BE, BF, BG, BR, CA, CD, CH, CI, CL, CM, CN, CO, CR, CZ, DE, DK, DZ, EC, EG, ES, FI, FR, GB_ENG, GB_NIR, GB_SCT, GB_WLS, GE, GH, GM, GN, GR, GT, HR, HT, HU, IE, IL, IS, IT, JM, JP, KN, KR, MA, ME, ML, MW, MX, NG, NL, NO, NZ, PA, PH, PL, PT, PY, RO, RS, RU, SE, SI, SK, SN, SR, TR, UA, US, UY, VE, XK, ZA, ZM } from "country-flag-icons/react/3x2";
import { AlbumPanel, CareerArea, CareerPlayerBadge, PostMatchSummary } from "./career-panels";
import { claimWelcomePack, forfeitWelcomePack, normalizeStarXIState, removeStarXIPlayersFromSquad, startWelcomePack, toggleFavoriteCard, togglePinnedStarter, unlockWelcomePack, welcomePackOpen } from "./feature-data";
import { CLUB_BADGES, CLUB_COLORS, SEASON_MODE_MATCHES_PER_SEASON, STAR_FORMATIONS, STAR_PACKS, STAR_POSITIONS, STAR_XI_BASE_CARD_COUNT, STAR_XI_BENCH_SIZE, STAR_XI_ICON_CARD_COUNT, STAR_XI_MAX_SUBSTITUTIONS, SPECIAL_CARD_PACK, STAR_XI_SPECIAL_CARD_COUNT, STAR_XI_SQUAD_SIZE, STAR_XI_TOTAL_CARD_COUNT, TOURNAMENTS, activatePendingTransferLoans, addHistory, addStarXIPlayer, advanceCupMatch, applyCupSubstitution, applyPendingMatchChanges, beginCupMatch, beginSeasonCupMatch, canStarXIPlayerFillSlot, completeTournamentRun, getSpecialCardPackOdds, purchaseSpecialCardPack, finishActiveTransferLoans, getCupMatchMinute, getCupPlayerMatchRating, getGoalBoostMultiplier, getOpenTransferSquadVacancies, getRandomEventDelay, getRewardPackOdds, getSeasonModeDivisionLabel, getSeasonModeNextOpponent, getStarFormation, getStarPack, getStarXIEffectiveMatchRating, getStarXIPlayer, getStarXIPositions, getStarXIRating, getStarXISelection, getTournament, getTournamentRewardPack, getBestXIUnavailablePlayerIds, maybeGrantStarterSquad, STARTER_SQUAD_UNLOCK_CLICKS, getUnavailableStarXIPlayerIds, initialGameFeatures, isRewardPack, isTransferDeadlineDay, normalizeGameFeatures, openEarnedPack, openStarPack, pauseGameFeatureTimers, queueMatchChanges, recordSeasonModeMatch, releaseMatchSquad, resolveCupPenalty, getCupPenaltyStep, resolveRandomEvent, resolveTransferInsiderEvent, acceptTransferOffer, declineTransferOffer, expireTransferOffer, transferDeclinedLabel, resolveVarEvent, restoreStarXIAfterMatch, resumeCupMatch, setBestStarXI, setStarXIBenchPlayer, setStarXIFormation, setStarXIStarter, shouldTriggerPackTroll, getPrestigeBlockReason, getHomeCityBlockReason, chooseHomeCity, seasonMatchDuration, sortSeasonTable, tournamentMatchDuration } from "./feature-data";
import { DailyRewardCard } from "./daily-reward-panel";
import { FootballGraphic, Icon, StarXIPositionBadges } from "./game/ui";
import { LiveMatchViewer } from "./match-viewer";
import { AccountButton, AccountLink } from "./account-panel";
import { ConfirmDialog, useDialogFocus } from "./confirm-dialog";
import { PrestigeDialog, PrestigeVoteDialog, prestigeBonusLabel, prestigeBonusPercent } from "./prestige-dialog";
import { HomeCityCard } from "./home-city-picker";
import { homeCityOf, homeGroundLabel } from "./home-cities";
import type { HomeCityId } from "./home-cities";
import { WHATS_NEW } from "./whats-new";
import { WhatsNewDialog } from "./whats-new-dialog";
import { TutorialCoach, TutorialIntroDialog } from "./tutorial-panel";
import { SeasonTrophyCelebration, getSeasonTitle, type SeasonTitle } from "./season-trophy";
import { advanceTutorial, currentTutorialStep, finishedTutorial, tutorialAllowedTabs, tutorialStepTab, newTutorial, parseTutorialState, serializeTutorialState, type TutorialState, type TutorialStep } from "./tutorial";
import { TAB_PATHS, tabForPath } from "./tab-routes";
import type { RoutedTab } from "./tab-routes";
import { gameAudioContext, playPackReveal } from "./match-audio";
import { MatchAudio } from "./match-audio-player";
import { AccountContext, GuestContext } from "./account-gate";
import { FLUSH_SAVE_EVENT } from "./cloud-sync";
import { resolveSquadTap, SquadBenchCard, SquadBenchPanel, SquadBenchSlot, SquadPitchPanel, SquadPitchSlot, formatStarXIPositions, useSquadDrag } from "./squad-board";
import type { SquadPick } from "./squad-board";
import { SEASON_MILESTONES, getSeasonMilestone } from "./season-roadmap";
import { getFormationUnlockLeague, sortFormationsForPicker, getPackUnlockLeague, getReachedLeague, getTournamentUnlockLeague, getUpgradeUnlockLeague, isLeagueContentUnlocked, leagueForTier } from "./season-progression";
import { MULTIPLAYER_PROTOCOL_VERSION, MULTIPLAYER_UPDATE_MESSAGE } from "./multiplayer-protocol";
import { PressConferencePanel } from "./press-conference-panel";
import { TravelPanel, TravelStatsPanel, durationLabel } from "./travel-panel";
import { advanceLocalGameWhileOpen, claimLocalSave, getMiniGameCooldownUntil, initialGame, isLocalSaveWriter, markLocalSaveLoaded, normalizeAchievements, normalizeLayoutOrder, normalizeNickname, pauseMiniGameCooldowns, persistLocalGame, readStoredGame, suspendLocalPersistence } from "./game/storage";
import type { LocalSaveResult } from "./game/storage";
import { answerPressConference, getPressReward } from "./press-conference";
import { canVibrate, readVibrationSetting, setVibrationOn, vibrate, vibrationOn } from "./game/device";
import { albumMilestonesFromStorage, claimAlbumRewards, getCareerCard, getPlayerForm, prepareCareerMatch, recordCareerMatch, rivalryKey } from "./career-data";
import { competitionFor, competitionLabel, competitionOfCup, getBannedPlayerIds, nextCompetition, squadBanError, suspensionLabel } from "./discipline";
import { WORLD_DAILY_KEY, claimDailyReward, mergeDailyRewardsForWorld } from "./daily-reward";
import { confirmMatchDraft, requestMatchEdit } from "./match-commands";
import { consumeTravel, eligibilityError, fixtureFor, journeyView, payTravelFines, settleTravel, travelTiming } from "./travel-data";
import { COOP_UPDATE_REQUIRED_EVENT, coopLastActiveLabel, coopRetryDelay, coopRoleLabel, createCoopGameNormalizer, isCoopRole, multiplayerUrl, newCoopActionId, notifyCoopOffline, occupiedCoopPlayers, prestigeVoteMessage, readCoopResponse, reloadForUpdate, upsertSavedRoom } from "./game/coop";
import { capGoalsAfterRebalance, createClickResult, decayComboCount, formatComboMultiplier, getBaseClickPower, getBasePassivePower, getBulkPurchase, getClickPower, getComboLevel, getCost, getLevel, getPassivePower, getRank, getUpgradeEffect, normalizeUpgrades, scaleMiniGameReward } from "./game/economy";
import { UPGRADES } from "./game/upgrades";
import { applyGamePrestige } from "./game/prestige";
import { TransferOfferActions } from "./transfer-offer-actions";
import { pronounText } from "./player-pronouns";
import { LeaderboardPanel } from "./leaderboard-panel";
import { SeasonPanel } from "./season-panel";
import { expectedHomeCrowd, getTicketIncome, recordTicketIncome } from "./ticket-income";
import { directionLabel, directionWord, formatCountdown, formatGoalDifference, formatHistoryTime, formatNumber, formatPackChance, getRandomCrossbarHeight, getRandomMatchPrediction, getRandomPenaltyDirection, heightLabel, predictionLabel } from "./game/format";
import { getCurrentTime, getTravelTime, syncTravelClock } from "./game/clock";
import { getStarCardTier, getWalkoutPresentation } from "./walkout-data";
import { WalkoutAvatar } from "./walkout-avatar";
import { loadRouteCache } from "./travel-route-cache-lazy";
import { isAway, onReturn } from "./activity";
import { MAX_BACKGROUND_CATCH_UP_MS, takeBackgroundTime } from "./game/storage";
import { monotonicNow } from "./game/clock";
import { NEWER_VERSION_MESSAGE } from "./game/save-schema";
import { exportCurrentSave, SaveFileControls } from "./save-file-controls";
import { MATCH_RAN_WHILE_AWAY, matchRanWhileAway, missedMatchCaughtUp, summarizeMissedMatch } from "./match-missed";
import { claimWeeklyGoal, ensureWeeklyGoals, notePackOpened, weeklyGoalsNeedUpdate } from "./weekly-goals";
import { WeeklyGoalsPanel } from "./weekly-goals-panel";
import { appBadgeCount, claimableAlbumGroups, getOpenActions, returnSummary, sectionBadges, statusTitle } from "./qol/status";
import type { OpenAction } from "./qol/status";
import { NextStepsStrip } from "./qol/next-steps";
import { SavingsGoalBar, UpgradeHints } from "./qol/shop-hints";
import { addPassiveGoals, createPassiveGoalsStore } from "./game/live-goals";
import { ClickBallButton, ComboMeter, FloatingClickNumbers, LiveGoalCount, createClickFeedbackStore } from "./game/live-display";
import { bestValueUpgrade, nextLevelGain, savingsHint } from "./qol/economy-hints";
import { parseSavingsGoal, pickStringFields, type SavingsGoal } from "./qol/prefs";
import { bestRatingPerFormation, benchChangeCount, describeReplacements, fillStarXIGaps, formatRatingDelta, lineupChanges, movePlayerToEmptyBench, movePlayerToReserve, ratingAfterLineupMove, withBestBench } from "./game/lineup-tools";
import type { LineupChange } from "./game/lineup-tools";
import { KickoffChecklist, type KickoffItem } from "./qol/kickoff-checklist";
import { abandonTournamentBlockReason, abandonTournamentRun } from "./game/tournament-abandon";
import { HISTORY_TOPICS, filterHistory, historyActors, type HistoryTopic } from "./qol/history-filter";
import { inviteUrl, joinCodeFromSearch, shortcutFor } from "./qol/invite";
import { newNotifiableActions, setAppBadge, showLocalNotification } from "./qol/notifications";
import { DeviceSettingsPanel, type SoundPrefs } from "./qol/device-settings";
import { nextToast, pushToast, toastDuration, type ToastPriority, type ToastQueueState } from "./qol/toast-queue";
import { PREF_KEYS, parsePurchaseMode, readJsonPref, readPref, writeJsonPref, writePref } from "./qol/prefs";
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dataText } from "./i18n/data-text";
import { currentLocale, localizeText, t } from "./i18n/runtime";
import { useLocale } from "./i18n/use-locale";


type FeatureTab = RoutedTab;

const WALKOUT_COUNTRY_FLAGS: Record<string, typeof FR> = {
  AL, AR, AT, AU, AZ, BA, BE, BF, BG, BR, CA, CD, CH, CI, CL, CM, CN, CO, CR, CZ, DE, DK, DZ, EC, EG,
  EN: GB_ENG, ES, FI, FR, GE, GH, GM, GN, GR, GT, HR, HT, HU, IE, IL, IS, IT, JM, JP, KN, KR, MA, ME, ML,
  MW, MX, NG, NI: GB_NIR, NL, NO, NZ, PA, PH, PL, PT, PY, RO, RS, RU, SC: GB_SCT, SE, SI, SK, SN, SR, TR,
  UA, US, UY, VE, WA: GB_WLS, XK, ZA, ZM,
};

function WalkoutCountryFlag({ code, country, compact = false }: { code: string; country: string; compact?: boolean }) {
  const Flag = WALKOUT_COUNTRY_FLAGS[code] ?? CH;
  return <Flag className={compact ? "walkout-country-flag compact" : "walkout-country-flag"} role="img" aria-label={t("logic.flagOf", { country })} />;
}












const ANNOUNCEMENT_AUTO_CLOSE_MS = 8500;

/** True while the pointer is over the element, focus is inside it or one of its <details> is open. */
function useAnnouncementHold(ref: RefObject<HTMLElement | null>, open: boolean) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    let hover = false;
    const update = () => setHeld(hover || element.contains(document.activeElement) || Boolean(element.querySelector("details[open]")));
    const enter = () => { hover = true; update(); };
    const leave = () => { hover = false; update(); };
    const blur = () => window.setTimeout(update, 0);
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", update);
    element.addEventListener("focusout", blur);
    element.addEventListener("toggle", update, true);
    update();
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", update);
      element.removeEventListener("focusout", blur);
      element.removeEventListener("toggle", update, true);
      setHeld(false);
    };
  }, [ref, open]);
  return held;
}

const TAB_TITLES: Partial<Record<FeatureTab, string>> = { home: "Home", cup: "Spiele", season: "Saison", squad: "Kader", career: "Karriere", packs: "Packshop", album: "Sammelalbum", club: "Clubprofil", fabrizio: "Fabrizio", missions: "Wochenziele", leaderboard: "Rangliste", history: "Verlauf" };

function primarySectionOf(tab: FeatureTab) {
  return tab === "album" ? "packs" : ["fabrizio", "missions", "leaderboard", "history"].includes(tab) ? "club" : tab;
}

const SAVE_FAILED_MESSAGE = "Speichern fehlgeschlagen: Der Browser Speicher ist voll. Sichere deinen Spielstand als Datei, bevor du die Seite schliesst.";
/** A waiting co-op world without input for this long is polled every COOP_IDLE_POLL_MS instead of every 1.5 s. */
const COOP_IDLE_AFTER_MS = 30_000;
const COOP_IDLE_POLL_MS = 4000;
const STAR_WALKOUT_ANIMATION_MS = 9500;
const STAR_TOP_WALKOUT_ANIMATION_MS = 11500;
const STAR_WALKOUT_READY_MS = 7500;
const STAR_TOP_WALKOUT_READY_MS = 10900;

/** With reduced motion the reveal skips its animations and is ready almost at once. */
const STAR_REVEAL_REDUCED_MOTION_READY_MS = 700;
/** A player who has seen one walkout may skip the next ones after this long. */

function prefersReducedMotion() {
  try { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

function getStarRevealReadyDelay(reveal: StarPackReveal) {
  if (prefersReducedMotion() && getStarCardTier(reveal.player) !== "standard") return STAR_REVEAL_REDUCED_MOTION_READY_MS;
  const tier = getStarCardTier(reveal.player);
  const trollDelay = reveal.troll && (tier === "walkout" || tier === "icon" || tier === "legendary") ? PACK_TROLL_INTRO_MS : 0;
  if (tier === "rare") return STAR_RARE_REVEAL_DURATION_MS;
  if (tier === "walkout" || tier === "icon" || tier === "legendary") return trollDelay + (reveal.player.rating >= 90 ? STAR_TOP_WALKOUT_READY_MS : STAR_WALKOUT_READY_MS);
  return 0;
}



function mergeCoopSessionRoom(current: CoopSession | null, room: CoopRoom, role?: CoopRole) {
  if (!current || current.code !== room.code || room.revision < current.room.revision) return current;
  // A slim answer keeps the features this client already has; without matching ones it waits for a full answer.
  if (room.featuresOmitted) {
    if (!current.room.featuresKey || current.room.featuresKey !== room.featuresKey || !current.room.game?.features) return current;
    room = { ...room, featuresOmitted: false, game: { ...room.game, features: current.room.game.features } };
  }
  return { ...current, room, role: role ?? current.role };
}




























function formatStableInteger(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, currentLocale() === "en" ? "," : "'");
}



























export function App() {
  // The game re-renders when the player switches the language (texts already moved to the catalogue follow it).
  useLocale();
  const packPurchaseRef = useRef(false);
  const starterSquadRequestedRef = useRef(false);
  const [starterSquadRetry, setStarterSquadRetry] = useState(0);
  const travelActionRef = useRef(false);
  const [travelBusy, setTravelBusy] = useState(false);
  const [game, setGameState] = useState<GameState>(initialGame);
  // Passive ticks collect in this store and reach the state about once per second (audit P09); every other game
  // update first adds them, so purchases, rewards and saves see exactly the goals the old 200 ms commits gave.
  const [passiveGoals] = useState(() => createPassiveGoalsStore(initialGame().goals));
  const flushPassiveGoals = useCallback(() => {
    const amount = passiveGoals.takePending();
    if (amount) setGameState((current) => addPassiveGoals(current, amount));
  }, [passiveGoals]);
  const setGame = useCallback((update: SetStateAction<GameState>) => {
    flushPassiveGoals();
    setGameState(update);
  }, [flushPassiveGoals]);
  const [hydrated, setHydrated] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  // Finished until the start decides: only a brand new club gets the tutorial.
  const [tutorial, setTutorialState] = useState<TutorialState>(finishedTutorial);
  // Ending the tutorial before the welcome pack was opened asks first: the pack would be lost for good.
  const [tutorialEndDialog, setTutorialEndDialog] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("single");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const account = useContext(AccountContext);
  // A guest plays single player only; co-op needs an account.
  const guest = useContext(GuestContext);
  const [guestCoopPrompt, setGuestCoopPrompt] = useState(false);
  // Milestone bonuses in the album: remembered with the account; a guest always starts with the original ratings.
  const [albumMilestones, setAlbumMilestonesState] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = guest ? null : localStorage.getItem(ALBUM_MILESTONES_STORAGE_KEY); } catch { /* the default applies */ }
    const show = albumMilestonesFromStorage(stored, Boolean(guest));
    window.setTimeout(() => setAlbumMilestonesState(show), 0);
  }, [guest]);
  function setAlbumMilestones(show: boolean) {
    setAlbumMilestonesState(show);
    if (guest) return;
    try { localStorage.setItem(ALBUM_MILESTONES_STORAGE_KEY, show ? "on" : "off"); } catch { /* only this visit remembers it */ }
  }
  // With an account the display name of the profile is the nickname in every world.
  const coopNickname = account?.profile.displayName ?? playerName;
  const [coopCodeInput, setCoopCodeInput] = useState("");
  const [coopRoomName, setCoopRoomName] = useState("Meine Welt");
  const [coopSession, setCoopSession] = useState<CoopSession | null>(null);
  const [confirmSingle, setConfirmSingle] = useState(false);
  // Open Prestige dialog with its own request id: a double click or a retry starts one Prestige only.
  // `prestigeCount`: the count when the dialog opened; when it changes (another seat started Prestige), the dialog closes.
  const [prestigeDialog, setPrestigeDialog] = useState<{ requestId: string; error: string; prestigeCount: number } | null>(null);
  const prestigeConfirmedRef = useRef(new Set<string>());
  // Seat management: leave the own seat, or (host) remove a member. Always asked in a ConfirmDialog first.
  const [seatDialog, setSeatDialog] = useState<{ kind: "leave" } | { kind: "kick"; role: CoopRole; name: string; inactive: boolean; activity: string } | null>(null);
  // An open co-op Prestige vote the player hid (by vote id); it comes back with the next vote.
  const [hiddenPrestigeVote, setHiddenPrestigeVote] = useState("");
  const shownVoteResultRef = useRef("");
  // The md5 of the shared features this client holds; polls send it so the server can leave them out.
  const coopFeaturesKeyRef = useRef("");
  const missedMatchRef = useRef<{ since: number; until: number; matchStartedAt: number } | null>(null);
  const [savedRooms, setSavedRooms] = useState<CoopRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [coopMessage, setCoopMessage] = useState("");
  // A newer server refused this client's protocol: a banner offers the reload instead of reloading mid action.
  const [coopUpdateRequired, setCoopUpdateRequired] = useState(false);
  useEffect(() => {
    const onUpdateRequired = () => setCoopUpdateRequired(true);
    window.addEventListener(COOP_UPDATE_REQUIRED_EVENT, onUpdateRequired);
    return () => window.removeEventListener(COOP_UPDATE_REQUIRED_EVENT, onUpdateRequired);
  }, []);
  const [coopBusy, setCoopBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [purchaseMode, setPurchaseModeState] = useState<PurchaseMode>(1);
  const [featureTab, setFeatureTabState] = useState<FeatureTab>("home");
  const [selectedTournamentId, setSelectedTournamentId] = useState<TournamentId>("stadium");
  // The buy mode and the last chosen tournament stay on this device (app/qol/prefs.ts).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPurchaseModeState(parsePurchaseMode(readPref(PREF_KEYS.purchaseMode)));
      const tournament = readPref(PREF_KEYS.tournament);
      if (tournament && TOURNAMENTS.some((item) => item.id === tournament)) setSelectedTournamentId(tournament as TournamentId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function setPurchaseMode(mode: PurchaseMode) { setPurchaseModeState(mode); writePref(PREF_KEYS.purchaseMode, String(mode)); }
  function chooseTournament(id: TournamentId) { setSelectedTournamentId(id); writePref(PREF_KEYS.tournament, id); }
  const [selectedLineupSlot, setSelectedLineupSlot] = useState<number | null>(null);
  const [selectedBenchSlot, setSelectedBenchSlot] = useState<number | null>(null);
  const [selectedReserveId, setSelectedReserveId] = useState<string | null>(null);
  // "Beste Startelf" shows its changes first (Q22); after applying, one step back is possible (single player).
  const [bestXIPreview, setBestXIPreview] = useState<{ after: StarXIState; changes: LineupChange[]; bench: number; before: number; rating: number } | null>(null);
  const [squadUndo, setSquadUndo] = useState<{ lineupIds: string[]; benchIds: string[]; formationId: string; signature: string } | null>(null);
  const [formationRatings, setFormationRatings] = useState<Partial<Record<StarFormationId, number>>>({});
  const [starRatingFilter, setStarRatingFilter] = useState("all");
  const [starPositionFilter, setStarPositionFilter] = useState("all");
  const [starSearch, setStarSearch] = useState("");
  // Reserve sort and filters (Q32 to Q36), remembered on this device (Q35).
  const [reserveSort, setReserveSort] = useState("ovr");
  const [reserveType, setReserveType] = useState("all");
  const [reserveStatus, setReserveStatus] = useState("all");
  const [reserveOnlyCompatible, setReserveOnlyCompatible] = useState(false);
  const reserveFiltersLoadedRef = useRef(false);
  useEffect(() => {
    const saved = readJsonPref(PREF_KEYS.reserveFilters, (value) => pickStringFields(value, { rating: "all", position: "all", sort: "ovr", type: "all", status: "all" }, { rating: STAR_RATING_FILTERS.map((filter) => filter.id), position: ["all", ...STAR_POSITIONS], sort: RESERVE_SORTS.map((item) => item.id), type: RESERVE_TYPES.map((item) => item.id), status: RESERVE_STATUS_FILTERS.map((item) => item.id) }));
    const timer = window.setTimeout(() => { setStarRatingFilter(saved.rating); setStarPositionFilter(saved.position); setReserveSort(saved.sort); setReserveType(saved.type); setReserveStatus(saved.status); reserveFiltersLoadedRef.current = true; }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  // Cards that came since the last visit of the Kader tab carry "NEU" during the next visit (Q37, per device).
  const [newCardIds, setNewCardIds] = useState<ReadonlySet<string>>(new Set());
  const [reservePage, setReservePage] = useState(0);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutOrder, setLayoutOrder] = useState<LayoutCardId[]>(DEFAULT_LAYOUT_ORDER);
  const [layoutReady, setLayoutReady] = useState(false);
  const [draggingLayoutCard, setDraggingLayoutCard] = useState<LayoutCardId | null>(null);
  const [dragOverLayoutCard, setDragOverLayoutCard] = useState<LayoutCardId | null>(null);
  const squadDrag = useSquadDrag({
    canDrop: canDropSquadPlayer,
    onDrop: dropSquadPlayer,
    onBlocked: () => showToast(t("logic.subNotPossible")),
    locked: (source) => layoutEditMode || coopBusy || (source.area === "reserve" && displayGame.features.cup.active),
    picked: () => pickedSquadSpot()?.source ?? null,
  });
  const draggingSquadPlayer = squadDrag.dragging;
  // Each tab has its own address; the game page stays mounted, only the history entry changes.
  function openFeatureTab(tab: FeatureTab) {
    // While the tutorial runs only the tabs of the current step open; the rest belongs to a later step.
    if (tutorialLockRef.current && !tutorialLockRef.current.includes(primarySectionOf(tab) as RoutedTab)) { showToast(t("logic.laterTutorial")); return; }
    // A new main section starts at the top with focus on its heading; a sub tab of the same section keeps the place.
    if (tab !== featureTab && primarySectionOf(tab) !== primarySectionOf(featureTab)) tabFocusPendingRef.current = true;
    setFeatureTabState(tab);
    const path = TAB_PATHS[tab];
    if (typeof window !== "undefined" && tabForPath(window.location.pathname) !== tab) window.history.pushState(null, "", `${path}${window.location.search}${window.location.hash}`);
  }
  // The tabs the tutorial step allows right now (null: no tutorial lock). A ref, so every way of opening a tab sees the same state.
  const tutorialLockRef = useRef<readonly RoutedTab[] | null>(null);
  const tabFocusPendingRef = useRef(false);
  useEffect(() => {
    if (!tabFocusPendingRef.current) return;
    tabFocusPendingRef.current = false;
    window.scrollTo({ top: 0, behavior: "auto" });
    const heading = [...document.querySelectorAll<HTMLElement>("main h2, main h3, main h4")].find((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [featureTab]);
  useLayoutEffect(() => {
    const sync = () => setFeatureTabState(tabForPath(window.location.pathname));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const [clubDraft, setClubDraft] = useState(initialGameFeatures().club);
  const [eventAnnouncement, setEventAnnouncement] = useState<RandomEvent | null>(null);
  const [transferAnnouncement, setTransferAnnouncement] = useState<TransferInsiderEvent | null>(null);
  const [gazetteAnnouncement, setGazetteAnnouncement] = useState<TournamentGazetteIssue | null>(null);
  const [cupCardAnnouncement, setCupCardAnnouncement] = useState<CupCardEvent | null>(null);
  const gazetteCardRef = useRef<HTMLDivElement>(null);
  const [seasonTitle, setSeasonTitle] = useState<SeasonTitle | null>(null);
  const [starReveal, setStarReveal] = useState<StarPackReveal | null>(null);
  const [starWalkoutReady, setStarWalkoutReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let query: MediaQueryList;
    try { query = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { return; }
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  // How far the reveal had already run when it appeared (after a reload); fixed for the whole animation.
  const [starRevealLag, setStarRevealLag] = useState(0);
  const packSoundRef = useRef<(() => void) | null>(null);
  const [activeMiniGame, setActiveMiniGame] = useState<MiniGameId | null>(null);
  const [penaltyGame, setPenaltyGame] = useState<PenaltyGame | null>(null);
  const [dribbleGame, setDribbleGame] = useState<DribbleGame | null>(null);
  const [crossbarGame, setCrossbarGame] = useState<CrossbarGame | null>(null);
  const [predictionGame, setPredictionGame] = useState<PredictionGame | null>(null);
  const [countdownNow, setCountdownNow] = useState(getCurrentTime);
  // Ball pulse, floating numbers and combo meter re-render on their own (audit P09).
  const [clickFeedback] = useState(createClickFeedbackStore);
  const [toastState, setToastState] = useState<ToastQueueState>({ current: null, queue: [] });
  const toast = toastState.current?.text ?? "";
  const [offline, setOffline] = useState("");
  const saveFailedRef = useRef(false);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([{ id: 1, icon: "broadcast", text: t("logic.fansHere") }]);
  const gameRef = useRef(game);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);
  const streakRef = useRef(0);
  const comboRef = useRef({ count: 0, last: 0, paused: false, multiplier: 1 });
  const comboTimerRef = useRef<number | null>(null);
  const [vibrationEnabled, setVibrationEnabled] = useState(readVibrationSetting);
  // Sound is split into effects (clicks, packs) and stadium (live match); the header switch turns both off.
  const [soundPrefs, setSoundPrefsState] = useState<SoundPrefs>({ effects: true, stadium: true });
  const soundPrefsRef = useRef(soundPrefs);
  useEffect(() => {
    const timer = window.setTimeout(() => setSoundPrefsState(readJsonPref(PREF_KEYS.stadiumSound, (value) => { const source = value && typeof value === "object" ? value as Partial<SoundPrefs> : {}; return { effects: source.effects !== false, stadium: source.stadium !== false }; })), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { soundPrefsRef.current = soundPrefs; }, [soundPrefs]);
  function setSoundPrefs(next: SoundPrefs) { setSoundPrefsState(next); writeJsonPref(PREF_KEYS.stadiumSound, next); }
  const [whatsNewArchive, setWhatsNewArchive] = useState(false);
  const [abandonDialog, setAbandonDialog] = useState(false);
  const [historyTopic, setHistoryTopic] = useState<HistoryTopic>("all");
  const [historyActor, setHistoryActor] = useState("");
  // A co-op action that failed: the chip offers to send it again with the same action id (Q64).
  const [coopFailed, setCoopFailed] = useState<{ action: string; extra: Record<string, unknown> } | null>(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [pressBusy, setPressBusy] = useState(false);
  const clubGoalRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const starRevealTimerRef = useRef<number | null>(null);
  const cupCardTimerRef = useRef<number | null>(null);
  const seasonHistoryRef = useRef<string | null>(null);
  const feedIdRef = useRef(2);
  const coopStatusRef = useRef<CoopRoom["status"] | null>(null);
  const coopPlayerCountRef = useRef(0);
  const coopEventRef = useRef<number | null>(null);
  const transferEventRef = useRef<number | null>(null);
  const gazetteIssueRef = useRef<string | null>(null);
  const coopPackRevealRef = useRef<number | null>(null);
  const eventAnnouncementRef = useRef<RandomEvent | null>(null);
  const eventAnnouncementQueueRef = useRef<RandomEvent[]>([]);
  const coopClickBatchRef = useRef({ amount: 0, count: 0 });
  const coopClickBatchTimerRef = useRef<number | null>(null);
  const coopClickInFlightRef = useRef(false);
  const coopMiniGameStartingRef = useRef(false);
  const cupGoalRef = useRef<string | null>(null);
  const cupCardRef = useRef<string | null>(null);
  const coopControlQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const coopBackgroundActionRef = useRef<Promise<unknown> | null>(null);
  const coopForegroundPendingRef = useRef(0);
  const eventLockRef = useRef(false);
  const coopRestoreAttemptedRef = useRef(false);
  const pageInactiveAtRef = useRef<number | null>(null);

  const activeCoopCode = coopSession?.code;
  const coopFeaturesKey = coopSession?.room.featuresKey ?? "";
  useEffect(() => { coopFeaturesKeyRef.current = coopFeaturesKey; }, [coopFeaturesKey]);
  const activeCoopPlayerId = coopSession?.playerId;

  const loadSavedRooms = useCallback(async () => {
    if (!playerId) return;
    setRoomsLoading(true);
    try {
      const response = await fetch(multiplayerUrl({ list: "1", playerId }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok) throw new Error(data.error ?? t("logic.roomsLoadFailed"));
      setSavedRooms(data.rooms ?? []);
    } catch (error) {
      if (appMode === "coop") setCoopMessage(error instanceof Error ? error.message : t("logic.roomsLoadFailed"));
    } finally {
      setRoomsLoading(false);
    }
  }, [appMode, playerId]);

  const restoreCoopRoom = useCallback(async () => {
    const raw = localStorage.getItem(COOP_ROOM_KEY);
    if (!raw || !playerId) return;
    let stored: { code?: unknown; role?: unknown; playerId?: unknown } = {};
    try { stored = JSON.parse(raw) as { code?: unknown; role?: unknown; playerId?: unknown }; } catch { return; }
    const code = typeof stored.code === "string" ? stored.code.trim().toUpperCase().slice(0, 6) : "";
    if (code.length !== 6) return;
    try {
      const storedPlayerId = typeof stored.playerId === "string" ? stored.playerId : "";
      const candidateIds = [...new Set([storedPlayerId, playerId, ...LEGACY_PLAYER_ID_KEYS.map((key) => localStorage.getItem(key) ?? "")].filter((value) => value.length >= 8))];
      for (const candidateId of candidateIds) {
        const response = await fetch(multiplayerUrl({ code, playerId: candidateId }), { cache: "no-store" });
        const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
        if (response.status === 404) {
          localStorage.removeItem(COOP_ROOM_KEY);
          return;
        }
        if (!response.ok || !data.room) continue;
        localStorage.setItem(PLAYER_ID_KEY, candidateId);
        if (candidateId !== playerId) setPlayerId(candidateId);
        coopStatusRef.current = data.room.status;
        coopPlayerCountRef.current = data.room.playerCount;
        setSavedRooms((current) => upsertSavedRoom(current, data.room!));
        setCoopSession({ code: data.room.code, role: data.role ?? (isCoopRole(stored.role) ? stored.role : "host"), playerId: candidateId, room: data.room });
        setAppMode("coop");
        setCoopMessage(t("logic.roomReopened"));
        return;
      }
      const nickname = normalizeNickname(localStorage.getItem(PLAYER_NAME_KEY) ?? playerName);
      if (nickname.length < 2) return;
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", code, playerId, nickname, preferredRole: stored.role, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      // Left or removed meanwhile: the stored room is forgotten, the player rejoins with the code if they want to.
      if (response.status === 403) { localStorage.removeItem(COOP_ROOM_KEY); if (data.error) setCoopMessage(data.error); return; }
      if (!response.ok || !data.room) return;
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? (isCoopRole(stored.role) ? stored.role : "host"), playerId, room: data.room });
      setAppMode("coop");
      setCoopMessage(t("logic.seatRestored"));
    } catch {
      setCoopMessage(t("logic.savedRoomUnreachable"));
    }
  }, [playerId, playerName]);

  const syncCoopRoom = useCallback(async () => {
    if (!activeCoopCode || !activeCoopPlayerId) return;
    try {
      const response = await fetch(multiplayerUrl({ code: activeCoopCode, playerId: activeCoopPlayerId, featuresKey: coopFeaturesKeyRef.current }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok) {
        // 404: the world was deleted. 403: the seat was given up or the host removed this player; the world is no
        // longer this player's, also not after a reload (the server refuses taking a free seat back by itself).
        if (response.status === 404 || response.status === 403) {
          localStorage.removeItem(COOP_ROOM_KEY);
          coopStatusRef.current = null;
          coopPlayerCountRef.current = 0;
          setCoopSession(null);
          if (response.status === 403) setSavedRooms((current) => current.filter((room) => room.code !== activeCoopCode));
          void loadSavedRooms();
        }
        if (response.status === 403) setCoopMessage(t("logic.notInWorld"));
        else if (data.error) setCoopMessage(data.error);
        return;
      }
      if (data.room) {
        const previousStatus = coopStatusRef.current;
        const previousPlayerCount = coopPlayerCountRef.current;
        coopStatusRef.current = data.room.status;
        coopPlayerCountRef.current = data.room.playerCount;
        setSavedRooms((current) => upsertSavedRoom(current, data.room!));
        if (previousStatus && previousStatus !== data.room.status) setCoopMessage(data.room.status === "live" ? t("logic.secondConnected") : t("logic.waitingSecond"));
        else if (previousPlayerCount && previousPlayerCount !== data.room.playerCount) setCoopMessage(data.room.playerCount > previousPlayerCount ? t("logic.nowInWorld", { playerCount: data.room.playerCount }) : t("logic.stillInWorld", { playerCount: data.room.playerCount }));
        setCoopSession((current) => mergeCoopSessionRoom(current, data.room!, data.role));
      }
    } catch {
      setCoopMessage(t("logic.coopDisconnected"));
    }
  }, [activeCoopCode, activeCoopPlayerId, loadSavedRooms]);

  const rawCoopGame = coopSession?.room.game;
  const [normalizeCoopGame] = useState(createCoopGameNormalizer);
  const normalizedCoopGame = useMemo(() => coopSession?.room.status === "live" ? normalizeCoopGame(rawCoopGame, game.sound) : null, [coopSession?.room.status, game.sound, rawCoopGame, normalizeCoopGame]);
  const isCoopLive = appMode === "coop" && coopSession?.room.status === "live" && Boolean(normalizedCoopGame);
  const displayGame = isCoopLive && normalizedCoopGame ? { ...normalizedCoopGame, sound: game.sound, lastSaved: game.lastSaved } : game;
  const hasFullTestAccess = isCoopLive && Boolean(coopSession?.room.testMode);
  const hasInfiniteMoney = hasFullTestAccess;
  const spendableGoals = hasInfiniteMoney ? Number.MAX_VALUE : displayGame.goals;
  // The local club's counter follows every passive tick through the store; a co-op world shows its own total.
  const displayBalance = <LiveGoalCount store={passiveGoals} fixed={hasInfiniteMoney ? "∞" : displayGame === game ? null : formatNumber(displayGame.goals)} />;
  const soloJourneyId = !isCoopLive && !game.features.travel.journey?.consumed ? game.features.travel.journey?.id : undefined;
  useEffect(() => {
    if(!hydrated||!playerId||!soloJourneyId)return;
    let stopped=false;
    const sync=async()=>{try{
      // A journey that already has its route asks for the status without it (the plan of a journey never changes).
      const local=gameRef.current.features.travel.journey,planStartedAt=local?.id===soloJourneyId&&local.plan?local.startedAt:undefined;
      const response=await fetch('/api/travel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'status',playerId,fixtureId:soloJourneyId,planStartedAt})});
      const data=await response.json() as {journey?:Journey;serverNow?:number;planOmitted?:boolean};
      const serverJourney=data.journey, serverNow=data.serverNow;
      if(stopped||!response.ok||!serverJourney||typeof serverNow!=='number'||!Number.isFinite(serverNow))return;
      syncTravelClock(serverNow);
      setGame(current=>{
        if(current.features.travel.journey?.id!==soloJourneyId)return current;
        const old=current.features.travel;
        const plan=data.planOmitted?old.journey!.startedAt===serverJourney.startedAt?old.journey!.plan:undefined:serverJourney.plan;
        if(data.planOmitted&&!plan)return current;
        const j={...serverJourney,...(plan?{plan}:{}),consumed:old.journey!.consumed};
        const counted=(old.journey as Journey & {counted?:boolean}).counted, finesPaid=old.journey!.finesPaid;
        const travel=settleTravel({...old,journey:{...j,counted,finesPaid} as Journey},serverNow);
        return {...current,features:{...current.features,travel,squadLock:serverJourney.squadLock}};
      });
    }catch{ /* Last authoritative clock continues; kickoff always revalidates. */ }};
    void sync();const timer=window.setInterval(()=>{const j=gameRef.current.features.travel.journey;if(j&&!isAway()&&!journeyView(j,getTravelTime()).arrived)void sync();},5000);
    const visible=()=>{if(document.visibilityState==='visible')void sync();};
    document.addEventListener('visibilitychange',visible);
    return ()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[hydrated,playerId,soloJourneyId,setGame]);
  // Fines from the journey (speeding, parking) are paid once the team has arrived.
  const soloJourney = !isCoopLive ? game.features.travel.journey : null;
  const soloFinesDue = Boolean(soloJourney && !soloJourney.finesPaid && soloJourney.events.some((event) => event.fine) && countdownNow >= soloJourney.endsAt);
  useEffect(() => {
    if (!hydrated || !soloFinesDue) return;
    setGame((current) => {
      const features = { ...current.features };
      const fine = payTravelFines(features, current.goals, getBasePassivePower(current.upgrades, current.stars, current.features), getTravelTime());
      if (!features.travel.journey?.finesPaid) return current;
      return { ...current, features, goals: current.goals - fine, seasonGoals: Math.max(0, current.seasonGoals - fine) };
    });
    // countdownNow re-runs it each second, because the travel clock may reach the arrival a moment later.
  }, [hydrated, soloFinesDue, countdownNow, setGame]);
  const sharedRandomEvent = isCoopLive ? displayGame.features.randomEvent : null;
  const visibleTransferEvent = displayGame.features.transferSaga.latestEvent;
  const visibleGazetteIssue = displayGame.features.gazetteIssues.at(-1) ?? null;
  const sharedPackReveal = isCoopLive ? displayGame.features.starPackReveal : null;
  const displayedCupGoal = displayGame.features.cup.lastGoal;
  const displayedCupCard = displayGame.features.cup.cardEvents.slice(-1)[0] ?? null;
  const cupMatchMinute = getCupMatchMinute(displayGame.features.cup, countdownNow);
  const deadlineDayActive = isTransferDeadlineDay(displayGame.features, countdownNow);
  const deadlineDayLabel = formatCountdown(displayGame.features.transferSaga.deadlineDayEndsAt, countdownNow);
  const tournamentCooldownActive = !displayGame.features.cup.active && !displayGame.features.cup.pendingNextRound && displayGame.features.cup.nextTournamentAt > countdownNow;
  const tournamentCooldownLabel = formatCountdown(displayGame.features.cup.nextTournamentAt, countdownNow);
  const starRevealAge = starReveal ? Math.max(0, countdownNow - starReveal.openedAt) : 0;
  const starRevealIsCustomDraw = starReveal?.source === "custom-draw";
  const starRevealAction = starRevealIsCustomDraw ? t("logic.drewSpecial") : t("logic.openedPack");
  const starRevealKicker = starRevealIsCustomDraw ? t("logic.randomSpecial") : starReveal ? t("logic.packOpenedEyebrow", { packName: dataText(starReveal.packName) }) : "";
  const starRevealTier = starReveal ? getStarCardTier(starReveal.player) : "standard";
  const starRevealIsWalkout = starRevealTier === "walkout" || starRevealTier === "icon" || starRevealTier === "legendary";
  const starRevealIsIconic = starRevealTier === "icon";
  const starRevealIsLegendary = starRevealTier === "legendary";
  const starRevealIsRare = starRevealTier === "rare";
  const starRevealTrollActive = Boolean(starReveal?.troll && starRevealIsWalkout && starRevealAge < PACK_TROLL_INTRO_MS && !reducedMotion);
  // Honest reveal button (Q19): where the new card is now, and whether putting it into the eleven raises the rating.
  const revealPlacement = useMemo(() => {
    if (!starReveal || starReveal.duplicate) return null;
    const id = starReveal.player.id, squad = displayGame.features.starXI;
    if (!squad.ownedIds.includes(id)) return null;
    if (squad.lineupIds.includes(id)) return { kind: "lineup" as const, slot: -1, delta: 0 };
    let best: { kind: "upgrade"; slot: number; delta: number } | null = null;
    if (!displayGame.features.cup.active) {
      const current = getStarXIRating(squad.ownedIds, squad.lineupIds);
      for (let slot = 0; slot < STAR_XI_SQUAD_SIZE; slot += 1) {
        if (!canStarXIPlayerFillSlot(id, slot, squad.formationPositions)) continue;
        const delta = ratingAfterLineupMove(squad, id, slot) - current;
        if (delta > 0 && (!best || delta > best.delta)) best = { kind: "upgrade", slot, delta };
      }
    }
    return best ?? { kind: squad.benchIds.includes(id) ? "bench" as const : "reserve" as const, slot: -1, delta: 0 };
  }, [starReveal, displayGame.features.starXI, displayGame.features.cup.active]);
  const revealContinueLabel = starReveal?.duplicate ? t("logic.continue") : revealPlacement?.kind === "lineup" ? t("logic.continueXI") : revealPlacement?.kind === "bench" ? t("logic.continueBench") : t("logic.continueSquad");
  const revealLineupButton = starReveal && revealPlacement?.kind === "upgrade" ? <button type="button" className="mode-primary star-reveal-lineup" disabled={coopBusy} onClick={() => { const id = starReveal.player.id, slot = revealPlacement.slot; dismissStarReveal(); void moveStarXIPlayerToLineup(id, slot); }}>{t("logic.intoXI")}{formatRatingDelta(revealPlacement.delta)})</button> : null;
  const starRevealTrollDelay = starReveal?.troll && starRevealIsWalkout ? PACK_TROLL_INTRO_MS : 0;
  const starWalkoutIsTop = starRevealIsWalkout && (starReveal?.player.rating ?? 0) >= 90;
  const starWalkoutConfetti = starRevealIsLegendary || starWalkoutIsTop ? GOLD_CONFETTI : starRevealIsIconic ? SILVER_CONFETTI : null;
  const starWalkoutAnimationDuration = starWalkoutIsTop ? STAR_TOP_WALKOUT_ANIMATION_MS : STAR_WALKOUT_ANIMATION_MS;
  // The CSS animations start once and keep their own clock. Their delay must not follow the one-second
  // countdown tick, otherwise every tick pushes them forward and the reveal races through in a second.
  const starWalkoutElapsed = Math.min(starWalkoutAnimationDuration, Math.max(0, starRevealLag - starRevealTrollDelay));
  const starRareElapsed = Math.min(STAR_RARE_REVEAL_DURATION_MS, starRevealLag);
  const starWalkoutPresentation = starReveal ? getWalkoutPresentation(starReveal.player) : null;
  const starWalkoutStyle = starWalkoutPresentation ? {
    "--walkout-skin": starWalkoutPresentation.skin,
    "--walkout-hair": starWalkoutPresentation.hairColor,
    "--walkout-primary": starWalkoutPresentation.kitPrimary,
    "--walkout-secondary": starWalkoutPresentation.kitSecondary,
    "--walkout-boots": starWalkoutPresentation.boots,
    "--walkout-height": starWalkoutPresentation.height,
    "--walkout-build": starWalkoutPresentation.build,
    "--walkout-duration": `${starWalkoutAnimationDuration}ms`,
    "--walkout-delay": `${-starWalkoutElapsed}ms`,
    "--rare-delay": `${-starRareElapsed}ms`,
  } as CSSProperties : undefined;
  const otherCoopOnlineCount = isCoopLive && coopSession ? coopSession.room.players.filter((player) => player.occupied && player.role !== coopSession.role && player.online).length : 0;
  const otherCoopOnline = otherCoopOnlineCount > 0;
  const displayClubName = displayGame.features.club.name;
  const displayClubBadge = displayGame.features.club.badge;
  const displayClubColor = displayGame.features.club.color;
  const starXIState = displayGame.features.starXI;
  const ownedStarIds = starXIState.ownedIds;
  const lineupStarIds = starXIState.lineupIds;
  const benchStarIds = starXIState.benchIds;
  const ownedStarXIPlayers = useMemo(() => ownedStarIds.map((id) => getStarXIPlayer(id)).filter((player): player is NonNullable<ReturnType<typeof getStarXIPlayer>> => Boolean(player)), [ownedStarIds]);
  const startingStarXIPlayers = useMemo(() => Array.from({ length: STAR_XI_SQUAD_SIZE }, (_, index) => getStarXIPlayer(lineupStarIds[index] ?? "") ?? null), [lineupStarIds]);
  const startingStarXISelection = startingStarXIPlayers.filter((player): player is NonNullable<typeof player> => Boolean(player));
  const benchStarXIPlayers = useMemo(() => Array.from({ length: STAR_XI_BENCH_SIZE }, (_, index) => getStarXIPlayer(benchStarIds[index] ?? "") ?? null), [benchStarIds]);
  const benchStarXIPlayerCount = benchStarXIPlayers.filter(Boolean).length;
  const loanedStarIds = useMemo(() => displayGame.features.transferSaga.loans.map((loan) => loan.playerId), [displayGame.features.transferSaga.loans]);
  const currentTransferLoans = displayGame.features.transferSaga.loans.map((loan) => ({ loan, player: getStarXIPlayer(loan.playerId) })).filter((entry): entry is { loan: typeof entry.loan; player: NonNullable<ReturnType<typeof getStarXIPlayer>> } => Boolean(entry.player));
  const transferArchive = [...displayGame.features.transferSaga.archive].reverse();
  const pendingTransferOffer = displayGame.features.transferSaga.pendingOffer;
  // Only cards still in the club can be banned; older saves may list sold or discarded ones.
  const ownedDisciplineBans = displayGame.features.discipline.bans.filter((ban) => displayGame.features.starXI.ownedIds.includes(ban.playerId));
  const reserveStarXICount = useMemo(() => {const assigned=new Set([...lineupStarIds,...benchStarIds,...loanedStarIds]);return ownedStarIds.filter(id=>!assigned.has(id)).length;},[ownedStarIds,lineupStarIds,benchStarIds,loanedStarIds]);
  const reserveStarXIPlayers = useMemo(() => featureTab!=="squad" || displayGame.features.cup.active ? [] : ownedStarXIPlayers.filter((player) => !lineupStarIds.includes(player.id) && !benchStarIds.includes(player.id) && !loanedStarIds.includes(player.id)), [benchStarIds, lineupStarIds, loanedStarIds, ownedStarXIPlayers, featureTab, displayGame.features.cup.active]);
  const suspendedStarIds = displayGame.features.cup.suspendedPlayerIds;
  const injuredStarIds = Object.entries(displayGame.features.cup.injuredPlayerIds ?? {}).filter(([, matches]) => Number(matches) > 0).map(([playerId]) => playerId);
  const suspendedStarPlayers = suspendedStarIds.map((id) => getStarXIPlayer(id)).filter((player): player is NonNullable<ReturnType<typeof getStarXIPlayer>> => Boolean(player));
  const injuredStarPlayers = injuredStarIds.map((id) => ({ player: getStarXIPlayer(id), matches: Math.max(0, Math.floor(Number(displayGame.features.cup.injuredPlayerIds[id]) || 0)) })).filter((entry): entry is { player: NonNullable<ReturnType<typeof getStarXIPlayer>>; matches: number } => Boolean(entry.player) && entry.matches > 0);
  const activeMatchInjury = displayGame.features.cup.matchPaused && !displayGame.features.cup.simulation ? displayGame.features.cup.lastInjury : null;
  const suspendedPlayerOnSquad = suspendedStarIds.some((id) => lineupStarIds.includes(id) || benchStarIds.includes(id));
  const activeLineupSlot = selectedLineupSlot !== null && selectedLineupSlot < STAR_XI_SQUAD_SIZE ? selectedLineupSlot : null;
  const activeFormation = getStarFormation(starXIState.formationId);
  const activeFormationPositions = displayGame.features.starXI.formationPositions;
  const activeLineupPosition = activeLineupSlot !== null ? activeFormationPositions[activeLineupSlot] : null;
  const starXIRating = getStarXIRating(displayGame.features.starXI.ownedIds, displayGame.features.starXI.lineupIds);
  const totalTrophies = TOURNAMENTS.reduce((total, tournament) => total + displayGame.features.cup.trophies[tournament.id], 0);
  const cupPenaltyHomeEvents = displayGame.features.cup.penaltyEvents.filter((event) => event.side === "home");
  const cupPenaltyAwayEvents = displayGame.features.cup.penaltyEvents.filter((event) => event.side === "away");
  const cupPenaltySlotCount = Math.max(5, cupPenaltyHomeEvents.length, cupPenaltyAwayEvents.length);
  const cupPenaltyIsSuddenDeath = displayGame.features.cup.penaltyHomeTaken >= 5 && displayGame.features.cup.penaltyAwayTaken >= 5;
  const allTimeTopScorers = Object.entries(displayGame.features.cup.allTimeScorers).map(([starPlayerId, goals]) => ({ player: getStarXIPlayer(starPlayerId), goals, appearances: Math.max(0, Math.floor(Number(displayGame.features.cup.allTimeAppearances?.[starPlayerId]) || (goals > 0 ? 1 : 0))) })).filter((entry): entry is { player: NonNullable<ReturnType<typeof getStarXIPlayer>>; goals: number; appearances: number } => Boolean(entry.player) && entry.goals > 0).sort((first, second) => second.goals - first.goals || second.player.rating - first.player.rating || first.player.name.localeCompare(second.player.name)).slice(0, 3);
  const starXIComplete = startingStarXISelection.length === STAR_XI_SQUAD_SIZE;
  const openTransferSquadVacancies = getOpenTransferSquadVacancies(displayGame.features);
  const hasTransferSquadVacancy = openTransferSquadVacancies.length > 0;
  // While the team travels to a match (or a match runs) no other match can start, so the match choice is hidden.
  const journeyUnderway = Boolean(displayGame.features.travel.journey && !displayGame.features.travel.journey.consumed);
  const transferSquadVacancyLabel = startingStarXISelection.length < STAR_XI_SQUAD_SIZE ? t("logic.inXI") : t("logic.onBench");
  const filteredReserveStarXIPlayers = useMemo(() => {
    const career = displayGame.features.career;
    const order = new Map(ownedStarIds.map((id, index) => [id, index]));
    const injured = new Set(injuredStarIds), banned = new Set([...suspendedStarIds, ...getBannedPlayerIds(displayGame.features, nextCompetition(displayGame.features))]);
    const favorites = new Set(displayGame.features.favoriteIds ?? []);
    const entries = reserveStarXIPlayers.map((player) => ({ id: player.id, name: player.name, positions: getStarXIPositions(player), rating: getCareerCard(career, player).rating, compatible: activeLineupSlot !== null && canStarXIPlayerFillSlot(player.id, activeLineupSlot, activeFormationPositions), player,
      type: reserveCardType(player), order: order.get(player.id) ?? 0, form: getPlayerForm(career, player.id).bonus, status: injured.has(player.id) ? "injured" as const : banned.has(player.id) ? "banned" as const : "available" as const, favorite: favorites.has(player.id), isNew: newCardIds.has(player.id) }));
    return filterAndSortReserve(entries, { search: starSearch, ratingFilter: starRatingFilter, positionFilter: starPositionFilter, preferCompatible: activeLineupSlot !== null, sort: reserveSort, type: reserveType, status: reserveStatus, onlyCompatible: reserveOnlyCompatible && activeLineupSlot !== null }).map((entry) => entry.player);
  }, [activeFormationPositions, activeLineupSlot, reserveStarXIPlayers, starPositionFilter, starRatingFilter, starSearch, displayGame.features, ownedStarIds, injuredStarIds, suspendedStarIds, reserveSort, reserveType, reserveStatus, reserveOnlyCompatible, newCardIds]);
  useEffect(() => { if (reserveFiltersLoadedRef.current) writeJsonPref(PREF_KEYS.reserveFilters, { rating: starRatingFilter, position: starPositionFilter, sort: reserveSort, type: reserveType, status: reserveStatus }); }, [starRatingFilter, starPositionFilter, reserveSort, reserveType, reserveStatus]);
  const squadScope = isCoopLive && coopSession ? `coop:${coopSession.code}` : "solo";
  useEffect(() => {
    if (featureTab !== "squad" || !hydrated) return;
    const stored = readJsonPref(PREF_KEYS.squadSeen, (value) => value && typeof value === "object" ? value as Record<string, unknown> : {});
    const seen = Array.isArray(stored[squadScope]) ? new Set((stored[squadScope] as unknown[]).filter((id): id is string => typeof id === "string")) : null;
    const fresh = seen ? ownedStarIds.filter((id) => !seen.has(id)) : [];
    writeJsonPref(PREF_KEYS.squadSeen, { ...Object.fromEntries(Object.entries(stored).slice(-5)), [squadScope]: ownedStarIds });
    const timer = window.setTimeout(() => setNewCardIds((current) => new Set([...current, ...fresh])), 0);
    return () => window.clearTimeout(timer);
    // Once per visit of the Kader tab; cards added during the visit count as seen on the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureTab, hydrated, squadScope]);
  const favoriteCardIds = useMemo(() => new Set(displayGame.features.favoriteIds ?? []), [displayGame.features.favoriteIds]);
  /** Pins or unpins the starter of the chosen place: t("logic.bestXI") keeps pinned cards in the eleven. */
  async function togglePinnedStarterOfSlot(playerId: string) {
    const name = getStarXIPlayer(playerId)?.name ?? t("logic.player");
    const wasPinned = Boolean(displayGame.features.starXI.pinnedPlayerIds?.includes(playerId));
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-pin", { starPlayerId: playerId });
      setCoopBusy(false);
      if (data) showToast(wasPinned ? t("logic.unpinned", { name }) : t("logic.pinned", { name }));
      return;
    }
    let outcome = "";
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      outcome = togglePinnedStarter(features, playerId);
      return outcome === "pinned" || outcome === "unpinned" ? { ...current, features } : current;
    });
    if (outcome === "limit") showToast(t("logic.maxPinned"));
    else showToast(wasPinned ? t("logic.unpinned", { name }) : t("logic.pinned", { name }));
  }
  async function toggleFavorite(playerId: string) {
    const name = getStarXIPlayer(playerId)?.name ?? t("logic.player");
    const wasFavorite = favoriteCardIds.has(playerId);
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-favorite", { starPlayerId: playerId });
      setCoopBusy(false);
      if (data) showToast(wasFavorite ? t("logic.unfavorited", { name }) : t("logic.favorited", { name }));
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      return toggleFavoriteCard(features, playerId) ? { ...current, features } : current;
    });
    showToast(wasFavorite ? t("logic.unfavorited", { name }) : t("logic.favorited", { name }));
  }
  const reservePageCount = Math.max(1, Math.ceil(filteredReserveStarXIPlayers.length / RESERVE_PAGE_SIZE));
  const activeReservePage = Math.min(reservePage, reservePageCount - 1);
  const visibleReserveStarXIPlayers = useMemo(() => {
    const start = activeReservePage * RESERVE_PAGE_SIZE;
    return filteredReserveStarXIPlayers.slice(start, start + RESERVE_PAGE_SIZE);
  }, [activeReservePage, filteredReserveStarXIPlayers]);
  // Squad helpers (app/game/lineup-tools.ts): bans for the coming match, open gaps, rating preview while dragging.
  const nextSquadCompetition = nextCompetition(displayGame.features);
  const bannedForNext = useMemo(() => new Set(displayGame.features.cup.active ? [] : getBannedPlayerIds(displayGame.features, nextSquadCompetition)), [displayGame.features, nextSquadCompetition]);
  const banLabelFor = (playerId: string | undefined) => playerId && bannedForNext.has(playerId) ? t("logic.bannedFor", { competition: competitionLabel(nextSquadCompetition).toUpperCase() }) : undefined;
  const squadGapCount = useMemo(() => featureTab === "squad" && !displayGame.features.cup.active ? fillStarXIGaps(displayGame.features, { career: displayGame.features.career, cup: displayGame.features.cup }).replacements.length : 0, [featureTab, displayGame.features]);
  // The kickoff checklist (Q25) offers "Lücken füllen" on every tab; computed once per change of the world, not per render.
  const squadGapsFillable = useMemo(() => squadGapCount > 0 || (!displayGame.features.cup.active && fillStarXIGaps(displayGame.features, { career: displayGame.features.career, cup: displayGame.features.cup }).replacements.length > 0), [squadGapCount, displayGame.features]);
  const abandonBlockReason = abandonTournamentBlockReason(displayGame.features);
  const squadMovePreview = (() => {
    const source = squadDrag.dragging, target = squadDrag.dropTarget, squad = displayGame.features.starXI;
    if (!source || !target || displayGame.features.cup.active) return "";
    const before = getStarXIRating(squad.ownedIds, squad.lineupIds);
    const without = (id: string) => squad.lineupIds.map((item) => item === id ? "" : item);
    let after = before;
    if (target.area === "lineup") after = ratingAfterLineupMove(squad, source.playerId, target.index);
    else if (source.area === "lineup" && source.index !== null && target.area === "bench") { const incoming = squad.benchIds[target.index]; after = incoming ? ratingAfterLineupMove(squad, incoming, source.index) : getStarXIRating(squad.ownedIds, without(source.playerId)); }
    else if (source.area === "lineup" && target.area === "reserve") after = getStarXIRating(squad.ownedIds, without(source.playerId));
    return formatRatingDelta(after - before);
  })();
  const undoAvailable = Boolean(squadUndo && !isCoopLive && `${lineupStarIds.join()}|${benchStarIds.join()}` === squadUndo.signature);
  // OVR per formation (Q23): the best eleven of every formation, computed one formation per idle step.
  const formationRatingKey = featureTab === "squad" && !displayGame.features.cup.active ? `${ownedStarIds.join(",")}|${getBestXIUnavailablePlayerIds(displayGame.features).join(",")}|${displayGame.features.seasonMode.highestDivision}|${displayGame.seasons}` : "";
  useEffect(() => {
    if (!formationRatingKey) return;
    const features = displayGame.features, ids = pickerFormations.filter(isFormationAvailable).map((formation) => formation.id), result: Partial<Record<StarFormationId, number>> = {};
    let index = 0, stopped = false, timer = 0;
    const step = () => {
      if (stopped) return;
      const id = ids[index++];
      if (!id) { setFormationRatings(result); return; }
      Object.assign(result, bestRatingPerFormation(features, [id], { career: features.career, cup: features.cup }));
      timer = window.setTimeout(step, 0);
    };
    timer = window.setTimeout(step, 120);
    return () => { stopped = true; window.clearTimeout(timer); };
    // One run per squad and availability, not per render of the features object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formationRatingKey]);
  const currentRank = useMemo(() => getRank(displayGame.totalGoals), [displayGame.totalGoals]);
  const nextRank = useMemo(() => RANKS.find((rank) => rank.minimum > displayGame.totalGoals), [displayGame.totalGoals]);
  // Take over overlays: focus moves into them and stays there; Escape closes only what may close.
  const starWalkoutReadyRef = useRef(starWalkoutReady);
  useEffect(() => { starWalkoutReadyRef.current = starWalkoutReady; }, [starWalkoutReady]);
  const penaltyDialogRef = useRef<HTMLDivElement>(null);
  const transferDialogRef = useRef<HTMLDivElement>(null);
  const starRevealDialogRef = useRef<HTMLDivElement>(null);
  const penaltyOverlayOpen = Boolean(displayGame.features.cup.active && displayGame.features.cup.phase === "penalties");
  useDialogFocus(penaltyOverlayOpen, penaltyDialogRef, () => undefined);
  useDialogFocus(Boolean(transferAnnouncement && !gazetteAnnouncement), transferDialogRef, () => dismissTransferAnnouncement());
  useDialogFocus(Boolean(starReveal), starRevealDialogRef, () => { if (starWalkoutReadyRef.current) dismissStarReveal(); });
  useEffect(() => {
    if (!starReveal) return;
    const dialog = starRevealDialogRef.current;
    if (!dialog || dialog.contains(document.activeElement)) { if (starWalkoutReady) dialog?.querySelector<HTMLElement>(".star-walkout-dismiss:not([disabled]), .event-takeover-dismiss:not([disabled])")?.focus(); return; }
    (dialog.querySelector<HTMLElement>("button:not([disabled])") ?? dialog).focus();
  }, [starReveal, starWalkoutReady]);
  // One persistent live region: the goal counter and combo are not live (they change several times a second);
  // toasts and rank milestones are announced here instead.
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const announcedRankRef = useRef<string | null>(null);
  useEffect(() => { if (toast) setSrAnnouncement(toast); }, [toast]);
  useEffect(() => {
    if (announcedRankRef.current !== null && announcedRankRef.current !== currentRank.name) setSrAnnouncement(t("logic.newRank", { name: dataText(currentRank.name) }));
    announcedRankRef.current = currentRank.name;
  }, [currentRank.name]);
  const goalBoostMultiplier = getGoalBoostMultiplier(displayGame.features, countdownNow);
  const goalBoostActive = goalBoostMultiplier > 1;
  const goalBoostLabel = String(goalBoostMultiplier).replace(".", ",");
  const goalBoostCountdown = formatCountdown(displayGame.features.goalBoost.endsAt, countdownNow);
  const clickPower = getClickPower(displayGame.upgrades, displayGame.stars, displayGame.features, countdownNow);
  const passivePower = getPassivePower(displayGame.upgrades, displayGame.stars, displayGame.features, countdownNow);
  const seasonMode = displayGame.features.seasonMode;
  const currentSeason = seasonMode.division;
  const currentSeasonMilestone = getSeasonMilestone(currentSeason);
  // Unlocks follow the best league ever reached (Liga 15 entry, Liga 1 top).
  const reachedLeague = getReachedLeague(displayGame.seasons, seasonMode.highestDivision);
  const unlockedFormationCount = STAR_FORMATIONS.filter((formation) => isLeagueContentUnlocked(getFormationUnlockLeague(formation.id), reachedLeague, hasFullTestAccess)).length;
  const isFormationAvailable = (formation: { id: string }) => isLeagueContentUnlocked(getFormationUnlockLeague(formation.id), reachedLeague, hasFullTestAccess) || activeFormation.id === formation.id;
  const pickerFormations = sortFormationsForPicker(STAR_FORMATIONS, isFormationAvailable);
  const seasonCareerComplete = seasonMode.hallOfFame;
  // Prestige has its own rules: lineup, open slots and suspensions never block it, running operations do.
  const prestigeBlockReason = seasonCareerComplete ? getPrestigeBlockReason(displayGame.features) : "";
  // Another seat (or this one, after a lost response) already started Prestige: the open dialog would offer a
  // second one, so it closes with a neutral note instead of saying nothing changed.
  const shownPrestigeCount = displayGame.features.seasonMode.prestigeCount;
  useEffect(() => {
    if (!prestigeDialog || shownPrestigeCount === prestigeDialog.prestigeCount) return;
    const ownRequest = prestigeConfirmedRef.current.has(prestigeDialog.requestId);
    setPrestigeDialog(null);
    if (!ownRequest) setCoopMessage(t("logic.prestigeInWorld", { count: shownPrestigeCount }));
  }, [prestigeDialog, shownPrestigeCount]);
  // Co-op Prestige vote: every member sees the open vote, and once how it ended (a result older than half a minute
  // when the world opens is not announced again).
  const coopPrestigeVote = isCoopLive ? coopSession?.room.prestigeVote ?? null : null;
  const coopVoteResult = isCoopLive ? coopSession?.room.prestigeVoteResult ?? null : null;
  const coopVoteResultKey = coopVoteResult ? `${coopVoteResult.id}:${coopVoteResult.outcome}` : "";
  const coopVoteResultFresh = Boolean(coopVoteResult && coopVoteResult.ageMs < 30_000);
  const coopVoteResultText = coopVoteResult ? prestigeVoteMessage(coopVoteResult) : "";
  useEffect(() => {
    if (!coopVoteResultKey || shownVoteResultRef.current === coopVoteResultKey) return;
    shownVoteResultRef.current = coopVoteResultKey;
    if (coopVoteResultFresh) setCoopMessage(coopVoteResultText);
  }, [coopVoteResultKey, coopVoteResultFresh, coopVoteResultText]);
  // The same ranking as the season itself (head-to-head before goal difference), so the live table matches promotion.
  const seasonTable = sortSeasonTable(seasonMode.table, seasonMode.results);
  const seasonInProgress = seasonMode.matchday > 0 || seasonMode.table.some((team) => team.played > 0);
  // Available upgrades keep their order; locked ones follow in the order they unlock (Liga 15 is the entry,
  // so Liga 14 comes before Liga 13).
  const upgradeUnlockRank = (upgrade: UpgradeDefinition) => getLevel(displayGame.upgrades, upgrade.id) > 0 || isLeagueContentUnlocked(getUpgradeUnlockLeague(upgrade.id), reachedLeague, hasFullTestAccess) ? 0 : 100 - getUpgradeUnlockLeague(upgrade.id);
  const visibleUpgrades = UPGRADES.filter((upgrade) => activeTab === "all" || upgrade.kind === activeTab).map((upgrade, index) => ({ upgrade, index, rank: upgradeUnlockRank(upgrade) })).sort((first, second) => first.rank - second.rank || first.index - second.index).map((entry) => entry.upgrade);
  // Shop hints (app/qol/economy-hints.ts): gain of the next level, payback, best value and the savings goal.
  const upgradeGains = useMemo(() => new Map(UPGRADES.map((upgrade) => [upgrade.id, nextLevelGain(upgrade, displayGame.upgrades, displayGame.stars, displayGame.features)])), [displayGame.upgrades, displayGame.stars, displayGame.features]);
  const bestValueUpgradeId = bestValueUpgrade(UPGRADES.filter((upgrade) => getLevel(displayGame.upgrades, upgrade.id) > 0 || isLeagueContentUnlocked(getUpgradeUnlockLeague(upgrade.id), reachedLeague, hasFullTestAccess)).map((upgrade) => upgradeGains.get(upgrade.id)!));
  const [savingsGoal, setSavingsGoalState] = useState<SavingsGoal | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setSavingsGoalState(readJsonPref(PREF_KEYS.savingsGoal, parseSavingsGoal)), 0); return () => window.clearTimeout(timer); }, []);
  function setSavingsGoal(goal: SavingsGoal | null) {
    setSavingsGoalState(goal);
    writePref(PREF_KEYS.savingsGoal, goal ? JSON.stringify(goal) : null);
    if (goal) showToast(t("logic.savingsGoalSet"));
  }
  function toggleSavingsGoal(goal: SavingsGoal) { setSavingsGoal(savingsGoal?.kind === goal.kind && savingsGoal.id === goal.id ? null : goal); }
  const savingsTarget = (() => {
    if (!savingsGoal) return null;
    if (savingsGoal.kind === "upgrade") { const upgrade = UPGRADES.find((item) => item.id === savingsGoal.id); return upgrade ? { label: t("logic.upgradeLevel", { name: dataText(upgrade.name), level: getLevel(displayGame.upgrades, upgrade.id) + 1 }), cost: getCost(upgrade, displayGame.upgrades) } : null; }
    const pack = getStarPack(savingsGoal.id as StarPackId);
    return pack && !isRewardPack(pack.id) ? { label: dataText(pack.label), cost: pack.price } : null;
  })();
  const isMiniGameOnCooldown = (id: MiniGameId) => displayGame.miniGameCooldowns[id] > countdownNow;
  const miniGameCooldownLabel = (id: MiniGameId, availableLabel: string) => isMiniGameOnCooldown(id) ? t("logic.readyIn", { time: formatCountdown(displayGame.miniGameCooldowns[id], countdownNow) }) : availableLabel;
  // Open actions (app/qol/status.ts): tab title, navigation dots, "Nächste Schritte", app badge and local notices.
  const albumClaimableCount = useMemo(() => claimableAlbumGroups(displayGame.features).length, [displayGame.features]);
  const openActions = useMemo(() => hydrated ? getOpenActions({ features: displayGame.features, now: countdownNow, coop: isCoopLive, minigameWins: displayGame.minigameWins, miniGameCooldowns: displayGame.miniGameCooldowns, travelNow: getTravelTime(), albumClaimable: albumClaimableCount }) : [], [hydrated, displayGame.features, countdownNow, isCoopLive, displayGame.minigameWins, displayGame.miniGameCooldowns, albumClaimableCount]);
  const navBadges = sectionBadges(openActions);
  const pageTitle = statusTitle(localizeText(TAB_TITLES[featureTab]), displayGame.features, countdownNow, openActions);
  // Next.js writes the metadata title after the first render (first load, direct URL); the 1 s countdown below puts the status title back.
  const pageTitleRef = useRef(pageTitle);
  useEffect(() => { pageTitleRef.current = pageTitle; document.title = pageTitle; }, [pageTitle]);
  const badgeCount = appBadgeCount(openActions);
  useEffect(() => { if (hydrated) setAppBadge(badgeCount); }, [hydrated, badgeCount]);
  // Local notices (opt in under Club): only while this page runs in the background; nothing is sent anywhere.
  const [notificationsOn, setNotificationsOn] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setNotificationsOn(readPref(PREF_KEYS.notifications) === "on"), 0); return () => window.clearTimeout(timer); }, []);
  function changeNotifications(on: boolean) { setNotificationsOn(on); writePref(PREF_KEYS.notifications, on ? "on" : "off"); }
  const notifiedActionsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const previous = notifiedActionsRef.current;
    notifiedActionsRef.current = new Set(openActions.map((action) => action.id));
    if (!previous || !notificationsOn || !hydrated || typeof document === "undefined" || !document.hidden) return;
    for (const action of newNotifiableActions(previous, openActions)) void showLocalNotification("Goal Clicker", action.label, `goal-clicker-${action.id}`);
  }, [openActions, notificationsOn, hydrated]);
  // Unread entries of the history (bell); the first visit counts everything older as read.
  const [historySeenAt, setHistorySeenAt] = useState<number | null>(null);
  const latestHistoryAt = displayGame.features.history.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0);
  useEffect(() => {
    if (!hydrated) return;
    const stored = Number(readPref(PREF_KEYS.historySeenAt));
    const timer = window.setTimeout(() => setHistorySeenAt((current) => current ?? (Number.isFinite(stored) && stored > 0 ? stored : latestHistoryAt)), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, latestHistoryAt]);
  useEffect(() => {
    if (featureTab !== "history" || !latestHistoryAt) return;
    writePref(PREF_KEYS.historySeenAt, String(latestHistoryAt));
    const timer = window.setTimeout(() => setHistorySeenAt(latestHistoryAt), 0);
    return () => window.clearTimeout(timer);
  }, [featureTab, latestHistoryAt]);
  const unreadHistory = historySeenAt === null ? 0 : displayGame.features.history.filter((entry) => entry.timestamp > historySeenAt).length;
  /** A t("logic.nextSteps") chip: open the place where the action is done. */
  function openActionTarget(action: OpenAction) {
    openFeatureTab(action.tab);
    const selector = action.id === "daily" ? ".daily-reward" : action.id === "minigame" ? ".mini-game-hub" : action.id === "press" ? ".press-conference" : "";
    if (selector) window.setTimeout(() => document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  useEffect(() => {
    const storedId = localStorage.getItem(PLAYER_ID_KEY);
    const legacyId = LEGACY_PLAYER_ID_KEYS.map((key) => localStorage.getItem(key)).find((value) => Boolean(value));
    const nextId = storedId || legacyId || globalThis.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_ID_KEY, nextId);
    window.setTimeout(() => {
      setPlayerId(nextId);
      setPlayerName(localStorage.getItem(PLAYER_NAME_KEY) ?? "");
    }, 0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) setLayoutOrder(normalizeLayoutOrder(JSON.parse(saved)));
      } catch {
        // Keep the standard layout when local storage contains invalid data.
      }
      setLayoutReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || !layoutReady) return;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutOrder));
  }, [hydrated, layoutReady, layoutOrder]);

  useEffect(() => {
    if (!coopSession) return;
    localStorage.setItem(COOP_ROOM_KEY, JSON.stringify({ code: coopSession.code, role: coopSession.role, playerId: coopSession.playerId }));
  }, [coopSession]);

  useEffect(() => {
    if (!coopSession?.room.roomName) return;
    const syncName = window.setTimeout(() => setCoopRoomName(coopSession.room.roomName), 0);
    return () => window.clearTimeout(syncName);
  }, [coopSession?.room.roomName]);

  useEffect(() => () => {
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    if (cupCardTimerRef.current) window.clearTimeout(cupCardTimerRef.current);
    if (coopClickBatchTimerRef.current) window.clearTimeout(coopClickBatchTimerRef.current);
  }, []);

  useEffect(() => {
    coopEventRef.current = null;
    transferEventRef.current = null;
    gazetteIssueRef.current = null;
    coopPackRevealRef.current = null;
    seasonHistoryRef.current = null;
    cupGoalRef.current = null;
    cupCardRef.current = null;
    eventAnnouncementRef.current = null;
    eventAnnouncementQueueRef.current = [];
    // Clear on the next turn, but do not hide an event that the shared-event
    // effect has already restored in the same commit.
    const resetGoal = window.setTimeout(() => {
      setCupCardAnnouncement(null);
      setTransferAnnouncement(null);
      setGazetteAnnouncement(null);
      if (!eventAnnouncementRef.current) setEventAnnouncement(null);
    }, 0);
    return () => window.clearTimeout(resetGoal);
  }, [activeCoopCode]);

  useEffect(() => {
    if (!hydrated || (activeCoopCode && !isCoopLive)) return;
    const latest = displayGame.features.seasonMode.history.at(-1) ?? null;
    if (!latest) {
      seasonHistoryRef.current = null;
      return;
    }
    if (seasonHistoryRef.current === null) {
      seasonHistoryRef.current = latest.id;
      return;
    }
    if (seasonHistoryRef.current === latest.id) return;
    seasonHistoryRef.current = latest.id;
    // No extra result card on "Spiele" any more (the match summary shows the result); the table lives in "Saison".
    const seasonEnd = latest.completedSeason ? { promoted: t("logic.promotion"), relegated: t("logic.relegation"), stayed: t("logic.survival"), "hall-of-fame": "Hall of Fame" }[String(latest.seasonOutcome)] : undefined;
    showToast(seasonEnd ? t("logic.seasonEnded", { seasonEnd }) : t("logic.leaderboardUpdated"));
    // A league title gets the trophy celebration on top of the final table.
    const title = getSeasonTitle(latest, displayGame.features.seasonMode.lastTable, displayGame.features.seasonMode.lastResults);
    if (title) {
      setSeasonTitle(title);
      [523, 659, 784, 1047].forEach((frequency, index) => playTone(frequency, index === 3 ? 0.5 : 0.16, "triangle", 0.045, 0.35 + index * 0.16));
    }
  }, [activeCoopCode, displayGame.features.seasonMode.history, displayGame.features.seasonMode.lastTable, displayGame.features.seasonMode.lastResults, hydrated, isCoopLive]);

  useEffect(() => {
    if (!isCoopLive || !sharedRandomEvent || coopEventRef.current === sharedRandomEvent.createdAt) return;
    coopEventRef.current = sharedRandomEvent.createdAt;
    presentEventAnnouncement(sharedRandomEvent);
    showToast(sharedRandomEvent.title);
    addFeed(sharedRandomEvent.message, sharedRandomEvent.tone === "negative" ? "screen" : sharedRandomEvent.id === "var" ? "screen" : "star");
    // Present the server-broadcast event on both devices.
  }, [isCoopLive, sharedRandomEvent]);

  useEffect(() => {
    if (!visibleTransferEvent || transferEventRef.current === visibleTransferEvent.createdAt) return;
    transferEventRef.current = visibleTransferEvent.createdAt;
    if (getCurrentTime() - visibleTransferEvent.createdAt > 30000) return;
    const presentTransfer = window.setTimeout(() => {
      setTransferAnnouncement(visibleTransferEvent);
      showToast("Fabrizio Romario");
      addFeed(visibleTransferEvent.message, visibleTransferEvent.outcome === "sale" ? "screen" : "broadcast");
    }, 0);
    return () => window.clearTimeout(presentTransfer);
  }, [visibleTransferEvent]);

  useEffect(() => {
    if (!visibleGazetteIssue || gazetteIssueRef.current === visibleGazetteIssue.id) return;
    gazetteIssueRef.current = visibleGazetteIssue.id;
    if (getCurrentTime() - visibleGazetteIssue.createdAt > 45000) return;
    const presentGazette = window.setTimeout(() => setGazetteAnnouncement(visibleGazetteIssue), 0);
    return () => window.clearTimeout(presentGazette);
  }, [visibleGazetteIssue]);

  useEffect(() => {
    if (!isCoopLive || !sharedPackReveal || coopPackRevealRef.current === sharedPackReveal.openedAt) return;
    if (getCurrentTime() - sharedPackReveal.openedAt > STAR_TOP_WALKOUT_ANIMATION_MS + 15000) {
      coopPackRevealRef.current = sharedPackReveal.openedAt;
      return;
    }
    coopPackRevealRef.current = sharedPackReveal.openedAt;
    presentStarReveal(sharedPackReveal);
    showToast(sharedPackReveal.duplicate ? t("logic.duplicateStar", { fragments: formatNumber(sharedPackReveal.fragmentCompensation) }) : t("logic.drawn", { name: sharedPackReveal.player.name }));
    // Present the shared pack result on both devices.
  }, [isCoopLive, sharedPackReveal]);

  useEffect(() => {
    if (!displayedCupGoal || cupGoalRef.current === displayedCupGoal.id || getCurrentTime() - displayedCupGoal.createdAt > 12000) return;
    cupGoalRef.current = displayedCupGoal.id;
    addFeed(t("logic.scores", { scorer: displayedCupGoal.scorer, minute: displayedCupGoal.minute }), "crown");
  }, [displayedCupGoal]);

  useEffect(() => {
    if (!displayedCupCard || cupCardRef.current === displayedCupCard.id || getCurrentTime() - displayedCupCard.createdAt > 15000) return;
    cupCardRef.current = displayedCupCard.id;
    setCupCardAnnouncement(displayedCupCard);
    if (cupCardTimerRef.current) window.clearTimeout(cupCardTimerRef.current);
    cupCardTimerRef.current = window.setTimeout(() => {
      setCupCardAnnouncement(null);
      cupCardTimerRef.current = null;
    }, 5000);
    addFeed(t("logic.seesRed", { player: displayedCupCard.player }), "screen");
    showToast(t("logic.redCard"));
  }, [displayedCupCard]);

  useEffect(() => {
    if (!hydrated || !playerId || guest || coopRestoreAttemptedRef.current) return;
    coopRestoreAttemptedRef.current = true;
    void restoreCoopRoom();
  }, [hydrated, playerId, guest, restoreCoopRoom]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !playerId || coopSession) return;
    const initialLoad = window.setTimeout(() => void loadSavedRooms(), 0);
    const timer = window.setInterval(() => { if (!isAway()) void loadSavedRooms(); }, 15000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [appMode, coopSession, hydrated, loadSavedRooms, playerId]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !activeCoopCode || !activeCoopPlayerId || coopSession?.room.status === "live") return;
    // A tab in the background does not poll; it catches up as soon as it is visible again. While nobody touches
    // the page for a while, the waiting world is checked every 4 s instead of every 1.5 s, and not at all once the
    // player counts as away (app/activity.ts); any tap or key press brings back the fast rhythm at once.
    let lastInput = Date.now();
    let timer = 0;
    let stopped = false;
    const syncWhileOpen = () => { if (!isAway()) void syncCoopRoom(); };
    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => { syncWhileOpen(); schedule(); }, Date.now() - lastInput < COOP_IDLE_AFTER_MS ? 1500 : COOP_IDLE_POLL_MS);
    };
    const onInput = () => {
      const wasIdle = Date.now() - lastInput >= COOP_IDLE_AFTER_MS;
      lastInput = Date.now();
      if (wasIdle) { window.clearTimeout(timer); syncWhileOpen(); schedule(); }
    };
    const initialSync = window.setTimeout(syncWhileOpen, 0);
    schedule();
    document.addEventListener("visibilitychange", syncWhileOpen);
    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("keydown", onInput);
    return () => { stopped = true; window.clearTimeout(initialSync); window.clearTimeout(timer); document.removeEventListener("visibilitychange", syncWhileOpen); window.removeEventListener("pointerdown", onInput); window.removeEventListener("keydown", onInput); };
  }, [activeCoopCode, activeCoopPlayerId, appMode, coopSession?.room.status, hydrated, syncCoopRoom]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !activeCoopCode || !activeCoopPlayerId || coopSession?.room.status !== "live") return;
    // Hidden or untouched for 10 minutes (app/activity.ts): no ticks, so a forgotten tab neither polls nor keeps the
    // database awake. The other players' ticks keep the world running; coming back ticks at once.
    const tick = () => { if (!isAway()) void sendCoopAction("tick", { featuresKey: coopFeaturesKeyRef.current }); };
    const timer = window.setInterval(tick, 1500);
    document.addEventListener("visibilitychange", tick);
    const stopReturn = onReturn(tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); stopReturn(); };
    // Background synchronisation is coalesced by sendCoopAction and must not restart on every room update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCoopCode, activeCoopPlayerId, appMode, coopSession?.room.status, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeCoopCode || !activeCoopPlayerId) return;
    const markOffline = () => notifyCoopOffline(activeCoopCode, activeCoopPlayerId);
    window.addEventListener("beforeunload", markOffline);
    window.addEventListener("pagehide", markOffline);
    return () => {
      window.removeEventListener("beforeunload", markOffline);
      window.removeEventListener("pagehide", markOffline);
    };
  }, [activeCoopCode, activeCoopPlayerId, hydrated]);

  useEffect(() => {
    gameRef.current = addPassiveGoals(game, passiveGoals.getPending());
  }, [game, passiveGoals]);
  // Before paint, so the counter never shows a committed state without the ticks collected since.
  useLayoutEffect(() => {
    passiveGoals.setDisplay(game.goals + passiveGoals.getPending());
  }, [game.goals, passiveGoals]);

  useEffect(() => {
    const nextClub = { name: displayClubName, badge: displayClubBadge, color: displayClubColor };
    const syncClub = window.setTimeout(() => setClubDraft(nextClub), 0);
    return () => window.clearTimeout(syncClub);
  }, [displayClubBadge, displayClubColor, displayClubName]);

  useEffect(() => {
    if (!hydrated) return;
    // One render per second: the countdowns and the passive goals collected since the last commit.
    const timer = window.setInterval(() => {
      flushPassiveGoals();
      setCountdownNow(getCurrentTime());
      if (document.title !== pageTitleRef.current) document.title = pageTitleRef.current;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hydrated, flushPassiveGoals]);
  // A press first commits the collected goals, so the handler that follows renders with exact goals (affordable
  // buttons, bulk counts, pack checks). The ball adds its goals through setGame, which commits them anyway.
  useEffect(() => {
    if (!hydrated) return;
    const commit = (event: Event) => {
      if (!passiveGoals.getPending()) return;
      if (event.target instanceof Element && event.target.closest(".ball-button")) return;
      flushPassiveGoals();
    };
    window.addEventListener("pointerdown", commit, { capture: true, passive: true });
    window.addEventListener("keydown", commit, { capture: true, passive: true });
    return () => { window.removeEventListener("pointerdown", commit, { capture: true }); window.removeEventListener("keydown", commit, { capture: true }); };
  }, [hydrated, flushPassiveGoals, passiveGoals]);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const accountMessage = useCallback((message: string) => showToastRef.current(message), []);
  // The Google account decides the player ID, so all its devices share the same worlds.
  const adoptAccountPlayerId = useCallback((id: string) => {
    localStorage.setItem(PLAYER_ID_KEY, id);
    setPlayerId(id);
  }, []);

  /** Queued toasts (app/qol/toast-queue.ts): `minor` click messages never push a real message away. */
  function showToast(message: string, priority: ToastPriority = "info") {
    // Server answers arrive in German; the toast shows them in the chosen language (localizeText, Etappe 6).
    setToastState((current) => pushToast(current, { text: localizeText(message), priority }));
  }
  const currentToast = toastState.current;
  useEffect(() => {
    if (!currentToast) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastState((current) => current.current === currentToast ? nextToast(current) : current), toastDuration(currentToast));
    return () => { if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current); };
  }, [currentToast]);

  function presentEventAnnouncement(event: RandomEvent) {
    if (eventAnnouncementRef.current) {
      const alreadyQueued = eventAnnouncementQueueRef.current.some((queued) => queued.createdAt === event.createdAt);
      if (!alreadyQueued && eventAnnouncementRef.current.createdAt !== event.createdAt) {
        eventAnnouncementQueueRef.current = [...eventAnnouncementQueueRef.current, event];
      }
      return;
    }
    eventAnnouncementRef.current = event;
    setEventAnnouncement(event);
  }

  function dismissEventAnnouncement() {
    const next = eventAnnouncementQueueRef.current.shift() ?? null;
    eventAnnouncementRef.current = next;
    setEventAnnouncement(next);
  }

  useEffect(() => {
    if (!eventAnnouncement) return;
    const duration = eventAnnouncement.tone === 'negative' ? 5000 : eventAnnouncement.amount === 0 ? 3000 : 4000;
    const timer = window.setTimeout(dismissEventAnnouncement, duration);
    return () => window.clearTimeout(timer);
  }, [eventAnnouncement]);

  function dismissTransferAnnouncement() {
    setTransferAnnouncement(null);
  }

  // The gazette closes on its own after a while, but never while the player reads it:
  // hovering, focus inside or an opened <details> holds them until the player lets go.
  const gazetteHeld = useAnnouncementHold(gazetteCardRef, Boolean(gazetteAnnouncement));
  useEffect(()=>{
    if(!gazetteAnnouncement || gazetteHeld)return;
    const timer=window.setTimeout(()=>setGazetteAnnouncement(null),ANNOUNCEMENT_AUTO_CLOSE_MS);
    return ()=>window.clearTimeout(timer);
  },[gazetteAnnouncement, gazetteHeld]);

  function dismissGazetteAnnouncement() {
    setGazetteAnnouncement(null);
  }

  function clearEventAnnouncements() {
    eventAnnouncementQueueRef.current = [];
    eventAnnouncementRef.current = null;
    transferEventRef.current = null;
    gazetteIssueRef.current = null;
    setEventAnnouncement(null);
    setTransferAnnouncement(null);
    setGazetteAnnouncement(null);
  }

  function flushCoopClickBatch() {
    // Exactly one timer waits at a time: a flush called while one is pending (more than 50 clicks queued during a
    // blocked request) replaces it instead of starting a second chain.
    if (coopClickBatchTimerRef.current) window.clearTimeout(coopClickBatchTimerRef.current);
    coopClickBatchTimerRef.current = null;
    if (coopForegroundPendingRef.current > 0) {
      coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 70);
      return;
    }
    // One click request at a time: the server counts each batch on top of the previous one.
    if (coopClickInFlightRef.current) {
      coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 70);
      return;
    }
    const batch = coopClickBatchRef.current;
    coopClickBatchRef.current = { amount: 0, count: 0 };
    coopClickBatchTimerRef.current = null;
    if (batch.count > 0) {
      coopClickInFlightRef.current = true;
      void sendCoopAction("click", { amount: batch.amount, clickCount: batch.count }).finally(() => { coopClickInFlightRef.current = false; });
    }
  }

  function queueCoopClick(amount: number) {
    if (coopClickBatchRef.current.count >= 50) flushCoopClickBatch();
    coopClickBatchRef.current.amount += amount;
    coopClickBatchRef.current.count += 1;
    if (coopClickBatchTimerRef.current) return;
    coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 70);
  }

  function addFeed(text: string, icon: IconName) {
    const entry = { id: feedIdRef.current++, icon, text };
    setFeed((current) => [entry, ...current].slice(0, 8));
  }

  function presentStarReveal(reveal: StarPackReveal) {
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    const elapsed = Math.max(0, Date.now() - reveal.openedAt);
    const revealDuration = getStarRevealReadyDelay(reveal);
    setStarRevealLag(elapsed);
    setStarReveal(reveal);
    openAllRef.current?.opened.push(reveal);
    packSoundRef.current?.();
    packSoundRef.current = null;
    // Only a reveal that starts now gets its sound, not one restored half way through after a reload.
    if (gameRef.current.sound && soundPrefsRef.current.effects && elapsed < 1000) {
      const tier = getStarCardTier(reveal.player), walkout = tier === "walkout" || tier === "icon" || tier === "legendary";
      packSoundRef.current = playPackReveal(tier, { top: reveal.player.rating >= 90, delay: reveal.troll && walkout ? PACK_TROLL_INTRO_MS - elapsed : -elapsed });
    }
    if (elapsed < revealDuration) {
      const tier = getStarCardTier(reveal.player);
      if (tier === "walkout" || tier === "icon" || tier === "legendary") vibrate([90, 50, 90, 50, 260]);
      setStarWalkoutReady(false);
      starRevealTimerRef.current = window.setTimeout(() => {
        setStarWalkoutReady(true);
        starRevealTimerRef.current = null;
      }, revealDuration - elapsed);
      return;
    }
    setStarWalkoutReady(true);
    starRevealTimerRef.current = null;
  }

  function dismissStarReveal() {
    packPurchaseRef.current = false;
    packSoundRef.current?.();
    packSoundRef.current = null;
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    starRevealTimerRef.current = null;
    setStarWalkoutReady(false);
    setStarReveal(null);
    continueOpenAll();
  }

  function finishStarWalkout(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.animationName !== "star-avatar-walk") return;
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    starRevealTimerRef.current = null;
    setStarWalkoutReady(true);
  }

  function layoutOrderNumber(id: LayoutCardId) {
    return layoutOrder.indexOf(id) + 1;
  }

  function layoutCardClass(id: LayoutCardId, baseClass: string) {
    return `${baseClass} layout-card${layoutEditMode ? " layout-card-editing" : ""}${dragOverLayoutCard === id ? " layout-card-drag-over" : ""}`;
  }

  function handleLayoutDragStart(event: DragEvent<HTMLElement>, id: LayoutCardId) {
    if (!layoutEditMode) return;
    setDraggingLayoutCard(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleLayoutDragOver(event: DragEvent<HTMLElement>, id: LayoutCardId) {
    if (!layoutEditMode || !draggingLayoutCard || draggingLayoutCard === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverLayoutCard(id);
  }

  function handleLayoutDrop(event: DragEvent<HTMLElement>, targetId: LayoutCardId) {
    if (!layoutEditMode) return;
    event.preventDefault();
    const sourceId = draggingLayoutCard ?? event.dataTransfer.getData("text/plain") as LayoutCardId;
    if (!sourceId || sourceId === targetId || !LAYOUT_CARD_IDS.includes(sourceId)) {
      setDraggingLayoutCard(null);
      setDragOverLayoutCard(null);
      return;
    }
    setLayoutOrder((current) => {
      const next = current.filter((id) => id !== sourceId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceId);
      return normalizeLayoutOrder(next);
    });
    setDraggingLayoutCard(null);
    setDragOverLayoutCard(null);
  }

  function handleLayoutDragEnd() {
    setDraggingLayoutCard(null);
    setDragOverLayoutCard(null);
  }

  function moveLayoutCard(id: LayoutCardId, direction: -1 | 1) {
    setLayoutOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + direction));
      if (index < 0 || index === nextIndex) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function resetLayout() {
    setLayoutOrder(DEFAULT_LAYOUT_ORDER);
    showToast(t("logic.layoutRestored"));
  }

  async function createCoopRoom() {
    const nickname = normalizeNickname(coopNickname);
    if (!playerId) {
      setCoopMessage(t("logic.idPreparing"));
      return;
    }
    if (nickname.length < 2) {
      setCoopMessage(t("logic.enterNameFirst"));
      return;
    }
    setCoopBusy(true);
    localStorage.setItem(PLAYER_NAME_KEY, nickname);
    setPlayerName(nickname);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", playerId, nickname, roomName: coopRoomName, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok || !data.room) throw new Error(data.error ?? t("logic.roomCreateFailed"));
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "host", playerId, room: data.room });
      setCoopMessage(t("logic.roomCreated"));
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : t("logic.roomCreateFailed"));
    } finally {
      setCoopBusy(false);
    }
  }

  async function joinCoopRoom() {
    const nickname = normalizeNickname(coopNickname);
    const code = coopCodeInput.trim().toUpperCase().slice(0, 6);
    if (!playerId) {
      setCoopMessage(t("logic.idPreparing"));
      return;
    }
    if (nickname.length < 2) {
      setCoopMessage(t("logic.enterNameFirst"));
      return;
    }
    if (code.length !== 6) {
      setCoopMessage(t("logic.codeSixChars"));
      return;
    }
    setCoopBusy(true);
    localStorage.setItem(PLAYER_NAME_KEY, nickname);
    setPlayerName(nickname);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", code, playerId, nickname, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok || !data.room) throw new Error(data.error ?? t("logic.roomJoinFailed"));
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "guest", playerId, room: data.room });
      setCoopMessage(t("logic.playersInRoom", { playerCount: data.room.playerCount }));
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : t("logic.roomJoinFailed"));
    } finally {
      setCoopBusy(false);
    }
  }

  async function reopenSavedRoom(code: string) {
    if (!playerId || code.length !== 6) return;
    setCoopBusy(true);
    try {
      const response = await fetch(multiplayerUrl({ code, playerId }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok || !data.room) throw new Error(data.error ?? t("logic.roomOpenFailed"));
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "host", playerId, room: data.room });
      setAppMode("coop");
      setCoopMessage(t("logic.savedRoomOpened"));
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : t("logic.roomOpenFailed"));
      if (error instanceof Error && error.message.includes(t("logic.notInRoom"))) {
        setSavedRooms((current) => current.filter((room) => room.code !== code));
      }
    } finally {
      setCoopBusy(false);
    }
  }

  function leaveCoopRoom() {
    notifyCoopOffline(coopSession?.code, coopSession?.playerId);
    localStorage.removeItem(COOP_ROOM_KEY);
    coopStatusRef.current = null;
    coopPlayerCountRef.current = 0;
    coopEventRef.current = null;
    coopPackRevealRef.current = null;
    clearEventAnnouncements();
    dismissStarReveal();
    setCoopSession(null);
    setCoopMessage(t("logic.leftRoom"));
    void loadSavedRooms();
  }

  /** Closes the co-op screen after this player's seat is gone (left on purpose); the world is no longer listed. */
  function forgetCoopRoom(code: string, message: string) {
    localStorage.removeItem(COOP_ROOM_KEY);
    coopStatusRef.current = null;
    coopPlayerCountRef.current = 0;
    coopEventRef.current = null;
    coopPackRevealRef.current = null;
    clearEventAnnouncements();
    dismissStarReveal();
    setSavedRooms((current) => current.filter((item) => item.code !== code));
    setCoopSession(null);
    setCoopMessage(message);
    void loadSavedRooms();
  }

  async function leaveCoopSeat() {
    if (!coopSession) return;
    const code = coopSession.code;
    setSeatDialog(null);
    setCoopBusy(true);
    const data = await sendCoopAction("leave-seat");
    setCoopBusy(false);
    if (!data?.left) return;
    forgetCoopRoom(code, data.newHost ? t("logic.freedHostPassed") : t("logic.freedWorldGoesOn"));
  }

  async function kickCoopMember(role: CoopRole, name: string, force: boolean) {
    if (!coopSession || coopSession.role !== "host") return;
    setSeatDialog(null);
    setCoopBusy(true);
    const data = await sendCoopAction("kick", { targetRole: role, force });
    setCoopBusy(false);
    if (data?.left) setCoopMessage(t("logic.seatFreeAgain", { name }));
  }

  async function answerPrestigeVote(decision: "approve" | "decline") {
    const vote = coopSession?.room.prestigeVote;
    if (!vote) return;
    setCoopBusy(true);
    const data = await sendCoopAction("prestige-vote", { voteId: vote.id, decision });
    setCoopBusy(false);
    if (data?.prestigeVote === "pending") setCoopMessage(t("logic.youAgreed"));
  }

  async function deleteCoopRoom(code: string) {
    const room = coopSession?.code === code ? coopSession.room : savedRooms.find((item) => item.code === code);
    if (!room?.canDelete) {
      setCoopMessage(t("logic.onlyHostDeletes"));
      return;
    }
    if (!window.confirm(t("logic.deleteRoomConfirm", { code }))) return;
    setCoopBusy(true);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", code, playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
      if (!response.ok || !data.deleted) throw new Error(data.error ?? t("logic.roomDeleteFailed"));
      localStorage.removeItem(COOP_ROOM_KEY);
      setSavedRooms((current) => current.filter((item) => item.code !== code));
      if (coopSession?.code === code) {
        coopStatusRef.current = null;
        coopPlayerCountRef.current = 0;
        coopEventRef.current = null;
        coopPackRevealRef.current = null;
        clearEventAnnouncements();
        dismissStarReveal();
        setCoopSession(null);
      }
      setCoopMessage(t("logic.roomDeleted"));
      void loadSavedRooms();
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : t("logic.roomDeleteFailed"));
    } finally {
      setCoopBusy(false);
    }
  }

  const vibrationSupported = hydrated && canVibrate();
  // Travel previews show an estimate ("ca.") and use exact routes as soon as the route data arrived. The 1.5 MB
  // route data only loads once the Spiele tab is open (the travel map loads it itself), not on every start.
  const [, setRoutesLoaded] = useState(false);
  const routesWanted = featureTab === "cup";
  useEffect(() => { if (!routesWanted) return; let active = true; void loadRouteCache().then((loaded) => { if (active && loaded) setRoutesLoaded(true); }); return () => { active = false; }; }, [routesWanted]);
  // Without clicks the combo drains one click per step, so a short pause costs a little instead of everything.
  const scheduleComboDecay = useCallback(function scheduleDecay(delay: number) {
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      const state = comboRef.current;
      const count = decayComboCount(state.count, Date.now() - state.last);
      const { multiplier } = getComboLevel(count);
      if (state.multiplier > 1 && multiplier === 1) clickFeedback.setBurst({ id: Date.now(), text: t("logic.comboOver") });
      clickFeedback.setCombo({ count, multiplier });
      if (count > 0) {
        state.multiplier = multiplier;
        scheduleDecay(COMBO_DECAY_MS);
      } else {
        comboTimerRef.current = null;
        comboRef.current = { count: 0, last: 0, paused: false, multiplier: 1 };
      }
    }, delay);
  }, [clickFeedback]);
  // Full screen announcements (Fabrizio Romario, gazette) pause the combo instead of ending it.
  const comboPaused = Boolean(transferAnnouncement || gazetteAnnouncement);
  useEffect(() => {
    const state = comboRef.current;
    if (comboPaused) {
      if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
      if (!state.paused) state.count = decayComboCount(state.count, Date.now() - state.last);
      state.paused = true;
      return;
    }
    if (!state.paused) return;
    state.paused = false;
    state.last = Date.now();
    if (state.count > 0) scheduleComboDecay(COMBO_HOLD_MS + COMBO_DECAY_MS);
  }, [comboPaused, scheduleComboDecay]);
  useEffect(() => () => { if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current); }, []);
  const latestClubGoalId = displayGame.features.cup.matchEvents.filter((event) => event.side === "home").at(-1)?.id ?? null;
  const liveMatch = displayGame.features.cup.active;
  useEffect(() => {
    // Vibrate once for every new goal of our club while the match is live; ignore goals restored from a save.
    if (clubGoalRef.current === null) { clubGoalRef.current = latestClubGoalId ?? ""; return; }
    if (latestClubGoalId && latestClubGoalId !== clubGoalRef.current && liveMatch) vibrate([70, 40, 140]);
    clubGoalRef.current = latestClubGoalId ?? "";
  }, [latestClubGoalId, liveMatch]);
  async function sendCoopAction(action: string, extra: Record<string, unknown> = {}) {
    if (!coopSession) return null;
    // Foreground actions carry one id for all their attempts: a resend after a lost answer is answered from the
    // server's receipt instead of being applied a second time.
    const actionId = action === "click" || action === "tick" || action === "cup-tick" ? undefined : newCoopActionId();
    const run = async () => {
      const maxAttempts = action === "click" ? 1 : 4;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // Growing pauses with jitter, so clients that collided do not collide again in lockstep.
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, coopRetryDelay(attempt)));
        try {
          const response = await fetch("/api/multiplayer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, code: coopSession.code, playerId: coopSession.playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, featuresKey: coopFeaturesKeyRef.current, ...(actionId ? { actionId } : {}), ...extra }),
          });
          const data = await readCoopResponse(response);
      syncTravelClock((data as typeof data & {serverNow?:number}).serverNow);
          if (data.room) setCoopSession((current) => mergeCoopSessionRoom(current, data.room!, data.role));
          // A newer server: the reload banner explains it (readCoopResponse); nothing was saved.
          if (response.status === 426) return null;
          if (!response.ok && data.errorCode === "STALE_STATE" && attempt + 1 < maxAttempts) continue;
          if (!response.ok) {
            // Clicks beyond the server's click budget are simply not counted; that is no error to show.
            if (action !== "click" || response.status !== 429) { setCoopMessage(data.error ?? t("logic.coopActionFailed")); showToast(data.error ?? t("logic.coopActionFailed"), "error"); }
            return null;
          }
          if (actionId) setCoopFailed((current) => current?.extra.actionId === actionId ? null : current);
          if (data.packReveal) {
            coopPackRevealRef.current = data.packReveal.openedAt;
            presentStarReveal(data.packReveal);
            showToast(data.packReveal.duplicate ? t("logic.duplicateDrawn", { fragments: formatNumber(data.packReveal.fragmentCompensation) }) : data.packReveal.source === "custom-draw" ? t("logic.drawnAsSpecial", { name: data.packReveal.player.name }) : t("logic.drawn", { name: data.packReveal.player.name }));
          }
          return data;
        } catch {
          const retryUnsafe = NETWORK_RETRY_UNSAFE_COOP_ACTIONS.has(action);
          if (action !== "click" && !retryUnsafe && attempt + 1 < maxAttempts) continue;
          if (actionId && !retryUnsafe) setCoopFailed({ action, extra: { ...extra, actionId } });
          setCoopMessage(retryUnsafe ? t("logic.connectionLostPurchase") : t("logic.coopDisconnected"));
          return null;
        }
      }
      setCoopMessage(t("logic.coopConflict"));
      return null;
    };
    // Klicks werden serverseitig atomar addiert. Hintergrund-Ticks werden
    // zusammengefasst, damit sie Käufe während eines Live-Spiels nie blockieren.
    if (action === "click") return run();
    if (action === "tick" || action === "cup-tick") {
      if (coopForegroundPendingRef.current > 0 || coopBackgroundActionRef.current) return null;
      const backgroundAction = run();
      coopBackgroundActionRef.current = backgroundAction;
      try {
        return await backgroundAction;
      } finally {
        if (coopBackgroundActionRef.current === backgroundAction) coopBackgroundActionRef.current = null;
      }
    }

    coopForegroundPendingRef.current += 1;
    const runForeground = async () => {
      const backgroundAction = coopBackgroundActionRef.current;
      if (backgroundAction) await backgroundAction;
      return run();
    };
    const queued = coopControlQueueRef.current.then(runForeground, runForeground);
    coopControlQueueRef.current = queued.then(() => undefined, () => undefined);
    try {
      return await queued;
    } finally {
      coopForegroundPendingRef.current = Math.max(0, coopForegroundPendingRef.current - 1);
      if (coopForegroundPendingRef.current === 0 && coopClickBatchRef.current.count > 0 && !coopClickBatchTimerRef.current) {
        coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 0);
      }
    }
  }

  // Invite link (Q60): the share sheet where there is one, else the clipboard.
  async function shareInvite() {
    if (!coopSession) return;
    const url = inviteUrl(window.location.origin, coopSession.code);
    const text = t("logic.inviteText", { roomName: coopSession.room.roomName, code: coopSession.code });
    try {
      if (navigator.share) { await navigator.share({ title: "Goal Clicker Koop", text, url }); return; }
      await navigator.clipboard?.writeText(url);
      showToast(t("logic.inviteCopied"));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setCoopMessage(t("logic.inviteLink", { url }));
      showToast(t("logic.inviteLink", { url }));
    }
  }

  async function copyCoopCode() {
    if (!coopSession) return;
    try {
      await navigator.clipboard?.writeText(coopSession.code);
      setCoopMessage(t("logic.codeCopied"));
    } catch {
      setCoopMessage(t("logic.roomCode", { code: coopSession.code }));
    }
  }

  async function renameCoopRoom() {
    if (!coopSession || coopSession.role !== "host") return;
    const roomName = coopRoomName.trim().replace(/\s+/g, " ").slice(0, 28);
    if (!roomName) {
      setCoopMessage(t("logic.nameWorldFirst"));
      return;
    }
    setCoopBusy(true);
    const data = await sendCoopAction("rename-room", { roomName });
    if (data?.room) setCoopMessage(t("logic.worldRenamed", { roomName: data.room.roomName }));
    setCoopBusy(false);
  }

  function applyLocalEvent(event: RandomEvent) {
    presentEventAnnouncement(event);
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const amount = Math.floor(event.amount);
      features.randomEvent = event;
      if (event.id === "var") features.nextVarAt = Date.now() + getRandomEventDelay();
      else features.nextEventAt = Date.now() + getRandomEventDelay();
      addHistory(features, { title: event.title, detail: event.message, tone: event.tone });
      return {
        ...current,
        goals: Math.max(0, current.goals + amount),
        seasonGoals: Math.max(0, current.seasonGoals + amount),
        totalGoals: Math.max(0, current.totalGoals + Math.max(0, amount)),
        features,
      };
    });
    addFeed(event.message, event.tone === "negative" ? "screen" : event.id === "var" ? "screen" : "star");
    showToast(event.title);
  }

  function triggerRandomEvent() {
    if (gameRef.current.features.squadLock || eventLockRef.current || gameRef.current.features.nextEventAt > getCurrentTime()) return;
    eventLockRef.current = true;
    const event = resolveRandomEvent(gameRef.current.goals, getBasePassivePower(gameRef.current.upgrades, gameRef.current.stars, gameRef.current.features));
    applyLocalEvent(event);
    window.setTimeout(() => { eventLockRef.current = false; }, 1200);
  }

  function triggerVarEvent() {
    if (gameRef.current.features.squadLock || eventLockRef.current || gameRef.current.features.nextVarAt > getCurrentTime()) return;
    eventLockRef.current = true;
    const event = resolveVarEvent(gameRef.current.goals, getBasePassivePower(gameRef.current.upgrades, gameRef.current.stars, gameRef.current.features));
    applyLocalEvent(event);
    window.setTimeout(() => { eventLockRef.current = false; }, 1200);
  }

  function triggerTransferInsiderEvent() {
    if (eventLockRef.current || gameRef.current.features.cup.active || gameRef.current.features.squadLock || gameRef.current.features.transferSaga.nextAt > getCurrentTime()) return;
    eventLockRef.current = true;
    const result = resolveTransferInsiderEvent(gameRef.current.features);
    setGame((current) => ({
      ...current,
      goals: current.goals + result.goalDelta,
      seasonGoals: current.seasonGoals + result.goalDelta,
      totalGoals: current.totalGoals + result.goalDelta,
      features: result.features,
    }));
    window.setTimeout(() => { eventLockRef.current = false; }, 1200);
  }

  /** An offer nobody answered in time counts as declined. */
  function expireLocalTransferOffer() {
    const result = expireTransferOffer(gameRef.current.features, getCurrentTime());
    if (result.event || result.deferred) setGame((current) => ({ ...current, features: result.features }));
  }

  function answerTransferOffer(accept: boolean) {
    setTransferAnnouncement(null);
    if (appMode === "coop" && isCoopLive) { void sendCoopAction(accept ? "transfer-accept" : "transfer-decline"); return; }
    const now = getCurrentTime();
    const result = accept ? acceptTransferOffer(gameRef.current.features, now) : declineTransferOffer(gameRef.current.features, now);
    if (result.error) { showToast(result.error); if (!result.features.transferSaga.pendingOffer) setGame((current) => ({ ...current, features: result.features })); return; }
    setGame((current) => ({
      ...current,
      goals: current.goals + result.goalDelta,
      seasonGoals: current.seasonGoals + result.goalDelta,
      totalGoals: current.totalGoals + result.goalDelta,
      features: result.features,
    }));
  }

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      const coopOffer = displayGame.features.transferSaga.pendingOffer, localOffer = gameRef.current.features.transferSaga.pendingOffer;
      if (appMode === "coop" && isCoopLive) {
        if (isAway()) return;
        if (!displayGame.features.squadLock && coopOffer && coopOffer.expiresAt <= getCurrentTime()) void sendCoopAction("transfer-insider-event");
        else if (!displayGame.features.squadLock && !coopOffer && !displayGame.features.cup.active && displayGame.features.transferSaga.nextAt <= getCurrentTime()) void sendCoopAction("transfer-insider-event");
        else if (!displayGame.features.squadLock && displayGame.features.nextVarAt <= getCurrentTime()) void sendCoopAction("var-event");
        else if (!displayGame.features.squadLock && displayGame.features.nextEventAt <= getCurrentTime()) void sendCoopAction("event");
      } else if (appMode === "single") {
        if (!gameRef.current.features.squadLock && localOffer && localOffer.expiresAt <= getCurrentTime()) expireLocalTransferOffer();
        else if (!gameRef.current.features.squadLock && !localOffer && !gameRef.current.features.cup.active && gameRef.current.features.transferSaga.nextAt <= getCurrentTime()) triggerTransferInsiderEvent();
        else if (!gameRef.current.features.squadLock && gameRef.current.features.nextVarAt <= getCurrentTime()) triggerVarEvent();
        else if (!gameRef.current.features.squadLock && gameRef.current.features.nextEventAt <= getCurrentTime()) triggerRandomEvent();
      }
    }, 5000);
    return () => window.clearInterval(timer);
    // These handlers intentionally stay out of the dependency list so the five-second clock is not restarted on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, displayGame.features.nextEventAt, displayGame.features.nextVarAt, displayGame.features.transferSaga.nextAt, displayGame.features.transferSaga.pendingOffer?.expiresAt, hydrated, isCoopLive]);

  async function saveClubProfile() {
    const profile = {
      name: clubDraft.name.trim().replace(/\s+/g, " ").slice(0, 22) || "FC Goal",
      badge: CLUB_BADGES.includes(clubDraft.badge) ? clubDraft.badge : CLUB_BADGES[0],
      color: CLUB_COLORS.includes(clubDraft.color) ? clubDraft.color : CLUB_COLORS[0],
    };
    setClubDraft(profile);
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("profile", profile);
      if (data) setCoopMessage(t("logic.clubProfileShared"));
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.club = profile;
      features.seasonMode.table = features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: profile.name } : team);
      features.seasonMode.lastTable = features.seasonMode.lastTable.map((team) => team.id === "club" ? { ...team, name: profile.name } : team);
      addHistory(features, { title: "Clubprofil aktualisiert", detail: `${profile.badge} ${profile.name} ist bereit für die nächste Runde.`, tone: "neutral" });
      return { ...current, features };
    });
    showToast(t("logic.clubProfileSaved"));
  }

  async function openRewardPack(rewardId:string) {
    if(packPurchaseRef.current||starReveal||displayGame.features.cup.active)return;
    packPurchaseRef.current=true;setCoopBusy(true);
    try {
      if(isCoopLive){const data=await sendCoopAction('reward-pack',{rewardId});if(!data)openAllRef.current=null;return;}
      const playerId=localStorage.getItem(PLAYER_ID_KEY);
      const response=await fetch('/api/rewards',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playerId,rewardId,features:gameRef.current.features})});
      const data=await response.json() as {error?:string;opening?:import('./feature-data').StarPackOpening};if(!response.ok){openAllRef.current=null;showToast(data.error??t("logic.rewardOpenFailed"));return;}
      const apply=async()=>{
        const current=gameRef.current, saved=readStoredGame().saved;
        const features=normalizeGameFeatures(current.features);
        const receipts=normalizeGameFeatures(saved?.features);
        for(const receipt of receipts.earnedPacks){const existing=features.earnedPacks.find(p=>p.id===receipt.id);if(existing&&receipt.opening)existing.opening=receipt.opening;else if(!existing)features.earnedPacks.push(receipt);}
        // Merge receipts from this tab before applying the single canonical server draw.
        for(const earned of current.features.earnedPacks)if(!features.earnedPacks.some(p=>p.id===earned.id))features.earnedPacks.push(earned);
        const reveal=openEarnedPack(features,rewardId,Date.now(),Math.random,data.opening);
        if(!reveal){showToast(t("logic.rewardOpened"));return;}
        const next={...current,features,lastSaved:Date.now()};persistLocalGame(next);gameRef.current=next;setGame(next);presentStarReveal(reveal);
      };
      if(navigator.locks)await navigator.locks.request('goal-clicker-reward',apply);else await apply();
    } catch {openAllRef.current=null;showToast(t("logic.rewardKept"));}
    finally {packPurchaseRef.current=false;setCoopBusy(false);}
  }

  // "Alle öffnen": the earned packs open one after the other; each reveal shows, the last one ends with a summary.
  const openAllRef = useRef<{ ids: string[]; opened: StarPackReveal[] } | null>(null);
  const openRewardPackRef = useRef(openRewardPack);
  openRewardPackRef.current = openRewardPack;
  function openAllRewardPacks() {
    const ids = displayGame.features.earnedPacks.filter((pack) => !pack.opening).map((pack) => pack.id);
    if (!ids.length || openAllRef.current) return;
    const [first, ...rest] = ids;
    openAllRef.current = { ids: rest, opened: [] };
    void openRewardPack(first);
  }
  function continueOpenAll() {
    const run = openAllRef.current;
    if (!run) return;
    const next = run.ids.shift();
    if (next) { window.setTimeout(() => void openRewardPackRef.current(next), 250); return; }
    openAllRef.current = null;
    const fresh = run.opened.filter((reveal) => !reveal.duplicate);
    const best = [...run.opened].sort((a, b) => b.player.rating - a.player.rating)[0];
    if (run.opened.length) showToast(`${t("logic.packsOpened", { opened: run.opened.length, fresh: fresh.length })}${best ? t("logic.packsBest", { name: best.player.name, rating: best.player.rating }) : ""}`);
  }

  async function buyStarPack(packId: StarPackId) {
    if (packPurchaseRef.current || starReveal) return;
    const pack = getStarPack(packId);
    if (!pack || isRewardPack(pack.id)) return;
    const unlockLeague = getPackUnlockLeague(pack.id);
    if (!isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess)) {
      showToast(t("logic.packUnlocksAt", { label: dataText(pack.label), unlockLeague }));
      return;
    }
    if (displayGame.features.cup.active) {
      showToast(t("logic.noPacksCup"));
      return;
    }
    if (!hasInfiniteMoney && displayGame.goals < pack.price) {
      showToast(t("logic.packCosts", { label: dataText(pack.label), price: formatNumber(pack.price) }));
      return;
    }
    packPurchaseRef.current = true;
    if (isCoopLive) {
      setCoopBusy(true);
      try {
        await sendCoopAction("star-pack", { packId: pack.id });
      } finally {
        packPurchaseRef.current = false;
        setCoopBusy(false);
      }
      return;
    }
    const latestGame = gameRef.current;
    if (latestGame.goals < pack.price || latestGame.features.cup.active) {
      packPurchaseRef.current = false;
      showToast(latestGame.features.cup.active ? t("logic.noPacksCup") : t("logic.packCosts", { label: dataText(pack.label), price: formatNumber(pack.price) }));
      return;
    }
    const opening = openStarPack(pack.id, latestGame.features.starXI.ownedIds, Math.random, latestGame.features.starXI.formationPositions);
    const reveal: StarPackReveal = { packId: opening.packId, packName: opening.packName, player: opening.player, duplicate: opening.duplicate, fragmentCompensation: opening.fragmentCompensation, source: opening.source, openedAt: Date.now(), openedBy: "Du", troll: shouldTriggerPackTroll(opening.player) };
    // The reveal and toast follow the state update: a purchase the updater refused shows nothing.
    // The flag keeps a repeated updater call (React StrictMode) from presenting twice.
    let settled = false;
    const settle = (applied: boolean) => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        if (!applied) { packPurchaseRef.current = false; return; }
        presentStarReveal(reveal);
        showToast(opening.duplicate ? t("logic.duplicateStar", { fragments: formatNumber(opening.fragmentCompensation) }) : t("logic.drawn", { name: opening.player.name }));
      }, 0);
    };
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (current.goals < pack.price || features.cup.active) { settle(false); return current; }
      settle(true);
      features.starPackReveal = reveal;
      notePackOpened(features, reveal.openedAt);
      if (!opening.duplicate) features.starXI = addStarXIPlayer(features.starXI, opening.player.id, getBestXIUnavailablePlayerIds(features));
      if (opening.duplicate) {
        features.starXI.fragments += opening.fragmentCompensation;
        addHistory(features, { title: `Doppelter Star: ${opening.player.name}`, detail: `+${formatNumber(opening.fragmentCompensation)} Fragmente · nur für Custom-Karten.`, tone: "neutral" });
      } else {
        addHistory(features, { title: `${opening.player.name} in die Star XI gezogen`, detail: `${formatStarXIPositions(opening.player)} · Rating ${opening.player.rating}`, tone: "positive" });
      }
      return { ...current, goals: current.goals - pack.price, features };
    });
  }

  async function buySpecialCardPack() {
    if (packPurchaseRef.current || starReveal) return;
    const cost = SPECIAL_CARD_PACK.price;
    const unlockLeague = getPackUnlockLeague(SPECIAL_CARD_PACK.id);
    if (!isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess)) {
      showToast(t("logic.packUnlocksAt", { label: dataText(SPECIAL_CARD_PACK.label), unlockLeague }));
      return;
    }
    if (displayGame.features.cup.active) {
      showToast(t("logic.noPacksMatch"));
      return;
    }
    if (!hasInfiniteMoney && displayGame.features.starXI.fragments < cost) {
      showToast(t("logic.specialCosts", { label: dataText(SPECIAL_CARD_PACK.label), cost: formatNumber(cost) }));
      return;
    }
    // One ID per click: the server and the local save both refuse a repeated receipt.
    const purchaseId = `special-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    packPurchaseRef.current = true;
    if (isCoopLive) {
      setCoopBusy(true);
      try {
        await sendCoopAction("special-pack", { purchaseId });
      } finally {
        packPurchaseRef.current = false;
        setCoopBusy(false);
      }
      return;
    }
    // The draw takes two rolls (rarity, then card); both runs replay the same ones.
    const rolls = [Math.random(), Math.random()], openedAt = Date.now();
    const replayRolls = () => { let index = 0; return () => rolls[index++ % rolls.length]; };
    const preview = normalizeGameFeatures(structuredClone(gameRef.current.features));
    const result = purchaseSpecialCardPack(preview, purchaseId, { random: replayRolls(), now: openedAt, unlimited: hasInfiniteMoney });
    if (!result.ok) {
      packPurchaseRef.current = false;
      showToast(result.error);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      // Same rolls and time as the preview, so the stored card is exactly the revealed card.
      return purchaseSpecialCardPack(features, purchaseId, { random: replayRolls(), now: openedAt, unlimited: hasInfiniteMoney }).ok ? { ...current, features } : current;
    });
    packPurchaseRef.current = false;
    presentStarReveal(result.reveal);
    showToast(result.reveal.duplicate ? t("logic.duplicateDrawn", { fragments: formatNumber(result.reveal.fragmentCompensation) }) : t("logic.drawn", { name: result.reveal.player.name }));
  }

  async function confirmMatchChanges(changes: {playerId:string;slot:number}[]) {
    if(isCoopLive){await sendCoopAction('cup-substitutions',{changes});return;}
    let failure='';
    setGame(current=>{const features=normalizeGameFeatures(current.features);failure=queueMatchChanges(features,changes,getCurrentTime());return failure?current:{...current,features};});
    showToast(failure||t("logic.subQueued"));
  }

  async function moveStarXIPlayerToLineup(playerId: string, lineupIndex: number) {
    if(displayGame.features.cup.active && displayGame.features.cup.simulation){showToast(t("logic.openSubs"));return;}
    if(displayGame.features.cup.active){await confirmMatchChanges([{playerId,slot:lineupIndex}]);return;}
    const player = getStarXIPlayer(playerId);
    if (!player || !Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE || !displayGame.features.starXI.ownedIds.includes(playerId)) return;
    if (displayGame.features.cup.active && displayGame.features.squadLock && !displayGame.features.squadLock.playerIds.includes(playerId)) { showToast(t("logic.notInMatchSquad")); return; }
    if (suspendedStarIds.includes(playerId)) {
      showToast(t("logic.bannedAfterRed", { name: player.name }));
      return;
    }
    const lineupPosition = activeFormationPositions[lineupIndex];
    const outgoingPlayerId = lineupStarIds[lineupIndex];
    if (displayGame.features.cup.active && outgoingPlayerId && displayGame.features.cup.sentOffPlayerIds.includes(outgoingPlayerId)) {
      const outgoingPlayer = getStarXIPlayer(outgoingPlayerId);
      showToast(t("logic.redNoSub", { name: outgoingPlayer?.name ?? t("logic.thisPlayer") }));
      return;
    }
    if (!canStarXIPlayerFillSlot(playerId, lineupIndex, activeFormationPositions)) {
      showToast(t("logic.cannotPlayPosition", { name: player.name, position: lineupPosition }));
      return;
    }
    const comesFromBench = displayGame.features.starXI.benchIds.includes(playerId);
    if (displayGame.features.cup.active && !comesFromBench) {
      showToast(t("logic.onlyFromBench"));
      return;
    }
    if (displayGame.features.cup.active && displayGame.features.cup.substitutionsUsed >= STAR_XI_MAX_SUBSTITUTIONS) {
      showToast(t("logic.allSubsUsed"));
      return;
    }
    if (displayGame.features.cup.active && displayGame.features.cup.playerExitedAt[playerId]) {
      showToast(t("logic.alreadySubbedOff", { name: player.name }));
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-lineup", { lineupIndex, starPlayerId: playerId });
      if (data) setCoopMessage(displayGame.features.cup.active ? t("logic.subbedOnLive", { name: player.name }) : t("logic.nowAtPosition", { name: player.name, position: lineupPosition }));
      setCoopBusy(false);
      if (data) setSelectedLineupSlot(null);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const outgoingPlayerId = features.starXI.lineupIds[lineupIndex];
      features.starXI = setStarXIStarter(features.starXI, lineupIndex, playerId, getUnavailableStarXIPlayerIds(features));
      if (features.cup.active) {
        const substitutionMinute = getCupMatchMinute(features.cup, getCurrentTime());
        features.cup = applyCupSubstitution(features.cup, outgoingPlayerId, playerId, substitutionMinute, getCurrentTime()).cup;
        if (outgoingPlayerId) features.cup.playerExitedAt[outgoingPlayerId] = Math.min(features.cup.playerExitedAt[outgoingPlayerId] ?? substitutionMinute, substitutionMinute);
        features.cup.playerEnteredAt[playerId] = substitutionMinute;
        features.cup.playerMatchPositions[playerId] = features.starXI.formationPositions[lineupIndex] ?? player.position;
        features.cup.substitutionsUsed = Math.min(STAR_XI_MAX_SUBSTITUTIONS, features.cup.substitutionsUsed + 1);
      }
      return { ...current, features };
    });
    showToast(displayGame.features.cup.active ? t("logic.subbedOn", { name: player.name }) : t("logic.putAt", { name: player.name, position: lineupPosition }));
    setSelectedLineupSlot(null);
    setSelectedBenchSlot(null);
  }

  async function changeStarXIFormation(formationId: StarFormationId) {
    if (displayGame.features.cup.active || activeFormation.id === formationId) return;
    const formation = getStarFormation(formationId);
    const unlockLeague = getFormationUnlockLeague(formation.id);
    if (!isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess)) {
      showToast(t("logic.packUnlocksAt", { label: dataText(formation.label), unlockLeague }));
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-formation", { formationId });
      if (data) setCoopMessage(t("logic.formationSwitched", { label: dataText(formation.label) }));
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.starXI = setStarXIFormation(features.starXI, formationId, getUnavailableStarXIPlayerIds(features));
      addHistory(features, { title: "Formation angepasst", detail: `Die Startelf spielt jetzt im ${formation.label}.`, tone: "neutral", kind: "squad" });
      return { ...current, features };
    });
    setSelectedLineupSlot(null);
    showToast(t("logic.formation", { label: dataText(formation.label) }));
  }

  async function autoPickBestStarXI() {
    if (displayGame.features.cup.active) {
      showToast(t("logic.xiLockedInMatch"));
      return;
    }
    const preview = setBestStarXI(displayGame.features.starXI, getBestXIUnavailablePlayerIds(displayGame.features), { career: displayGame.features.career, cup: displayGame.features.cup });
    const selectedCount = preview.lineupIds.filter(Boolean).length;
    if (!selectedCount) {
      showToast(t("logic.noMatchingPlayers"));
      return;
    }
    const unchanged = preview.lineupIds.join() === displayGame.features.starXI.lineupIds.join() && preview.benchIds.join() === displayGame.features.starXI.benchIds.join();
    if (unchanged) {
      showToast(t("logic.alreadyBestXI"));
      return;
    }
    const before = displayGame.features.starXI;
    setBestXIPreview({ after: preview, changes: lineupChanges(before, preview), bench: benchChangeCount(before, preview), before: getStarXIRating(before.ownedIds, before.lineupIds), rating: getStarXIRating(preview.ownedIds, preview.lineupIds) });
  }

  async function applyBestStarXI() {
    setBestXIPreview(null);
    if (displayGame.features.cup.active) return;
    const preview = setBestStarXI(displayGame.features.starXI, getBestXIUnavailablePlayerIds(displayGame.features), { career: displayGame.features.career, cup: displayGame.features.cup });
    const selectedCount = preview.lineupIds.filter(Boolean).length;
    if (!selectedCount) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-best-lineup");
      if (data) {
        setSelectedLineupSlot(null);
        setSelectedBenchSlot(null);
        setCoopMessage(t("logic.bestXIFilled", { count: selectedCount, size: STAR_XI_SQUAD_SIZE }));
        showToast(t("logic.bestXIShort", { count: selectedCount, size: STAR_XI_SQUAD_SIZE }));
      }
      setCoopBusy(false);
      return;
    }
    const shown = displayGame.features;
    setSquadUndo({ lineupIds: [...shown.starXI.lineupIds], benchIds: [...shown.starXI.benchIds], formationId: shown.starXI.formationId, signature: `${preview.lineupIds.join()}|${preview.benchIds.join()}` });
    setGame((current) => {
      // The preview was computed from exactly these features: reuse it instead of normalizing and searching again.
      let features: GameFeatures;
      if (current.features === shown) features = { ...current.features, starXI: preview };
      else {
        features = normalizeGameFeatures(current.features);
        features.starXI = setBestStarXI(features.starXI, getBestXIUnavailablePlayerIds(features), { career: features.career, cup: features.cup });
      }
      const count = features.starXI.lineupIds.filter(Boolean).length;
      addHistory(features, { title: "Beste Startelf aufgestellt", detail: `${count} von ${STAR_XI_SQUAD_SIZE} Positionen mit den stärksten passenden Spielern besetzt.`, tone: "positive", kind: "squad" });
      return { ...current, features };
    });
    setSelectedLineupSlot(null);
    setSelectedBenchSlot(null);
    showToast(t("logic.bestXIShort", { count: selectedCount, size: STAR_XI_SQUAD_SIZE }));
  }

  /** One step back after t("logic.bestXI") (single player), as long as nobody changed the squad since. */
  function undoBestStarXI() {
    const undo = squadUndo;
    setSquadUndo(null);
    if (!undo || isCoopLive || displayGame.features.cup.active) return;
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (`${features.starXI.lineupIds.join()}|${features.starXI.benchIds.join()}` !== undo.signature || features.starXI.formationId !== undo.formationId) return current;
      features.starXI = removeStarXIPlayersFromSquad(normalizeStarXIState({ ...features.starXI, lineupIds: undo.lineupIds, benchIds: undo.benchIds }), getBestXIUnavailablePlayerIds(features));
      return { ...current, features };
    });
    showToast(t("logic.lineupReset"));
  }

  /** t("logic.fillGaps") (Q21): only empty or unavailable places change; everything else stays as the player set it. */
  async function fillSquadGaps() {
    if (displayGame.features.cup.active) { showToast(t("logic.gapsViaSubs")); return; }
    const preview = fillStarXIGaps(displayGame.features, { career: displayGame.features.career, cup: displayGame.features.cup });
    if (!preview.replacements.length) { showToast(startingStarXISelection.length < STAR_XI_SQUAD_SIZE ? t("logic.noFitForGaps") : t("logic.noGaps")); return; }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-fill-gaps");
      setCoopBusy(false);
      if (data) showToast(describeReplacements(preview.replacements).join(" · "));
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const result = fillStarXIGaps(features, { career: features.career, cup: features.cup });
      if (!result.replacements.length) return current;
      features.starXI = result.starXI;
      addHistory(features, { title: "Lücken gefüllt", detail: describeReplacements(result.replacements).join(" · "), tone: "neutral", kind: "squad" });
      return { ...current, features };
    });
    pickSquadSpot(null);
    showToast(describeReplacements(preview.replacements).join(" · "));
  }

  /** t("logic.bestBench") (Q27): the strongest fitting substitutes behind the eleven, which stays as it is. */
  async function pickBestBench() {
    if (displayGame.features.cup.active) return;
    const next = withBestBench(displayGame.features, { career: displayGame.features.career, cup: displayGame.features.cup });
    if (next.benchIds.join() === displayGame.features.starXI.benchIds.join()) { showToast(t("logic.alreadyBestBench")); return; }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-best-bench");
      setCoopBusy(false);
      if (data) showToast(t("logic.bestBenchSet"));
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.starXI = withBestBench(features, { career: features.career, cup: features.cup });
      addHistory(features, { title: "Beste Bank aufgestellt", detail: `${features.starXI.benchIds.filter(Boolean).length} Bankplätze mit den stärksten passenden Spielern besetzt.`, tone: "neutral", kind: "squad" });
      return { ...current, features };
    });
    showToast(t("logic.bestBenchSet"));
  }

  /** A player leaves his place without a replacement: onto an empty bench place or back to the reserve (Q30). */
  async function unassignSquadPlayer(playerId: string, benchIndex?: number) {
    if (displayGame.features.cup.active) return;
    const name = getStarXIPlayer(playerId)?.name ?? t("logic.player");
    const preview = benchIndex === undefined ? movePlayerToReserve(displayGame.features.starXI, playerId) : movePlayerToEmptyBench(displayGame.features.starXI, playerId, benchIndex);
    if (!preview) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-unassign", { starPlayerId: playerId, ...(benchIndex === undefined ? {} : { benchIndex }) });
      setCoopBusy(false);
      if (data) showToast(benchIndex === undefined ? t("logic.nowInReserve", { name }) : t("logic.nowOnBench", { name }));
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const next = benchIndex === undefined ? movePlayerToReserve(features.starXI, playerId) : movePlayerToEmptyBench(features.starXI, playerId, benchIndex);
      if (!next) return current;
      features.starXI = next;
      return { ...current, features };
    });
    showToast(benchIndex === undefined ? t("logic.nowInReserve", { name }) : t("logic.nowOnBench", { name }));
  }

  // "Kaderlücke schliessen": the best eleven and bench fill the free place; without enough players the packs help.
  async function closeSquadVacancy() {
    // Filling only the free places keeps every other choice (Q21); the best eleven is the fallback.
    const filled = fillStarXIGaps(displayGame.features, { career: displayGame.features.career, cup: displayGame.features.cup });
    if (filled.replacements.length && !getOpenTransferSquadVacancies({ ...displayGame.features, starXI: filled.starXI }).length) { await fillSquadGaps(); return; }
    const starXI = setBestStarXI(displayGame.features.starXI, getBestXIUnavailablePlayerIds(displayGame.features), { career: displayGame.features.career, cup: displayGame.features.cup });
    if (getOpenTransferSquadVacancies({ ...displayGame.features, starXI }).length) {
      showToast(t("logic.tooFewFit"));
      return;
    }
    await autoPickBestStarXI();
  }

  async function selectStarXIBenchPlayer(playerId: string, benchIndex: number) {
    const player = getStarXIPlayer(playerId);
    if (!player || displayGame.features.cup.active || !displayGame.features.starXI.ownedIds.includes(playerId) || displayGame.features.starXI.lineupIds.includes(playerId)) return;
    if (displayGame.features.cup.active && displayGame.features.squadLock && !displayGame.features.squadLock.playerIds.includes(playerId)) { showToast(t("logic.notInMatchSquad")); return; }
    if (suspendedStarIds.includes(playerId)) {
      showToast(t("logic.redNoBench", { name: player.name }));
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-bench", { benchIndex, starPlayerId: playerId });
      if (data) setCoopMessage(t("logic.onBenchSlot", { name: player.name, slot: benchIndex + 1 }));
      setCoopBusy(false);
      if (data) setSelectedBenchSlot(null);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.starXI = setStarXIBenchPlayer(features.starXI, benchIndex, playerId, getUnavailableStarXIPlayerIds(features));
      return { ...current, features };
    });
    setSelectedBenchSlot(null);
    showToast(t("logic.movedToBench", { name: player.name }));
  }

  /** The spot picked by a first tap in the t("logic.squad") tab: a pitch place, a bench place or a reserve player. */
  function pickedSquadSpot(): SquadPick | null {
    if (activeLineupSlot !== null) { const id = lineupStarIds[activeLineupSlot]; return { source: id ? { playerId: id, area: "lineup", index: activeLineupSlot } : null, target: { area: "lineup", index: activeLineupSlot } }; }
    if (selectedBenchSlot !== null) { const id = benchStarIds[selectedBenchSlot]; return { source: id ? { playerId: id, area: "bench", index: selectedBenchSlot } : null, target: { area: "bench", index: selectedBenchSlot } }; }
    return selectedReserveId ? { source: { playerId: selectedReserveId, area: "reserve", index: null }, target: null } : null;
  }

  function pickSquadSpot(pick: SquadPick | null) {
    setSelectedLineupSlot(pick?.target?.area === "lineup" ? pick.target.index : null);
    setSelectedBenchSlot(pick?.target?.area === "bench" ? pick.target.index : null);
    setSelectedReserveId(pick && !pick.target ? pick.source?.playerId ?? null : null);
    if (pick?.target) setReservePage(0);
  }

  // First tap picks, second tap moves or swaps (see resolveSquadTap); drag and drop does the same in one go.
  function tapSquadSpot(tapped: SquadPick) {
    const result = resolveSquadTap(pickedSquadSpot(), tapped, canDropSquadPlayer);
    if ("move" in result) { pickSquadSpot(null); void dropSquadPlayer(...result.move); return; }
    pickSquadSpot(result.pick);
  }

  function chooseLineupSlot(index: number) {
    const playerId = lineupStarIds[index];
    if (displayGame.features.cup.active && playerId && displayGame.features.cup.sentOffPlayerIds.includes(playerId)) {
      const player = getStarXIPlayer(playerId);
      showToast(t("logic.redNoSub", { name: player?.name ?? t("logic.thisPlayer") }));
      return;
    }
    tapSquadSpot({ source: playerId ? { playerId, area: "lineup", index } : null, target: { area: "lineup", index } });
  }

  function chooseBenchSlot(index: number) {
    if (displayGame.features.cup.active) {
      showToast(t("logic.pickStarterToSub"));
      return;
    }
    const playerId = benchStarIds[index];
    tapSquadSpot({ source: playerId ? { playerId, area: "bench", index } : null, target: { area: "bench", index } });
  }

  function chooseReservePlayer(playerId: string) {
    tapSquadSpot({ source: { playerId, area: "reserve", index: null }, target: null });
  }

  function canDropSquadPlayer(source: SquadDragSource, target: SquadDropTarget) {
    const player = getStarXIPlayer(source.playerId);
    if (!player || coopBusy || !displayGame.features.starXI.ownedIds.includes(source.playerId)) return false;
    if (suspendedStarIds.includes(source.playerId)) return false;
    // A yellow card ban for the coming match keeps a reserve player out of the eleven and the bench.
    if (source.area === "reserve" && getBannedPlayerIds(displayGame.features, displayGame.features.cup.active ? competitionOfCup(displayGame.features.cup) : nextCompetition(displayGame.features)).includes(source.playerId)) return false;

    if (target.area === "lineup") {
      if (target.index < 0 || target.index >= STAR_XI_SQUAD_SIZE || !canStarXIPlayerFillSlot(source.playerId, target.index, activeFormationPositions)) return false;
      if (source.area === "lineup" && source.index === target.index) return false;
      if (displayGame.features.cup.active) {
        const outgoingPlayerId = lineupStarIds[target.index];
        if (outgoingPlayerId && displayGame.features.cup.sentOffPlayerIds.includes(outgoingPlayerId)) return false;
        return source.area === "bench"
          && displayGame.features.cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS
          && !displayGame.features.cup.playerExitedAt[source.playerId];
      }
      if (source.area === "lineup" && source.index !== null) {
        const displacedPlayerId = lineupStarIds[target.index];
        if (displacedPlayerId && !canStarXIPlayerFillSlot(displacedPlayerId, source.index, activeFormationPositions)) return false;
      }
      return true;
    }

    if (target.area === "reserve") return source.area !== "reserve" && !displayGame.features.cup.active;
    if (target.index < 0 || target.index >= STAR_XI_BENCH_SIZE || (source.area === "bench" && source.index === target.index)) return false;
    if (source.area !== "lineup") return !displayGame.features.cup.active;
    if (source.index === null) return false;
    const incomingPlayerId = benchStarIds[target.index];
    if (!incomingPlayerId) return !displayGame.features.cup.active;
    if (!canStarXIPlayerFillSlot(incomingPlayerId, source.index, activeFormationPositions)) return false;
    if (!displayGame.features.cup.active) return true;
    return displayGame.features.cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS
      && !displayGame.features.cup.playerExitedAt[incomingPlayerId];
  }

  async function dropSquadPlayer(source: SquadDragSource, target: SquadDropTarget) {
    if (target.area === "reserve") { await unassignSquadPlayer(source.playerId); return; }
    if (source.area === "lineup" && target.area === "bench" && !benchStarIds[target.index]) { await unassignSquadPlayer(source.playerId, target.index); return; }
    if (target.area === "lineup") {
      await moveStarXIPlayerToLineup(source.playerId, target.index);
      return;
    }
    if (source.area === "lineup" && source.index !== null) {
      const incomingPlayerId = benchStarIds[target.index];
      if (incomingPlayerId) await moveStarXIPlayerToLineup(incomingPlayerId, source.index);
      return;
    }
    await selectStarXIBenchPlayer(source.playerId, target.index);
  }

  function travelLabel(fixture:TravelFixture) {
    if(!fixture.away)return t("logic.startMatch");
    const j=displayGame.features.travel.journey;
    if(!j||j.fixture.id!==fixture.id||j.consumed)return t("logic.startTrip");
    return journeyView(j,getTravelTime()).arrived?t("logic.startMatch"):t("logic.tripRunning");
  }
  async function prepareTravel(mode:'season'|'tournament', tournamentId: TournamentId):Promise<TravelFixture|null> {
    const fixture=fixtureFor(displayGame.features,mode,tournamentId);
    const error=eligibilityError(displayGame.features,mode,tournamentId,getTravelTime());
    if(error){showToast(error);return null;}
    const j=displayGame.features.travel.journey;
    if(j&&!j.consumed&&j.fixture.id!==fixture.id){showToast(t("logic.finishTripFirst"));openFeatureTab('cup');return null;}
    if(!fixture.away)return fixture;
    if(travelActionRef.current)return null;
    travelActionRef.current=true;setTravelBusy(true);
    try {
      if(isCoopLive){
        if(j?.fixture.id===fixture.id&&journeyView(j,getTravelTime()).arrived)return fixture;
        await sendCoopAction('travel-start',{mode,tournamentId});openFeatureTab('cup');return null;
      }
      const action=j?.fixture.id===fixture.id&&journeyView(j,getTravelTime()).arrived?'start':'depart';
      const response=await fetch('/api/travel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,mode,tournamentId,playerId,features:displayGame.features})});
      const data=await response.json() as {journey?:Journey;serverNow?:number;error?:string};
      if(!response.ok||!data.journey){showToast(data.error||t("logic.tripSaveFailed"));return null;}
      syncTravelClock(data.serverNow);
      setGame(current=>{
        const old=current.features.travel, same=old.journey?.id===data.journey!.id, counted=same?(old.journey as Journey & {counted?:boolean}).counted:false, finesPaid=same?old.journey!.finesPaid:false;
        const travel=settleTravel({...old,journey:{...data.journey!,consumed:false,counted,finesPaid} as Journey},data.serverNow!);
        travel.journey!.consumed=false;
        return {...current,features:{...current.features,travel,squadLock:data.journey!.squadLock}};
      });
      openFeatureTab('cup');
      return action==='start'?data.journey.fixture:null;
    }catch{showToast(t("logic.tripNeedsServer"));return null;}
    finally{travelActionRef.current=false;setTravelBusy(false);}
  }

  async function startCup(tournamentId: TournamentId = selectedTournamentId) {
    if (displayGame.features.cup.active) return;
    const cupStartNow = getCurrentTime();
    if (!displayGame.features.cup.pendingNextRound && displayGame.features.cup.nextTournamentAt > cupStartNow) {
      showToast(t("logic.newTournamentIn", { time: formatCountdown(displayGame.features.cup.nextTournamentAt, cupStartNow) }));
      return;
    }
    if (hasTransferSquadVacancy) {
      showToast(t("logic.fillVacancyFirst", { place: transferSquadVacancyLabel }));
      return;
    }
    if (displayGame.features.cup.pendingNextRound && tournamentId !== displayGame.features.cup.tournamentId) {
      showToast(t("logic.prepareNextFirst"));
      return;
    }
    if (!starXIComplete) {
      showToast(suspendedStarPlayers.length ? t("games.replaceFirst", { names: suspendedStarPlayers.map((player) => player.name).join(", ") }) : t("logic.xiNeedsPlayers", { size: STAR_XI_SQUAD_SIZE }));
      return;
    }
    const tournament = getTournament(tournamentId) ?? TOURNAMENTS[0];
    const unlockLeague = getTournamentUnlockLeague(tournament.id);
    if (!isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess)) {
      showToast(t("logic.packUnlocksAt", { label: dataText(tournament.label), unlockLeague }));
      return;
    }
    if (starXIRating < tournament.minimumRating) {
      showToast(t("logic.needsOvr", { label: dataText(tournament.label), minimumRating: tournament.minimumRating }));
      return;
    }
    const tournamentBanError = squadBanError(displayGame.features, competitionFor("tournament", tournament.id));
    if (tournamentBanError) {
      showToast(tournamentBanError);
      return;
    }
    const travelFixture = await prepareTravel("tournament", tournament.id);
    if (!travelFixture) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-start", { tournamentId: tournament.id });
      if (data) setCoopMessage(t("logic.tournamentOpened", { label: dataText(tournament.label) }));
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      let features = normalizeGameFeatures(current.features);
      const suspendedOnSquad = features.cup.suspendedPlayerIds.some((playerId) => features.starXI.lineupIds.includes(playerId) || features.starXI.benchIds.includes(playerId));
      if (squadBanError(features, competitionFor("tournament", tournament.id)) || getOpenTransferSquadVacancies(features).length > 0 || getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE || suspendedOnSquad || features.cup.active || (!features.cup.pendingNextRound && features.cup.nextTournamentAt > cupStartNow)) return current;
      if (!features.cup.pendingNextRound) features = activatePendingTransferLoans(features, tournament.id);
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      features.cup = beginCupMatch(features.cup, cupStartNow, tournament.id, homePlayers, features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds, Math.random, travelFixture.schedule);
      consumeTravel(features, travelFixture);
      prepareCareerMatch(features);
      return { ...current, features };
    });
    showToast(t("logic.tournamentKickoff", { label: dataText(tournament.label), duration: formatCountdown(tournamentMatchDuration(tournament.minimumRating), 0) }));
  }

  async function startSeasonCupMatch() {
    if (displayGame.features.cup.active) return;
    const cupStartNow = getCurrentTime();
    if (displayGame.features.seasonMode.hallOfFame) {
      showToast(t("logic.hofPrestigeFirst"));
      return;
    }
    if (displayGame.features.cup.pendingNextRound) {
      showToast(t("logic.previousMatchFirst"));
      return;
    }
    if (hasTransferSquadVacancy) {
      showToast(t("logic.fillVacancyFirst", { place: transferSquadVacancyLabel }));
      return;
    }
    if (!starXIComplete) {
      showToast(suspendedStarPlayers.length ? t("games.replaceFirst", { names: suspendedStarPlayers.map((player) => player.name).join(", ") }) : t("logic.xiNeedsPlayers", { size: STAR_XI_SQUAD_SIZE }));
      return;
    }
    const nextOpponent = getSeasonModeNextOpponent(displayGame.features.seasonMode, displayClubName);
    const leagueBanError = squadBanError(displayGame.features, competitionFor("season", "stadium"));
    if (leagueBanError) {
      showToast(leagueBanError);
      return;
    }
    const travelFixture = await prepareTravel("season", "stadium");
    if (!travelFixture) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-start", { mode: "season" });
      if (data) setCoopMessage(t("logic.seasonMatchOpened", { name: nextOpponent.name }));
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      let features = normalizeGameFeatures(current.features);
      const suspendedOnSquad = features.cup.suspendedPlayerIds.some((playerId) => features.starXI.lineupIds.includes(playerId) || features.starXI.benchIds.includes(playerId));
      if (squadBanError(features, competitionFor("season", "stadium")) || getOpenTransferSquadVacancies(features).length > 0 || getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE || suspendedOnSquad || features.cup.active || features.cup.pendingNextRound) return current;
      features = activatePendingTransferLoans(features, "stadium");
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, cupStartNow, homePlayers, features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
      consumeTravel(features, travelFixture);
      prepareCareerMatch(features);
      return { ...current, features };
    });
    showToast(t("logic.matchdayKickoff", { matchday: displayGame.features.seasonMode.matchday + 1, name: nextOpponent.name, duration: formatCountdown(seasonMatchDuration(displayGame.features.seasonMode.division), 0) }));
  }


  function recordFinishedSeasonMatch(features: GameFeatures, now: number, passivePerSecond: number) {
    // The stadium and the table still show the match that was played, so the takings are counted first.
    const tickets = getTicketIncome(features, passivePerSecond);
    const result = recordSeasonModeMatch(features.seasonMode, features.cup.homeScore, features.cup.awayScore, features.club.name, now, Math.random, features.cup.opponentIds[0]);
    if (!result.played || !result.entry) return { features, entry: null as typeof result.entry, ticketIncome: 0 };
    features = recordCareerMatch(features, now, result.entry);
    if (tickets) recordTicketIncome(features, tickets, now);
    features.seasonMode = result.state;
    features.seasonMode.table = features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: features.club.name } : team);
    features = finishActiveTransferLoans(features, now, { hallOfFameReached: result.entry.seasonOutcome === "hall-of-fame" }).features;
    const outcomeLabel = result.entry.seasonOutcome === "promoted" ? t("logic.promotion") : result.entry.seasonOutcome === "relegated" ? t("logic.relegation") : result.entry.seasonOutcome === "hall-of-fame" ? "Hall of Fame" : result.entry.completedSeason ? t("logic.survival") : result.entry.outcome === "win" ? t("logic.win") : result.entry.outcome === "loss" ? t("logic.loss") : t("logic.draw");
    addHistory(features, {
      title: `Saisonspiel · ${outcomeLabel}`,
      detail: `${result.entry.clubScore}:${result.entry.opponentScore} gegen ${result.entry.opponent} · Spieltag ${result.entry.matchday}/${SEASON_MODE_MATCHES_PER_SEASON}`,
      tone: result.entry.seasonOutcome === "relegated" || result.entry.outcome === "loss" ? "negative" : result.entry.seasonOutcome === "promoted" || result.entry.seasonOutcome === "hall-of-fame" || result.entry.outcome === "win" ? "positive" : "neutral",
    });
    // Stars only for a league never reached before (getSeasonStarReward), never for promotion after relegation.
    const seasonReward = result.starReward;
    return { features, entry: result.entry, seasonReward, ticketIncome: tickets?.income ?? 0 };
  }

  async function takeCupPenalty(direction: CupPenaltyDirection) {
    const visibleCup = displayGame.features.cup;
    if (!visibleCup.active || visibleCup.phase !== "penalties" || coopBusy) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const expectedPenaltyStep = getCupPenaltyStep(visibleCup);
      const data = await sendCoopAction("cup-penalty", { direction, expectedPenaltyStep });
      if (data) setCoopMessage(t("logic.penaltySynced"));
      setCoopBusy(false);
      return;
    }
    // A second tap before the screen shows the next attempt aims at a step that is already taken.
    const expectedPenaltyStep = getCupPenaltyStep(visibleCup);
    setGame((current) => {
      let features = normalizeGameFeatures(current.features);
      if (!features.cup.active || features.cup.phase !== "penalties" || getCupPenaltyStep(features.cup) !== expectedPenaltyStep) return current;
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      const effectiveRating = getStarXIEffectiveMatchRating(features.starXI.ownedIds, features.starXI.lineupIds, features.cup, 120);
      const cupNow = getCurrentTime();
      const result = resolveCupPenalty(features.cup, effectiveRating, direction, cupNow, Math.random, homePlayers, features.starXI.formationPositions);
      features.cup = result.cup;
      applyPendingMatchChanges(features, getCurrentTime());
      if (result.finished) releaseMatchSquad(features, getCurrentTime());
      if (result.finished) {
        features.starXI = restoreStarXIAfterMatch(features.starXI, features.cup);
        if (features.cup.mode === "season") {
          const finished = recordFinishedSeasonMatch(features, cupNow, getBasePassivePower(current.upgrades, current.stars, current.features));
          features = finished.features;
          return { ...current, features, goals: current.goals + finished.ticketIncome, seasonGoals: current.seasonGoals + finished.ticketIncome, totalGoals: current.totalGoals + finished.ticketIncome, seasons: Math.max(current.seasons, features.seasonMode.highestDivision - 1), stars: Math.min(MAX_SEASON_STARS, current.stars + (finished.seasonReward ?? 0)) };
        } else {
          recordCareerMatch(features, cupNow);

          addHistory(features, {
            title: result.tournamentWon ? `${getTournament(features.cup.tournamentId)?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Elfmeterschiessen gewonnen · Trophäe erhalten · ${getTournamentRewardPack(result.cup.tournamentId, features.seasonMode.highestDivision).label}` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Elfmeterschiessen gewonnen · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Elfmeterschiessen gewonnen · Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Elfmeterschiessen gewonnen · Runde ${result.completedRound + 1} läuft bereits` : "Im Elfmeterschiessen ausgeschieden.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) features = completeTournamentRun(features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, cupNow);
        }
      }
      return { ...current, features };
    });
  }

  async function editInteractiveMatch() {
    if(isCoopLive){await sendCoopAction('cup-edit');return;}
    setGame(current=>({...current,features:requestMatchEdit(normalizeGameFeatures(current.features),getCurrentTime())}));
  }
  async function batchInteractiveMatch(draft:MatchDraft){
    if(isCoopLive){await sendCoopAction('cup-batch',{draft});return;}
    setGame(current=>{const result=confirmMatchDraft(normalizeGameFeatures(current.features),draft,getCurrentTime());return result.error?current:{...current,features:result.features};});
  }
  async function resumeInteractiveMatch(){
    if(isCoopLive){await sendCoopAction('cup-resume');return;}
    setGame(current=>({...current,features:{...current.features,cup:resumeCupMatch(current.features.cup,getCurrentTime())}}));
  }
  function advanceLocalCup() {
    if (!gameRef.current.features.cup.active) return;
    const now = getCurrentTime();
    setGame((current) => {
      let features = { ...current.features };
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      const matchMinute = getCupMatchMinute(features.cup, now);
      const effectiveRating = getStarXIEffectiveMatchRating(features.starXI.ownedIds, features.starXI.lineupIds, features.cup, matchMinute);
      const result = advanceCupMatch(features.cup, effectiveRating, now, Math.random, homePlayers, features.starXI.formationPositions);
      if (!result.finished && result.cup.lastTickAt === features.cup.lastTickAt) return current;
      features.cup = result.cup;
      applyPendingMatchChanges(features, getCurrentTime());
      if (result.finished) releaseMatchSquad(features, getCurrentTime());
      if (result.finished) {
        features = structuredClone(features);
        features.starXI = restoreStarXIAfterMatch(features.starXI, features.cup);
        if (features.cup.mode === "season") {
          const finished = recordFinishedSeasonMatch(features, now, getBasePassivePower(current.upgrades, current.stars, current.features));
          features = finished.features;
          return { ...current, features, goals: current.goals + finished.ticketIncome, seasonGoals: current.seasonGoals + finished.ticketIncome, totalGoals: current.totalGoals + finished.ticketIncome, seasons: Math.max(current.seasons, features.seasonMode.highestDivision - 1), stars: Math.min(MAX_SEASON_STARS, current.stars + (finished.seasonReward ?? 0)) };
        } else {
          recordCareerMatch(features, now);

          addHistory(features, {
            title: result.tournamentWon ? `${getTournament(features.cup.tournamentId)?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Trophäe erhalten · ${getTournamentRewardPack(result.cup.tournamentId, features.seasonMode.highestDivision).label}` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Rote Karte · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Runde ${result.completedRound + 1} läuft bereits` : "Der nächste Turnierlauf kommt bestimmt.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) features = completeTournamentRun(features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, now);
        }
      }
      return { ...current, features };
    });
  }

  useEffect(() => {
    if (!hydrated || (appMode !== "single" && !isCoopLive)) return;
    const timer = window.setInterval(() => {
      if (appMode === "coop" && isCoopLive && displayGame.features.cup.active && displayGame.features.cup.phase !== "penalties") { if (!isAway()) void sendCoopAction("cup-tick"); }
      else if (appMode === "single" && gameRef.current.features.cup.active) advanceLocalCup();
    }, 1000);
    return () => window.clearInterval(timer);
    // The one-second clock should stay stable while the match is live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, displayGame.features.cup.active, hydrated, isCoopLive]);

  // After a single player match the places of injured, suspended or banned players are filled at once (Q21).
  const soloCupActive = game.features.cup.active;
  const soloCupWasActiveRef = useRef(soloCupActive);
  useEffect(() => {
    const was = soloCupWasActiveRef.current;
    soloCupWasActiveRef.current = soloCupActive;
    if (!hydrated || isCoopLive || !was || soloCupActive) return;
    const timer = window.setTimeout(() => {
      const current = gameRef.current;
      if (current.features.cup.active) return;
      const preview = fillStarXIGaps(current.features, { career: current.features.career, cup: current.features.cup });
      if (!preview.replacements.some((entry) => entry.area === "lineup")) return;
      setGame((latest) => {
        if (latest.features.cup.active) return latest;
        const features = normalizeGameFeatures(latest.features);
        const result = fillStarXIGaps(features, { career: features.career, cup: features.cup });
        if (!result.replacements.length) return latest;
        features.starXI = result.starXI;
        addHistory(features, { title: "Lücken automatisch gefüllt", detail: describeReplacements(result.replacements).join(" · "), tone: "neutral", kind: "squad" });
        return { ...latest, features };
      });
      showToast(t("logic.autoReplaced", { replacements: describeReplacements(preview.replacements).join(" · ") }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [soloCupActive, hydrated, isCoopLive, setGame]);

  async function collectAlbumReward(groupId: string) {
    if (coopBusy) return;
    if (isCoopLive) {
      setCoopBusy(true);
      await sendCoopAction("album-claim", { groupId });
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      // Fragments plus seconds of income in goals (claimAlbumRewards).
      const claim = claimAlbumRewards(features, groupId, getBasePassivePower(current.upgrades, current.stars, current.features));
      return claim.claimed ? { ...current, features, goals: current.goals + claim.goals, seasonGoals: current.seasonGoals + claim.goals, totalGoals: current.totalGoals + claim.goals } : current;
    });
  }

  async function claimWeeklyGoalReward(goalId: string) {
    if (coopBusy) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("weekly-claim", { goalId });
      if (data) setCoopMessage(t("logic.weeklyClaimed"));
      setCoopBusy(false);
      return;
    }
    let message = "";
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const claim = claimWeeklyGoal(features, goalId, Date.now(), current.minigameWins);
      message = claim.ok ? `${t("logic.weeklyDone", { title: localizeText(claim.goal.title) })}${claim.goal.reward.kind === "pack" ? t("logic.weeklyPackReady", { label: claim.label }) : `+${claim.label}`}` : claim.error;
      return claim.ok ? { ...current, features } : current;
    });
    if (message) showToast(message);
  }

  // Single player: a new Zurich week starts its goals (and the baseline of every counter) as soon as it begins.
  useEffect(() => {
    if (!hydrated || appMode !== "single") return;
    const check = () => {
      const now = Date.now(), current = gameRef.current;
      if (!weeklyGoalsNeedUpdate(current.features, now, current.minigameWins)) return;
      setGame((latest) => {
        const features = { ...latest.features };
        return ensureWeeklyGoals(features, now, latest.minigameWins) ? { ...latest, features } : latest;
      });
    };
    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [hydrated, appMode, setGame]);

  function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.03, delay = 0) {
    if (!gameRef.current.sound || !soundPrefsRef.current.effects || typeof window === "undefined") return;
    const audio = gameAudioContext();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function toggleVibration() {
    const next = !vibrationOn;
    setVibrationOn(next);
    setVibrationEnabled(next);
    try { localStorage.setItem(VIBRATION_STORAGE_KEY, next ? "on" : "off"); } catch { /* Storage can be unavailable. */ }
    if (next) vibrate(40);
    showToast(next ? t("logic.vibrationOn") : t("logic.vibrationOff"));
  }

  function registerCombo(now: number) {
    const state = comboRef.current;
    if (state.paused) return getComboLevel(state.count).multiplier;
    const current = decayComboCount(state.count, now - state.last);
    const previous = getComboLevel(current);
    state.count = Math.min(COMBO_MAX_COUNT, current + 1);
    state.last = now;
    const level = getComboLevel(state.count);
    state.multiplier = level.multiplier;
    clickFeedback.setCombo({ count: state.count, multiplier: level.multiplier });
    if (level.multiplier > previous.multiplier) {
      clickFeedback.setBurst({ id: now, text: `COMBO ${formatComboMultiplier(level.multiplier)}` });
      window.setTimeout(() => clickFeedback.setBurst((current) => current?.id === now ? null : current), 900);
      playTone(level.tier === 3 ? 988 : 784, 0.12, "triangle", 0.045);
      vibrate(level.tier === 3 ? [30, 25, 45] : 30);
    }
    scheduleComboDecay(COMBO_HOLD_MS + COMBO_DECAY_MS);
    return level.multiplier;
  }

  // The starter squad after the first clicks, also for a loaded save that is already past them; once per club or world.
  const starterSquadDue = hydrated && !displayGame.features.starterSquadGranted && displayGame.clicks >= STARTER_SQUAD_UNLOCK_CLICKS && !displayGame.features.cup.active && !displayGame.features.squadLock;
  useEffect(() => {
    if (!starterSquadDue || starterSquadRequestedRef.current) return;
    starterSquadRequestedRef.current = true;
    const announce = (added: number, complete: boolean) => {
      if (!added) return;
      addFeed(complete ? t("logic.starterNewInXI", { added }) : t("logic.starterWaiting", { added }), "squad");
      showToast(complete ? t("logic.xiComplete") : t("logic.starterNew", { added }));
    };
    const timer = window.setTimeout(() => {
      if (isCoopLive) {
        void sendCoopAction("starter-squad").then((data) => {
          if (data?.starterSquad) { announce(data.starterSquad.added, data.starterSquad.complete); return; }
          // Not granted (network, conflict): ask again a little later. When another player got it meanwhile, the
          // synced world no longer needs it and nothing is sent.
          window.setTimeout(() => { starterSquadRequestedRef.current = false; setStarterSquadRetry((count) => count + 1); }, 10_000);
        });
        return;
      }
      const features = normalizeGameFeatures(structuredClone(gameRef.current.features));
      const result = maybeGrantStarterSquad(features, gameRef.current.clicks);
      if (!result) return;
      setGame((current) => ({ ...current, features }));
      announce(result.added.length, result.complete);
    }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterSquadDue, isCoopLive, starterSquadRetry]);

  function handleBallClick(event: MouseEvent<HTMLButtonElement>) {
    const comboMultiplier = registerCombo(Date.now());
    const liveClickPower = getClickPower(displayGame.upgrades, displayGame.stars, displayGame.features, getCurrentTime()) * comboMultiplier;
    const result = createClickResult(liveClickPower, lastClickRef.current, streakRef.current);
    lastClickRef.current = result.now;
    streakRef.current = result.streak;
    if (isCoopLive) queueCoopClick(result.amount);
    else setGame((current) => ({ ...current, goals: current.goals + result.amount, seasonGoals: current.seasonGoals + result.amount, totalGoals: current.totalGoals + result.amount, clicks: current.clicks + 1 }));
    const rect = stageRef.current?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 50;
    const y = rect ? event.clientY - rect.top : 50;
    const effect = { id: result.effectId, x, y, amount: result.amount, critical: result.critical, combo: getComboLevel(comboRef.current.count).tier };
    clickFeedback.addEffect(effect);
    setTimeout(() => clickFeedback.removeEffect(effect.id), 850);
    clickFeedback.togglePulse();
    playTone(result.critical ? 720 : 350, 0.07, "triangle", result.critical ? 0.055 : 0.025);
    if (result.critical) { showToast(t("logic.criticalFinish"), "minor"); playTone(980, 0.13, "square", 0.04, 0.07); }
    else if (result.streak === 10) showToast(t("logic.tenClicks"), "minor");
  }

  function handleBallKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "Enter" || event.key === " ") && event.repeat) event.preventDefault();
  }

  /** A mini game reward at the club's current income (fixed amounts are the floor). */
  function miniGameReward(id: MiniGameId, baseReward: number) {
    return scaleMiniGameReward(id, baseReward, getBasePassivePower(displayGame.upgrades, displayGame.stars, displayGame.features));
  }

  function awardMiniGame(reward: number, name: string, id: MiniGameId, icon: IconName = "star") {
    const safeReward = Math.max(0, Math.floor(reward));
    const celebrate = () => {
      addFeed(t("logic.miniReward", { name, reward: formatNumber(safeReward), seconds: MINI_GAME_COOLDOWN_SECONDS[id] }), icon);
      showToast(t("logic.miniRewardShort", { name, reward: formatNumber(safeReward) }));
      playTone(523, 0.1, "triangle", 0.035);
      playTone(784, 0.18, "triangle", 0.04, 0.1);
    };
    // In a world the server decides; the reward is only announced once it accepted it (else its message shows).
    if (isCoopLive) {
      void sendCoopAction("minigame", { minigameId: id, reward: safeReward }).then((data) => { if (data) celebrate(); });
      return;
    }
    setGame((current) => ({ ...current, goals: current.goals + safeReward, seasonGoals: current.seasonGoals + safeReward, totalGoals: current.totalGoals + safeReward, minigameWins: current.minigameWins + 1, miniGameCooldowns: { ...current.miniGameCooldowns, [id]: getMiniGameCooldownUntil(id) } }));
    celebrate();
  }

  /** Opens a mini game; in a world only after the server started the run, without which no reward counts. */
  function openMiniGame(id: MiniGameId, open: () => void) {
    if (!isCoopLive) { open(); return; }
    if (coopMiniGameStartingRef.current) return;
    coopMiniGameStartingRef.current = true;
    void sendCoopAction("minigame-start", { minigameId: id }).then((data) => { if (data) open(); }).finally(() => { coopMiniGameStartingRef.current = false; });
  }

  function closeMiniGame() {
    setActiveMiniGame(null);
  }

  function startPenaltyGame() {
    if (isMiniGameOnCooldown("penalty")) {
      showToast(t("logic.penaltyLocked", { game: localizeText(MINI_GAME_NAMES.penalty), time: formatCountdown(displayGame.miniGameCooldowns.penalty, countdownNow) }));
      return;
    }
    openMiniGame("penalty", () => {
      setActiveMiniGame("penalty");
      setPenaltyGame({ shots: 0, goals: 0, message: t("logic.pickCorner"), finished: false, reward: 0 });
    });
  }

  function takePenalty(direction: PenaltyDirection) {
    if (!penaltyGame || penaltyGame.finished) return;
    const goalkeeper = getRandomPenaltyDirection();
    const scored = direction !== goalkeeper;
    const shots = penaltyGame.shots + 1;
    const goals = penaltyGame.goals + (scored ? 1 : 0);
    if (shots >= 5) {
      const reward = miniGameReward("penalty", 250 + goals * 150);
      setPenaltyGame({ shots, goals, message: t("logic.penaltyResult", { goals, reward: formatNumber(reward) }), finished: true, reward });
      awardMiniGame(reward, t("logic.penaltyScore", { goals }), "penalty", scored ? "ball" : "screen");
      return;
    }
    setPenaltyGame({ ...penaltyGame, shots, goals, message: scored ? t("logic.penaltyGoal") : t("logic.penaltySaved", { goalkeeper: directionWord(goalkeeper) }), finished: false, reward: 0 });
  }

  function startDribbleGame() {
    if (isMiniGameOnCooldown("dribble")) {
      showToast(t("logic.dribbleLocked", { game: localizeText(MINI_GAME_NAMES.dribble), time: formatCountdown(displayGame.miniGameCooldowns.dribble, countdownNow) }));
      return;
    }
    const sequence = Array.from({ length: 6 }, () => getRandomPenaltyDirection());
    openMiniGame("dribble", () => {
      setActiveMiniGame("dribble");
      setDribbleGame({ sequence, step: 0, attempts: 0, misses: 0, message: t("logic.firstMove", { direction: directionLabel(sequence[0]) }), finished: false, reward: 0 });
    });
  }

  function takeDribble(direction: PenaltyDirection) {
    if (!dribbleGame || dribbleGame.finished) return;
    const expected = dribbleGame.sequence[dribbleGame.step];
    const correct = direction === expected;
    const step = correct ? dribbleGame.step + 1 : 0;
    const attempts = dribbleGame.attempts + 1;
    const misses = dribbleGame.misses + (correct ? 0 : 1);
    if (correct && step >= dribbleGame.sequence.length) {
      const reward = miniGameReward("dribble", 220 + Math.max(0, 3 - misses) * 45);
      setDribbleGame({ ...dribbleGame, step, attempts, misses, message: t("logic.perfectDribble", { attempts }), finished: true, reward });
      awardMiniGame(reward, "Dribble Run", "dribble", "striker");
      return;
    }
    if (!correct && misses >= 3) {
      const reward = miniGameReward("dribble", 60 + dribbleGame.step * 15);
      setDribbleGame({ ...dribbleGame, step, attempts, misses, message: t("logic.dribbleLost", { reward: formatNumber(reward) }), finished: true, reward });
      awardMiniGame(reward, "Dribble Run", "dribble", "boot");
      return;
    }
    setDribbleGame({ ...dribbleGame, step, attempts, misses, message: correct ? t("logic.cleanNext", { direction: directionLabel(dribbleGame.sequence[step]) }) : t("logic.ballLost"), finished: false, reward: 0 });
  }

  function startCrossbarGame() {
    if (isMiniGameOnCooldown("crossbar")) {
      showToast(t("logic.crossbarLocked", { game: localizeText(MINI_GAME_NAMES.crossbar), time: formatCountdown(displayGame.miniGameCooldowns.crossbar, countdownNow) }));
      return;
    }
    openMiniGame("crossbar", () => {
      setActiveMiniGame("crossbar");
      setCrossbarGame({ shots: 0, hits: 0, message: t("logic.crossbarIntro"), finished: false, reward: 0 });
    });
  }

  function takeCrossbar(height: CrossbarHeight) {
    if (!crossbarGame || crossbarGame.finished) return;
    const target = getRandomCrossbarHeight();
    const hit = height === target;
    const shots = crossbarGame.shots + 1;
    const hits = crossbarGame.hits + (hit ? 1 : 0);
    if (shots >= 5) {
      const reward = miniGameReward("crossbar", 50 + hits * 45);
      setCrossbarGame({ shots, hits, message: t("logic.crossbarResult", { hits, reward: formatNumber(reward) }), finished: true, reward });
      awardMiniGame(reward, t("logic.crossbarScore", { hits }), "crossbar", hit ? "star" : "screen");
      return;
    }
    setCrossbarGame({ ...crossbarGame, shots, hits, message: hit ? t("logic.crossbarHit") : t("logic.crossbarMiss", { height: heightLabel(target) }), finished: false, reward: 0 });
  }

  function startPredictionGame() {
    if (isMiniGameOnCooldown("prediction")) {
      showToast(t("logic.predictionLocked", { game: localizeText(MINI_GAME_NAMES.prediction), time: formatCountdown(displayGame.miniGameCooldowns.prediction, countdownNow) }));
      return;
    }
    openMiniGame("prediction", () => {
      setActiveMiniGame("prediction");
      setPredictionGame({ round: 0, wins: 0, message: t("logic.whoWins"), finished: false, reward: 0 });
    });
  }

  function takePrediction(prediction: MatchPrediction) {
    if (!predictionGame || predictionGame.finished) return;
    const outcome = getRandomMatchPrediction();
    const round = predictionGame.round + 1;
    const wins = predictionGame.wins + (prediction === outcome ? 1 : 0);
    if (round >= 3) {
      const reward = miniGameReward("prediction", 70 + wins * 55 + (wins === 3 ? 100 : 0));
      setPredictionGame({ round, wins, message: t("logic.predictResult", { wins, reward: formatNumber(reward) }), finished: true, reward });
      awardMiniGame(reward, t("logic.predictScore", { wins }), "prediction", "broadcast");
      return;
    }
    setPredictionGame({ ...predictionGame, round, wins, message: prediction === outcome ? t("logic.predictRight", { outcome: predictionLabel(outcome) }) : t("logic.predictWrong", { outcome: predictionLabel(outcome) }), finished: false, reward: 0 });
  }

  async function buyUpgrade(upgrade: UpgradeDefinition) {
    const unlockLeague = getUpgradeUnlockLeague(upgrade.id);
    const alreadyOwned = getLevel(displayGame.upgrades, upgrade.id) > 0;
    if (!alreadyOwned && !isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess)) {
      showToast(t("logic.upgradeUnlocksAt", { name: dataText(upgrade.name), unlockLeague }));
      return;
    }
    const purchase = getBulkPurchase(upgrade, displayGame.upgrades, spendableGoals, purchaseMode, hasInfiniteMoney);
    const isBigPurchase = purchase.count >= 10 || (!hasInfiniteMoney && purchase.totalCost >= displayGame.goals * 0.5);
    if (purchase.count === 0) {
      const nextCost = getCost(upgrade, displayGame.upgrades);
      showToast(nextCost === Infinity ? t("logic.upgradeMax") : t("logic.upgradeCosts", { name: dataText(upgrade.name), cost: formatNumber(nextCost) }));
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      try {
        const data = await sendCoopAction("buy", { upgradeId: upgrade.id, count: purchase.count });
        if (data) setCoopMessage(t("logic.boughtTogether", { name: dataText(upgrade.name) }));
        if (data && isBigPurchase) vibrate([35, 30, 60]);
      } finally {
        setCoopBusy(false);
      }
      return;
    }
    const level = getLevel(game.upgrades, upgrade.id) + purchase.count;
    setGame((current) => ({ ...current, goals: current.goals - purchase.totalCost, upgrades: { ...current.upgrades, [upgrade.id]: level } }));
    addFeed(t("logic.boughtMany", { name: dataText(upgrade.name), count: purchase.count, total: formatNumber(purchase.totalCost) }), upgrade.icon);
    showToast(purchase.count === 1 ? t("logic.upgradeToLevel", { name: dataText(upgrade.name), level }) : t("logic.levelsBought", { name: dataText(upgrade.name), count: purchase.count }));
    playTone(440, 0.08, "triangle", 0.03);
    playTone(660, 0.13, "triangle", 0.04, 0.08);
    if (isBigPurchase) vibrate([35, 30, 60]);
  }

  async function claimDaily() {
    if (dailyBusy) return;
    if (isCoopLive) {
      setDailyBusy(true);
      try {
        const data = await sendCoopAction("daily-claim");
        if (data?.dailyReward) {
          showToast(`${t("logic.dailyToast", { day: data.dailyReward.dayIndex, amount: formatNumber(data.dailyReward.amount) })}${data.dailyReward.pack ? t("logic.dailyPackWorld") : ""}`);
          vibrate([40, 30, 90]);
        }
      } finally {
        setDailyBusy(false);
      }
      return;
    }
    const now = getCurrentTime();
    const preview = claimDailyReward(game.features.dailyRewards, "solo", getBasePassivePower(game.upgrades, game.stars, game.features), getBaseClickPower(game.upgrades, game.stars, game.features), now);
    if (!preview) { showToast(t("logic.dailyClaimed")); return; }
    setGame((current) => {
      const claim = claimDailyReward(current.features.dailyRewards, "solo", getBasePassivePower(current.upgrades, current.stars, current.features), getBaseClickPower(current.upgrades, current.stars, current.features), now);
      if (!claim) return current;
      const features = normalizeGameFeatures(current.features);
      features.dailyRewards = claim.state;
      if (claim.pack && !features.earnedPacks.some((pack) => pack.id === claim.pack!.id)) features.earnedPacks.push(claim.pack);
      addHistory(features, { title: `Tägliche Prämie · Tag ${claim.dayIndex}`, detail: `+${formatNumber(claim.amount)} Tore${claim.pack ? " und ein Spezialkarten-Pack" : ""}. Serie: ${claim.streak} ${claim.streak === 1 ? "Tag" : "Tage"}.`, tone: "positive" }, now);
      return { ...current, goals: current.goals + claim.amount, seasonGoals: current.seasonGoals + claim.amount, totalGoals: current.totalGoals + claim.amount, features };
    });
    addFeed(t("logic.dailyAmount", { dayIndex: preview.dayIndex, amount: formatNumber(preview.amount) }), "star");
    showToast(`${t("logic.dailyToast", { day: preview.dayIndex, amount: formatNumber(preview.amount) })}${preview.pack ? t("logic.dailyPackAlbum") : ""}`);
    playTone(659, 0.1, "triangle", 0.04);
    playTone(988, 0.18, "triangle", 0.045, 0.1);
    vibrate([40, 30, 90]);
  }

  async function answerPress(matchId: string, questionId: string, answerIndex: number) {
    if (pressBusy) return;
    if (isCoopLive) {
      setPressBusy(true);
      try {
        const data = await sendCoopAction("press-answer", { matchId, questionId, answerIndex });
        if (data?.press) showToast(t("logic.mediaReward", { reward: formatNumber(data.press.reward), sign: data.press.mood >= 0 ? "+" : "", mood: data.press.mood }));
      } finally {
        setPressBusy(false);
      }
      return;
    }
    const now = getCurrentTime();
    const preview = answerPressConference(game.features.press, game.features.cup, game.features.club.name, matchId, questionId, answerIndex, now);
    if (!preview) return;
    const reward = getPressReward(getBasePassivePower(game.upgrades, game.stars, game.features), getBaseClickPower(game.upgrades, game.stars, game.features));
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const result = answerPressConference(features.press, features.cup, features.club.name, matchId, questionId, answerIndex, now);
      if (!result) return current;
      features.press = result.press;
      addHistory(features, { title: "Pressekonferenz", detail: `«${result.answer}» · Fanstimmung ${result.mood >= 0 ? "+" : ""}${result.mood}`, tone: result.mood >= 0 ? "positive" : "neutral" }, now);
      return { ...current, goals: current.goals + reward, seasonGoals: current.seasonGoals + reward, totalGoals: current.totalGoals + reward, features };
    });
    showToast(t("logic.mediaReward", { reward: formatNumber(reward), sign: preview.mood >= 0 ? "+" : "", mood: preview.mood }));
    playTone(523, 0.08, "triangle", 0.03);
  }

  function openPrestigeDialog() {
    const reason = getPrestigeBlockReason(displayGame.features);
    if (reason) { showToast(reason); return; }
    setPrestigeDialog({ requestId: crypto.randomUUID(), error: "", prestigeCount: displayGame.features.seasonMode.prestigeCount });
  }

  /** Home city of a new game (before its first league match); in co-op the host sets it for the whole world. */
  async function selectHomeCity(city: HomeCityId) {
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("home-city", { city });
      setCoopBusy(false);
      if (data) setCoopMessage(t("logic.worldHomeCity", { name: homeCityOf(city).name }));
      return;
    }
    const check = chooseHomeCity(gameRef.current.features, city);
    if (check.error) { showToast(check.error); return; }
    setGame((current) => { const result = chooseHomeCity(current.features, city); return result.error ? current : { ...current, features: result.features }; });
    showToast(t("logic.homeCity", { name: homeCityOf(city).name }));
  }

  async function confirmSeasonPrestige(keepNormalId: string | null, homeCity?: HomeCityId) {
    if (!prestigeDialog) return;
    const { requestId, prestigeCount } = prestigeDialog;
    // A double click confirms once: the feed, the toast and the sound come only with the first confirmation.
    if (prestigeConfirmedRef.current.has(requestId)) return;
    if (isCoopLive) {
      prestigeConfirmedRef.current.add(requestId);
      setCoopBusy(true);
      const data = await sendCoopAction("season-prestige", { requestId, keepNormalId, homeCity, expectedPrestigeCount: prestigeCount });
      setCoopBusy(false);
      if (!data) {
        // The same request id may be sent again: the server counts it once.
        prestigeConfirmedRef.current.delete(requestId);
        setPrestigeDialog((current) => current && { ...current, error: t("logic.prestigeNotConfirmed") });
        return;
      }
      setPrestigeDialog(null);
      // Other members are online: the proposal opened a vote; Prestige starts once they all agreed.
      if (data.prestigeVote === "pending") {
        setHiddenPrestigeVote("");
        setCoopMessage(t("logic.voteStarted"));
        return;
      }
      setCoopMessage(t("logic.prestigeStartedCoop"));
    } else {
      const now = getCurrentTime();
      // Checked once more against the current state; season, squad, album, upgrades, goals and count change in one update.
      const check = applyGamePrestige(gameRef.current, keepNormalId, now, requestId, homeCity);
      if (check.duplicate) { setPrestigeDialog(null); return; }
      if (check.error) { setPrestigeDialog((current) => current && { ...current, error: check.error }); return; }
      prestigeConfirmedRef.current.add(requestId);
      setGame((current) => {
        const result = applyGamePrestige(current, keepNormalId, now, requestId, homeCity);
        return result.error || result.duplicate ? current : result.game;
      });
      setPrestigeDialog(null);
    }
    addFeed(t("logic.prestigeStartedSolo"), "star");
    showToast(t("logic.prestigeStarted"));
    playTone(523, 0.12, "triangle", 0.04);
    playTone(784, 0.2, "triangle", 0.05, 0.1);
  }

  async function abandonTournament() {
    setAbandonDialog(false);
    const blocked = abandonTournamentBlockReason(displayGame.features);
    if (blocked) { showToast(blocked); return; }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-abandon");
      setCoopBusy(false);
      if (data) showToast(t("logic.tournamentGivenUp"));
      return;
    }
    const now = getCurrentTime();
    setGame((current) => { const features = abandonTournamentRun(normalizeGameFeatures(current.features), now); return features ? { ...current, features } : current; });
    showToast(t("logic.tournamentGivenUp"));
  }

  async function resumeCupWithoutSubstitution() {
    if (!displayGame.features.cup.active || !displayGame.features.cup.matchPaused) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-resume");
      if (data) setCoopMessage(t("logic.noSubContinues"));
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (!features.cup.active || !features.cup.matchPaused) return current;
      features.cup = resumeCupMatch(features.cup, getCurrentTime());
      addHistory(features, { title: "Verletzungspause beendet", detail: "Der verletzte Spieler bleibt draussen; die Partie läuft ohne Wechsel weiter.", tone: "neutral" });
      return { ...current, features };
    });
    setSelectedLineupSlot(null);
    showToast(t("logic.noSubContinuesShort"));
  }

  function toggleSound() {
    setGame((current) => ({ ...current, sound: !current.sound }));
    showToast(game.sound ? t("logic.soundOff") : t("logic.soundOn"));
  }

  function closeWhatsNew() {
    setWhatsNewOpen(false);
    try {
      // A synced key: the cloud upload carries it to the player's other devices.
      localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW[0]?.id ?? "");
    } catch {
      // The window closes even when the browser storage refuses the write.
    }
  }

  function setTutorial(next: TutorialState) {
    setTutorialState(next);
    try {
      // A synced key: the cloud upload carries the progress to the player's other devices.
      localStorage.setItem(TUTORIAL_STORAGE_KEY, serializeTutorialState(next));
    } catch {
      // Without browser storage the tutorial still runs until the page closes.
    }
  }

  function endTutorial() {
    setTutorial({ ...tutorial, status: "done" });
    // Ending the tutorial early must not leave a club without a starting eleven: the open places get the best fitting cards.
    setGame((current) => {
      if (current.features.starXI.lineupIds.filter(Boolean).length >= STAR_XI_SQUAD_SIZE || current.features.cup.active) return current;
      const features = normalizeGameFeatures(current.features);
      features.starXI = setBestStarXI(features.starXI, getBestXIUnavailablePlayerIds(features), { career: features.career, cup: features.cup });
      return { ...current, features };
    });
  }

  /** t("logic.endTutorial") and the skip of the welcome window: with an unopened welcome pack the player is asked first. */
  function requestEndTutorial() {
    if (welcomePackOpen(gameRef.current.features)) setTutorialEndDialog(true);
    else endTutorial();
  }

  function confirmEndTutorial() {
    setTutorialEndDialog(false);
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      forfeitWelcomePack(features);
      return { ...current, features };
    });
    endTutorial();
  }

  /** Opens the welcome pack of the shop: exactly one random walkout card, given once. */
  function openWelcomePack() {
    if (starReveal || gameRef.current.features.welcomePack !== "available") return;
    const features = normalizeGameFeatures(structuredClone(gameRef.current.features));
    const reveal = claimWelcomePack(features);
    if (!reveal) return;
    setGame((current) => ({ ...current, features }));
    presentStarReveal(reveal);
  }

  function restartTutorial() {
    setTutorial(newTutorial());
    openFeatureTab("home");
  }

  // "Zeig es mir": open the tab of the task, or bring the ball or the upgrade shop on the home screen into view.
  function showTutorialStep(step: TutorialStep) {
    const target = step.target;
    const homeTarget = target === "ball" || target === "shop";
    openFeatureTab(target === "ball" || target === "shop" ? "home" : target);
    window.setTimeout(() => {
      const element = target === "ball" ? stageRef.current : target === "shop" ? document.querySelector(".shop-card") : document.querySelector(".feature-card");
      element?.scrollIntoView({ behavior: "smooth", block: homeTarget ? "center" : "start" });
    }, 50);
  }

  // What the autosave did: another tab saved meanwhile (load that game), or the browser storage is full.
  const outdatedShownRef = useRef(false);
  const handleLocalSave = useCallback((result: LocalSaveResult) => {
    if (result === "stale") {
      suspendLocalPersistence();
      window.location.reload();
      return;
    }
    // A newer version of the game stored this save; it stays untouched until the page is reloaded.
    if (result === "outdated") {
      if (!outdatedShownRef.current) { outdatedShownRef.current = true; setOffline(NEWER_VERSION_MESSAGE); }
      return;
    }
    if (result === "failed" && !saveFailedRef.current) {
      saveFailedRef.current = true;
      setOffline(SAVE_FAILED_MESSAGE);
    } else if (result === "saved" && saveFailedRef.current) {
      saveFailedRef.current = false;
      setOffline((current) => current === SAVE_FAILED_MESSAGE ? "" : current);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredGame();
    markLocalSaveLoaded();
    // The newest release notes show once to players who already had a game; new players start without them.
    try {
      const latest = WHATS_NEW[0]?.id;
      if (latest && localStorage.getItem(WHATS_NEW_STORAGE_KEY) !== latest) {
        if (stored.saved) window.setTimeout(() => setWhatsNewOpen(true), 0);
        else localStorage.setItem(WHATS_NEW_STORAGE_KEY, latest);
      }
    } catch {
      // Without browser storage the window simply stays closed.
    }
    // A brand new club starts the tutorial; a game saved before the tutorial existed never sees it.
    try {
      const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      const next = raw ? parseTutorialState(raw) : stored.saved ? finishedTutorial() : newTutorial();
      if (!raw) localStorage.setItem(TUTORIAL_STORAGE_KEY, serializeTutorialState(next));
      window.setTimeout(() => setTutorialState(next), 0);
    } catch {
      if (!stored.saved) window.setTimeout(() => setTutorialState(newTutorial()), 0);
    }
    if (document.visibilityState === "visible") claimLocalSave();
    if (stored.saved) {
      try {
        const saved = stored.saved;
        const upgrades = normalizeUpgrades(saved.upgrades);
        const savedAt = Number(saved.lastSaved) || Date.now();
        const pausedMs = Math.max(0, Date.now() - savedAt);
        const totalGoalsValue = Number(saved.totalGoals);
        const totalGoals = Number.isFinite(totalGoalsValue) ? Math.max(0, totalGoalsValue) : 0;
        const savedSeasonGoals = Number(saved.seasonGoals);
        const seasonGoals = Number.isFinite(savedSeasonGoals) ? Math.max(0, savedSeasonGoals) : totalGoals;
        const stars = Math.min(MAX_SEASON_STARS, Math.max(0, Number(saved.stars) || 0));
        const seasons = Math.max(0, Number(saved.seasons) || 0);
        const minigameWins = Math.max(0, Math.floor(Number(saved.minigameWins) || 0));
        const miniGameCooldowns = pauseMiniGameCooldowns(saved.miniGameCooldowns, pausedMs, savedAt);
        const features = pauseGameFeatureTimers(saved.features, pausedMs);
        const goalsValue = Number(saved.goals);
        const goals = capGoalsAfterRebalance(Number.isFinite(goalsValue) ? Math.max(0, goalsValue) : 0, saved.features, upgrades, stars, features);
        const clicksValue = Number(saved.clicks);
        const next: GameState = { ...initialGame(), upgrades, features, achievements: normalizeAchievements(saved.achievements), goals, totalGoals, seasonGoals, clicks: Number.isFinite(clicksValue) ? Math.max(0, clicksValue) : 0, stars, seasons, balanceVersion: BALANCE_VERSION, sound: saved.sound !== false, lastSaved: Date.now(), miniGameCooldowns, minigameWins };
        if (stored.recovered) {
          window.setTimeout(() => setOffline(t("logic.backupLoaded")), 0);
        } else if (pausedMs > 10000 && matchRanWhileAway(features.cup)) {
          // The match is not paused while the app is closed: say so, and list what happened once it has caught up.
          missedMatchRef.current = { since: savedAt, until: Date.now(), matchStartedAt: features.cup.matchStartedAt };
          window.setTimeout(() => setOffline(MATCH_RAN_WHILE_AWAY), 0);
        } else if (pausedMs > 10000 && (getPassivePower(upgrades, stars, features) > 0 || features.cup.active)) {
          // Return summary: how long the club was alone and what waits now (the chips on Home lead there).
          const waiting = getOpenActions({ features, now: Date.now(), miniGameCooldowns, minigameWins });
          window.setTimeout(() => setOffline(t("logic.welcomeBack", { summary: returnSummary(pausedMs, waiting) })), 0);
        }
        window.setTimeout(() => {
          setGame(next);
          // Restore the last saved event as a presentation-only notification.
          // The event is presentation-only here: its reward was already applied
          // before the save and must not be applied a second time.
          if (next.features.randomEvent) presentEventAnnouncement(next.features.randomEvent);
        }, 0);
      } catch {
        window.setTimeout(() => setOffline(t("logic.backupUnreadable")), 0);
      }
    } else {
      // A brand new club: the free welcome pack (one random walkout) is not handed out now. It waits invisibly until the
      // tutorial reaches its shop step, so the first walkout is part of the guided start.
      window.setTimeout(() => {
        const features = normalizeGameFeatures(structuredClone(gameRef.current.features));
        startWelcomePack(features);
        setGame((current) => ({ ...current, features }));
      }, 0);
    }
    window.setTimeout(() => setHydrated(true), 0);
  }, [setGame]);

  // Hidden time is measured on the monotonic clock (system clock changes earn nothing), and one hidden period
  // earns at most MAX_BACKGROUND_CATCH_UP_MS of passive income in total. pageInactiveAtRef holds monotonic readings.
  const hiddenBudgetRef = useRef(MAX_BACKGROUND_CATCH_UP_MS);
  const markPageHidden = useCallback((now: number) => {
    if (pageInactiveAtRef.current !== null) return;
    pageInactiveAtRef.current = now;
    hiddenBudgetRef.current = MAX_BACKGROUND_CATCH_UP_MS;
  }, []);
  const takeHiddenTime = useCallback((now: number) => {
    const taken = takeBackgroundTime(pageInactiveAtRef.current, hiddenBudgetRef.current, now);
    hiddenBudgetRef.current = taken.budgetMs;
    return taken.elapsedMs;
  }, []);
  // Once the match that ran on while the app was closed has caught up, the banner lists what was missed.
  useEffect(() => {
    const missed = missedMatchRef.current;
    if (!hydrated || !missed) return;
    const cup = game.features.cup;
    const sameMatch = cup.matchStartedAt === missed.matchStartedAt;
    if (sameMatch && !missedMatchCaughtUp(cup, missed.until) && Date.now() - missed.until < 15000) return;
    missedMatchRef.current = null;
    if (!sameMatch) return;
    const summary = summarizeMissedMatch(cup, missed.since, missed.until);
    window.setTimeout(() => setOffline((current) => current === MATCH_RAN_WHILE_AWAY ? summary : current), 0);
  }, [hydrated, game.features.cup]);

  useEffect(() => {
    if (!hydrated) return;
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      const power = getPassivePower(gameRef.current.upgrades, gameRef.current.stars, gameRef.current.features);
      if (power <= 0) return;
      // Earned at once (gameRef, saves, the counter); committed to the state with the next flush.
      passiveGoals.addPending(power / 5);
      gameRef.current = addPassiveGoals(gameRef.current, power / 5);
      passiveGoals.setDisplay(gameRef.current.goals);
    }, 200);
    const save = window.setInterval(() => {
      const now = Date.now();
      const mono = monotonicNow();
      const next = document.hidden && pageInactiveAtRef.current !== null
        ? advanceLocalGameWhileOpen(gameRef.current, takeHiddenTime(mono), now)
        : { ...gameRef.current, lastSaved: now };
      if (document.hidden) { markPageHidden(mono); pageInactiveAtRef.current = mono; }
      gameRef.current = next;
      handleLocalSave(persistLocalGame(next));
    }, 2200);
    return () => { window.clearInterval(tick); window.clearInterval(save); };
  }, [hydrated, handleLocalSave, markPageHidden, takeHiddenTime, passiveGoals]);

  useEffect(() => {
    if (!hydrated || isCoopLive) return;
    const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => game.totalGoals >= achievement.threshold && !game.achievements.includes(achievement.id));
    if (!newlyUnlocked.length) return;
    window.setTimeout(() => setGame((current) => ({ ...current, achievements: [...current.achievements, ...newlyUnlocked.map((item) => item.id)] })), 0);
    const first = newlyUnlocked[0];
    window.setTimeout(() => {
      showToast(t("logic.achievement", { name: dataText(first.name) }));
      addFeed(t("logic.achievementBody", { name: dataText(first.name) }), first.icon);
      playTone(523, 0.12, "square", 0.035);
      playTone(659, 0.12, "square", 0.035, 0.1);
      playTone(784, 0.22, "square", 0.04, 0.2);
    }, 0);
  }, [game.totalGoals, game.achievements, hydrated, isCoopLive, setGame]);

  useEffect(() => {
    if (!hydrated) return;
    const saveOnExit = () => {
      const now = Date.now();
      const mono = monotonicNow();
      const hidden = pageInactiveAtRef.current !== null;
      const next = hidden ? advanceLocalGameWhileOpen(gameRef.current, takeHiddenTime(mono), now) : { ...gameRef.current, lastSaved: now };
      if (hidden) pageInactiveAtRef.current = mono;
      gameRef.current = next;
      // No reload while the page closes; the next start reads the newest save anyway.
      const result = persistLocalGame(next);
      if (result !== "stale") handleLocalSave(result);
    };
    // The tab the player uses is the one that saves; an older tab first loads what the other one saved.
    const claim = () => {
      if (!isLocalSaveWriter() && claimLocalSave() === "stale") handleLocalSave("stale");
    };
    const onVisibility = () => {
      if (document.hidden) {
        markPageHidden(monotonicNow());
        persistLocalGame({ ...gameRef.current, lastSaved: Date.now() });
        return;
      }
      if (!isLocalSaveWriter() && claimLocalSave() === "stale") { handleLocalSave("stale"); return; }
      if (pageInactiveAtRef.current === null) return;
      const now = Date.now();
      const elapsed = takeHiddenTime(monotonicNow());
      pageInactiveAtRef.current = null;
      const next = advanceLocalGameWhileOpen(gameRef.current, elapsed, now);
      gameRef.current = next;
      handleLocalSave(persistLocalGame(next));
      setGame(next);
    };
    if (document.hidden) onVisibility();
    window.addEventListener("beforeunload", saveOnExit);
    window.addEventListener("pagehide", saveOnExit);
    window.addEventListener(FLUSH_SAVE_EVENT, saveOnExit);
    window.addEventListener("pointerdown", claim, { capture: true, passive: true });
    window.addEventListener("keydown", claim, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("beforeunload", saveOnExit); window.removeEventListener("pagehide", saveOnExit); window.removeEventListener(FLUSH_SAVE_EVENT, saveOnExit); window.removeEventListener("pointerdown", claim, { capture: true }); window.removeEventListener("keydown", claim, { capture: true }); document.removeEventListener("visibilitychange", onVisibility); };
  }, [hydrated, handleLocalSave, markPageHidden, takeHiddenTime, setGame]);

  // Tutorial tasks tick off from the game itself; a league match counts at kick off, before its history exists.
  const tutorialCup = game.features.cup;
  useEffect(() => {
    if (!hydrated || tutorial.status === "done") return;
    const next = advanceTutorial(tutorial, game, featureTab);
    if (next === tutorial) return;
    const finished = next.status === "done";
    window.setTimeout(() => {
      setTutorial(next);
      if (finished) {
        showToast(t("logic.tutorialDone"));
        addFeed(t("logic.tutorialDoneClub"), "star");
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tutorial, game.clicks, game.upgrades, featureTab, tutorialCup.active, tutorialCup.mode, tutorialCup.matchStartedAt, game.features.squadLock, game.features.seasonMode.history.length, game.features.seasonMode.lastMatchAt, game.features.welcomePack, game.features.starXI.lineupIds]);

  // The shop step of the tutorial unlocks the welcome pack; before that it neither shows nor opens.
  const tutorialStepId = tutorial.status === "active" ? currentTutorialStep(tutorial)?.id : undefined;
  // Guided path: only the tabs of the current step, no switch to the co-op mode and no layout editing until the tutorial ends.
  const tutorialAllowed = hydrated && appMode === "single" ? tutorialAllowedTabs(tutorial) : null;
  tutorialLockRef.current = tutorialAllowed;
  const tutorialFocusTab = tutorialStepId ? tutorialStepTab(currentTutorialStep(tutorial)!) : null;
  // The page follows the guide: a new step brings the player to its tab, and a tab outside the lock (address, back button, shortcut) is corrected.
  const previousTutorialStepRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const step = tutorialStepId ? currentTutorialStep(tutorial) : null;
    const previous = previousTutorialStepRef.current;
    previousTutorialStepRef.current = tutorialStepId;
    if (!step || !tutorialAllowed) return;
    const wanted = tutorialStepTab(step);
    const outside = !tutorialAllowed.includes(primarySectionOf(featureTab) as RoutedTab);
    if (outside || (previous !== undefined && previous !== tutorialStepId && wanted !== primarySectionOf(featureTab))) openFeatureTab(wanted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tutorialStepId, featureTab]);
  useEffect(() => {
    if (!hydrated || tutorialStepId !== "packs" || game.features.welcomePack !== "pending") return;
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      unlockWelcomePack(features);
      return { ...current, features };
    });
  }, [hydrated, tutorialStepId, game.features.welcomePack, setGame]);

  const rankRange = nextRank ? nextRank.minimum - currentRank.minimum : 1;
  const rankProgress = nextRank ? Math.max(0, Math.min(100, ((displayGame.totalGoals - currentRank.minimum) / rankRange) * 100)) : 100;
  const activeTournament = getTournament(displayGame.features.cup.tournamentId) ?? TOURNAMENTS[0];
  const seasonNextOpponent = getSeasonModeNextOpponent(displayGame.features.seasonMode, displayGame.features.club.name);
  const selectedTournament = displayGame.features.cup.pendingNextRound ? activeTournament : (getTournament(selectedTournamentId) ?? TOURNAMENTS[0]);
  const selectedTournamentUnlockLeague = getTournamentUnlockLeague(selectedTournament.id);
  const selectedTournamentLeagueUnlocked = isLeagueContentUnlocked(selectedTournamentUnlockLeague, reachedLeague, hasFullTestAccess);
  const allFeatureHistory = [...displayGame.features.history].reverse();
  const featureHistoryActors = historyActors(allFeatureHistory);
  const featureHistory = filterHistory(allFeatureHistory, historyTopic, featureHistoryActors.includes(historyActor) ? historyActor : "");
  // The next match in one tap (Q44, Q46): the waiting cup round, else the next league matchday (or its journey).
  const seasonFixture = fixtureFor(displayGame.features, "season");
  const nextMatchAction = displayGame.features.cup.active || journeyUnderway ? undefined
    : displayGame.features.cup.pendingNextRound ? { label: t("logic.tournamentRound", { label: dataText(activeTournament.label), round: displayGame.features.cup.round + 1 }), disabled: coopBusy || travelBusy, onClick: () => void startCup(activeTournament.id) }
    : seasonCareerComplete ? undefined
    : { label: t("logic.travelMatchday", { label: travelLabel(seasonFixture) === t("logic.startTrip") ? t("logic.startTrip") : t("logic.nextSeasonMatch"), matchday: seasonMode.matchday + 1 }), disabled: coopBusy || travelBusy, onClick: () => void startSeasonCupMatch() };
  const seasonTabAction = displayGame.features.cup.active ? undefined
    : seasonCareerComplete ? { label: t("logic.prestigeStart"), disabled: coopBusy || Boolean(prestigeBlockReason), note: prestigeBlockReason || undefined, onClick: openPrestigeDialog }
    : { label: displayGame.features.cup.pendingNextRound ? t("logic.finishCupFirst") : t("logic.travelMatchday", { label: travelLabel(seasonFixture), matchday: seasonMode.matchday + 1 }), disabled: coopBusy || travelBusy || journeyUnderway || displayGame.features.cup.pendingNextRound || hasTransferSquadVacancy || suspendedPlayerOnSquad || !starXIComplete, note: hasTransferSquadVacancy || suspendedPlayerOnSquad || !starXIComplete ? t("logic.xiIncomplete") : journeyUnderway ? t("logic.teamTravelling") : undefined, onClick: () => void startSeasonCupMatch() };
  // "Vor dem Anpfiff" (Q25, Q45): every blocker of the next match at once, each with its fix, and the open press talk.
  const kickoffItems: KickoffItem[] = [];
  if (!displayGame.features.cup.active) {
    const fillFix = squadGapsFillable ? { label: t("logic.fillGaps"), run: () => void fillSquadGaps() } : { label: t("logic.toSquad"), run: () => openFeatureTab("squad") };
    if (hasTransferSquadVacancy) kickoffItems.push({ id: "vacancy", text: t("logic.vacancyAfterTransfer", { place: transferSquadVacancyLabel }), fix: fillFix });
    if (suspendedPlayerOnSquad) kickoffItems.push({ id: "red", text: t("logic.bannedAfterRedNames", { names: suspendedStarPlayers.map((player) => player.name).join(", ") }), fix: fillFix });
    else if (!starXIComplete) kickoffItems.push({ id: "eleven", text: t("logic.xiFilled", { count: startingStarXISelection.length, size: STAR_XI_SQUAD_SIZE }), fix: fillFix });
    const banError = !seasonCareerComplete && !displayGame.features.cup.pendingNextRound ? squadBanError(displayGame.features, competitionFor("season", "stadium")) : displayGame.features.cup.pendingNextRound ? squadBanError(displayGame.features, competitionFor("tournament", displayGame.features.cup.tournamentId)) : "";
    if (banError) kickoffItems.push({ id: "ban", text: banError, fix: fillFix });
    if (displayGame.features.cup.pendingNextRound) kickoffItems.push({ id: "pending", tone: "hint", text: `${t("logic.roundWaits", { label: dataText(activeTournament.label), round: displayGame.features.cup.round + 1 })}${abandonBlockReason ? ` ${localizeText(abandonBlockReason)}` : ""}`, ...(abandonBlockReason ? {} : { fix: { label: t("logic.giveUpTournament"), run: () => setAbandonDialog(true) } }) });
    if (openActions.some((action) => action.id === "press")) kickoffItems.push({ id: "press", tone: "hint", text: t("logic.pressOpen", { reward: formatNumber(getPressReward(getBasePassivePower(displayGame.upgrades, displayGame.stars, displayGame.features), getBaseClickPower(displayGame.upgrades, displayGame.stars, displayGame.features))) }), fix: { label: t("logic.answer"), run: () => document.querySelector(".press-conference")?.scrollIntoView({ behavior: "smooth", block: "center" }) } });
  }
  // short: the label in the phone tab bar; the button keeps the full label as its accessible name.
  const primaryTabs: { id: FeatureTab; label: string; text?: string; short: string; icon: IconName }[] = [{id:'home',label:t('nav.home'),short:t('nav.home'),icon:'home'},{id:'cup',label:displayGame.features.cup.active?t('nav.gamesLive'):t('nav.games'),text:t('nav.games'),short:t('nav.games'),icon:'trophy'},{id:'season',label:t('nav.season'),short:t('nav.season'),icon:'table'},{id:'squad',label:t('nav.squad'),short:t('nav.squad'),icon:'squad'},{id:'career',label:t('nav.career'),short:t('nav.career'),icon:'career'},{id:'packs',label:t('nav.packs'),short:t('nav.packsShort'),icon:'cards'},{id:'club',label:t('nav.club'),short:t('nav.clubShort'),icon:'shield'}];
  const featureTabs: {id:FeatureTab;label:string}[] = ['packs','album'].includes(featureTab) ? [{id:'packs',label:t('nav.packShop')},{id:'album',label:t('nav.album')}] : ['club','fabrizio','missions','leaderboard','history'].includes(featureTab) ? [{id:'club',label:t('nav.clubProfile')},{ id: "fabrizio", label: t('nav.fabrizio') },{id:'missions',label:t('nav.weekly')},{id:'leaderboard',label:t('nav.leaderboard')},{id:'history',label:t('nav.history')}] : [];
  const primarySection = primarySectionOf(featureTab);
  // Desktop shortcuts (Q61): 1 to 7 open the main tabs, the arrow keys aim in the shootout; Escape closes dialogs.
  const shortcutRef = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  shortcutRef.current = (event) => {
    const target = event.target as HTMLElement | null;
    if (document.querySelector('[role="dialog"][aria-modal="true"]:not(.cup-penalty-takeover)')) return;
    const action = shortcutFor({ key: event.key, altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, repeat: event.repeat, targetTag: target?.tagName, editable: Boolean(target?.isContentEditable) }, penaltyOverlayOpen);
    if (!action) return;
    if (action.kind === "penalty") { event.preventDefault(); void takeCupPenalty(action.direction); return; }
    if (appMode !== "single" && !isCoopLive) return;
    const tab = primaryTabs[action.index];
    if (tab) { openFeatureTab(tab.id); setLayoutEditMode(false); }
  };
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Invite link (Q60): "?join=ABC123" fills in the room code and opens the co-op lobby once.
  useEffect(() => {
    if (!hydrated) return;
    const code = joinCodeFromSearch(window.location.search);
    if (!code) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    const timer = window.setTimeout(() => {
      setCoopCodeInput(code);
      if (guest) setGuestCoopPrompt(true);
      else { setAppMode("coop"); setCoopMessage(t("logic.inviteToRoom", { code })); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, guest]);


  // The full world management (name, members, code, delete, leave) lives under "Club & Mehr", not above the game on Home.
  const coopWorldPanel = isCoopLive && coopSession ? <section className="coop-world-panel" id="coop-world" aria-label={t("logic.manageWorld")}>
    <div className="coop-inline-room-bar static"><div><p className="eyebrow">{t("logic.coopEyebrow")} {coopSession.room.roomName}</p><strong>{coopSession.code}</strong><span>{occupiedCoopPlayers(coopSession.room).map((player) => player.name).join(" · ")}</span></div><div className="coop-inline-room-actions"><button className="mode-secondary" onClick={() => void shareInvite()}>{t("logic.invite")}</button><button className="mode-secondary" onClick={() => void copyCoopCode()}>{t("logic.copyCode")}</button>{coopSession.role === "host" && <button className="mode-secondary danger" onClick={() => void deleteCoopRoom(coopSession.code)}>{t("logic.deleteRoom")}</button>}<button className="mode-secondary quiet" onClick={leaveCoopRoom}>{t("logic.leave")}</button></div></div>
    <div className="coop-world-tools"><div><p className="eyebrow">{t("logic.manageWorldCaps")}</p>{coopSession.role === "host" ? <div className="coop-tool-input"><input className="mode-input" value={coopRoomName} maxLength={28} onChange={(event) => setCoopRoomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !coopBusy) { event.preventDefault(); void renameCoopRoom(); } }} aria-label={t("logic.worldName")} /><button className="mode-secondary" onClick={() => void renameCoopRoom()} disabled={coopBusy}>{t("logic.saveName")}</button></div> : <strong>{coopSession.room.roomName}</strong>}</div><div className="coop-members"><p className="eyebrow">{t("logic.members")}</p><ul>{occupiedCoopPlayers(coopSession.room).map((player) => { const activity = coopLastActiveLabel(player); return <li key={player.role}><span><strong>{player.name ?? coopRoleLabel(player.role)}</strong><small>{player.role === "host" ? "Host" : coopRoleLabel(player.role)}{player.role === coopSession.role ? t("logic.youSuffix") : ""}{activity ? ` · ${activity}` : ""}{player.inactive ? t("logic.inactiveSuffix") : ""}</small></span>{coopSession.role === "host" && player.role !== "host" && <button className="mode-secondary quiet" disabled={coopBusy} onClick={() => setSeatDialog({ kind: "kick", role: player.role, name: player.name ?? coopRoleLabel(player.role), inactive: Boolean(player.inactive), activity })}>{t("logic.remove")}</button>}</li>; })}</ul>{coopSession.room.playerCount > 1 ? <button className="mode-secondary quiet danger" disabled={coopBusy} onClick={() => setSeatDialog({ kind: "leave" })}>{t("logic.freeSeat")}</button> : <small>{t("logic.lastMember")}</small>}<small className="coop-members-note">{t("logic.who")} {coopSession.room.inactiveDays ?? 7} {t("logic.inactiveRule")}</small></div></div>
  </section> : null;

  return (
    <div className={`app-shell section-${featureTab}${displayGame.features.cup.active && featureTab === "cup" ? " match-in-progress" : ""}`} data-tutorial-step={tutorialAllowed ? tutorialStepId : undefined}>
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-ball"><FootballGraphic /></div><div className="brand-copy"><p className="eyebrow">FOOTBALL IDLE CLUB</p><h1>GOAL <span>CLICKER</span></h1></div></div>
        <div className={`header-goals${goalBoostActive ? " goal-boost-active" : ""}`} role="group" aria-label={`${t("game.balanceLabel", { goals: hasInfiniteMoney ? t("game.unlimited") : formatNumber(displayGame.goals) })}${goalBoostActive ? t("game.boostLabel", { factor: goalBoostLabel, time: goalBoostCountdown }) : ""}`}><span>{hasInfiniteMoney ? t("game.testMode") : t("game.currentBalance")}</span><strong>{displayBalance}</strong><small>{t("game.goalsCaps")}</small>{goalBoostActive && <em className="header-goal-boost">⚡ {goalBoostLabel}× · {goalBoostCountdown}</em>}{seasonMode.prestigeCount > 0 && <em className="header-prestige" title={prestigeBonusLabel(seasonMode.prestigeCount)}><span className="header-prestige-long">{t("games.prestige")} {seasonMode.prestigeCount} · </span>+{prestigeBonusPercent(seasonMode.prestigeCount)} % Tore</em>}{navBadges.season && <button type="button" className="header-prestige-ready" onClick={() => openFeatureTab("season")}>{t("games.prestigeReady")}</button>}</div>
        <div className="top-actions"><AccountButton /><button className="icon-button bell-button" aria-label={unreadHistory ? t("game.historyUnread", { unreadHistory }) : t("game.notifications")} onClick={()=>openFeatureTab("history")}><Icon name="bell" size={18} />{unreadHistory > 0 && <span className="bell-count" aria-hidden="true">{unreadHistory > 9 ? "9+" : unreadHistory}</span>}</button><button className="icon-button" onClick={toggleSound} aria-label={game.sound ? t("game.soundOff") : t("game.soundOn")}><Icon name={game.sound ? "sound" : "mute"} size={17} /></button>{vibrationSupported && <button className={`icon-button vibration-toggle${vibrationEnabled ? "" : " off"}`} onClick={toggleVibration} aria-pressed={vibrationEnabled} aria-label={vibrationEnabled ? t("game.vibrationOff") : t("game.vibrationOn")}><Icon name="vibrate" size={18} /></button>}</div>
      </header>

      {seasonTitle && <SeasonTrophyCelebration title={seasonTitle} clubName={displayClubName} homeCity={displayGame.features.seasonMode.homeCity} onClose={() => setSeasonTitle(null)} />}
      {whatsNewOpen && WHATS_NEW[0] && <WhatsNewDialog entry={WHATS_NEW[0]} onClose={closeWhatsNew} />}
      {whatsNewArchive && !whatsNewOpen && WHATS_NEW[0] && <WhatsNewDialog entry={WHATS_NEW[0]} archive={WHATS_NEW} onClose={() => setWhatsNewArchive(false)} />}
      {hydrated && tutorial.status === "intro" && !starReveal && !whatsNewOpen && appMode === "single" && <TutorialIntroDialog onStart={() => setTutorial({ ...tutorial, status: "active" })} onSkip={requestEndTutorial} />}
      {guestCoopPrompt && guest && <ConfirmDialog title={t("coop.needsAccountTitle")} confirmLabel={t("coop.signIn")} onCancel={() => setGuestCoopPrompt(false)} onConfirm={() => { setGuestCoopPrompt(false); guest.signIn(); }}>
        <p>{t("coop.needsAccountBody")}</p>
      </ConfirmDialog>}
      {prestigeDialog && <PrestigeDialog features={displayGame.features} goals={displayGame.goals} upgradeLevels={Object.values(displayGame.upgrades).reduce((sum, level) => sum + level, 0)} busy={coopBusy} error={prestigeDialog.error} voteMembers={isCoopLive ? otherCoopOnlineCount : 0} onCancel={() => setPrestigeDialog(null)} onConfirm={(keepNormalId, homeCity) => void confirmSeasonPrestige(keepNormalId, homeCity)} />}
      {coopPrestigeVote && coopSession && !prestigeDialog && hiddenPrestigeVote !== coopPrestigeVote.id && <PrestigeVoteDialog vote={coopPrestigeVote} room={coopSession.room} busy={coopBusy} onApprove={() => void answerPrestigeVote("approve")} onDecline={() => void answerPrestigeVote("decline")} onHide={() => setHiddenPrestigeVote(coopPrestigeVote.id)} />}
      {seatDialog?.kind === "leave" && coopSession && <ConfirmDialog title={t("coop.freeSeatTitle")} confirmLabel={t("coop.freeSeatConfirm")} onCancel={() => setSeatDialog(null)} onConfirm={() => void leaveCoopSeat()}>
        <p>Du verlässt {coopSession.room.roomName} für immer. Der gemeinsame Spielstand bleibt für die anderen vollständig erhalten, auch deine bisherigen Tore und Klicks zählen weiter.</p>
        <p>{coopSession.role === "host" ? t("coop.hostPasses") : ""}Mit dem Raumcode {coopSession.code} kannst du später wieder beitreten, solange ein Platz frei ist.</p>
      </ConfirmDialog>}
      {seatDialog?.kind === "kick" && <ConfirmDialog title={t("coop.removeTitle", { name: seatDialog.name })} confirmLabel={seatDialog.inactive ? t("coop.remove") : t("coop.removeAnyway")} onCancel={() => setSeatDialog(null)} onConfirm={() => void kickCoopMember(seatDialog.role, seatDialog.name, !seatDialog.inactive)}>
        <p>{seatDialog.inactive ? t("coop.seatInactive", { name: seatDialog.name, days: coopSession?.room.inactiveDays ?? 7, activity: seatDialog.activity }) : t("coop.seatActive", { name: seatDialog.name, days: coopSession?.room.inactiveDays ?? 7, activity: seatDialog.activity || t("coop.recently") })}</p>
        <p>{t("coop.seatFreed")} {seatDialog.name} kann mit dem Raumcode wieder beitreten, solange ein Platz frei ist.</p>
      </ConfirmDialog>}
      {abandonDialog && <ConfirmDialog title={t("games.giveUpTitle", { label: dataText(activeTournament.label) })} confirmLabel={t("games.giveUpConfirm")} onCancel={() => setAbandonDialog(false)} onConfirm={() => void abandonTournament()}>
        <p>Der Turnierlauf endet nach Runde {displayGame.features.cup.round} wie ein Ausscheiden: keine Trophäe und keine Turnierprämie. Danach sind Ligaspiele und Prestige wieder frei, das nächste Turnier nach der üblichen Pause.</p>
      </ConfirmDialog>}
      {bestXIPreview && <ConfirmDialog title={t("squad.bestXITitle")} confirmLabel={t("squad.bestXIApply", { delta: formatRatingDelta(bestXIPreview.rating - bestXIPreview.before) })} onCancel={() => setBestXIPreview(null)} onConfirm={() => void applyBestStarXI()}>
        <p>{t("games.teamScore")} {bestXIPreview.before} → {bestXIPreview.rating} OVR{bestXIPreview.bench ? t("squad.newBench", { bench: bestXIPreview.bench }) : ""}.</p>
        {bestXIPreview.changes.length > 0 ? <ul className="best-xi-changes">{bestXIPreview.changes.map((change) => <li key={change.slot}><b>{change.position}</b> {getStarXIPlayer(change.inId)?.name ?? "offen"}{change.outId ? <> für {getStarXIPlayer(change.outId)?.name ?? t("game.player")}</> : t("coop.freeSeatParen")}</li>)}</ul> : <p>{t("squad.bestXIBenchOnly")}</p>}
        {!isCoopLive && <p>{t("squad.bestXIUndoOnce")}</p>}
      </ConfirmDialog>}
      {confirmSingle && <ConfirmDialog title={t("coop.switchSingleTitle")} confirmLabel={t("coop.switch")} onCancel={() => setConfirmSingle(false)} onConfirm={() => { setConfirmSingle(false); notifyCoopOffline(coopSession?.code, coopSession?.playerId); setAppMode("single"); }}>
        <p>{coopSession ? t("coop.leaveRoom", { roomName: coopSession.room.roomName }) : t("coop.leaveMultiplayer")}</p>
      </ConfirmDialog>}
      <nav className="mode-switch" aria-label={t("game.gameMode")}>
        <button className={appMode === "single" ? "active" : ""} onClick={() => { if (appMode === "coop") setConfirmSingle(true); }}>{t("game.singleplayer")}</button>
        <button className={appMode === "coop" ? "active" : ""} disabled={tutorial.status === "active" && appMode === "single"} title={tutorial.status === "active" ? t("game.afterTutorial") : undefined} onClick={() => guest ? setGuestCoopPrompt(true) : setAppMode("coop")}>{t("game.coopMultiplayer")}{guest ? " 🔒" : ""}</button>
      </nav>
      <AccountLink playerId={playerId} onPlayerId={adoptAccountPlayerId} onMessage={accountMessage} />

      {hydrated && appMode === "single" && tutorial.status === "active" && <TutorialCoach state={tutorial} game={game} onShow={showTutorialStep} onEnd={requestEndTutorial} />}
      {tutorialEndDialog && <ConfirmDialog title={t("tutorial.endTitle")} confirmLabel={t("tutorial.end")} cancelLabel={t("tutorial.keepPlaying")} onConfirm={confirmEndTutorial} onCancel={() => setTutorialEndDialog(false)}>{t("tutorial.endBody")}</ConfirmDialog>}
      {(appMode === 'single' || isCoopLive) && <nav className="section-navigation" aria-label={t("nav.main")}>{primaryTabs.map(tab=>{const tabLocked=Boolean(tutorialAllowed&&!tutorialAllowed.includes(tab.id as RoutedTab));return <button type="button" key={tab.id} aria-label={tab.label} disabled={tabLocked} title={tabLocked?t("nav.tutorialLocked"):navBadges[tab.id as keyof typeof navBadges]?.join(", ")} aria-current={primarySection===tab.id?'page':undefined} className={`${primarySection===tab.id?'active':''}${tabLocked?' tutorial-locked':''}${tutorialFocusTab===tab.id&&primarySection!==tab.id?' tutorial-focus':''}`} onClick={()=>{openFeatureTab(tab.id==='club'&&pendingTransferOffer&&primarySection!=='club'?'fabrizio':tab.id);setLayoutEditMode(false);}}><span className="tab-icon"><Icon name={tab.icon} size={22} />{tab.id==='cup'&&displayGame.features.cup.active&&<i className="tab-live-dot" aria-hidden="true" />}{tab.id==='club'&&pendingTransferOffer&&<i className="tab-live-dot offer" aria-hidden="true" />}{navBadges[tab.id as keyof typeof navBadges]&&!(tab.id==='cup'&&displayGame.features.cup.active)&&!(tab.id==='club'&&pendingTransferOffer)&&<i className="tab-live-dot action" aria-hidden="true" />}</span><span className="tab-label-full">{tab.text ?? tab.label}{tab.id==='cup'&&displayGame.features.cup.active&&<span className="tab-live-badge" aria-hidden="true">LIVE</span>}</span><span className="tab-label-short" aria-hidden="true">{tab.short}</span></button>;})}</nav>}
      {(appMode === "single" || isCoopLive) && <main className={`clicker-layout${isCoopLive ? " coop-clicker-layout" : ""}`}>
        {isCoopLive && coopSession && <div className="coop-inline-room-bar compact"><div><p className="eyebrow">KOOP / {coopSession.room.roomName}</p><strong>{coopSession.code}</strong><span>{occupiedCoopPlayers(coopSession.room).map((player) => player.name).join(" · ")}</span></div><div className="coop-inline-room-actions"><span className={`coop-presence${otherCoopOnline ? " online" : ""}`}><i />{otherCoopOnline ? t("coop.teammatesOnline", { count: otherCoopOnlineCount }) : t("coop.teammatesOffline")}</span>{coopBusy && <span className="coop-pending-chip" role="status">{t("game.saving")}</span>}{!coopBusy && coopFailed && <button type="button" className="coop-pending-chip failed" onClick={() => { const failed = coopFailed; setCoopFailed(null); void sendCoopAction(failed.action, failed.extra); }}>{t("coop.notSavedRetry")}</button>}{coopPrestigeVote && hiddenPrestigeVote === coopPrestigeVote.id && <button className="mode-secondary" onClick={() => setHiddenPrestigeVote("")}>{t("games.showPrestigeVote")}</button>}<button className="mode-secondary" onClick={() => void shareInvite()}>{t("coop.invite")}</button><button className="mode-secondary" onClick={() => openFeatureTab("club")}>{t("coop.manageWorld")}</button></div></div>}
        <div className={`layout-toolbar${layoutEditMode ? " active" : " compact"}`}>
          {layoutEditMode && <div><p className="eyebrow">{t("layout.eyebrow")}</p><strong>{t("layout.title")}</strong><small>{t("layout.hint")}</small></div>}
          <div className="layout-toolbar-actions">{layoutEditMode && <button className="mode-secondary" onClick={resetLayout}>{t("layout.standard")}</button>}<button className={layoutEditMode ? "mode-primary" : "mode-secondary"} disabled={Boolean(tutorialAllowed)} onClick={() => { setLayoutEditMode((current) => !current); setDraggingLayoutCard(null); setDragOverLayoutCard(null); }}>{layoutEditMode ? "Fertig" : t("layout.edit")}</button></div>
        </div>
        <section className={layoutCardClass("hero", "click-zone-card")} style={{ order: layoutOrderNumber("hero") }} onDragOver={(event) => handleLayoutDragOver(event, "hero")} onDrop={(event) => handleLayoutDrop(event, "hero")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "hero")} onDragEnd={handleLayoutDragEnd} aria-label={t("layout.moveBall")}><span className="layout-handle-grip" aria-hidden="true"><Icon name="grip" size={18} /></span><div><strong>{t("layout.ballCard")}</strong><small>{t("layout.dragHint")}</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("hero", -1); }} aria-label={t("layout.ballUp")}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("hero", 1); }} aria-label={t("layout.ballDown")}>↓</button></div></div>}
          <div className="panel-intro"><div><p className="eyebrow">{isCoopLive ? t("coop.liveMatchEyebrow") : "CAREER MODE / 01"}</p><h2>{isCoopLive ? <>{t("game.together")}<br /><span>{t("games.toWin")}</span></> : <>Build your<br /><span>football empire.</span></>}</h2><p className="intro-copy">{isCoopLive ? t("home.coopTagline", { count: coopSession?.room.playerCount ?? 2 }) : t("home.tagline")}</p></div><div className="career-badges"><div className="rank-badge"><span className="rank-symbol"><Icon name={currentRank.icon} size={21} /></span><div><small>{isCoopLive ? t("coop.teamRank") : t("home.yourRank")}</small><strong>{dataText(currentRank.name)}</strong></div></div><div className="season-chip" title={currentSeasonMilestone.title}><Icon name="star" size={14} /><span>{t("game.season")} {currentSeason}</span><strong>★ {displayGame.stars}</strong></div></div></div>
          {hydrated && <NextStepsStrip actions={openActions} onOpen={openActionTarget} />}
          <div className="score-display"><span className="score-label">{hasInfiniteMoney ? t("game.unlimitedTest") : isCoopLive ? t("home.sharedGoals") : t("home.yourGoals")}</span><strong>{displayBalance}</strong><span className="per-click-label">+{formatNumber(clickPower)} {isCoopLive ? t("game.perTeamClick") : t("game.perClickLower")}</span>{savingsGoal && savingsTarget && !hasInfiniteMoney && <SavingsGoalBar goal={savingsGoal} label={savingsTarget.label} cost={savingsTarget.cost} goals={displayGame.goals} passivePerSecond={passivePower} format={formatNumber} onClear={() => setSavingsGoal(null)} onOpen={() => { if (savingsGoal.kind === "pack") openFeatureTab("packs"); else { openFeatureTab("home"); window.setTimeout(() => document.querySelector(".shop-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60); } }} />}</div>
          <div className="ball-stage" ref={stageRef}>
            <div className="stadium-glow" /><div className="stadium-lights"><span /><span /><span /><span /><span /></div><div className="field-circle" /><div className="field-line field-line-one" /><div className="field-line field-line-two" /><div className="field-label">{isCoopLive ? t("coop.arena") : "GOAL CLICKER ARENA"}</div>
            <ClickBallButton store={clickFeedback} coop={isCoopLive} onClick={handleBallClick} onKeyDown={handleBallKeyDown} />
            <p className="click-label"><span>CLICK</span> {t("home.theBall")} {isCoopLive ? t("home.forTeam") : t("home.forGoals")}</p>
            <FloatingClickNumbers store={clickFeedback} />
            <ComboMeter store={clickFeedback} paused={comboPaused} />
          </div>
          <div className="production-strip"><div className="production-item"><span className="production-icon">/s</span><div><small>{t("game.perSecond")}</small><strong>{formatNumber(passivePower)}</strong></div></div><div className="production-divider" /><div className="production-item"><span className="production-icon">+1</span><div><small>{t("game.perClick")}</small><strong>{formatNumber(clickPower)}</strong></div></div><div className="production-divider" /><div className="production-item"><span className="production-icon">#</span><div><small>{t("game.clicksCaps")}</small><strong>{formatNumber(displayGame.clicks)}</strong></div></div></div>
          {hydrated && (!isCoopLive || coopSession) && <DailyRewardCard state={isCoopLive ? mergeDailyRewardsForWorld(displayGame.features.dailyRewards) : displayGame.features.dailyRewards} claimKey={isCoopLive ? WORLD_DAILY_KEY : "solo"} now={countdownNow} passivePerSecond={getBasePassivePower(displayGame.upgrades, displayGame.stars, displayGame.features)} clickPower={getBaseClickPower(displayGame.upgrades, displayGame.stars, displayGame.features)} busy={dailyBusy || coopBusy} coop={isCoopLive} onClaim={() => { void claimDaily(); }} format={formatNumber} />}
          {!activeMiniGame && <div className="mini-game-hub">
            <div className="mini-game-hub-heading"><div><p className="eyebrow">{t("mini.arenaEyebrow")}</p><h3>{t("mini.title")}</h3></div><span>{t("shop.rotating")}</span></div>
            <div className="mini-game-grid">
              <button className={`mini-game-card${isMiniGameOnCooldown("penalty") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("penalty")} onClick={startPenaltyGame} aria-label={`${localizeText(MINI_GAME_NAMES.penalty)}${isMiniGameOnCooldown("penalty") ? `, ${miniGameCooldownLabel("penalty", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="star" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 01</small><strong>Penalty Challenge</strong><em>{miniGameCooldownLabel("penalty", t("mini.dribbleMeta"))}</em></span><b>{isMiniGameOnCooldown("penalty") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("dribble") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("dribble")} onClick={startDribbleGame} aria-label={`${localizeText(MINI_GAME_NAMES.dribble)}${isMiniGameOnCooldown("dribble") ? `, ${miniGameCooldownLabel("dribble", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="striker" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 02</small><strong>Dribble Run</strong><em>{miniGameCooldownLabel("dribble", t("mini.dribbleMetaPattern"))}</em></span><b>{isMiniGameOnCooldown("dribble") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("crossbar") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("crossbar")} onClick={startCrossbarGame} aria-label={`${localizeText(MINI_GAME_NAMES.crossbar)}${isMiniGameOnCooldown("crossbar") ? `, ${miniGameCooldownLabel("crossbar", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="stadium" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 03</small><strong>{t("mini.crossbarName")}</strong><em>{miniGameCooldownLabel("crossbar", t("mini.crossbarMeta"))}</em></span><b>{isMiniGameOnCooldown("crossbar") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("prediction") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("prediction")} onClick={startPredictionGame} aria-label={`${localizeText(MINI_GAME_NAMES.prediction)}${isMiniGameOnCooldown("prediction") ? `, ${miniGameCooldownLabel("prediction", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="broadcast" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 04</small><strong>{t("mini.predictName")}</strong><em>{miniGameCooldownLabel("prediction", t("mini.predictMeta"))}</em></span><b>{isMiniGameOnCooldown("prediction") ? "◷" : "↗"}</b></button>
            </div>
          </div>}
          {activeMiniGame === "penalty" && penaltyGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">{t("mini.eyebrowPrecision")}</p><h3>Penalty Challenge</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label={t("mini.closePenalty")}>×</button></div><div className="penalty-meta"><span>{penaltyGame.shots} / 5 Schüsse</span><strong>{penaltyGame.goals} {t("game.goals")}</strong></div><div className="penalty-progress"><div style={{ width: `${(penaltyGame.shots / 5) * 100}%` }} /></div>{!penaltyGame.finished ? <div className="penalty-buttons">{PENALTY_DIRECTIONS.map((direction) => <button key={direction} onClick={() => takePenalty(direction)}><span>{directionLabel(direction)}</span><small>{t("mini.shot")}</small></button>)}</div> : <div className="mini-game-result"><strong>{penaltyGame.goals} / 5</strong><span>{penaltyGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("penalty")} onClick={startPenaltyGame}>{isMiniGameOnCooldown("penalty") ? t("mini.readyIn", { time: formatCountdown(displayGame.miniGameCooldowns.penalty, countdownNow) }) : t("mini.newRound")}</button></div>}<p className="mini-game-message">{penaltyGame.finished ? t("mini.rewardCredited") : penaltyGame.message}</p></div>}
          {activeMiniGame === "dribble" && dribbleGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">{t("mini.eyebrow2")}</p><h3>Dribble Run</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label={t("mini.closeDribble")}>×</button></div><p className="mini-game-intro">{t("mini.dribbleIntro")}</p><div className="dribble-sequence" aria-label={t("mini.dribblePattern")}>{dribbleGame.sequence.map((direction, index) => <span className={index < dribbleGame.step ? "done" : index === dribbleGame.step ? "current" : ""} key={`${direction}-${index}`}>{directionLabel(direction)}</span>)}</div><div className="penalty-meta"><span>{dribbleGame.step} / 6 Hütchen</span><strong>{dribbleGame.misses} {t("game.error")}</strong></div><div className="penalty-progress"><div style={{ width: `${(dribbleGame.step / dribbleGame.sequence.length) * 100}%` }} /></div>{!dribbleGame.finished ? <div className="penalty-buttons">{PENALTY_DIRECTIONS.map((direction) => <button key={direction} onClick={() => takeDribble(direction)}><span>{directionLabel(direction)}</span><small>Move</small></button>)}</div> : <div className="mini-game-result"><strong>{dribbleGame.step} / 6</strong><span>{dribbleGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("dribble")} onClick={startDribbleGame}>{isMiniGameOnCooldown("dribble") ? t("mini.readyInDribble", { time: formatCountdown(displayGame.miniGameCooldowns.dribble, countdownNow) }) : t("mini.newRound")}</button></div>}<p className="mini-game-message">{dribbleGame.message}</p></div>}
          {activeMiniGame === "crossbar" && crossbarGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">{t("mini.eyebrow3")}</p><h3>{t("mini.crossbarName")}</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label={t("mini.closeCrossbar")}>×</button></div><p className="mini-game-intro">{t("mini.crossbarIntro")}</p><div className="penalty-meta"><span>{crossbarGame.shots} / 5 Schüsse</span><strong>{crossbarGame.hits} {t("mini.hits")}</strong></div><div className="penalty-progress"><div style={{ width: `${(crossbarGame.shots / 5) * 100}%` }} /></div>{!crossbarGame.finished ? <div className="penalty-buttons crossbar-buttons">{CROSSBAR_HEIGHTS.map((height) => <button key={height} onClick={() => takeCrossbar(height)}><span>{heightLabel(height)}</span><small>{t("mini.shot")}</small></button>)}</div> : <div className="mini-game-result"><strong>{crossbarGame.hits} / 5</strong><span>{crossbarGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("crossbar")} onClick={startCrossbarGame}>{isMiniGameOnCooldown("crossbar") ? t("mini.readyInCrossbar", { time: formatCountdown(displayGame.miniGameCooldowns.crossbar, countdownNow) }) : t("mini.newRound")}</button></div>}<p className="mini-game-message">{crossbarGame.message}</p></div>}
          {activeMiniGame === "prediction" && predictionGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">{t("mini.eyebrow4")}</p><h3>{t("mini.predictName")}</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label={t("mini.closePredict")}>×</button></div><p className="mini-game-intro">{t("mini.predictIntro")}</p><div className="penalty-meta"><span>{predictionGame.round} / 3 Tipps</span><strong>{predictionGame.wins} richtig</strong></div><div className="penalty-progress"><div style={{ width: `${(predictionGame.round / 3) * 100}%` }} /></div>{!predictionGame.finished ? <div className="prediction-buttons">{MATCH_PREDICTIONS.map((prediction) => <button key={prediction} onClick={() => takePrediction(prediction)}><span>{predictionLabel(prediction)}</span><small>{t("mini.placeTip")}</small></button>)}</div> : <div className="mini-game-result"><strong>{predictionGame.wins} / 3</strong><span>{predictionGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("prediction")} onClick={startPredictionGame}>{isMiniGameOnCooldown("prediction") ? t("mini.readyInPrediction", { time: formatCountdown(displayGame.miniGameCooldowns.prediction, countdownNow) }) : t("mini.newRound")}</button></div>}<p className="mini-game-message">{predictionGame.message}</p></div>}
        </section>

        <section className={layoutCardClass("shop", "shop-card")} style={{ order: layoutOrderNumber("shop") }} onDragOver={(event) => handleLayoutDragOver(event, "shop")} onDrop={(event) => handleLayoutDrop(event, "shop")}><div className="layout-card-handle" draggable={layoutEditMode} onDragStart={(event) => handleLayoutDragStart(event, "shop")} onDragEnd={handleLayoutDragEnd} aria-label={t("shop.moveUpgrades")}>{layoutEditMode && <><span className="layout-handle-grip" aria-hidden="true"><Icon name="grip" size={18} /></span><div><strong>{t("shop.upgrades")}</strong><small>{t("layout.dragHint")}</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("shop", -1); }} aria-label={t("shop.upgradesUp")}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("shop", 1); }} aria-label={t("shop.upgradesDown")}>↓</button></div></>}</div><div className="shop-header"><div><p className="eyebrow">{t("club.officeEyebrow")} {UPGRADES.length} {t("shop.levels")}</p><h2>{t("shop.upgrades")}</h2><small className="shop-subtitle">{displayGame.features.cup.active ? t("shop.liveUpgrades") : hasFullTestAccess ? t("shop.academyFull") : t("shop.growsEachSeason")}</small></div><div className="shop-balance"><span>{displayBalance}</span> {t("game.goalsCaps")}</div></div><div className="bulk-buy-bar"><div><span>{t("shop.buyAmountCaps")}</span><small>{t("shop.multiBuy")}</small></div><div className="bulk-options" role="group" aria-label={t("shop.buyAmount")}>{PURCHASE_MODES.map((mode) => <button className={purchaseMode === mode ? "active" : ""} key={String(mode)} onClick={() => setPurchaseMode(mode)}>{mode === "max" ? "MAX" : `x${mode}`}</button>)}</div></div><div className="shop-tabs" role="tablist"><button className={`tab-button${activeTab === "all" ? " active" : ""}`} onClick={() => setActiveTab("all")} role="tab">{t("game.all")}</button><button className={`tab-button${activeTab === "click" ? " active" : ""}`} onClick={() => setActiveTab("click")} role="tab">{t("game.clicks")}</button><button className={`tab-button${activeTab === "auto" ? " active" : ""}`} onClick={() => setActiveTab("auto")} role="tab">{t("game.automatic")}</button></div><div className="upgrade-list">{visibleUpgrades.map((upgrade) => { const level = getLevel(displayGame.upgrades, upgrade.id); const unlockLeague = getUpgradeUnlockLeague(upgrade.id); const unlocked = level > 0 || isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess); const purchase = getBulkPurchase(upgrade, displayGame.upgrades, spendableGoals, purchaseMode, hasInfiniteMoney); const affordable = unlocked && purchase.count > 0; const nextCost = getCost(upgrade, displayGame.upgrades); const purchaseLabel = !unlocked ? t("game.league", { unlockLeague }) : purchase.count === 0 ? (nextCost === Infinity ? "MAX" : t("shop.price")) : purchaseMode === "max" ? `MAX · x${purchase.count}` : purchaseMode === 1 ? "kaufen" : t("shop.buyCount", { count: purchase.count }); const buttonCost = purchase.count > 0 ? purchase.totalCost : nextCost; return <div className={`upgrade-item${affordable ? " affordable" : ""}${unlocked ? "" : " season-locked"}`} key={upgrade.id}><div className="upgrade-icon"><Icon name={upgrade.icon} size={20} /></div><div className="upgrade-copy"><strong>{dataText(upgrade.name)}</strong><small>{unlocked ? getUpgradeEffect(upgrade, level) : t("game.availableFromLeague", { unlockLeague })}</small><span className="upgrade-level">{unlocked ? `LEVEL ${level}` : t("game.stillLocked")}</span>{unlocked && !hasInfiniteMoney && <UpgradeHints gain={upgradeGains.get(upgrade.id)!} best={bestValueUpgradeId === upgrade.id} goals={displayGame.goals} passivePerSecond={passivePower} pinned={savingsGoal?.kind === "upgrade" && savingsGoal.id === upgrade.id} onPin={() => toggleSavingsGoal({ kind: "upgrade", id: upgrade.id })} format={formatNumber} />}</div><button className="buy-button" disabled={!affordable || coopBusy} onClick={() => void buyUpgrade(upgrade)} aria-label={`${dataText(upgrade.name)} ${purchaseLabel}`}>{unlocked ? hasInfiniteMoney ? "∞" : formatNumber(buttonCost) : "🔒"}<br /><small>{purchaseLabel}</small></button></div>; })}</div></section>

        <section className={layoutCardClass("feature", "feature-card")} style={{ order: layoutOrderNumber("feature") }} onDragOver={(event) => handleLayoutDragOver(event, "feature")} onDrop={(event) => handleLayoutDrop(event, "feature")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "feature")} onDragEnd={handleLayoutDragEnd} aria-label={t("layout.clubWorldMove")}><span className="layout-handle-grip" aria-hidden="true"><Icon name="grip" size={18} /></span><div><strong>Club World</strong><small>{t("layout.dragHint")}</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("feature", -1); }} aria-label={t("layout.clubWorldUp")}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("feature", 1); }} aria-label={t("layout.clubWorldDown")}>↓</button></div></div>}
          <div className="feature-card-heading"><div><p className="eyebrow">{t("club.newOptionsEyebrow")}</p><h2>{t("mini.moreThanClicking")}</h2><p>{t("club.newOptionsBody")}</p></div><span className="feature-card-icon" style={{ color: displayGame.features.club.color, borderColor: `${displayGame.features.club.color}35` }}>{displayGame.features.club.badge}</span></div>

          {featureTabs.length>0 && <div className="feature-tabs" role="tablist" aria-label="Club World"><div>{featureTabs.map((tab) => <button key={tab.id} className={featureTab === tab.id ? "active" : ""} onClick={() => openFeatureTab(tab.id)} role="tab" aria-selected={featureTab === tab.id} title={tab.id !== "fabrizio" ? openActions.filter((action) => action.tab === tab.id).map((action) => action.label).join(", ") || undefined : undefined}>{tab.label}{tab.id === "fabrizio" && pendingTransferOffer && <><i className="feature-tab-offer-dot" aria-hidden="true" /><span className="sr-only"> {t("fabrizio.openOffer")}</span></>}{tab.id !== "fabrizio" && openActions.some((action) => action.tab === tab.id) && <i className="feature-tab-offer-dot" aria-hidden="true" />}</button>)}</div></div>}

          {featureTab === "cup" && <TravelPanel features={displayGame.features} travel={displayGame.features.travel} serverNow={getTravelTime} busy={coopBusy || travelBusy} onStart={()=>{const f=displayGame.features.travel.journey?.fixture;if(f)void(f.mode==='season'?startSeasonCupMatch():startCup(f.tournamentId));}} />}
          {featureTab === "career" && <CareerArea features={displayGame.features} />}
          {featureTab === "album" && <AlbumPanel features={displayGame.features} busy={coopBusy} onClaim={(id) => void collectAlbumReward(id)} showMilestones={albumMilestones} onShowMilestones={setAlbumMilestones} />}

          {featureTab === "fabrizio" && <div className="transfer-saga-dashboard">
            <div className="transfer-match-lock"><span>{t("fabrizio.marketClosedCaps")}</span><strong>{t("fabrizio.noBuying")}</strong><small>{t("fabrizio.marketClosedBody")}</small></div>
            {pendingTransferOffer && <section className="transfer-offer-card" aria-live="polite"><div><span>{t("fabrizio.openOfferCaps")}</span><strong>{pendingTransferOffer.playerName} · {pendingTransferOffer.club}</strong><small>{pendingTransferOffer.message}</small></div><TransferOfferActions offer={pendingTransferOffer} features={displayGame.features} now={countdownNow} busy={coopBusy} onAnswer={answerTransferOffer} /></section>}
            {deadlineDayActive && <section className="deadline-day-banner" aria-live="polite"><div><span>{t("fabrizio.deadlineEyebrow")}</span><strong>{t("fabrizio.deadlineTitle")}</strong><small>{t("fabrizio.deadlineBody")}</small></div><b>{deadlineDayLabel}</b></section>}
            {displayGame.features.cup.active && <div className="transfer-match-lock"><span>{t("fabrizio.matchRunningCaps")}</span><strong>{t("fabrizio.noDepartures")}</strong><small>{t("fabrizio.afterMatch")}</small></div>}
            <div className="transfer-ledger-grid">
              <section className="transfer-ledger-card"><div className="transfer-ledger-heading"><div><p className="eyebrow">{t("fabrizio.loanStationsEyebrow")}</p><h4>{t("fabrizio.currentlyLoaned")}</h4></div><span>{currentTransferLoans.length}</span></div>{currentTransferLoans.length ? <div className="transfer-ledger-list">{currentTransferLoans.map(({ loan, player }) => <article key={`loan-${loan.playerId}`}><span>{player?.name.slice(0, 1) ?? "?"}</span><div><strong>{player?.name ?? t("fabrizio.unknownPlayer")}</strong><small>{loan.club} · {loan.status === "active" ? t("fabrizio.returnsAfterMatch") : t("fabrizio.missesNextSeasonMatch")}</small></div><b>{t("fabrizio.loanCaps")}</b></article>)}</div> : <div className="transfer-ledger-empty">{t("fabrizio.noLoans")}</div>}</section>
              <section className="transfer-ledger-card"><div className="transfer-ledger-heading"><div><p className="eyebrow">{t("fabrizio.ledgerEyebrow")}</p><h4>{t("fabrizio.history")}</h4></div><span>{transferArchive.length}</span></div>{transferArchive.length ? <div className="transfer-ledger-list archive">{transferArchive.slice(0, 12).map((event) => <article key={`archive-${event.id}`}><span>{event.outcome === "sale" ? "↗" : event.outcome === "return" ? "↙" : event.outcome === "declined" ? "✋" : "⇄"}</span><div><strong>{event.playerName ?? t("fabrizio.severalPlayers")}</strong><small>{event.outcome === "return" ? t("fabrizio.backFrom", { club: event.club }) : event.outcome === "declined" ? t("fabrizio.keptWanted", { club: event.club }) : `${event.outcome === "sale" ? t("fabrizio.soldTo", { club: event.club }) : t("fabrizio.loanedToClub", { club: event.club })}${event.fee > 0 ? t("fabrizio.feeSuffix", { fee: formatNumber(event.fee) }) : event.outcome === "sale" ? t("fabrizio.freeSuffix") : ""}`}</small></div><b>{formatHistoryTime(event.createdAt)}</b></article>)}</div> : <div className="transfer-ledger-empty">{t("fabrizio.noDeparturesYet")}</div>}</section>
            </div>
          </div>}

          {featureTab === "season" && <SeasonPanel features={displayGame.features} action={seasonTabAction} />}
          {featureTab === "cup" && <div className="feature-panel cup-panel">
            {!displayGame.features.cup.active && <div className="post-match-extras">
      {gazetteAnnouncement && <div ref={gazetteCardRef} className={`inline-gazette ${gazetteAnnouncement.tone}`}  aria-label={`Goal Gazette: ${gazetteAnnouncement.headline}`}><article className="gazette-front-page"><header><span>GOAL GAZETTE</span><b>{t("club.specialEdition")}</b></header><div className="gazette-dateline"><span>{dataText(getTournament(gazetteAnnouncement.tournamentId)?.label) || t("club.tournamentCaps")}</span><strong>{displayClubName} {gazetteAnnouncement.homeScore}:{gazetteAnnouncement.awayScore} {gazetteAnnouncement.opponent}</strong></div><h2>{gazetteAnnouncement.headline}</h2><h3>{gazetteAnnouncement.strapline}</h3><p>{gazetteAnnouncement.body}</p><footer><span>{gazetteAnnouncement.tieBreak ? t("games.shootoutDecides") : t("games.roundDone", { completedRound: gazetteAnnouncement.completedRound })}</span><button className="event-takeover-dismiss" onClick={dismissGazetteAnnouncement}>{t("club.closePaper")}</button></footer></article></div>}
            </div>}
            {!displayGame.features.cup.active && displayGame.features.cup.matchStartedAt > 0 && <PostMatchSummary features={displayGame.features} onCareer={()=>openFeatureTab("career")} onContinue={()=>openFeatureTab("squad")} next={nextMatchAction} />}
            {!displayGame.features.cup.active && displayGame.features.cup.matchStartedAt > 0 && <PressConferencePanel features={displayGame.features} busy={pressBusy || coopBusy} reward={getPressReward(getBasePassivePower(displayGame.upgrades, displayGame.stars, displayGame.features), getBaseClickPower(displayGame.upgrades, displayGame.stars, displayGame.features))} onAnswer={(matchId, questionId, index) => { void answerPress(matchId, questionId, index); }} format={formatNumber} />}

            {(() => { const opponent = displayGame.features.cup.active ? displayGame.features.cup.opponent : getSeasonModeNextOpponent(displayGame.features.seasonMode, displayClubName).name; const rival = displayGame.features.career.rivals[rivalryKey(opponent)]; return rival?.active ? <div className="career-derby-banner"><strong>{t("games.derbyAgainst")} {rival.opponent}</strong>{rival.wins} Siege · {rival.draws} Remis · {rival.losses} Niederlagen. Die Kurve zählt auf dich. Sieg: 400 Fragmente, Remis: 150.</div> : null; })()}
            <div className="feature-panel-heading"><div><p className="eyebrow">{t("games.seasonModeStar")}</p><h3>{t("games.everyMatchCounts")}</h3></div><span className="feature-stat">{starXIRating} OVR</span></div>
            <p className="feature-copy">{t("games.seasonRules")}</p>
            <div className="starxi-summary"><div><span>{t("squad.rating")}</span><strong>{starXIRating}</strong><small>{t("squad.ratingLabel")}</small></div><div><span>{t("squad.startingXI")}</span><strong>{startingStarXISelection.length} / {STAR_XI_SQUAD_SIZE}</strong><small>{starXIComplete ? t("games.allPositionsFilled") : t("games.startersNeeded", { size: STAR_XI_SQUAD_SIZE })}</small></div><div><span>{t("squad.bench")}</span><strong>{benchStarXIPlayerCount} / {STAR_XI_BENCH_SIZE}</strong><small>{reserveStarXICount} {t("squad.morePlayersStored")}</small></div><div><span>{displayGame.features.cup.active ? t("squad.liveSub") : t("games.seasonMatches")}</span><strong>{displayGame.features.cup.active ? `${displayGame.features.cup.substitutionsUsed} / ${STAR_XI_MAX_SUBSTITUTIONS}` : displayGame.features.seasonMode.history.length}</strong><small>{displayGame.features.cup.active ? t("games.pickStarterThenBench") : t("games.allResultsCount")}</small></div><div><span>{t("games.fragmentsCaps")}</span><strong>{formatNumber(displayGame.features.starXI.fragments)}</strong><small>{t("games.autoCustomCards")}</small></div></div>
            {suspendedStarPlayers.length > 0 && <div className="red-card-warning" role="alert"><span>🟥</span><div><strong>{suspendedStarPlayers.map((player) => player.name).join(", ")} {t("squad.redCardBanned")}</strong><small>{suspendedStarPlayers.length === 1 ? pronounText(t("squad.replaceOneBanned"), suspendedStarPlayers[0]) : t("squad.replaceAllBanned")} {t("squad.notOnBenchUntil")}</small></div></div>}
            {ownedDisciplineBans.length > 0 && <div className="discipline-warning" role="status"><span aria-hidden="true">{ownedDisciplineBans.some((ban) => ban.reason === "red") ? "🟥" : "🟨"}</span><div><strong>{t("squad.bans")}</strong>{ownedDisciplineBans.map((ban) => <span key={ban.id}>{getStarXIPlayer(ban.playerId)?.name ?? t("game.player")}: {suspensionLabel(ban)}. </span>)}<small>{t("games.bannedNotInSquad")}</small></div></div>}
            {injuredStarPlayers.length > 0 && <div className="injury-warning" role="status"><span>🩹</span><div><strong>{injuredStarPlayers.map(({ player }) => player.name).join(", ")} verletzt</strong><small>{injuredStarPlayers.map(({ player, matches }) => t("squad.injuredMatchesLeft", { name: player.name, count: matches })).join(" · ")}{t("squad.injuriesOnlyLive")}</small></div></div>}
            {!displayGame.features.cup.active && !journeyUnderway && <KickoffChecklist items={kickoffItems} busy={coopBusy || travelBusy} />}
            {!displayGame.features.cup.active && !journeyUnderway && !getHomeCityBlockReason(displayGame.features) && <HomeCityCard value={displayGame.features.seasonMode.homeCity} onChange={(city) => void selectHomeCity(city)} busy={coopBusy} readOnly={isCoopLive && coopSession?.role !== "host"} />}
            {!displayGame.features.cup.active && !journeyUnderway && <section className="tournament-picker competition-picker" aria-label={t("games.sectionLabel")}>
              <div className="tournament-picker-heading"><div><p className="eyebrow">{t("games.eyebrow")}</p><h4>{t("games.pickNext")}</h4></div><span>{displayGame.features.cup.pendingNextRound ? t("games.continueCupRun") : t("games.leagueMatchDuration", { duration: formatCountdown(seasonMatchDuration(displayGame.features.seasonMode.division), 0) })}</span></div>
              <div className="tournament-grid competition-grid">
                <article className="competition-card season-competition-card">
                  <div className="competition-card-top"><strong>{t("games.seasonMatch")}</strong><b>{seasonCareerComplete ? "HALL OF FAME" : dataText(getSeasonModeDivisionLabel(seasonMode.division, seasonMode.homeCity))}</b></div>
                  <p>{t("games.seasonTenDays")} {dataText(getSeasonModeDivisionLabel(seasonMode.division, seasonMode.homeCity))}</p>
                  <div className="competition-card-route"><span>{seasonCareerComplete ? (prestigeBlockReason ? t("games.prestigeWaits") : t("games.prestigeReadyCaps")) : t("games.matchday", { matchday: seasonMode.matchday + 1, total: SEASON_MODE_MATCHES_PER_SEASON })}</span><strong>{seasonCareerComplete ? "★" : `★ ${displayGame.stars}`}</strong></div>
                  <div className="competition-card-opponent"><strong>{seasonCareerComplete ? t("games.hofReached") : seasonNextOpponent.name}</strong><small>{seasonCareerComplete ? t("games.prestigeKeeps", { bonus: prestigeBonusPercent(seasonMode.prestigeCount + 1) }) : t("games.opponentRating", { rating: seasonNextOpponent.rating })}</small></div>
                  <span className="travel-home-label">{!fixtureFor(displayGame.features,"season").away ? t("games.homeMatchCrowd", { ground: homeGroundLabel(displayGame.features.seasonMode.homeCity), crowd: expectedHomeCrowd(displayGame.features).toLocaleString("de-CH") }) : t("games.awayMatchTravel", { stadium: fixtureFor(displayGame.features,"season").venue.stadium, city: fixtureFor(displayGame.features,"season").venue.city, km: Math.round(travelTiming(fixtureFor(displayGame.features,"season")).km), duration: durationLabel(travelTiming(fixtureFor(displayGame.features,"season")).baseMs/1000) })}</span><button className="mode-primary competition-card-action" onClick={() => seasonCareerComplete ? openPrestigeDialog() : void startSeasonCupMatch()} disabled={coopBusy || (seasonCareerComplete ? Boolean(prestigeBlockReason) : travelBusy || displayGame.features.cup.pendingNextRound || hasTransferSquadVacancy || suspendedPlayerOnSquad || !starXIComplete)}>{seasonCareerComplete ? t("games.prestigeStart") : travelLabel(fixtureFor(displayGame.features,"season"))}</button>{seasonCareerComplete && prestigeBlockReason && <small className="prestige-block-reason" role="status">{prestigeBlockReason}</small>}
                </article>
                {TOURNAMENTS.map((tournament) => {
                  const unlockLeague = getTournamentUnlockLeague(tournament.id);
                  const leagueUnlocked = isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess);
                  const continuingOtherTournament = displayGame.features.cup.pendingNextRound && tournament.id !== activeTournament.id;
                  const locked = continuingOtherTournament || !leagueUnlocked || hasTransferSquadVacancy || !starXIComplete || suspendedPlayerOnSquad || starXIRating < tournament.minimumRating;
                  const lowestOpponentRating = Math.min(...tournament.opponents.map((opponent) => opponent.rating));
                  const highestOpponentRating = Math.max(...tournament.opponents.map((opponent) => opponent.rating));
                  const tier = tournament.id === "stadium" ? t("games.entryTier") : tournament.id === "champions" ? t("games.proTier") : "ELITE";
                  const lockLabel = continuingOtherTournament ? t("games.finishCupRunFirst") : !leagueUnlocked ? t("game.fromLeague", { unlockLeague }) : hasTransferSquadVacancy ? t("games.fillVacancy", { place: transferSquadVacancyLabel }) : suspendedPlayerOnSquad ? t("games.replaceRedCard") : !starXIComplete ? t("games.playersNeeded", { size: STAR_XI_SQUAD_SIZE }) : t("games.ovrNeeded", { minimumRating: tournament.minimumRating });
                  return <button className={`tournament-card${selectedTournament.id === tournament.id ? " selected" : ""}${locked ? " locked" : ""}`} key={tournament.id} onClick={() => chooseTournament(tournament.id)} disabled={locked} style={{ borderTopColor: tournament.accent }}><span className="tournament-card-top"><strong>{dataText(tournament.label)}</strong><b>{tier}</b></span><small>{dataText(tournament.description)}</small><span className="tournament-route-preview" aria-label={t("games.rounds", { rounds: tournament.rounds })}>{Array.from({ length: tournament.rounds }, (_, index) => <i key={`${tournament.id}-round-${index}`} className={index === tournament.rounds - 1 ? "final" : ""}>{index + 1}</i>)}</span><span className="tournament-card-meta"><b>{t("games.rounds", { rounds: tournament.rounds })} · {tournament.opponents.length} {t("games.possibleOpponents")}</b><em>{lowestOpponentRating}–{highestOpponentRating} OVR</em></span><span className="tournament-boost-reward">{t("games.tournamentWin")} {dataText(getTournamentRewardPack(tournament.id).label)}</span>{locked && <span className="tournament-lock">{lockLabel}</span>}</button>;
                })}
              </div>
              <span className="travel-home-label">{(()=>{const f=fixtureFor(displayGame.features,'tournament',selectedTournament.id);return `${f.away?t('games.away'):t('games.home')} · ${f.opponent} · ${f.away?`${f.venue.stadium}, ${f.venue.city}`:'Bümplizstrasse 45, Bern'}`;})()}</span>
              <div className={`cup-start${displayGame.features.cup.pendingNextRound ? " paused" : tournamentCooldownActive ? " cooldown" : hasTransferSquadVacancy ? " vacancy" : ""}`}>
                <div aria-live={tournamentCooldownActive ? "polite" : undefined}>
                  {displayGame.features.cup.pendingNextRound ? <p className="eyebrow">{t("games.cupRunManual")}</p> : tournamentCooldownActive ? <p className="eyebrow">{t("games.breakEyebrow")}</p> : hasTransferSquadVacancy ? <p className="eyebrow">{t("games.gapEyebrow")}</p> : <p className="eyebrow">{t("games.select")}</p>}
                  <strong>{displayGame.features.cup.pendingNextRound ? suspendedPlayerOnSquad ? t("games.replaceFirst", { names: suspendedStarPlayers.map((player) => player.name).join(", ") || t("games.theBannedPlayer") }) : !starXIComplete ? t("games.completeXIFirst") : t("games.roundReady", { label: dataText(selectedTournament.label), round: displayGame.features.cup.round + 1 }) : tournamentCooldownActive ? t("games.newTournamentIn", { time: tournamentCooldownLabel }) : hasTransferSquadVacancy ? t("games.fillVacancyFirst", { place: transferSquadVacancyLabel }) : !selectedTournamentLeagueUnlocked ? t("games.tournamentLocked", { label: dataText(selectedTournament.label) }) : suspendedPlayerOnSquad && !starXIComplete ? t("games.replaceFirst", { names: suspendedStarPlayers.map((player) => player.name).join(", ") }) : starXIComplete ? t("games.tournamentSelected", { label: dataText(selectedTournament.label) }) : t("games.playersNeededByKickoff", { size: STAR_XI_SQUAD_SIZE })}</strong>
                  <small>{displayGame.features.cup.pendingNextRound ? suspendedPlayerOnSquad ? t("games.bannedNotInSquadShort") : !starXIComplete ? t("games.playersNeededNextKickoff", { size: STAR_XI_SQUAD_SIZE }) : t("games.adjustLineup") : tournamentCooldownActive ? t("games.breakAfterTournament") : hasTransferSquadVacancy ? t("games.soldNotReplaced") : !selectedTournamentLeagueUnlocked ? t("game.availableFromLeagueSel", { selectedTournamentUnlockLeague }) : suspendedPlayerOnSquad && !starXIComplete ? t("games.redCardWait") : starXIComplete ? t("games.tournamentSummary", { label: dataText(selectedTournament.label), rounds: selectedTournament.rounds, reward: dataText(getTournamentRewardPack(selectedTournament.id, displayGame.features.seasonMode.highestDivision).label) }) : t("games.allElevenFilled")}</small>
                </div>
                <button className="mode-primary" onClick={() => void (hasTransferSquadVacancy ? closeSquadVacancy() : startCup(selectedTournament.id))} disabled={travelBusy || coopBusy || tournamentCooldownActive || (!hasTransferSquadVacancy && (!selectedTournamentLeagueUnlocked || !starXIComplete || suspendedPlayerOnSquad || starXIRating < selectedTournament.minimumRating))}>{tournamentCooldownActive ? t("games.newTournamentIn", { time: tournamentCooldownLabel }) : hasTransferSquadVacancy ? t("games.closeGap") : displayGame.features.cup.pendingNextRound ? starXIComplete && !suspendedPlayerOnSquad ? travelLabel(fixtureFor(displayGame.features,"tournament",selectedTournament.id)) : t("games.completeXI") : !selectedTournamentLeagueUnlocked ? t("game.fromLeagueSel", { selectedTournamentUnlockLeague }) : starXIComplete ? travelLabel(fixtureFor(displayGame.features,"tournament",selectedTournament.id)) : t("games.completeXI")}</button>
              </div>
            </section>}
            {!displayGame.features.cup.active && <details className="season-overview"><summary>{t("games.tableDot")} {dataText(getSeasonModeDivisionLabel(seasonMode.division, seasonMode.homeCity))}</summary><div className="season-table">{seasonTable.map((team,index)=><div className={`season-table-row${team.id==='club'?' club':''}`} key={team.id}><i>{index+1}</i><strong>{team.name}</strong><small>{t("table.rowAbbr", { points: team.points, played: team.played, wins: team.wins, draws: team.draws, losses: team.losses, diff: formatGoalDifference(team) })}</small></div>)}</div></details>}
            <details className="tournament-reward-odds"><summary>{t("games.tournamentPrize")} {dataText(getTournamentRewardPack(selectedTournament.id, displayGame.features.seasonMode.highestDivision).label)} {t("packs.showOdds")}</summary><div className="star-pack-odds">{getRewardPackOdds(getTournamentRewardPack(selectedTournament.id, displayGame.features.seasonMode.highestDivision).id as import('./feature-data').RewardPackId).map(o=><span key={o.label}><em>{o.label}</em><b>{formatPackChance(o.chance)}</b></span>)}</div><small>{t("games.baseCardOnly")}</small></details>
            <MatchAudio features={displayGame.features} now={countdownNow} sound={displayGame.sound && soundPrefs.stadium} />
            {displayGame.features.cup.active && <LiveMatchViewer key={displayGame.features.cup.careerMatchId ?? displayGame.features.cup.matchStartedAt} features={displayGame.features} now={countdownNow} clubName={displayClubName} clubColor={displayClubColor} disabled={coopBusy} onEdit={()=>{void editInteractiveMatch();}} onBatch={draft=>{void batchInteractiveMatch(draft);}} onResume={()=>{void resumeInteractiveMatch();}} onSubstitute={changes=>{void confirmMatchChanges(changes);}} />}
              {activeMatchInjury && <div className="cup-injury-pause" role="alert"><div className="cup-injury-pause-icon">🩹</div><div><span className="eyebrow">{t("squad.medicalEyebrow")} {activeMatchInjury.minute}′</span><h4>{activeMatchInjury.player} {t("squad.mustGoOff")}</h4><p>{activeMatchInjury.reason}. Die Verletzung zählt für dieses Spiel und noch {activeMatchInjury.matches} {activeMatchInjury.matches === 1 ? t("games.morePartie") : t("games.morePartien")}.</p><small>{t("games.injuryChoose")}</small></div><div className="cup-injury-pause-actions"><button className="mode-primary" onClick={() => { document.querySelector<HTMLButtonElement>(".match-sub-button")?.click(); }} disabled={coopBusy || !lineupStarIds.includes(activeMatchInjury.playerId)}>{t("squad.subs")}</button><button className="mode-secondary" onClick={() => void resumeCupWithoutSubstitution()} disabled={coopBusy}>{t("squad.continueNoSub")}</button></div></div>}

          </div>}

          {featureTab === "packs" && <div className="feature-panel">
            <div className="starxi-pack-heading"><div><p className="eyebrow">{t("packs.eyebrow")}</p><h4>{formatStableInteger(STAR_XI_TOTAL_CARD_COUNT)} {t("packs.everyPullCounts")}</h4><small>{t("packs.cardCounts", { base: formatStableInteger(STAR_XI_BASE_CARD_COUNT), icons: STAR_XI_ICON_CARD_COUNT, specials: STAR_XI_SPECIAL_CARD_COUNT })}</small></div><span>{ownedStarXIPlayers.length - loanedStarIds.length} {t("squad.playersInTeam")}</span></div>
            {displayGame.features.welcomePack === "available" && <div className="star-pack-grid"><article className="star-pack-card welcome-pack-card" aria-label={t("club.welcomePack")}><div className="star-pack-top"><span className="star-pack-icon">✦</span><div><strong>{t("club.welcomePack")}</strong><small>{t("packs.welcomeBody")}</small></div><span className="star-pack-price">{t("game.free")}</span></div><button type="button" className="mode-primary" disabled={Boolean(starReveal)} onClick={openWelcomePack}>{t("packs.welcomeOpen")}</button></article></div>}
            {displayGame.features.earnedPacks.some(p=>!p.opening)&&<><div className="earned-packs-heading"><h4>{t("packs.yourRewards")}</h4>{displayGame.features.earnedPacks.filter(p=>!p.opening).length>1&&<button type="button" className="mode-secondary" onClick={openAllRewardPacks} disabled={coopBusy||Boolean(starReveal)||displayGame.features.cup.active}>{displayGame.features.cup.active?t("game.afterWhistle"):t("packs.openAll", { count: displayGame.features.earnedPacks.filter(p=>!p.opening).length })}</button>}</div><div className="star-pack-grid">{displayGame.features.earnedPacks.filter(p=>!p.opening).map(earned=>{if(earned.packId==='special'){const odds=getSpecialCardPackOdds(displayGame.features.starXI.ownedIds);return <article className="star-pack-card special-card-pack" key={earned.id}><div className="star-pack-top"><span className="star-pack-icon">✦</span><div><strong>{dataText(SPECIAL_CARD_PACK.label)}</strong><small>{t("packs.dailySpecialBody")}</small></div><span className="star-pack-price">{t("game.free")}</span></div><div className="star-pack-odds"><span><em>{t("game.contents")}</em><b>{odds.total} {t("packs.specialCards")}</b></span><span><em>{t("packs.everyCard")}</em><b>{formatPackChance(odds.each)}</b></span></div><button className="feature-buy-button" onClick={()=>void openRewardPack(earned.id)} disabled={coopBusy||Boolean(starReveal)||displayGame.features.cup.active}>{displayGame.features.cup.active?t("game.afterWhistle"):t("packs.openSpecial")}</button></article>;}const pack=getStarPack(earned.packId)!;return <article className="star-pack-card" key={earned.id}><div className="star-pack-top"><span className="star-pack-icon">🏆</span><div><strong>{dataText(pack.label)}</strong><small>{dataText(pack.description)}</small></div><span className="star-pack-price">{t("club.won")}</span></div><div className="star-pack-odds">{getRewardPackOdds(earned.packId).map(o=><span key={o.label}><em>{o.label}</em><b>{formatPackChance(o.chance)}</b></span>)}</div><button className="feature-buy-button" onClick={()=>void openRewardPack(earned.id)} disabled={coopBusy||Boolean(starReveal)||displayGame.features.cup.active}>{displayGame.features.cup.active?t("game.afterWhistle"):t("packs.openReward")}</button></article>;})}</div></>}
            <div className="star-pack-grid">{STAR_PACKS.map((pack) => { const unlockLeague = getPackUnlockLeague(pack.id); const unlocked = isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess); return <article className={`star-pack-card ${pack.id}${unlocked ? "" : " season-locked"}`} key={pack.id}><div className="star-pack-top"><span className="star-pack-icon">{unlocked ? "★" : "🔒"}</span><div><strong>{dataText(pack.label)}</strong><small>{unlocked ? dataText(pack.description) : t("game.availableFromLeague", { unlockLeague })}</small></div><span className="star-pack-price">{unlocked ? hasInfiniteMoney ? t("game.testModeShort") : t("packs.priceGoals", { price: formatNumber(pack.price) }) : t("game.leagueCaps", { unlockLeague })}</span></div><div className="star-pack-odds">{pack.odds.map((odd) => <span key={`${pack.id}-${odd.label}`}><em>{dataText(odd.label)}</em><b>{formatPackChance(odd.chance)}</b></span>)}</div>{unlocked && !hasInfiniteMoney && <div className="pack-savings">{displayGame.goals < pack.price && <small>{savingsHint(pack.price, displayGame.goals, passivePower, formatNumber)}</small>}<button type="button" className={`savings-pin${savingsGoal?.kind === "pack" && savingsGoal.id === pack.id ? " active" : ""}`} aria-pressed={savingsGoal?.kind === "pack" && savingsGoal.id === pack.id} onClick={() => toggleSavingsGoal({ kind: "pack", id: pack.id })}>{savingsGoal?.kind === "pack" && savingsGoal.id === pack.id ? t("shop.savingsGoalSet") : t("shop.savingsGoal")}</button></div>}<button className="feature-buy-button" onClick={() => void buyStarPack(pack.id)} disabled={!unlocked || displayGame.features.cup.active || (!hasInfiniteMoney && displayGame.goals < pack.price) || coopBusy || Boolean(starReveal)}>{!unlocked ? t("game.fromLeague", { unlockLeague }) : displayGame.features.cup.active ? t("game.afterWhistle") : hasInfiniteMoney ? t("packs.testPack") : t("packs.openPrice", { price: formatNumber(pack.price) })}</button></article>; })}
              {(() => { const unlockLeague = getPackUnlockLeague(SPECIAL_CARD_PACK.id); const unlocked = isLeagueContentUnlocked(unlockLeague, reachedLeague, hasFullTestAccess); const fragments = displayGame.features.starXI.fragments; const odds = getSpecialCardPackOdds(displayGame.features.starXI.ownedIds); const affordable = hasInfiniteMoney || fragments >= SPECIAL_CARD_PACK.price; return <article className={`star-pack-card special-card-pack${unlocked ? "" : " season-locked"}`} key={SPECIAL_CARD_PACK.id} aria-label={t("packs.specialLabel")}><div className="star-pack-top"><span className="star-pack-icon">{unlocked ? "✦" : "🔒"}</span><div><strong>{dataText(SPECIAL_CARD_PACK.label)}</strong><small>{unlocked ? dataText(SPECIAL_CARD_PACK.description) : t("game.availableFromLeague", { unlockLeague })}</small></div><span className="star-pack-price">{unlocked ? hasInfiniteMoney ? t("game.testModeShort") : t("packs.fragmentPriceCaps", { price: SPECIAL_CARD_PACK.price }) : t("game.leagueCaps", { unlockLeague })}</span></div><div className="star-pack-odds"><span><em>{t("packs.currency")}</em><b>{t("packs.fragments")}</b></span><span><em>{t("game.contents")}</em><b>{odds.total} {t("packs.specialCards")}</b></span><span><em>{t("packs.everyCard")}</em><b>{formatPackChance(odds.each)}</b></span><span><em>{t("packs.newForClub")}</em><b>{formatPackChance(odds.newCard)}</b></span></div><small className="special-pack-balance">{t("packs.yourBalance")} <b>{fragments.toLocaleString("de-CH")} Fragmente</b>{!affordable && unlocked ? t("packs.toNextPack", { amount: formatNumber(SPECIAL_CARD_PACK.price - fragments) }) : ""}</small><button className="feature-buy-button" onClick={() => void buySpecialCardPack()} disabled={!unlocked || displayGame.features.cup.active || !affordable || coopBusy || Boolean(starReveal)}>{!unlocked ? t("game.fromLeague", { unlockLeague }) : displayGame.features.cup.active ? t("game.afterWhistle") : hasInfiniteMoney ? t("packs.testPack") : t("packs.fragmentPriceOpen", { price: SPECIAL_CARD_PACK.price })}</button></article>; })()}</div>
            <p className="star-pack-rarity-note">{t("packs.oddsNote")}</p>
          </div>}
          {featureTab === "squad" && <div className="feature-panel">{displayGame.features.cup.active ? <div className="career-empty"><p>{t("squad.subsInMatch")}</p><button className="mode-primary" onClick={()=>openFeatureTab('cup')}>{t("games.toLiveMatch")}</button></div> : <>
            <div className="starxi-lineup-heading"><span>{t("squad.yourXIEyebrow")} {activeFormation.label}</span><small>{t("squad.dragOrTap")}</small></div>
            <div className="starxi-squad-layout">
              <SquadPitchPanel status={squadMovePreview ? <b className="squad-move-preview">{t("squad.subsLabel")} {squadMovePreview}</b> : activeLineupSlot === null ? t("squad.pickStartPlace") : t("squad.placePosition", { place: activeLineupSlot + 1, position: activeLineupPosition })} controls={<div className="starxi-formation-picker"><span><strong>{t("squad.formationCaps")}</strong><small>{displayGame.features.cup.active ? t("squad.lockedDuringMatch") : t("squad.formationsUnlocked", { unlocked: unlockedFormationCount, total: STAR_FORMATIONS.length })}</small></span><div className="starxi-formation-actions"><select value={activeFormation.id} disabled={displayGame.features.cup.active || coopBusy} onChange={(event) => void changeStarXIFormation(event.target.value as StarFormationId)} aria-label={t("squad.chooseFormation")}>{pickerFormations.map((formation) => { const unlockLeague = getFormationUnlockLeague(formation.id); const unlocked = isFormationAvailable(formation); return <option value={formation.id} key={formation.id} disabled={!unlocked}>{dataText(formation.label)}{unlocked ? formationRatings[formation.id] ? t("squad.formationUpTo", { rating: formationRatings[formation.id] }) : "" : t("squad.formationFromLeague", { unlockLeague })}</option>; })}</select><button type="button" className="starxi-best-button" onClick={() => void autoPickBestStarXI()} disabled={coopBusy || ownedStarXIPlayers.length === 0} aria-disabled={displayGame.features.cup.active || undefined} title={displayGame.features.cup.active ? t("squad.lockedDuringAMatch") : undefined}>★ Beste Startelf</button>{(() => { const slotPlayerId = activeLineupSlot !== null ? lineupStarIds[activeLineupSlot] : ""; const pinned = Boolean(slotPlayerId && displayGame.features.starXI.pinnedPlayerIds?.includes(slotPlayerId)); return <button type="button" className={`starxi-pin-button${pinned ? " active" : ""}`} aria-pressed={pinned} disabled={coopBusy || !slotPlayerId} title={slotPlayerId ? undefined : t("squad.pickStarterFirst")} onClick={() => slotPlayerId && void togglePinnedStarterOfSlot(slotPlayerId)}>{pinned ? t("squad.unpin") : "Fixieren"}</button>; })()}</div><div className="starxi-squad-tools">{squadGapCount > 0 && <button type="button" className="mode-secondary" onClick={() => void fillSquadGaps()} disabled={coopBusy}>Lücken füllen ({squadGapCount})</button>}<button type="button" className="mode-secondary" onClick={() => void pickBestBench()} disabled={coopBusy || ownedStarXIPlayers.length === 0}>Beste Bank</button>{undoAvailable && <button type="button" className="mode-secondary" onClick={undoBestStarXI}>{t("game.undo")}</button>}</div></div>} help={displayGame.features.cup.active ? t("squad.liveSubsHint", { max: STAR_XI_MAX_SUBSTITUTIONS, used: displayGame.features.cup.substitutionsUsed }) : activeLineupSlot !== null ? t("squad.onlyMatching", { position: activeLineupPosition }) : selectedBenchSlot !== null ? t("squad.benchSlotChosen", { slot: selectedBenchSlot + 1 }) : selectedReserveId !== null ? t("squad.reserveChosen", { name: getStarXIPlayer(selectedReserveId)?.name ?? t("game.player") }) : t("squad.dragBetween")}>{activeFormation.slots.map((slot, index) => {
                  const player = startingStarXIPlayers[index];
                  const liveRating = displayGame.features.cup.active && player ? getCupPlayerMatchRating(displayGame.features.cup, player.id, cupMatchMinute) : null;
                  return <SquadPitchSlot key={`${activeFormation.id}-${index}`} features={displayGame.features} drag={squadDrag} index={index} position={activeFormationPositions[index]} x={slot.x} y={slot.y} player={player} selected={activeLineupSlot === index} liveRating={liveRating} draggable={!layoutEditMode && !coopBusy} disabled={coopBusy} banLabel={banLabelFor(player?.id)} onClick={() => chooseLineupSlot(index)} />;
                })}</SquadPitchPanel>
              <div className="starxi-squad-side">
                <SquadBenchPanel id="gc-live-bench" count={benchStarXIPlayerCount} size={STAR_XI_BENCH_SIZE}>{Array.from({ length: STAR_XI_BENCH_SIZE }, (_, index) => {
                    const player = benchStarXIPlayers[index];
                    const compatible = Boolean(player && activeLineupSlot !== null && canStarXIPlayerFillSlot(player.id, activeLineupSlot, activeFormationPositions));
                    const selected = selectedBenchSlot === index;
                    const liveRating = displayGame.features.cup.active && player ? getCupPlayerMatchRating(displayGame.features.cup, player.id, cupMatchMinute) : null;
                    const alreadySubbedOut = Boolean(player && displayGame.features.cup.active && displayGame.features.cup.playerExitedAt[player.id]);
                    return player ? <SquadBenchCard key={player.id} features={displayGame.features} drag={squadDrag} index={index} player={player} selected={selected} incompatible={activeLineupSlot !== null && (!compatible || alreadySubbedOut)} liveRating={liveRating} status={alreadySubbedOut ? t("squad.alreadySubbed") : activeLineupSlot !== null ? compatible ? displayGame.features.cup.active ? t("squad.subOnlyThisMatch") : t("squad.putOn", { position: activeLineupPosition }) : t("squad.doesNotFit", { position: activeLineupPosition }) : displayGame.features.cup.active ? t("squad.dragOntoOutfield") : t("squad.benchSlotDrag", { place: index + 1 })} draggable={!layoutEditMode && !coopBusy} disabled={coopBusy} banLabel={banLabelFor(player.id)} onClick={() => chooseBenchSlot(index)} /> : <SquadBenchSlot key={`bank-empty-${index}`} drag={squadDrag} index={index} selected={selected} disabled={displayGame.features.cup.active || coopBusy} onClick={() => chooseBenchSlot(index)} />;
                  })}</SquadBenchPanel>
                <section className={`starxi-reserve-panel${squadDrag.squadDropClass("reserve", 0)}`} aria-label={t("squad.reserve")} data-squad-area="reserve" data-squad-index={0} onDragOver={(event) => squadDrag.handleSquadDragOver(event, { area: "reserve", index: 0 })} onDrop={(event) => void squadDrag.handleSquadDrop(event, { area: "reserve", index: 0 })}>
                  <div className="starxi-subheading"><div><span className="eyebrow">{t("squad.reserveEyebrow")}</span><h4>{t("squad.morePlayers")}</h4></div><strong>{reserveStarXIPlayers.length}</strong></div>
                  <div className="starxi-reserve-controls"><div className="starxi-filter-tools"><input className="starxi-search" value={starSearch} onChange={(event) => { setStarSearch(event.target.value); setReservePage(0); }} placeholder={t("squad.searchPlaceholder")} aria-label={t("squad.searchLabel")} /><select className="starxi-position-filter" value={starPositionFilter} onChange={(event) => { setStarPositionFilter(event.target.value); setReservePage(0); }} aria-label={t("squad.positionFilter")}><option value="all">{t("squad.allPositions")}</option>{STAR_POSITIONS.map((position) => <option value={position} key={`reserve-position-${position}`}>{position}</option>)}</select></div><div className="starxi-filter-tools"><select className="starxi-position-filter" value={reserveSort} onChange={(event) => { setReserveSort(event.target.value); setReservePage(0); }} aria-label={t("squad.reserveSort")}>{RESERVE_SORTS.map((item) => <option value={item.id} key={item.id}>{t("game.sortLabel")} {localizeText(item.label)}</option>)}</select><select className="starxi-position-filter" value={reserveType} onChange={(event) => { setReserveType(event.target.value); setReservePage(0); }} aria-label={t("packs.typeFilter")}>{RESERVE_TYPES.map((item) => <option value={item.id} key={item.id}>{localizeText(item.label)}</option>)}</select></div><div className="starxi-filter-row" role="group" aria-label={t("squad.availability")}>{RESERVE_STATUS_FILTERS.map((item) => <button type="button" className={reserveStatus === item.id ? "active" : ""} key={item.id} onClick={() => { setReserveStatus(item.id); setReservePage(0); }} aria-pressed={reserveStatus === item.id}>{localizeText(item.label)}</button>)}</div>{activeLineupSlot !== null && <label className="starxi-only-compatible"><input type="checkbox" checked={reserveOnlyCompatible} onChange={(event) => { setReserveOnlyCompatible(event.target.checked); setReservePage(0); }} /> Nur Spieler für {activeLineupPosition}</label>}<div className="starxi-filter-row" role="group" aria-label={t("packs.ratingFilter")}>{STAR_RATING_FILTERS.map((filter) => <button type="button" className={starRatingFilter === filter.id ? "active" : ""} key={filter.id} onClick={() => { setStarRatingFilter(filter.id); setReservePage(0); }} aria-pressed={starRatingFilter === filter.id}>{dataText(filter.label)}</button>)}</div></div>
                  <div className="starxi-reserve-list">{filteredReserveStarXIPlayers.length ? visibleReserveStarXIPlayers.map((player) => { const compatible = activeLineupSlot === null || canStarXIPlayerFillSlot(player.id, activeLineupSlot, activeFormationPositions); const suspended = suspendedStarIds.includes(player.id); const injuryMatches = injuredStarPlayers.find((entry) => entry.player.id === player.id)?.matches ?? 0; const unavailable = suspended || injuryMatches > 0; const injuryText = t("game.matchCount", { count: injuryMatches }); const dragSource: SquadDragSource = { playerId: player.id, area: "reserve", index: null }; const typeLabel = reserveTypeLabel(reserveCardType(player)); const favorite = favoriteCardIds.has(player.id); return <div className="starxi-reserve-item" key={player.id}><button type="button" className={`starxi-player-card reserve${activeLineupSlot !== null && !compatible ? " incompatible" : ""}${suspended ? " red-carded" : ""}${injuryMatches > 0 ? " injured" : ""}${selectedReserveId === player.id ? " selected" : ""}${draggingSquadPlayer?.playerId === player.id ? " squad-dragging" : ""}`} aria-pressed={selectedReserveId === player.id} onClick={() => { if (squadDrag.consumeDragClick()) return; if (suspended) showToast(t("squad.bannedNext", { name: player.name })); else if (injuryMatches > 0) showToast(t("squad.injuredFor", { name: player.name, injuryText })); else chooseReservePlayer(player.id); }} disabled={displayGame.features.cup.active || coopBusy || unavailable} draggable={!layoutEditMode && !displayGame.features.cup.active && !coopBusy && !unavailable} onDragStart={(event) => squadDrag.handleSquadDragStart(event, dragSource)} onDragEnd={squadDrag.handleSquadDragEnd}>{!unavailable && !displayGame.features.cup.active && !coopBusy && <span className="reserve-drag-grip" aria-hidden="true" {...squadDrag.touchHandlers(dragSource)}>⠿</span>}{suspended ? <span style={{ color: player.accent }}>🟥</span> : injuryMatches > 0 ? <span className="starxi-injury-mark" aria-hidden="true">🩹</span> : <StarXIPositionBadges player={player} variant="compact" />}<div><span className="reserve-card-title"><strong>{player.name}</strong>{newCardIds.has(player.id) && <em className="card-new-chip">{t("game.new")}</em>}{typeLabel && <em className="card-type-chip">{typeLabel}</em>}</span><CareerPlayerBadge features={displayGame.features} player={player} /><small>{suspended ? t("squad.redNotBench") : banLabelFor(player.id) ? t("squad.banNotInSquad", { ban: banLabelFor(player.id) }) : injuryMatches > 0 ? t("squad.injuredCaps", { time: injuryText.toUpperCase() }) : selectedReserveId === player.id ? t("squad.chosenTapPlace") : selectedBenchSlot !== null ? t("squad.toBenchSlot", { slot: selectedBenchSlot + 1 }) : activeLineupSlot !== null ? compatible ? t("squad.putOn", { position: activeLineupPosition }) : t("squad.cannotPlay", { position: activeLineupPosition }) : t("squad.tapOrDrag")}</small></div><b>{getCareerCard(displayGame.features.career, player).rating}</b></button><button type="button" className={`card-favorite-toggle${favorite ? " active" : ""}`} aria-pressed={favorite} aria-label={favorite ? t("squad.unfavorite", { name: player.name }) : t("squad.favorite", { name: player.name })} disabled={coopBusy} onClick={() => void toggleFavorite(player.id)}>{favorite ? "★" : "☆"}</button></div>; }) : <div className="starxi-empty">{t("squad.noFilterMatch")}</div>}</div>
                  {filteredReserveStarXIPlayers.length > 0 && <nav className="starxi-pagination" aria-label={t("squad.reservePages")}><button type="button" onClick={() => setReservePage(Math.max(0, activeReservePage - 1))} disabled={activeReservePage === 0}>{t("game.back")}</button><span><strong>{t("game.page")} {activeReservePage + 1} von {reservePageCount}</strong><small>{activeReservePage * RESERVE_PAGE_SIZE + 1} bis {Math.min((activeReservePage + 1) * RESERVE_PAGE_SIZE, filteredReserveStarXIPlayers.length)} von {filteredReserveStarXIPlayers.length}</small></span><button type="button" onClick={() => setReservePage(Math.min(reservePageCount - 1, activeReservePage + 1))} disabled={activeReservePage >= reservePageCount - 1}>{t("game.continueArrow")}</button></nav>}
                  {currentTransferLoans.length > 0 && <div className="starxi-loaned-list" aria-label={t("squad.loanedPlayers")}><span className="eyebrow">{t("fabrizio.loanedCaps")}</span>{currentTransferLoans.map(({ loan, player }) => <div className="starxi-player-card reserve loaned" key={`loaned-${player.id}`} aria-disabled="true"><StarXIPositionBadges player={player} variant="compact" /><div><strong>{player.name}</strong><small>{t("fabrizio.loanedTo")} {loan.club} · {loan.status === "active" ? t("fabrizio.returnsAfterGame") : t("fabrizio.missesNextMatch")}</small></div><b>{getCareerCard(displayGame.features.career, player).rating}</b></div>)}</div>}
                  <p className="starxi-reserve-drop-hint">{t("squad.dropToFree")}</p>
                </section>
              </div>
            </div>

          </>}</div>}
          {featureTab === "club" && <div className="feature-panel">{coopWorldPanel}            <section className="trophy-room" aria-label={t("club.cupsWon")}><div className="trophy-room-heading"><div><p className="eyebrow">{t("club.trophyRoom")}</p><h4>{t("club.yourCups")}</h4></div><span>{totalTrophies} {t("club.total")}</span></div><div className="trophy-grid">{TOURNAMENTS.map((tournament) => { const count = displayGame.features.cup.trophies[tournament.id]; return <article className={`trophy-card${count > 0 ? " earned" : " locked"}`} key={`trophy-${tournament.id}`} style={{ "--trophy-accent": tournament.accent } as CSSProperties}><span className="trophy-icon" aria-hidden="true">{tournament.trophyIcon}</span><div><strong>{dataText(tournament.trophyName)}</strong><small>{count > 0 ? t("club.timesWon", { count }) : t("club.roundsToCup", { rounds: tournament.rounds })}</small></div><b>{count}</b></article>; })}</div></section>
            <section className="club-scorer-board" aria-label={t("club.allTimeScorers")}><div className="club-scorer-heading"><div><p className="eyebrow">{t("club.recordsEyebrow")}</p><h4>{t("club.topThree")}</h4></div><span>{t("club.allMatchesCaps")}</span></div>{allTimeTopScorers.length ? <ol>{allTimeTopScorers.map(({ player, goals, appearances }, index) => <li key={`all-time-${player.id}`}><span>{index + 1}</span><div><strong>{player.name}</strong><small>{formatStarXIPositions(player)} · OVR {player.rating}</small></div><b>{goals} {goals === 1 ? t("game.goalCaps") : t("game.goalsCaps")} · {appearances} {appearances === 1 ? t("game.matchCaps") : t("game.matchesCaps")}</b></li>)}</ol> : <div className="club-scorer-empty"><strong>{t("club.recordsWait")}</strong><small>{t("club.firstGoal")}</small></div>}</section>
            <TravelStatsPanel travel={displayGame.features.travel} now={getTravelTime()} clubName={displayGame.features.club.name} />
            <DeviceSettingsPanel sound={game.sound} soundPrefs={soundPrefs} onSound={toggleSound} onSoundPrefs={setSoundPrefs} notifications={notificationsOn} onNotifications={changeNotifications} onWhatsNew={() => setWhatsNewArchive(true)} onMessage={showToast} />
            <section className="tutorial-restart" aria-label={t("club.tutorialLabel")}><div><p className="eyebrow">{t("club.tutorialEyebrow")}</p><strong>{t("club.tutorialAgainTitle")}</strong><small>{t("club.tutorialAgainBody")}</small></div><button type="button" className="mode-secondary" onClick={restartTutorial}>{t("club.restartTutorial")}</button></section>
            <section className="tutorial-restart" aria-label={t("club.saveFileLabel")}><div><p className="eyebrow">{t("club.saveFileEyebrow")}</p><strong>{t("club.saveFileTitle")}</strong><small>{t("club.saveFileBody")}</small></div><SaveFileControls getGame={() => gameRef.current} onMessage={showToast} /></section>
<section className="club-identity" aria-label={t("club.identity")}><div className="feature-panel-heading"><div><p className="eyebrow">{t("club.identityEyebrow")}</p><h3>{t("club.makeItYours")}</h3></div><span className="club-preview" role="img" aria-label={t("club.crestPreview", { badge: clubDraft.badge })} style={{ color: clubDraft.color, borderColor: clubDraft.color }}>{clubDraft.badge}</span></div><div className="club-form"><label htmlFor="club-name">{t("club.name")}</label><input id="club-name" className="mode-input" value={clubDraft.name} maxLength={22} onChange={(event) => setClubDraft((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !coopBusy) { event.preventDefault(); void saveClubProfile(); } }} enterKeyHint="done" /><div><span className="club-form-label">{t("club.crest")}</span><div className="club-choice-row">{CLUB_BADGES.map((badge) => <button key={badge} className={clubDraft.badge === badge ? "selected" : ""} onClick={() => setClubDraft((current) => ({ ...current, badge }))}>{badge}</button>)}</div></div><div><span className="club-form-label">{t("club.color")}</span><div className="club-choice-row colors">{CLUB_COLORS.map((color) => <button key={color} className={clubDraft.color === color ? "selected" : ""} style={{ background: color }} aria-label={t("club.colorName", { color })} onClick={() => setClubDraft((current) => ({ ...current, color }))} />)}</div></div><button className="mode-primary" onClick={() => void saveClubProfile()} disabled={coopBusy}>{t("club.saveProfile")}</button></div></section></div>}

          {featureTab === "missions" && <WeeklyGoalsPanel features={displayGame.features} minigameWins={displayGame.minigameWins} coop={isCoopLive} busy={coopBusy} now={getTravelTime()} onClaim={(goalId) => void claimWeeklyGoalReward(goalId)} />}

          {featureTab === "leaderboard" && <LeaderboardPanel playerId={playerId} />}
          {featureTab === "history" && <div className="feature-panel"><div className="feature-panel-heading"><div><p className="eyebrow">{t("club.matchCenterEyebrow")}</p><h3>{t("club.whatHappens")}</h3></div><span className="feature-stat">{featureHistory.length} {t("club.entries")}</span></div><div className="history-filters"><div className="starxi-filter-row" role="group" aria-label={t("club.historyFilter")}>{HISTORY_TOPICS.map((topic) => <button type="button" key={topic.id} className={historyTopic === topic.id ? "active" : ""} aria-pressed={historyTopic === topic.id} onClick={() => setHistoryTopic(topic.id)}>{topic.label}</button>)}</div>{featureHistoryActors.length > 0 && <select className="starxi-position-filter" value={historyActor} onChange={(event) => setHistoryActor(event.target.value)} aria-label={t("club.historyByPlayer")}><option value="">{t("club.allTeammates")}</option>{featureHistoryActors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}</select>}</div><div className="history-list">{featureHistory.length ? featureHistory.map((entry) => <div className={`history-row ${entry.tone}`} key={entry.id}><span><Icon name={entry.tone === "negative" ? "screen" : entry.title.includes("Pokal") ? "crown" : "star"} size={15} /></span><div><strong>{localizeText(entry.title)}</strong><small>{entry.actor ? `${entry.actor} · ` : ""}{localizeText(entry.detail)}</small></div><em>{formatHistoryTime(entry.timestamp)}</em></div>) : <div className="feature-empty"><Icon name="broadcast" size={25} /><p>{t("club.noEntries")}</p></div>}</div></div>}
          {featureTab === "history" && displayGame.features.gazetteIssues.length > 0 && <section className="gazette-archive"><div className="gazette-archive-heading"><div><p className="eyebrow">{t("club.gazetteArchive")}</p><h3>{t("club.frontPages")}</h3></div><span>{displayGame.features.gazetteIssues.length} {t("club.spending")}</span></div><div>{[...displayGame.features.gazetteIssues].reverse().map((issue) => <article className={issue.tone} key={`gazette-archive-${issue.id}`}><small>{dataText(getTournament(issue.tournamentId)?.label) || t("club.tournament")} · {formatHistoryTime(issue.createdAt)}</small><strong>{issue.headline}</strong><p>{issue.strapline}</p></article>)}</div></section>}
        </section>

        <aside className={layoutCardClass("side", "side-column")} style={{ order: layoutOrderNumber("side") }} onDragOver={(event) => handleLayoutDragOver(event, "side")} onDrop={(event) => handleLayoutDrop(event, "side")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "side")} onDragEnd={handleLayoutDragEnd} aria-label={t("layout.sideMove")}><span className="layout-handle-grip" aria-hidden="true"><Icon name="grip" size={18} /></span><div><strong>{t("layout.sideCards")}</strong><small>{t("layout.dragHint")}</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("side", -1); }} aria-label={t("layout.sideUp")}>↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("side", 1); }} aria-label={t("layout.sideDown")}>↓</button></div></div>}
          {isCoopLive && coopSession && <div className="side-card coop-team-card"><div className="side-card-heading"><span className="heading-icon"><Icon name="stadium" size={16} /></span><div><p className="eyebrow">TEAM / {String(coopSession.room.playerCount).padStart(2, "0")} VON 04</p><h2>{t("club.yourTeam")}</h2></div><span className="coop-live-badge">{hasInfiniteMoney ? "TEST" : "LIVE"}</span></div><div className="coop-players">{coopSession.room.players.map((player) => <div className={`coop-player-card${player.role === coopSession.role ? " you" : ""}${player.online ? " online" : ""}${!player.occupied ? " waiting" : ""}`} key={player.role}><span className="coop-player-tag">{player.role === coopSession.role ? t("club.youRole", { role: coopRoleLabel(player.role) }) : coopRoleLabel(player.role)}</span><strong>{player.occupied ? player.name : t("coop.freeSeat")}</strong><small>{player.occupied ? t("coop.playerStats", { goals: formatNumber(player.goals), clicks: formatNumber(player.clicks), status: player.online ? "online" : coopLastActiveLabel(player) || "offline" }) : t("coop.shareCode")}</small></div>)}</div><div className="coop-team-total"><span>{hasInfiniteMoney ? t("game.testBalance") : t("coop.sharedBalance")}</span><strong>{displayBalance} {t("game.goals")}</strong></div></div>}
          <div className="side-column-stack side-column-stack-rank">
            <div className="side-card"><div className="side-card-heading"><span className="heading-icon">↗</span><div><p className="eyebrow">{t("game.promotion")}</p><h2>{t("club.table")}</h2></div></div><div className="rank-display"><span className="rank-symbol large"><Icon name={currentRank.icon} size={29} /></span><div><strong>{dataText(currentRank.name)}</strong><small>{nextRank ? t("club.goalsForRank", { minimum: formatNumber(nextRank.minimum), name: dataText(nextRank.name) }) : t("club.youAreTheTable")}</small></div></div><div className="rank-progress"><div style={{ width: `${rankProgress}%` }} /></div><div className="rank-progress-labels"><span>{t("home.totalGoals", { goals: formatNumber(displayGame.totalGoals) })}</span><span>{nextRank ? formatNumber(nextRank.minimum) : "MAX"}</span></div></div>
            <div className="side-card feed-card"><div className="side-card-heading"><span className="heading-icon">≡</span><div><p className="eyebrow">{t("club.stadiumRadio")}</p><h2>{t("club.liveFromStand")}</h2></div></div><div className="feed-list">{feed.slice(0, feedExpanded ? 8 : 3).map((item) => <div className="feed-item" key={item.id}><span className="feed-mark"><Icon name={item.icon} size={13} /></span><p>{localizeText(item.text)}</p></div>)}</div>{feed.length > 3 && <button type="button" className="feed-more" aria-expanded={feedExpanded} onClick={() => setFeedExpanded((current) => !current)}>{feedExpanded ? "weniger" : t("club.more", { count: feed.length - 3 })}</button>}</div>
          </div>
          <div className="side-column-stack side-column-stack-season">
            <div className="side-card season-card">
            <div className="side-card-heading"><span className="heading-icon">★</span><div><p className="eyebrow">{t("games.seasonModeLeague")} {leagueForTier(currentSeason)}</p><h2>{currentSeasonMilestone.title}</h2></div><span className="season-stars">★ {displayGame.stars}</span></div>
            <p className="season-copy">{seasonCareerComplete ? t("season.topReached") : t("season.divisionRules", { division: dataText(getSeasonModeDivisionLabel(currentSeason)) })} {t("club.starBonus")}</p>
            <div className="season-unlocks"><span>{t("shop.activeUnlocks")}</span><div>{currentSeasonMilestone.rewards.map((reward) => <b key={`${currentSeason}-${reward}`}>✓ {reward}</b>)}</div></div>
            <div className="season-stat"><span>{seasonCareerComplete ? t("games.hofReachedCaps") : t("season.matchdayOf10", { matchday: seasonMode.matchday })}</span><strong>{seasonCareerComplete ? `PRESTIGE ${seasonMode.prestigeCount}` : seasonMode.lastResult.includes("wartet") ? t("games.kickoffReady") : t("season.bestLeagueCaps", { league: leagueForTier(seasonMode.highestDivision) })}</strong></div>
            <div className="season-progress"><div style={{ width: `${seasonCareerComplete ? 100 : Math.min(100, (seasonMode.matchday / 10) * 100)}%` }} /></div>
            <div className="season-table" aria-label={t("season.tableLabel")}><div className="season-table-heading"><span>{t("game.table")}</span><span>{t("table.headAbbr")}</span></div>{seasonTable.map((team, index) => <div className={`season-table-row${team.id === "club" ? " club" : ""}`} key={team.id}><i>{index + 1}</i><strong>{team.name}</strong><small>{t("table.rowAbbr", { points: team.points, played: team.played, wins: team.wins, draws: team.draws, losses: team.losses, diff: formatGoalDifference(team) })}</small></div>)}</div>
            <div className="season-next"><span>{t("game.lastResult")}</span><strong>{localizeText(seasonMode.lastResult)}</strong><small>{seasonMode.highestDivision > 1 ? t("season.bestLeague", { league: leagueForTier(seasonMode.highestDivision) }) : t("season.playFirst")}</small></div>
            <details className="season-roadmap"><summary>{t("season.allUnlocks")} <span>＋</span></summary><div>{SEASON_MILESTONES.map((milestone) => { const league = leagueForTier(milestone.season); return <article className={league > reachedLeague ? "done" : league === reachedLeague ? "current" : "future"} key={`season-roadmap-${milestone.season}`}><i>{league > reachedLeague ? "✓" : league}</i><div><strong>{t("game.league1")} {league} · {dataText(milestone.title)}</strong><small>{milestone.rewards.map(dataText).join(" · ")}</small></div></article>; })}</div></details>
            <p className="season-action-note">{t("season.startTogether")}</p>
            </div>
          </div>
          <div className="side-column-stack side-column-stack-achievements">
            <div className="side-card achievement-card"><div className="side-card-heading"><span className="heading-icon">◇</span><div><p className="eyebrow">{t("club.achievements")}</p><h2>{t("club.cupCabinet")}</h2></div><span className="achievement-count">{displayGame.achievements.length} / {ACHIEVEMENTS.length}</span></div><div className="achievement-list">{ACHIEVEMENTS.map((achievement) => { const unlocked = displayGame.achievements.includes(achievement.id); return <div className={`achievement-row${unlocked ? " unlocked" : ""}`} key={achievement.id}><span><Icon name={achievement.icon} size={17} /></span><div><strong>{dataText(achievement.name)}</strong><small>{dataText(achievement.description)}</small></div><em>{unlocked ? "✓" : formatNumber(achievement.threshold)}</em></div>; })}</div></div>
            <div className="coach-note"><span className="coach-avatar">COACH</span><div><strong>{t("club.coachTip")}</strong><p>{seasonCareerComplete ? t("season.hallOfFame") : seasonInProgress ? t("season.everyMatchCounts") : t("season.startFirst")}</p></div></div>
          </div>
        </aside>
      </main>}

      {appMode === "coop" && !isCoopLive && <main className="mode-page coop-mode-page">
        <section className={`mode-card coop-card${coopSession?.room.status === "live" ? " is-live" : ""}`}>
          <div className="mode-card-heading"><div><p className="eyebrow">{t("coop.lobbyEyebrow")}</p><h2>{t("coop.lobbyTitle")}</h2><p>{t("coop.lobbyBody")}</p></div><span className="mode-card-icon"><Icon name="stadium" size={24} /></span></div>
          {!coopSession ? <div className="coop-lobby">
            <div className="coop-lobby-panel"><span className="coop-panel-number">01</span><div><p className="eyebrow">{t("coop.newWorldCaps")}</p><h3>{t("coop.youAreHost")}</h3><p>{t("coop.nameWorld")}</p></div><input className="mode-input room-name-input" value={coopRoomName} maxLength={28} placeholder={t("club.namePlaceholder")} onChange={(event) => setCoopRoomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !coopBusy) { event.preventDefault(); void createCoopRoom(); } }} enterKeyHint="go" aria-label={t("coop.newWorldName")} /><button className="mode-primary" onClick={() => void createCoopRoom()} disabled={coopBusy}>{t("coop.createWorld")}</button></div>
            <div className="coop-lobby-panel"><span className="coop-panel-number">02</span><div><p className="eyebrow">{t("coop.joinCaps")}</p><h3>{t("coop.alreadyInvited")}</h3><p>{t("coop.joinBody")}</p></div><input className="mode-input code-input" value={coopCodeInput} maxLength={6} placeholder="ABC123" aria-label={t("coop.roomCode")} onChange={(event) => setCoopCodeInput(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter" && !coopBusy) { event.preventDefault(); void joinCoopRoom(); } }} enterKeyHint="go" autoCapitalize="characters" /><button className="mode-secondary" onClick={() => void joinCoopRoom()} disabled={coopBusy}>{t("coop.join")}</button></div>
            {account ? <div className="coop-name-field"><span className="coop-name-label">{t("coop.playingAs")}</span><strong>{account.profile.displayName}</strong><small>{t("coop.changeNameHint")}</small></div> : <div className="coop-name-field"><label htmlFor="coop-name">{t("coop.playerNameLabel")}</label><input id="coop-name" className="mode-input" value={playerName} maxLength={18} placeholder={t("coop.namePlaceholder")} onChange={(event) => setPlayerName(event.target.value)} /><small>{t("coop.nameShown")}</small></div>}
            {savedRooms.length > 0 && <div className="saved-rooms"><div className="saved-rooms-heading"><div><p className="eyebrow">{t("coop.yourWorldsCaps")}</p><h3>{t("games.savedMatches")}</h3></div><button className="mode-secondary" onClick={() => void loadSavedRooms()} disabled={roomsLoading}>{roomsLoading ? t("game.loading") : t("game.refresh")}</button></div><div className="saved-room-list">{savedRooms.map((room) => { const otherOnlineCount = room.players.filter((player) => player.occupied && player.role !== room.viewerRole && player.online).length; const otherOnline = otherOnlineCount > 0; const names = occupiedCoopPlayers(room).map((player) => player.name).join(" · "); return <div className={`saved-room-row${otherOnline ? " other-online" : ""}`} key={room.code}><button className="saved-room-main" onClick={() => void reopenSavedRoom(room.code)} disabled={coopBusy}><span className="saved-room-code">{room.code}</span><span className="saved-room-copy"><strong>{room.roomName}</strong><small>{names} · {room.playerCount}/4 Spieler · {room.testMode ? t("game.testModeLower") : t("coop.worldGoals", { goals: formatNumber(room.sharedCoins) })}</small></span><span className={`saved-room-presence${otherOnline ? " online" : ""}`}><i />{otherOnline ? `${otherOnlineCount} ONLINE` : "OFFLINE"}</span><span className="saved-room-open">{t("logic.openArrow")}</span></button>{room.canDelete && <button className="saved-room-delete" onClick={() => void deleteCoopRoom(room.code)} disabled={coopBusy}>{t("game.delete")}</button>}</div>; })}</div><p className="saved-rooms-note">{t("coop.worldsNote")}</p></div>}
          </div> : <div className="coop-room">
            <div className="coop-room-bar"><div><p className="eyebrow">{coopSession.room.roomName} / RAUMCODE</p><strong className="coop-code">{coopSession.code}</strong><span>{coopSession.room.status === "live" ? t("coop.liveConnected", { playerCount: coopSession.room.playerCount }) : t("coop.waitingShare")}</span></div><div className="coop-room-actions"><button className="mode-secondary" onClick={() => void shareInvite()}>{t("coop.invite")}</button><button className="mode-secondary" onClick={() => void copyCoopCode()}>{t("coop.copyCode")}</button>{coopSession.role === "host" && <button className="mode-secondary danger" onClick={() => void deleteCoopRoom(coopSession.code)}>{t("coop.deleteRoom")}</button>}<button className="mode-secondary quiet" onClick={leaveCoopRoom}>{t("game.leave")}</button></div></div>
            <div className="coop-world-tools waiting"><div><p className="eyebrow">{t("coop.worldName")}</p>{coopSession.role === "host" ? <div className="coop-tool-input"><input className="mode-input" value={coopRoomName} maxLength={28} onChange={(event) => setCoopRoomName(event.target.value)} /><button className="mode-secondary" onClick={() => void renameCoopRoom()} disabled={coopBusy}>{t("game.save")}</button></div> : <strong>{coopSession.room.roomName}</strong>}</div></div>
            {coopSession.room.status !== "live" && <div className="coop-waiting-state">
              <div className="coop-waiting-icon"><Icon name="stadium" size={28} /></div>
              <div><p className="eyebrow">{t("games.kickoffPrepared")}</p><h3>{t("coop.waitSecond")}</h3><p>{t("coop.waitSecondBody")}</p></div>
              <div className="coop-players coop-waiting-players">{coopSession.room.players.map((player) => <div className={`coop-player-card${player.role === coopSession.role ? " you" : ""}${player.online ? " online" : ""}${!player.occupied ? " waiting" : ""}`} key={player.role}><span className="coop-player-tag">{player.role === coopSession.role ? t("club.youRole", { role: coopRoleLabel(player.role) }) : coopRoleLabel(player.role)}</span><strong>{player.occupied ? player.name : t("coop.waitingJoin")}</strong><small>{player.occupied ? t("coop.readyKickoff") : t("coop.shareCode")}</small></div>)}</div>
            </div>}
          </div>}
          {coopUpdateRequired && <p className="mode-message" role="status">{MULTIPLAYER_UPDATE_MESSAGE} <button type="button" onClick={reloadForUpdate}>{t("game.reloadNow")}</button></p>}
          {coopMessage && <p className="mode-message" role="status">{localizeText(coopMessage)}</p>}
        </section>
      </main>}

      {displayGame.features.cup.active && displayGame.features.cup.phase === "penalties" && <div ref={penaltyDialogRef} className={`cup-penalty-takeover ${displayGame.features.cup.penaltyTurn}`} role="dialog" aria-modal="true" aria-label={t("shootout.control")}>
        <div className="cup-penalty-panel">
          <div className="cup-penalty-topline"><span>{displayGame.features.cup.mode === "season" ? t("shootout.eyebrow") : t("shootout.cupEyebrow")}</span><b>{cupPenaltyIsSuddenDeath ? "SUDDEN DEATH" : "BEST OF FIVE"}</b></div>
          <div className="cup-penalty-match-score"><span>{t("shootout.after120")}</span><strong>{displayClubName} {displayGame.features.cup.homeScore}:{displayGame.features.cup.awayScore} {displayGame.features.cup.opponent}</strong></div>
          <div className="cup-penalty-scoreboard">
            <div><small>{t("shootout.yourClub")}</small><strong>{displayGame.features.cup.penaltyHomeScore}</strong><div className="cup-penalty-dots">{Array.from({ length: cupPenaltySlotCount }, (_, index) => { const event = cupPenaltyHomeEvents[index]; return <i className={!event ? "pending" : event.outcome === "goal" ? "goal" : "miss"} key={`home-penalty-${index}`}>{!event ? "" : event.outcome === "goal" ? "✓" : "×"}</i>; })}</div></div>
            <em>:</em>
            <div><small>{t("game.opponent")}</small><strong>{displayGame.features.cup.penaltyAwayScore}</strong><div className="cup-penalty-dots">{Array.from({ length: cupPenaltySlotCount }, (_, index) => { const event = cupPenaltyAwayEvents[index]; return <i className={!event ? "pending" : event.outcome === "goal" ? "goal" : "miss"} key={`away-penalty-${index}`}>{!event ? "" : event.outcome === "goal" ? "✓" : "×"}</i>; })}</div></div>
          </div>
          <div className="cup-penalty-prompt"><span>{displayGame.features.cup.penaltyTurn === "home" ? t("shootout.youShoot") : t("shootout.youKeep")}</span><h2>{displayGame.features.cup.penaltyTurn === "home" ? t("shootout.whereShoot") : t("shootout.whereDive")}</h2><p>{displayGame.features.cup.penaltyMessage}</p><small className="cup-penalty-rules">{cupPenaltyIsSuddenDeath ? t("shootout.suddenDeathRule") : t("shootout.rules")} {t("mini.keysHint")}</small></div>
          <div className="cup-penalty-goal" aria-label={t("shootout.chooseDirection")}><div className="cup-penalty-net" aria-hidden="true" />{(["left", "center", "right"] as CupPenaltyDirection[]).map((direction) => <button key={direction} className={direction} onClick={() => void takeCupPenalty(direction)} disabled={coopBusy}><span>{direction === "left" ? "↙" : direction === "right" ? "↘" : "↓"}</span><strong>{direction === "left" ? t("mini.left") : direction === "right" ? t("mini.right") : t("mini.middle")}</strong><small>{displayGame.features.cup.penaltyTurn === "home" ? t("mini.shoot") : t("mini.dive")}</small></button>)}</div>
          <div className="cup-penalty-footer"><span>{coopBusy ? t("shootout.taking") : isCoopLive ? t("shootout.firstInputCounts") : t("shootout.alternate")}</span><b>{displayGame.features.cup.penaltyHomeTaken + displayGame.features.cup.penaltyAwayTaken + 1}. VERSUCH</b></div>
        </div>
      </div>}

      {cupCardAnnouncement && <div className="gc-notification card-notification" role="status"><span>🟥</span><div><strong>{cupCardAnnouncement.minute}′ · {cupCardAnnouncement.player}</strong><p>{cupCardAnnouncement.reason}{t("squad.sentOff")}</p></div></div>}

      {transferAnnouncement && !gazetteAnnouncement && <div ref={transferDialogRef} className={`transfer-insider-takeover ${transferAnnouncement.outcome}`} role="dialog" aria-modal="true" aria-label={t("transfer.announcement", { headline: transferAnnouncement.headline })}><div className="transfer-insider-card"><span className="transfer-insider-kicker">{t("fabrizio.insiderEyebrow")}</span><div className="transfer-insider-reporter"><span aria-hidden="true">FR</span><div><strong>Fabrizio Romario</strong><small>{t("fabrizio.justNow")}</small></div><b>LIVE</b></div><h2>{transferAnnouncement.headline}</h2><p>{transferAnnouncement.message}</p><span className="transfer-insider-result">{transferAnnouncement.outcome === "offer" ? transferAnnouncement.fee > 0 ? t("transfer.offerFee", { fee: formatNumber(transferAnnouncement.fee) }) : t("transfer.wishFree") : transferAnnouncement.outcome === "declined" ? transferDeclinedLabel(transferAnnouncement) : transferAnnouncement.outcome === "sale" ? transferAnnouncement.fee > 0 ? t("transfer.feeCaps", { fee: formatNumber(transferAnnouncement.fee) }) : t("transfer.contractEndFree") : transferAnnouncement.outcome === "loan" ? displayGame.features.cup.mode === "season" && !displayGame.features.seasonMode.hallOfFame ? t("transfer.outNextSeasonMatch") : t("transfer.outNextTournament") : transferAnnouncement.outcome === "return" ? t("transfer.backInTeam") : t("transfer.noTransfer")}</span>{transferAnnouncement.outcome === "offer" && pendingTransferOffer?.id === transferAnnouncement.id ? <TransferOfferActions offer={pendingTransferOffer} features={displayGame.features} now={countdownNow} busy={coopBusy} onAnswer={answerTransferOffer} onLater={dismissTransferAnnouncement} /> : <button className="event-takeover-dismiss" onClick={dismissTransferAnnouncement}>{t("game.continue")}</button>}</div></div>}
      {starReveal && <div ref={starRevealDialogRef} tabIndex={-1} className={`star-reveal${starRevealIsWalkout ? " walkout-active" : ""}${starRevealIsRare ? " rare-active" : ""}`} role="dialog" aria-modal="true" aria-label={starRevealIsCustomDraw ? t("packs.specialDrawn") : t("reveal.packOpened")}>
        <div className={`star-reveal-card${starRevealIsWalkout ? " star-reveal-walkout" : ""}${starWalkoutIsTop ? " star-reveal-top-walkout" : ""}${starRevealIsIconic ? " star-reveal-iconic" : ""}${starRevealIsLegendary ? " star-reveal-legendary" : ""}${starRevealIsRare ? " star-reveal-rare" : ""}`} style={{ borderColor: `${starReveal.player.accent}55` }}>
          {starRevealIsWalkout ? <>
            {/* The tier (86+, 90+, Icon, Legendary) is a spoiler: its label appears only once the walkout is over. */}
            <span className={`star-reveal-walkout-label${starWalkoutReady || starRevealTrollActive ? "" : " pending"}`} aria-hidden={!starWalkoutReady && !starRevealTrollActive}>{starRevealTrollActive ? t("reveal.something") : !starWalkoutReady ? "\u00a0" : starRevealIsLegendary ? t("reveal.legendaryWalkout") : starRevealIsIconic ? t("reveal.iconSilver") : starWalkoutIsTop ? "TOP WALKOUT · 90+" : "WALKOUT · 86+"}</span>
            <span className="star-reveal-kicker">{starRevealTrollActive ? t("reveal.falseTrail") : starRevealIsCustomDraw ? t("reveal.randomDraw") : t("reveal.packStadium", { packName: dataText(starReveal.packName) })}</span>
            {starRevealTrollActive ? <div className="star-pack-troll-stage" aria-live="assertive"><div className="star-pack-troll-mascot" aria-hidden="true"><i className="mascot-ear left" /><i className="mascot-ear right" /><span>GC</span><b>⚽</b></div><strong>{t("reveal.mascot")}</strong><small>{t("reveal.fakeWalkout")}</small></div> : <div className="star-walkout-stage" aria-live="assertive" style={starWalkoutStyle}>
              <div className="star-walkout-pyro" aria-hidden="true">{Array.from({ length: starWalkoutIsTop ? 17 : 11 }, (_, index) => <i key={index} style={{ "--pyro-index": index } as CSSProperties} />)}</div>
              <div className="star-walkout-confetti" aria-hidden="true">{GOAL_CONFETTI.map((particle, index) => <i key={index} style={{ left: particle.left, animationDelay: `calc(${900 + index * 28}ms + var(--walkout-delay, 0ms))`, animationDuration: particle.duration, background: starWalkoutConfetti ? starWalkoutConfetti[index % starWalkoutConfetti.length] : particle.color }} />)}</div>
              {starWalkoutPresentation && <>
                <div className="star-walkout-country"><WalkoutCountryFlag code={starWalkoutPresentation.countryCode} country={starWalkoutPresentation.country} /><strong>{starWalkoutPresentation.country}</strong><small>{starWalkoutPresentation.countryCode}</small></div>
                <div className="star-walkout-rating-panel"><StarXIPositionBadges player={starReveal.player} variant="walkout" /><strong>{starReveal.player.rating}</strong><em>{starRevealIsLegendary ? t("reveal.legendaryCard") : starRevealIsIconic ? t("reveal.iconCard") : t("reveal.walkoutCard")}</em></div>
                <WalkoutAvatar presentation={starWalkoutPresentation} rating={starReveal.player.rating} label={t("reveal.fullBody", { name: starReveal.player.name })} onAnimationEnd={finishStarWalkout} />
                <div className="star-walkout-nameplate"><span><WalkoutCountryFlag compact code={starWalkoutPresentation.countryCode} country={starWalkoutPresentation.country} /> {starWalkoutPresentation.countryCode} · {formatStarXIPositions(starReveal.player)}</span><h2>{starReveal.player.name}</h2></div>
              </>}
            </div>}
            <p className={`star-walkout-copy${starWalkoutReady ? " ready" : ""}`}>{starRevealTrollActive ? t("reveal.trolled") : !starWalkoutReady ? "\u00a0" : `${isCoopLive ? t(starRevealIsCustomDraw ? "reveal.openedByDrew" : "reveal.openedByOpened", { name: starReveal.openedBy }) : ""}${starReveal.duplicate ? t("reveal.duplicateBody", { fragments: formatNumber(starReveal.fragmentCompensation) }) : t("reveal.walkoutBody", { positions: formatStarXIPositions(starReveal.player), rating: starReveal.player.rating })}`}</p>
            <span className={`star-reveal-status star-walkout-status${starWalkoutReady ? " ready" : ""}`}>{starRevealTrollActive ? t("reveal.packTroll") : starWalkoutReady ? starReveal.duplicate ? t("reveal.duplicate") : starRevealIsLegendary ? t("reveal.legendaryStar") : starRevealIsIconic ? t("reveal.iconStar") : t("reveal.walkoutStar") : t("reveal.walkoutRunning")}</span>
            {starWalkoutReady && !starRevealTrollActive && revealLineupButton}
            <button className={`event-takeover-dismiss star-walkout-dismiss${starWalkoutReady ? " ready" : ""}`} disabled={!starWalkoutReady} onClick={dismissStarReveal}>{starRevealTrollActive ? t("reveal.mascotRunning") : starWalkoutReady ? revealContinueLabel : t("reveal.walkoutRunningShort")}</button>
          </> : starRevealIsRare ? <>
            <span className={`star-reveal-walkout-label${starWalkoutReady ? "" : " pending"}`} aria-hidden={!starWalkoutReady}>{starWalkoutReady ? t("reveal.rare8085") : "\u00a0"}</span>
            <span className="star-reveal-kicker">{starRevealKicker}</span>
            <div className="star-rare-stage" style={starWalkoutStyle} aria-live="assertive">
              <div className="star-rare-sparkles" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 96}%`, top: `${8 + (index * 23) % 78}%`, animationDelay: `calc(${index * 70}ms + var(--rare-delay, 0ms))` }} />)}</div>
              <div className="star-rare-card"><StarXIPositionBadges player={starReveal.player} variant="rare" /><strong>{starReveal.player.rating}</strong><small>{t("packs.rare")}</small><h2>{starReveal.player.name}</h2></div>
            </div>
            <p className={`star-walkout-copy${starWalkoutReady ? " ready" : ""}`}>{!starWalkoutReady ? "\u00a0" : `${isCoopLive ? `${starReveal.openedBy} hat ${starRevealAction}. ` : ""}${starReveal.duplicate ? `Doppelt gezogen. Du bekommst automatisch ${formatNumber(starReveal.fragmentCompensation)} Fragmente für Custom-Karten.` : `${formatStarXIPositions(starReveal.player)} · Rating ${starReveal.player.rating}. Seltene Karte für deinen Club.`}`}</p>
            <span className={`star-reveal-status star-walkout-status${starWalkoutReady ? " ready" : ""}`}>{starWalkoutReady ? starReveal.duplicate ? t("reveal.duplicate") : t("reveal.rareStar") : t("reveal.rare")}</span>
            {starWalkoutReady && !starRevealTrollActive && revealLineupButton}
            <button className={`event-takeover-dismiss star-walkout-dismiss${starWalkoutReady ? " ready" : ""}`} disabled={!starWalkoutReady} onClick={dismissStarReveal}>{starWalkoutReady ? revealContinueLabel : t("reveal.revealing")}</button>
          </> : <>
            <span className="star-reveal-kicker">{starRevealKicker}</span>
            <div className="star-reveal-player"><StarXIPositionBadges player={starReveal.player} /><strong>{starReveal.player.rating}</strong></div>
            <h2>{starReveal.player.name}</h2>
            <p>{`${isCoopLive ? `${starReveal.openedBy} hat ${starRevealAction}. ` : ""}${starReveal.duplicate ? `Doppelt gezogen. Du bekommst automatisch ${formatNumber(starReveal.fragmentCompensation)} Fragmente für Custom-Karten.` : `${formatStarXIPositions(starReveal.player)} · Rating ${starReveal.player.rating}. Der Spieler wird nur auf passenden Positionen eingesetzt.`}`}</p>
            <span className="star-reveal-status">{starReveal.duplicate ? t("reveal.duplicate") : starReveal.player.rating <= 70 ? t("reveal.common") : t("reveal.pro")}</span>
            {revealLineupButton}
            <button className="event-takeover-dismiss" onClick={dismissStarReveal}>{revealContinueLabel}</button>
          </>}
        </div>
      </div>}
      {eventAnnouncement && <div key={`${eventAnnouncement.id}:${eventAnnouncement.createdAt}`} className={`gc-notification ${eventAnnouncement.tone}`} role="status" aria-live="polite"><span aria-hidden="true">{eventAnnouncement.id==='var'?'📺':eventAnnouncement.tone==='negative'?'⚠️':'🏟️'}</span><div><strong>{eventAnnouncement.title}</strong><p>{eventAnnouncement.message}</p><small>{eventAnnouncement.amount<0?t("event.minusGoals", { amount: formatNumber(Math.abs(eventAnnouncement.amount)) }):eventAnnouncement.amount>0?t("event.plusGoals", { amount: formatNumber(eventAnnouncement.amount) }):t("event.noChange")}</small></div></div>}
      {offline && <div className="offline-banner" role="alert"><span className="offline-mark">Ⅱ</span><p>{localizeText(offline)}</p>{offline === SAVE_FAILED_MESSAGE && <button type="button" className="mode-secondary" style={{ minHeight: 44, flexShrink: 0, color: "var(--text)", fontSize: "var(--text-caption2)" }} onClick={() => showToast(exportCurrentSave(gameRef.current) ? t("club.saveFileDone") : t("game.saveFileFailed"))}>{t("club.saveAsFile")}</button>}{offline === NEWER_VERSION_MESSAGE && <button type="button" className="mode-secondary" style={{ minHeight: 44, flexShrink: 0, color: "var(--text)", fontSize: "var(--text-caption2)" }} onClick={() => window.location.reload()}>{t("game.reload")}</button>}<button type="button" style={{ minWidth: 44, minHeight: 44 }} onClick={() => setOffline("")} aria-label={t("game.closeHint")}>×</button></div>}
      <footer className="footer-note">Made by xevihans</footer>
      {toast && <div className="toast" aria-hidden="true">{toast}</div>}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srAnnouncement}</div>
    </div>
  );
}
