"use client";
// The signed in account in the game: the account button in the header with the profile settings, the link
// between account and player ID, and the save file export/import in the club tab.
import { useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import { AccountContext, GuestContext } from "./account-gate";
import { useDialogFocus } from "./confirm-dialog";
import { authErrorMessage, linkGoogleAccount, linkedGoogleEmail, setAccountPassword } from "./auth/browser";
import { subscribeSyncStatus } from "./cloud-sync";
import type { SyncStatus } from "./cloud-sync";
import { getInstallState, promptInstall, subscribeInstallState } from "./pwa";
import type { InstallState } from "./pwa";
import { DISPLAY_NAME_MAX, displayNameError, PASSWORD_MAX, PASSWORD_MIN, passwordError, USERNAME_MAX, usernameError } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";
import { readThemePreference, setThemePreference, THEME_OPTIONS } from "./theme";
import type { ThemePreference } from "./theme";

/** What the return from linking Google (?google=...) tells the player. */
const GOOGLE_LINK_MESSAGES: Record<string, string> = {
  verknuepft: "Google ist jetzt mit deinem Konto verknüpft. Du kannst dich ab sofort auch mit Google anmelden.",
  vergeben: "Dieses Google Konto gehört schon zu einem anderen Spielerkonto.",
  abgebrochen: "Die Verknüpfung mit Google wurde abgebrochen.",
  fehler: "Die Verknüpfung mit Google hat nicht geklappt. Bitte versuche es nochmal.",
  "nicht-konfiguriert": "Der Login ist auf diesem Server noch nicht eingerichtet.",
};

const SYNC_LABELS: Record<SyncStatus, string> = { saved: "Gespeichert", saving: "Speichert …", offline: "Offline, wird später gespeichert", failed: "Nicht gespeichert, der Browser Speicher ist voll" };

async function linkAccount(playerId: string) {
  const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId }) });
  const data = await response.json() as { playerId?: string; email?: string | null; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Das Konto konnte nicht geladen werden.");
  return data;
}

function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>("saved");
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}

/**
 * Links the signed in account with this browser's player ID; it shows nothing. The account's player ID becomes
 * this browser's player ID, so every device of the account sees the same worlds.
 */
export function AccountLink({ playerId, onPlayerId, onMessage }: { playerId: string; onPlayerId: (id: string) => void; onMessage: (text: string) => void }) {
  const account = useContext(AccountContext);
  const linked = useRef("");

  useEffect(() => {
    if (!account || !playerId || linked.current === playerId) return;
    linked.current = playerId;
    void linkAccount(playerId).then((data) => {
      if (data.playerId && data.playerId !== playerId) {
        linked.current = data.playerId;
        onPlayerId(data.playerId);
      }
    }).catch((error: Error) => {
      linked.current = "";
      onMessage(error.message);
    });
  }, [account, playerId, onPlayerId, onMessage]);

  return null;
}

async function patchProfile(body: { displayName?: string; username?: string }) {
  const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({})) as { profile?: PublicProfile; error?: string };
  if (!response.ok || !data.profile) throw new Error(data.error ?? "Das Profil konnte nicht gespeichert werden.");
  return data.profile;
}

/** Profile settings: display name, username (every 30 days), password of username accounts and deleting the profile. */
export function ProfilePanel({ onMessage }: { onMessage: (text: string) => void }) {
  const account = useContext(AccountContext);
  const status = useSyncStatus();
  const [displayName, setDisplayName] = useState(account?.profile.displayName ?? "");
  const [username, setUsername] = useState(account?.profile.username ?? "");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // Username accounts can add Google as a second way in: undefined while loading, null without Google.
  const [googleEmail, setGoogleEmail] = useState<string | null | undefined>(undefined);
  const passwordLogin = Boolean(account?.passwordLogin);
  useEffect(() => {
    if (!passwordLogin) return;
    let cancelled = false;
    linkedGoogleEmail().then((email) => { if (!cancelled) setGoogleEmail(email); }, () => { if (!cancelled) setGoogleEmail(null); });
    return () => { cancelled = true; };
  }, [passwordLogin]);
  const nextUsernameChangeAt = account ? new Date(account.profile.nextUsernameChangeAt).getTime() : 0;
  // The lock ends while the dialog may still be open; re-render once it does.
  useEffect(() => {
    const wait = nextUsernameChangeAt - Date.now();
    if (!Number.isFinite(wait) || wait <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(wait + 50, 2 ** 31 - 1));
    return () => window.clearTimeout(timer);
  }, [nextUsernameChangeAt, now]);
  if (!account) return null;
  const { profile } = account;
  const nextChange = new Date(profile.nextUsernameChangeAt);
  const usernameLocked = nextChange.getTime() > now && username.trim().toLowerCase() !== profile.username.toLowerCase();

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      onMessage(error instanceof Error && !("code" in error) ? error.message : authErrorMessage(error));
    } finally {
      setBusy("");
    }
  }

  function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    const problem = displayNameError(displayName);
    if (problem) { onMessage(problem); return; }
    void run("name", async () => { account!.setProfile(await patchProfile({ displayName })); onMessage("Anzeigename gespeichert."); });
  }

  function saveUsername(event: FormEvent) {
    event.preventDefault();
    const problem = usernameError(username);
    if (problem) { onMessage(problem); return; }
    void run("username", async () => { account!.setProfile(await patchProfile({ username: username.trim() })); onMessage("Benutzername geändert."); });
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const problem = passwordError(password) ?? (password !== passwordRepeat ? "Die beiden Passwörter stimmen nicht überein." : null);
    if (problem) { onMessage(problem); return; }
    void run("password", async () => { await setAccountPassword(password); setPassword(""); setPasswordRepeat(""); onMessage("Neues Passwort gespeichert."); });
  }

  function linkGoogle() {
    void run("google", () => linkGoogleAccount(window.location.pathname));
  }

  function deleteProfile(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Profil, Spielstand und Login werden endgültig gelöscht. Das lässt sich nicht rückgängig machen. Wirklich löschen?")) return;
    void run("delete", () => account!.deleteProfile(confirm));
  }

  return <section className="profile-panel" aria-label="Profil">
    <div><p className="eyebrow">PROFIL / KONTO</p><h4>{profile.displayName} <small>@{profile.username}</small></h4><p>{account.passwordLogin ? "Angemeldet mit Benutzername und Passwort." : `Angemeldet mit Google (${account.email ?? "unbekannt"}).`} Dein Spielstand wird automatisch in deinem Profil gespeichert: <strong className={`account-sync ${status}`}>{SYNC_LABELS[status]}</strong></p></div>
    <form className="profile-row" onSubmit={saveDisplayName}><label><span>Anzeigename</span><input className="mode-input" maxLength={DISPLAY_NAME_MAX} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || displayName.trim() === profile.displayName}>Speichern</button></form>
    <form className="profile-row" onSubmit={saveUsername}><label><span>Benutzername</span><input className="mode-input" maxLength={USERNAME_MAX} autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || usernameLocked || username.trim() === profile.username}>Ändern</button>
      <small>{nextChange.getTime() > now ? `Nächste Änderung ab ${nextChange.toLocaleDateString("de-CH")} möglich (nur Gross und Kleinschreibung jederzeit).` : "Du kannst den Benutzernamen jetzt ändern. Danach erst wieder in 30 Tagen."}{account.passwordLogin ? " Du meldest dich danach mit dem neuen Namen an." : ""}</small></form>
    {account.passwordLogin && <form className="profile-row" onSubmit={savePassword}><label><span>Neues Passwort</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>Wiederholen</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || !password}>Passwort ändern</button>
      <small>Du meldest dich mit deinem Benutzernamen und diesem Passwort an.</small></form>}
    {account.passwordLogin && <div className="profile-row profile-google">
      {typeof googleEmail === "string" ? <p><strong>Mit Google verknüpft</strong><small>{googleEmail ? `${googleEmail} · ` : ""}Du kannst dich mit Google oder mit Benutzername und Passwort anmelden, es ist dasselbe Konto.</small></p>
        : <><p><strong>Google verknüpfen</strong><small>Danach meldest du dich wahlweise mit Google oder mit Benutzername und Passwort an. Spielstand und Profil bleiben gleich.</small></p><button type="button" className="mode-secondary" disabled={Boolean(busy) || googleEmail === undefined} onClick={linkGoogle}>{busy === "google" ? "Weiter zu Google …" : "Mit Google verknüpfen"}</button></>}
    </div>}
    <details className="profile-danger"><summary>Profil löschen</summary>
      <form className="profile-row" onSubmit={deleteProfile}><label><span>Zur Bestätigung „{profile.username}“ eintippen</span><input className="mode-input" autoCapitalize="none" spellCheck={false} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button type="submit" className="mode-secondary danger" disabled={Boolean(busy) || confirm.trim().toLowerCase() !== profile.username.toLowerCase()}>Endgültig löschen</button>
        <small>Löscht Profil, Spielstand und Login. Multiplayer Welten bleiben für die anderen Spieler bestehen.</small></form>
    </details>
  </section>;
}

/** The account button in the header; it opens the profile settings in a dialog. */
export function AccountButton() {
  const account = useContext(AccountContext);
  const guest = useContext(GuestContext);
  const [open, setOpen] = useState(false);
  // Feedback stays inside the dialog; the page toast would sit under the dimmed overlay.
  const [notice, setNotice] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus(open, dialogRef, () => setOpen(false));
  // Back from linking Google: the account dialog opens and says how it went.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result || !account) return;
    params.delete("google");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    const timer = window.setTimeout(() => { setNotice(GOOGLE_LINK_MESSAGES[result] ?? GOOGLE_LINK_MESSAGES.fehler); setOpen(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [account]);

  if (!account && guest) return <>
    <button type="button" className="account-signin-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNotice(""); setOpen(true); }}>Anmelden</button>
    {open && createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-label="Gast">
        <button type="button" className="account-dialog-close" aria-label="Schliessen" onClick={() => setOpen(false)}>×</button>
        <section className="profile-panel" aria-label="Gast">
          <div><p className="eyebrow">GAST</p><h4>Du spielst als Gast</h4><p>Dein Spielstand liegt nur in diesem Browser, und Koop Multiplayer ist gesperrt. Mit einem Konto ist dein Spielstand gesichert, auf allen deinen Geräten gleich, und du kannst mit anderen zusammen spielen. Hat das Konto noch keinen Spielstand, nimmt es deinen Gast Spielstand mit.</p></div>
          <button type="button" className="mode-primary" onClick={() => { setOpen(false); guest.signIn(); }}>Anmelden oder Konto erstellen</button>
        </section>
        <ThemePicker />
        <InstallAppPanel onMessage={setNotice} />
        {notice && <p className="account-notice" role="status">{notice}</p>}
      </div>
    </div>, document.body)}
  </>;
  if (!account) return null;
  return <>
    <button type="button" className="icon-button account-button" aria-label={`Konto von ${account.profile.displayName}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNotice(""); setOpen(true); }}>👤</button>
    {/* The header blurs its background, which would trap a fixed dialog inside it; the dialog lives on <body>. */}
    {open && createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-label="Konto">
        <button type="button" className="account-dialog-close" aria-label="Schliessen" onClick={() => setOpen(false)}>×</button>
        <ProfilePanel onMessage={setNotice} />
        <ThemePicker />
        <InstallAppPanel onMessage={setNotice} />
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <button type="button" className="mode-secondary account-dialog-signout" onClick={() => void account.signOut()}>Abmelden</button>
      </div>
    </div>, document.body)}
  </>;
}

/** Light, dark or the device setting; applies at once and is remembered on this device. */
function ThemePicker() {
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference);
  return <div className="theme-picker">
    <span id="theme-picker-label">Darstellung</span>
    <div role="radiogroup" aria-labelledby="theme-picker-label">
      {THEME_OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} className={theme === option.value ? "active" : ""} onClick={() => { setThemePreference(option.value); setTheme(option.value); }}>{option.label}</button>)}
    </div>
  </div>;
}

/** "App installieren": the browser's install prompt, or the share menu hint on iPhone and iPad. */
function InstallAppPanel({ onMessage }: { onMessage: (text: string) => void }) {
  const state = useSyncExternalStore(subscribeInstallState, getInstallState, () => "unavailable" as InstallState);
  if (state === "unavailable") return null;
  return <div className="install-app">
    <span>App</span>
    {state === "installed" && <p>Goal Clicker ist als App installiert.</p>}
    {state === "prompt" && <button type="button" className="mode-secondary" onClick={() => void promptInstall().then((accepted) => { if (accepted) onMessage("Goal Clicker wird installiert."); })}>App installieren</button>}
    {state === "ios" && <p>Zum Installieren unten auf Teilen tippen und dann «Zum Home Bildschirm».</p>}
  </div>;
}
