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
import { currentIntlTag, localizeText, t } from "./i18n/runtime";
import type { MessageKey } from "./i18n/translate";
import { useLocale } from "./i18n/use-locale";
import { LanguagePicker } from "./i18n/language-picker";
import type { ThemePreference } from "./theme";

/** What the return from linking Google (?google=...) tells the player. */
const GOOGLE_LINK_MESSAGES: Record<string, MessageKey> = {
  verknuepft: "google.linked",
  vergeben: "google.taken",
  abgebrochen: "google.cancelled",
  fehler: "google.failed",
  "nicht-konfiguriert": "auth.notSetUp",
};

const SYNC_LABELS: Record<SyncStatus, MessageKey> = { saved: "sync.saved", saving: "sync.saving", offline: "sync.offline", failed: "sync.failed" };

async function linkAccount(playerId: string) {
  const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId }) });
  const data = await response.json() as { playerId?: string; email?: string | null; error?: string };
  if (!response.ok) throw new Error(localizeText(data.error) || t("panel.accountLoadFailed"));
  return data;
}

function useSyncStatus() {
  const [state, setState] = useState<{ status: SyncStatus; message: string | null }>({ status: "saved", message: null });
  useEffect(() => subscribeSyncStatus((status, message) => setState({ status, message })), []);
  return state;
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
  if (!response.ok || !data.profile) throw new Error(localizeText(data.error) || t("panel.profileSaveFailed"));
  return data.profile;
}

/** Profile settings: display name, username (every 30 days), password of username accounts and deleting the profile. */
export function ProfilePanel({ onMessage }: { onMessage: (text: string) => void }) {
  useLocale();
  const account = useContext(AccountContext);
  const { status, message: syncMessage } = useSyncStatus();
  const [displayName, setDisplayName] = useState(account?.profile.displayName ?? "");
  const [username, setUsername] = useState(account?.profile.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
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
      onMessage(error instanceof Error && !("code" in error) ? localizeText(error.message) : localizeText(authErrorMessage(error)));
    } finally {
      setBusy("");
    }
  }

  function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    const problem = displayNameError(displayName);
    if (problem) { onMessage(problem); return; }
    void run("name", async () => { account!.setProfile(await patchProfile({ displayName })); onMessage(t("panel.displayNameSaved")); });
  }

  function saveUsername(event: FormEvent) {
    event.preventDefault();
    const problem = usernameError(username);
    if (problem) { onMessage(problem); return; }
    void run("username", async () => { account!.setProfile(await patchProfile({ username: username.trim() })); onMessage(t("panel.usernameChanged")); });
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const problem = (currentPassword ? null : t("panel.enterCurrentPassword")) ?? passwordError(password) ?? (password !== passwordRepeat ? t("panel.passwordsDiffer") : null);
    if (problem) { onMessage(problem); return; }
    void run("password", async () => { await setAccountPassword(currentPassword, password); setCurrentPassword(""); setPassword(""); setPasswordRepeat(""); onMessage(t("panel.passwordSaved")); });
  }

  function linkGoogle() {
    void run("google", () => linkGoogleAccount(window.location.pathname));
  }

  function deleteProfile(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(t("panel.deleteConfirm"))) return;
    void run("delete", () => account!.deleteProfile(confirm));
  }

  return <section className="profile-panel" aria-label={t("panel.profile")}>
    <div><p className="eyebrow">{t("panel.eyebrow")}</p><h4>{profile.displayName} <small>@{profile.username}</small></h4><p>{account.passwordLogin ? t("panel.signedInPassword") : t("panel.signedInGoogle", { email: account.email ?? t("panel.unknown") })} {t("panel.autosave")} <strong className={`account-sync ${status}`}>{syncMessage ? localizeText(syncMessage) : t(SYNC_LABELS[status])}</strong></p></div>
    <form className="profile-row" onSubmit={saveDisplayName}><label><span>{t("panel.displayName")}</span><input className="mode-input" maxLength={DISPLAY_NAME_MAX} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || displayName.trim() === profile.displayName}>{t("panel.save")}</button></form>
    <form className="profile-row" onSubmit={saveUsername}><label><span>{t("panel.username")}</span><input className="mode-input" maxLength={USERNAME_MAX} autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || usernameLocked || username.trim() === profile.username}>{t("panel.change")}</button>
      <small>{nextChange.getTime() > now ? t("panel.nextChange", { date: nextChange.toLocaleDateString(currentIntlTag()) }) : t("panel.changeNow")}{account.passwordLogin ? ` ${t("panel.signInWithNew")}` : ""}</small></form>
    {account.passwordLogin && <form className="profile-row" onSubmit={savePassword}><label><span>{t("panel.currentPassword")}</span><input className="mode-input" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label><span>{t("panel.newPassword")}</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={password} onChange={(event) => setPassword(event.target.value)} /></label><label><span>{t("panel.repeat")}</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} /></label><button type="submit" className="mode-secondary" disabled={Boolean(busy) || !password || !currentPassword}>{t("panel.changePassword")}</button>
      <small>{t("panel.passwordHint")}</small></form>}
    {account.passwordLogin && <div className="profile-row profile-google">
      {typeof googleEmail === "string" ? <p><strong>{t("panel.googleLinked")}</strong><small>{googleEmail ? `${googleEmail} · ` : ""}{t("panel.googleLinkedHint")}</small></p>
        : <><p><strong>{t("panel.linkGoogle")}</strong><small>{t("panel.linkGoogleHint")}</small></p><button type="button" className="mode-secondary" disabled={Boolean(busy) || googleEmail === undefined} onClick={linkGoogle}>{busy === "google" ? t("panel.toGoogle") : t("panel.linkWithGoogle")}</button></>}
    </div>}
    <details className="profile-danger"><summary>{t("panel.deleteProfile")}</summary>
      <form className="profile-row" onSubmit={deleteProfile}><label><span>{t("panel.confirmType", { username: profile.username })}</span><input className="mode-input" autoCapitalize="none" spellCheck={false} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button type="submit" className="mode-secondary danger" disabled={Boolean(busy) || confirm.trim().toLowerCase() !== profile.username.toLowerCase()}>{t("panel.deleteFinal")}</button>
        <small>{t("panel.deleteHint")}</small></form>
    </details>
  </section>;
}

/** The account button in the header; it opens the profile settings in a dialog. */
export function AccountButton() {
  useLocale();
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
    const timer = window.setTimeout(() => { setNotice(t(GOOGLE_LINK_MESSAGES[result] ?? GOOGLE_LINK_MESSAGES.fehler)); setOpen(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [account]);

  if (!account && guest) return <>
    <button type="button" className="account-signin-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNotice(""); setOpen(true); }}>{t("header.signIn")}</button>
    {open && createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-label={t("guest.label")}>
        <button type="button" className="account-dialog-close" aria-label={t("dialog.close")} onClick={() => setOpen(false)}>×</button>
        <section className="profile-panel" aria-label={t("guest.label")}>
          <div><p className="eyebrow">{t("guest.eyebrow")}</p><h4>{t("guest.title")}</h4><p>{t("guest.text")}</p></div>
          <button type="button" className="mode-primary" onClick={() => { setOpen(false); guest.signIn(); }}>{t("guest.signIn")}</button>
        </section>
        <ThemePicker />
        <LanguagePicker />
        <InstallAppPanel onMessage={setNotice} />
        {notice && <p className="account-notice" role="status">{notice}</p>}
      </div>
    </div>, document.body)}
  </>;
  if (!account) return null;
  return <>
    <button type="button" className="icon-button account-button" aria-label={t("panel.accountOf", { name: account.profile.displayName })} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setNotice(""); setOpen(true); }}>👤</button>
    {/* The header blurs its background, which would trap a fixed dialog inside it; the dialog lives on <body>. */}
    {open && createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-label={t("panel.account")}>
        <button type="button" className="account-dialog-close" aria-label={t("dialog.close")} onClick={() => setOpen(false)}>×</button>
        <ProfilePanel onMessage={setNotice} />
        <ThemePicker />
        <LanguagePicker />
        <InstallAppPanel onMessage={setNotice} />
        {notice && <p className="account-notice" role="status">{notice}</p>}
        <button type="button" className="mode-secondary account-dialog-signout" onClick={() => void account.signOut()}>{t("panel.signOut")}</button>
      </div>
    </div>, document.body)}
  </>;
}

/** Light, dark or the device setting; applies at once and is remembered on this device. */
function ThemePicker() {
  useLocale();
  const [theme, setTheme] = useState<ThemePreference>(readThemePreference);
  return <div className="theme-picker">
    <span id="theme-picker-label">{t("settings.appearance")}</span>
    <div role="radiogroup" aria-labelledby="theme-picker-label">
      {THEME_OPTIONS.map((option) => <button key={option.value} type="button" role="radio" aria-checked={theme === option.value} className={theme === option.value ? "active" : ""} onClick={() => { setThemePreference(option.value); setTheme(option.value); }}>{t(`theme.${option.value}` as MessageKey)}</button>)}
    </div>
  </div>;
}

/** "App installieren": the browser's install prompt, or the share menu hint on iPhone and iPad. */
function InstallAppPanel({ onMessage }: { onMessage: (text: string) => void }) {
  useLocale();
  const state = useSyncExternalStore(subscribeInstallState, getInstallState, () => "unavailable" as InstallState);
  if (state === "unavailable") return null;
  return <div className="install-app">
    <span>{t("app.label")}</span>
    {state === "installed" && <p>{t("app.installed")}</p>}
    {state === "prompt" && <button type="button" className="mode-secondary" onClick={() => void promptInstall().then((accepted) => { if (accepted) onMessage(t("app.installing")); })}>{t("app.install")}</button>}
    {state === "ios" && <p>{t("app.iosHint")}</p>}
  </div>;
}
