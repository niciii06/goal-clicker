"use client";
// The signed in account in the game: name and save state below the mode switch, the account button in the
// header with the profile settings, and the save file export/import in the club tab.
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent, FormEvent } from "react";
import { AccountContext } from "./account-gate";
import { authErrorMessage, setAccountPassword } from "./auth/browser";
import { subscribeSyncStatus } from "./cloud-sync";
import type { SyncStatus } from "./cloud-sync";
import { suspendLocalPersistence } from "./game/storage";
import { DISPLAY_NAME_MAX, displayNameError, PASSWORD_MAX, PASSWORD_MIN, passwordError, USERNAME_MAX, usernameError } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";
import { applySaveFile, createSaveFile, parseSaveFile, saveFileName, savedPlayerId } from "./save-file";

const ADOPT_AFTER_IMPORT_KEY = "goalClickerAdoptAfterImport";
const SYNC_LABELS: Record<SyncStatus, string> = { saved: "Gespeichert", saving: "Speichert …", offline: "Offline, wird später gespeichert", conflict: "Anderes Gerät" };

async function linkAccount(playerId: string, adopt: boolean) {
  const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId, adopt }) });
  const data = await response.json() as { playerId?: string; email?: string | null; error?: string; adoptError?: string };
  if (!response.ok) throw new Error(data.error ?? "Das Konto konnte nicht geladen werden.");
  return data;
}

function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>("saved");
  useEffect(() => subscribeSyncStatus(setStatus), []);
  return status;
}

/**
 * Name and save state of the account in the header. The account's player ID becomes this browser's player ID,
 * so every device of the account sees the same worlds.
 */
export function AccountChip({ playerId, onPlayerId, onMessage }: { playerId: string; onPlayerId: (id: string) => void; onMessage: (text: string) => void }) {
  const account = useContext(AccountContext);
  const status = useSyncStatus();
  const linked = useRef("");

  useEffect(() => {
    if (!account || !playerId || linked.current === playerId) return;
    linked.current = playerId;
    const adopt = localStorage.getItem(ADOPT_AFTER_IMPORT_KEY) === playerId;
    void linkAccount(playerId, adopt).then((data) => {
      if (adopt) localStorage.removeItem(ADOPT_AFTER_IMPORT_KEY);
      if (data.adoptError) onMessage(data.adoptError);
      if (data.playerId && data.playerId !== playerId) {
        linked.current = data.playerId;
        onPlayerId(data.playerId);
      }
    }).catch((error: Error) => {
      linked.current = "";
      onMessage(error.message);
    });
  }, [account, playerId, onPlayerId, onMessage]);

  if (!account) return null;
  return <div className="account-chip signed-in">
    <span title={account.email ?? undefined}><strong>{account.profile.displayName}</strong> @{account.profile.username}</span>
    <span className={`account-sync ${status}`} title={SYNC_LABELS[status]}>{SYNC_LABELS[status]}</span>
    <button type="button" onClick={() => void account.signOut()}>Abmelden</button>
  </div>;
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
  const [now] = useState(() => Date.now());
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
    <details className="profile-danger"><summary>Profil löschen</summary>
      <form className="profile-row" onSubmit={deleteProfile}><label><span>Zur Bestätigung „{profile.username}“ eintippen</span><input className="mode-input" autoCapitalize="none" spellCheck={false} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button type="submit" className="mode-secondary danger" disabled={Boolean(busy) || confirm.trim().toLowerCase() !== profile.username.toLowerCase()}>Endgültig löschen</button>
        <small>Löscht Profil, Spielstand und Login. Multiplayer Welten bleiben für die anderen Spieler bestehen.</small></form>
    </details>
  </section>;
}

/** The account button in the header; it opens the profile settings in a dialog. */
export function AccountButton() {
  const account = useContext(AccountContext);
  const [open, setOpen] = useState(false);
  // Feedback stays inside the dialog; the page toast would sit under the dimmed overlay.
  const [notice, setNotice] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // A modal dialog keeps the keyboard inside: focus moves in on open, Tab wraps around, Escape closes,
  // and focus returns to the account button afterwards.
  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex='-1'])") ?? [])].filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !inside)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); button?.focus(); };
  }, [open]);

  if (!account) return null;
  return <>
    <button ref={buttonRef} type="button" className="icon-button account-button" aria-label={`Konto von ${account.profile.displayName}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNotice(""); setOpen(true); }}>👤</button>
    {/* The header blurs its background, which would trap a fixed dialog inside it; the dialog lives on <body>. */}
    {open && createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-label="Konto">
        <button type="button" className="account-dialog-close" aria-label="Schliessen" onClick={() => setOpen(false)}>×</button>
        <ProfilePanel onMessage={setNotice} />
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <button type="button" className="mode-secondary account-dialog-signout" onClick={() => void account.signOut()}>Abmelden</button>
      </div>
    </div>, document.body)}
  </>;
}

/** Download and upload of the single player save, for moving to a new address or device. */
export function SaveTransferPanel({ onMessage }: { onMessage: (text: string) => void }) {
  const account = useContext(AccountContext);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function exportSave() {
    const file = createSaveFile(localStorage, window.location.origin);
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = saveFileName();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onMessage("Spielstand heruntergeladen.");
  }

  async function importSave(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setBusy(true);
    try {
      const parsed = parseSaveFile(await selected.text());
      if (!parsed.ok) { onMessage(parsed.error); return; }
      if (!window.confirm("Der aktuelle Spielstand in diesem Browser wird durch die Datei ersetzt. Fortfahren?")) return;
      suspendLocalPersistence();
      applySaveFile(localStorage, parsed.file);
      const importedPlayerId = savedPlayerId(parsed.file);
      // A signed in account adopts the imported player ID (and its worlds) on the next start, if it has no world yet.
      if (importedPlayerId) localStorage.setItem(ADOPT_AFTER_IMPORT_KEY, importedPlayerId);
      window.location.reload();
    } catch {
      onMessage("Der Spielstand konnte nicht importiert werden. Dein bisheriger Stand bleibt erhalten.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="save-transfer" aria-label="Spielstand sichern">
    <div><p className="eyebrow">SPIELSTAND / SICHERN</p><h4>Spielstand als Datei</h4><p>{account ? "Dein Spielstand liegt automatisch in deinem Profil. Zusätzlich kannst du ihn als Datei sichern oder eine gesicherte Datei wieder einlesen; sie ersetzt dann den Stand im Profil." : "Der Einzelspieler Spielstand liegt nur in diesem Browser. Lade ihn als Datei herunter, um ihn auf einer neuen Adresse oder einem anderen Gerät wieder hochzuladen."} Die Datei enthält auch deine Spieler ID für deine Multiplayer Welten.</p></div>
    <div className="save-transfer-actions">
      <button type="button" className="mode-secondary" onClick={exportSave}>Spielstand herunterladen</button>
      <button type="button" className="mode-secondary" disabled={busy} onClick={() => input.current?.click()}>Spielstand hochladen</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => void importSave(event)} />
    </div>
  </section>;
}
