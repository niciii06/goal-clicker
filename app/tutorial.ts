// The tutorial for a brand new club: a short welcome window, then guided tasks that tick off by themselves.
// Its progress lives in a synced browser key, so it travels with the account's cloud save like "Was ist neu".
import { STARTER_SQUAD_UNLOCK_CLICKS, type GameFeatures } from "./feature-data";
import type { RoutedTab } from "./tab-routes";

export type TutorialStatus = "intro" | "active" | "done";
export type TutorialState = { status: TutorialStatus; done: string[]; visited: string[] };
export type TutorialGame = { clicks: number; upgrades: Record<string, number>; features: Pick<GameFeatures, "cup" | "seasonMode" | "squadLock"> };
/** Where "Zeig es mir" leads: a tab, or the ball and the upgrade shop on the home screen. */
export type TutorialTarget = RoutedTab | "ball" | "shop";
export type TutorialStep = { id: string; title: string; text: string; target: TutorialTarget; progress?: (game: TutorialGame) => { value: number; goal: number }; isDone: (game: TutorialGame, visited: readonly string[]) => boolean };

export const TUTORIAL_INTRO_PAGES: readonly { title: string; text: string }[] = [
  { title: "Willkommen im Club", text: "Du bist Präsident, Trainer und grösster Fan in einem. Aus einem kleinen Verein baust du Schritt für Schritt einen Weltklub." },
  { title: "Tore verdienen", text: "Jeder Klick auf den Ball bringt Tore. Klickst du schnell hintereinander, steigt deine Combo. Mit den Toren kaufst du Verstärkungen, die pro Klick und pro Sekunde mehr bringen." },
  { title: "Dein Kader", text: "Nach den ersten 50 Klicks bekommst du einen Starterkader. Im Reiter Kader stellst du deine Elf auf, wählst die Formation und tauschst Spieler." },
  { title: "Spiele und Saison", text: "Unter Spiele reist deine Mannschaft zur nächsten Partie. Siege bringen Punkte in der Tabelle, und am Saisonende winkt der Aufstieg in die nächste Liga." },
  { title: "Packs und Album", text: "In Packs findest du neue Spieler. Bessere Packs öffnen sich mit höheren Ligen, und im Sammelalbum siehst du, wen du schon hast." },
];

/** A match counts as started at kick off: the first league match has no season history yet while it runs. */
export function hasStartedMatch(features: TutorialGame["features"]) {
  const { cup, seasonMode } = features;
  const runningSeasonMatch = cup.active && cup.mode === "season" && cup.matchStartedAt > 0;
  return runningSeasonMatch || Boolean(features.squadLock) || cup.active || (seasonMode.history?.length ?? 0) > 0 || seasonMode.lastMatchAt > 0;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: "clicks", title: "Klicke auf den Ball", text: `Erziele mit ${STARTER_SQUAD_UNLOCK_CLICKS} Klicks deine ersten Tore. Danach kommt dein Starterkader.`, target: "ball", progress: (game) => ({ value: Math.min(game.clicks, STARTER_SQUAD_UNLOCK_CLICKS), goal: STARTER_SQUAD_UNLOCK_CLICKS }), isDone: (game) => game.clicks >= STARTER_SQUAD_UNLOCK_CLICKS },
  { id: "upgrade", title: "Kaufe eine Verstärkung", text: "Unter Verstärkungen gibst du Tore für mehr Tore pro Klick oder pro Sekunde aus.", target: "shop", isDone: (game) => Object.values(game.upgrades).some((level) => level > 0) },
  { id: "squad", title: "Schau dir deinen Kader an", text: "Im Reiter Kader siehst du deine Elf und kannst Spieler tauschen.", target: "squad", isDone: (_game, visited) => visited.includes("squad") },
  { id: "match", title: "Starte deine erste Partie", text: "Unter Spiele reist deine Mannschaft los. Nach der Ankunft wird angepfiffen.", target: "cup", isDone: (game) => hasStartedMatch(game.features) },
  { id: "packs", title: "Öffne den Packshop", text: "Im Packshop findest du neue Spieler für deinen Kader.", target: "packs", isDone: (_game, visited) => visited.includes("packs") },
];

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
  const newlyDone = TUTORIAL_STEPS.filter((step) => !state.done.includes(step.id) && step.isDone(game, visited)).map((step) => step.id);
  const done = newlyDone.length ? [...state.done, ...newlyDone] : state.done;
  const finished = state.status === "active" && TUTORIAL_STEPS.every((step) => done.includes(step.id));
  if (!newlyDone.length && visited === state.visited && !finished) return state;
  return { status: finished ? "done" : state.status, done, visited };
}
