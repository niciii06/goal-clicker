"use client";
// The start error screen. Its own module, so the page shell can show it without loading the game (audit P13).
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { COOP_ROOM_KEY } from "./constants";

export class GameErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : "Unbekannter Startfehler" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Goal Clicker konnte den Spielstand nicht darstellen.", error, info);
  }

  private reload = () => window.location.reload();

  private returnToSingleplayer = () => {
    localStorage.removeItem(COOP_ROOM_KEY);
    window.location.reload();
  };

  private repair = () => {
    if (!window.confirm("Wirklich alle lokalen Goal-Clicker-Daten löschen und komplett neu starten?")) return;
    for (const key of Object.keys(localStorage)) if (key.startsWith("goalClicker")) localStorage.removeItem(key);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="game-recovery"><section><span className="eyebrow">GOAL CLICKER / WIEDERHERSTELLUNG</span><h1>Das Spiel konnte nicht gestartet werden.</h1><p>Dein gespeicherter Spielstand bleibt erhalten. Lade zuerst nochmals oder wechsle zum Singleplayer. Löschen passiert nur noch nach deiner ausdrücklichen Bestätigung.</p><small className="game-recovery-code">Fehler: {this.state.message}</small><div><button type="button" className="mode-secondary" onClick={this.reload}>Nochmals laden</button><button type="button" className="mode-secondary" onClick={this.returnToSingleplayer}>Zum Singleplayer</button><button type="button" className="mode-primary" onClick={this.repair}>Komplett neu starten</button></div></section></main>;
  }
}
