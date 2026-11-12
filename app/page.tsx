"use client";

export const dynamic = "force-dynamic";

// The page shell (audit P13): the game with its logic and all card data (app/game-app.tsx, about 2 MB of
// JavaScript) is its own chunk. The browser starts loading it at once, while the account check runs, and the
// login screen does not wait for it. Server rendering still renders the game for a page without login.
import { lazy, Suspense } from "react";
import { AccountGate } from "./account-gate";
import { GameErrorBoundary } from "./game/error-boundary";

const loadGame = () => import("./game-app").then((module) => ({ default: module.App }));
const GameApp = lazy(loadGame);
if (typeof window !== "undefined") void loadGame();

/** Shown only while the game chunk is still loading: the brand of the account screen, without any text of its own. */
function GameLoading() {
  return <main className="account-screen" aria-busy="true">
    <section className="account-card">
      <div className="account-brand"><span className="account-brand-ball" aria-hidden="true">⚽</span><div><p className="eyebrow">FOOTBALL IDLE CLUB</p><strong>Goal Clicker</strong></div></div>
    </section>
  </main>;
}

export default function Home() { return <GameErrorBoundary><AccountGate><Suspense fallback={<GameLoading />}><GameApp /></Suspense></AccountGate></GameErrorBoundary>; }
