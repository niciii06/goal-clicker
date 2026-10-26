// Small presentational components and icons of the game page.
import type { ErrorInfo, ReactNode } from "react";
import type { IconName, StarXIPositionBadgeVariant } from "./types";
import { COOP_ROOM_KEY } from "./constants";
import { Component } from "react";
import { getStarXIPositions } from "../feature-data";

export function StarXIPositionBadges({ player, variant = "reveal" }: { player: Parameters<typeof getStarXIPositions>[0]; variant?: StarXIPositionBadgeVariant }) {
  if(player.benchOnly)return <span className="starxi-position-badge">{player.symbol} Nur Bank</span>;
  const positions = player.id === "star-goat-nicu" ? ["Alle Positionen"] : getStarXIPositions(player);
  return <span className={`starxi-position-badges starxi-position-badges-${variant}`} aria-label={`Positionen: ${positions.join(", ")}`}>
    {positions.map((position) => <span key={position}>{position === "Alle Positionen" ? "ALLE POSITIONEN" : position}</span>)}
  </span>;
}

export function iconPaths(name: IconName): ReactNode {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "ball": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="m12 8 2.4 1.7-.9 2.8H10.5l-.9-2.8L12 8Zm0 0L10.7 5.7m3.7 4 3.1-.9m-4.1 3.7 1.7 2.8m-4.6-2.8-1.7 2.8m.8-5.7-3-.9" {...stroke} /></>;
    case "boot": return <path d="M5 15.5c2 .8 3.7 1.4 5.1 1.9 2.5.8 4.3.7 5.8 0l2.1-1c.8-.4 1.7 0 1.9.8l.2.9c.2.8-.3 1.6-1.1 1.8-3.7 1-7.3.8-10.7-.4l-3.4-1.2c-.7-.3-1.1-1-.8-1.7l.2-.5c.1-.4.4-.6.7-.6Z M9.4 5.2 13 7l.8 4.2-3.5 2.8-4-1.8 1.8-4.7 1.3-2.3Z" {...stroke} />;
    case "worker": return <><circle cx="12" cy="7.5" r="2.8" {...stroke} /><path d="M6.5 19c.3-3.2 2.2-5 5.5-5s5.2 1.8 5.5 5M4.5 11.5h15" {...stroke} /></>;
    case "striker": return <path d="M13.4 2.9 5.7 13h5.2L10.2 21l8.1-11.1h-5.3l.4-7Z" {...stroke} />;
    case "board": return <><rect x="4" y="4" width="16" height="14" rx="1.5" {...stroke} /><path d="M8 8h8M8 12h5M8 16h8M9 18v3m6-3v3" {...stroke} /></>;
    case "light": return <><path d="M9 18h6M9.8 21h4.4M8 14.5c-1.2-1-2-2.5-2-4.2a6 6 0 1 1 12 0c0 1.7-.8 3.2-2 4.2-.7.6-1 1.1-1 1.8H9c0-.7-.3-1.2-1-1.8Z" {...stroke} /><path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4" {...stroke} /></>;
    case "screen": return <><rect x="3" y="5" width="18" height="12" rx="2" {...stroke} /><path d="M8 21h8M12 17v4M7 9h10M7 12h5" {...stroke} /></>;
    case "crown": return <path d="m4 7 4 3 4-6 4 6 4-3-2 12H6L4 7Z M6 22h12" {...stroke} />;
    case "number": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M10 9.5c.7-.7 2.6-.7 3.1.3.5 1-.2 1.8-1.3 2.3-1.1.5-2 1.2-2 2.4 0 1.2 1 1.8 2.2 1.8.9 0 1.6-.3 2.1-.9" {...stroke} /></>;
    case "flame": return <path d="M12.1 21c3.6 0 6-2.1 6-5.2 0-2.1-1.1-3.7-2.8-5.1.2 1.7-.6 2.6-1.5 3.2.2-3.6-1.8-6.1-4.7-8.2.2 2.8-.4 4.7-1.8 6.2-1.1 1.2-1.8 2.4-1.8 4 0 3 2.5 5.1 6.6 5.1Z" {...stroke} />;
    case "stadium": return <><path d="M3 20V8l9-4 9 4v12M3 20h18M7 20v-7h10v7M9 13V9m3 4V8m3 5V9" {...stroke} /></>;
    case "diamond": return <path d="m12 3 7 6-7 12L5 9l7-6Z M5 9h14M9 9l3 12 3-12" {...stroke} />;
    case "rookie": return <><path d="M5 21v-9l7-3 7 3v9M8 21v-5h8v5M3 21h18" {...stroke} /><path d="M9 9V5h6v4" {...stroke} /></>;
    case "starter": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M12 7v5l3 2" {...stroke} /></>;
    case "scorer": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="m12 6 1.8 3.7 4.2.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.2-.6L12 6Z" {...stroke} /></>;
    case "star": return <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z" {...stroke} />;
    case "rocket": return <><path d="M14.5 5.2c2.2-.8 4-.7 4.5-.2.5.5.6 2.3-.2 4.5-.9 2.5-2.6 4.8-4.6 6.8l-3.5-3.5c2-2 3.3-4.9 3.8-7.6Z" {...stroke} /><path d="m10.7 12.8-3.5 1.1-1.1 3.5 3.5-1.1 1.1-3.5ZM7.2 7.5 5 5.3M8.3 18.1l-2.4 2.4M5 12H2.5" {...stroke} /><circle cx="15.7" cy="8.3" r="1.2" {...stroke} /></>;
    case "sound": return <><path d="M4 10v4h3l4 3V7L7 10H4Z" {...stroke} /><path d="M15 9.5c1.4 1.3 1.4 3.7 0 5M17.5 7.3c2.5 2.4 2.5 7 0 9.4" {...stroke} /></>;
    case "mute": return <><path d="M4 10v4h3l4 3V7L7 10H4Z" {...stroke} /><path d="m16 10 4 4m0-4-4 4" {...stroke} /></>;
    case "broadcast": return <><circle cx="12" cy="12" r="2" {...stroke} /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" {...stroke} /></>;
    case "home": return <path d="M4 11.2 12 4.5l8 6.7M6.5 9.4V19.5h4v-5h3v5h4V9.4" {...stroke} />;
    case "trophy": return <path d="M8 4.5h8v5a4 4 0 0 1-8 0v-5ZM8 6.5H5v1.2A3.3 3.3 0 0 0 8.3 11M16 6.5h3v1.2a3.3 3.3 0 0 1-3.3 3.3M12 13.5v3.5M8.5 20h7M9.5 20l.5-3h4l.5 3" {...stroke} />;
    case "squad": return <><circle cx="9" cy="8.5" r="3" {...stroke} /><path d="M3.5 19c.4-3.3 2.3-5.2 5.5-5.2s5.1 1.9 5.5 5.2" {...stroke} /><path d="M15.5 5.8a3 3 0 0 1 0 5.6M17.3 14.2c1.9.6 3 2.2 3.2 4.8" {...stroke} /></>;
    case "career": return <path d="M4 19.5h16M6.5 16v-4M10.5 16V9M14.5 16v-3M18.5 16V6.5M6.5 8.5l4-3.5 4 3 4-3.5" {...stroke} />;
    case "cards": return <><rect x="8" y="3.5" width="11" height="15" rx="2" {...stroke} /><path d="M5.5 6.8 5 7a2 2 0 0 0-1.2 2.5l3 9.5a2 2 0 0 0 2.5 1.3l4.2-1.3" {...stroke} /></>;
    case "shield": return <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.5 7 9 4.1-1.5 7-4.8 7-9V6l-7-2.5ZM9 12l2 2 4-4" {...stroke} />;
    case "bell": return <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.5a2.2 2.2 0 0 0 4 0" {...stroke} />;
    case "vibrate": return <><rect x="8" y="4" width="8" height="16" rx="2" {...stroke} /><path d="M5 8.5v7M3 10.5v3M19 8.5v7M21 10.5v3" {...stroke} /></>;
    case "grip": return <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" {...stroke} strokeWidth={3} />;
    default: return <circle cx="12" cy="12" r="8" {...stroke} />;
  }
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="svg-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">{iconPaths(name)}</svg>;
}

export function FootballGraphic() {
  return <svg viewBox="0 0 100 100" className="hero-football" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="#f3f5ef"/><path d="M50 30 63 39l-5 15H42l-5-15 13-9Z" fill="#101918"/><path d="m50 30-6-12M63 39l16-5M58 54l9 15M42 54l-9 15M37 39 21 34" stroke="#101918" strokeWidth="4" strokeLinecap="round"/><circle cx="50" cy="50" r="43" fill="none" stroke="#b6c2b9" strokeWidth="2"/></svg>;
}

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
