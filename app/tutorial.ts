// The tutorial for a brand new club: a short welcome window, then guided tasks that tick off by themselves.
// Its progress lives in a synced browser key, so it travels with the account's cloud save like "Was ist neu".
import { STAR_XI_SQUAD_SIZE, STARTER_SQUAD_UNLOCK_CLICKS, type GameFeatures } from "./feature-data";
import type { RoutedTab } from "./tab-routes";

export type TutorialStatus = "intro" | "active" | "done";
export type TutorialState = { status: TutorialStatus; done: string[]; visited: string[] };
export type TutorialGame = { clicks: number; upgrades: Record<string, number>; features: Pick<GameFeatures, "cup" | "seasonMode" | "squadLock" | "welcomePack" | "starXI"> };
/** Where "Zeig es mir" leads: a tab, or the ball and the upgrade shop on the home screen. */
export type TutorialTarget = RoutedTab | "ball" | "shop";
export type TutorialStep = { id: string; title: string; text: string; target: TutorialTarget; progress?: (game: TutorialGame) => { value: number; goal: number }; isDone: (game: TutorialGame, visited: readonly string[], done: readonly string[]) => boolean };

export const TUTORIAL_INTRO_PAGES: readonly { title: string; text: string }[] = [
  { title: "Willkommen im Club", text: "Du bist Präsident, Trainer und grösster Fan in einem. Aus einem kleinen Verein baust du Schritt für Schritt einen Weltklub." },
  { title: "Tore verdienen", text: "Jeder Klick auf den Ball bringt Tore. Klickst du schnell hintereinander, steigt deine Combo. Mit den Toren kaufst du Verstärkungen, die pro Klick und pro Sekunde mehr bringen." },
  { title: "Dein Kader", text: "Nach den ersten 50 Klicks bekommst du einen Starterkader. Im Reiter Kader stellst du deine Elf auf, wählst die Formation und tauschst Spieler." },
  { title: "Spiele und Saison", text: "Unter Spiele reist deine Mannschaft zur nächsten Partie. Siege bringen Punkte in der Tabelle, und am Saisonende winkt der Aufstieg in die nächste Liga." },
  { title: "Packs und Album", text: "In Packs findest du neue Spieler. Bessere Packs öffnen sich mit höheren Ligen, und im Sammelalbum siehst du, wen du schon hast." },
];

/** A match counts as started at kick off: the first league match has no season history yet while it runs. */
export function hasStartedMatch(features: Pick<TutorialGame["features"], "cup" | "seasonMode" | "squadLock">) {
  const { cup, seasonMode } = features;
  const runningSeasonMatch = cup.active && cup.mode === "season" && cup.matchStartedAt > 0;
  return runningSeasonMatch || Boolean(features.squadLock) || cup.active || (seasonMode.history?.length ?? 0) > 0 || seasonMode.lastMatchAt > 0;
}

/** The last tutorial step: a regular season match was kicked off (a tournament, the Spiele tab alone or a journey do not count). */
export function hasStartedSeasonMatch(features: Pick<TutorialGame["features"], "cup" | "seasonMode">) {
  const { cup, seasonMode } = features;
  return (cup.active && cup.mode === "season" && cup.matchStartedAt > 0) || (seasonMode.history?.length ?? 0) > 0 || seasonMode.lastMatchAt > 0;
}

/** The welcome pack step is over once the pack was opened, or when there is no pack to wait for (a repeated tutorial, older clubs). */
export const welcomePackStepDone = (features: Pick<TutorialGame["features"], "welcomePack">) => features.welcomePack !== "pending" && features.welcomePack !== "available";

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: "clicks", title: "Klicke auf den Ball", text: `Erziele mit ${STARTER_SQUAD_UNLOCK_CLICKS} Klicks deine ersten Tore. Danach kommt dein Starterkader.`, target: "ball", progress: (game) => ({ value: Math.min(game.clicks, STARTER_SQUAD_UNLOCK_CLICKS), goal: STARTER_SQUAD_UNLOCK_CLICKS }), isDone: (game) => game.clicks >= STARTER_SQUAD_UNLOCK_CLICKS },
  { id: "upgrade", title: "Kaufe eine Verstärkung", text: "Unter Verstärkungen gibst du Tore für mehr Tore pro Klick oder pro Sekunde aus.", target: "shop", isDone: (game) => Object.values(game.upgrades).some((level) => level > 0) },
  { id: "lineup", title: "Stelle deine Startelf auf", text: `Dein Starterkader wartet im Reiter Kader. Tippe einen Startplatz an und dann eine passende Karte, bis alle ${STAR_XI_SQUAD_SIZE} Plätze besetzt sind.`, target: "squad", progress: (game) => ({ value: Math.min(game.features.starXI.lineupIds.filter(Boolean).length, STAR_XI_SQUAD_SIZE), goal: STAR_XI_SQUAD_SIZE }), isDone: (game) => game.features.starXI.lineupIds.filter(Boolean).length >= STAR_XI_SQUAD_SIZE },
  { id: "packs", title: "Öffne dein Willkommenspack", text: "Im Packshop wartet ein Geschenk auf dich: Öffne das Willkommenspack und erlebe deinen ersten Walkout.", target: "packs", isDone: (game, _visited, done) => done.includes("lineup") && welcomePackStepDone(game.features) },
  { id: "match", title: "Starte deine erste Saisonpartie", text: "Unter Spiele reist deine Mannschaft los. Starte die Saisonpartie: Siege bringen Punkte, nach 10 Spieltagen steigst du als Erster oder Zweiter auf.", target: "cup", isDone: (game, _visited, done) => done.includes("packs") && hasStartedSeasonMatch(game.features) },
];

/**
 * The tabs a step needs. While the tutorial runs, the navigation offers only these (plus Home); everything else belongs to
 * a later step, so nobody wanders off the guided path. Ending the tutorial always lifts the lock.
 */
const STEP_TABS: Record<string, readonly RoutedTab[]> = {
  clicks: ["home"],
  upgrade: ["home"],
  lineup: ["home", "squad"],
  packs: ["home", "packs"],
  match: ["home", "squad", "cup"],
};
export function tutorialAllowedTabs(state: TutorialState): readonly RoutedTab[] | null {
  if (state.status !== "active") return null;
  const step = currentTutorialStep(state);
  return step ? STEP_TABS[step.id] ?? ["home"] : null;
}
/** The tab (or "home" for the ball and the shop) a step wants the player on. */
export const tutorialStepTab = (step: TutorialStep): RoutedTab => step.target === "ball" || step.target === "shop" ? "home" : step.target;

const STEP_IDS = new Set(TUTORIAL_STEPS.map((step) => step.id));
const VISIT_TABS = new Set<string>(["squad", "packs"]);

export const newTutorial = (): TutorialState => ({ status: "intro", done: [], visited: [] });
export const finishedTutorial = (): TutorialState => ({ status: "done", done: [], visited: [] });

/** Unknown, empty or broken values count as finished, so a damaged key never shows the tutorial again. */
export function parseTutorialState(raw: string | null | undefined): TutorialState {
  if (!raw) return finishedTutorial();
  try {
    const value = JSON.parse(raw) as Partial<TutorialState> | null;
    if (!value || typeof value !== "object" || !["intro", "active", "done"].includes(value.status as string)) return finishedTutorial();
    const ids = (list: unknown, allowed: Set<string>) => Array.isArray(list) ? [...new Set(list.filter((id): id is string => typeof id === "string" && allowed.has(id)))] : [];
    return { status: value.status as TutorialStatus, done: ids(value.done, STEP_IDS), visited: ids(value.visited, VISIT_TABS) };
  } catch {
    return finishedTutorial();
  }
}

export const serializeTutorialState = (state: TutorialState) => JSON.stringify(state);

/** The first step still open, or null when every step is done. */
export function currentTutorialStep(state: TutorialState) {
  return TUTORIAL_STEPS.find((step) => !state.done.includes(step.id)) ?? null;
}

/** Ticks off every step the game has reached; a step once done stays done. Returns the same object when nothing changed. */
export function advanceTutorial(state: TutorialState, game: TutorialGame, openTab?: string): TutorialState {
  if (state.status === "done") return state;
  const visited = openTab && VISIT_TABS.has(openTab) && !state.visited.includes(openTab) ? [...state.visited, openTab] : state.visited;
  // In order: a step may depend on the ones before it (the season match counts only after the welcome pack).
  const doneNow = [...state.done], newlyDone: string[] = [];
  for (const step of TUTORIAL_STEPS) if (!doneNow.includes(step.id) && step.isDone(game, visited, doneNow)) { doneNow.push(step.id); newlyDone.push(step.id); }
  const done = newlyDone.length ? doneNow : state.done;
  const finished = state.status === "active" && TUTORIAL_STEPS.every((step) => done.includes(step.id));
  if (!newlyDone.length && visited === state.visited && !finished) return state;
  return { status: finished ? "done" : state.status, done, visited };
}
