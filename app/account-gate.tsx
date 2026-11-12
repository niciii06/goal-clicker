"use client";
// Once Neon Auth is configured the game starts with a login: Google, or username and password (no e-mail involved).
// Every account has a profile with a unique username and a display name; Google accounts create it after their
// first login, username accounts when they register. Before the game starts, the account's cloud save is written
// to localStorage; while it runs, CloudSync uploads every change. A guest plays single player only, with a save
// in this browser; signing in later takes that save into a new account.
import { createContext, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authErrorMessage, refreshAuthSession, registerWithUsername, signInWithGoogle, signInWithUsername, signOutOfAuth } from "./auth/browser";
import { browserAuthMode } from "./auth/config";
import { adoptOwnUpload, applyCloudSave, clearLocalAccountData, CloudSync, FLUSH_SAVE_EVENT, fetchCloudSave, holdsOtherAccountSave, NEWER_VERSION_MESSAGE, planInitialSync, readCloudMeta, readCloudMetaOwner, readLocalSaveKeys, reportSyncProblem, STORAGE_FULL_MESSAGE, writeCloudMeta } from "./cloud-sync";
import type { CloudSaveState } from "./cloud-sync";
import { cleanCloudSaveKeys, summarizeSave } from "./cloud-save-rules";
import type { SaveSummary } from "./cloud-save-rules";
import { PLAYER_NAME_KEY } from "./game/constants";
import { isSaveFromNewerVersion } from "./game/save-schema";
import { resumeLocalPersistence, suspendLocalPersistence } from "./game/storage";
import { exportCurrentSave } from "./save-file-controls";
import { cleanDisplayName, DISPLAY_NAME_MAX, displayNameError, PASSWORD_MAX, PASSWORD_MIN, passwordError, USERNAME_MAX, usernameError } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

export type AccountContextValue = {
  /** The game account ID (not the ID of the login). */
  userId: string;
  /** The Google address; null for accounts with username and password. */
  email: string | null;
  /** Signs in with username and password (and may change that password). */
  passwordLogin: boolean;
  profile: PublicProfile;
  setProfile: (profile: PublicProfile) => void;
  /** Saves a last time, forgets the account's save on this device and signs out. */
  signOut: () => Promise<void>;
  /** Deletes profile, cloud save and login; the username is the confirmation. */
  deleteProfile: (confirm: string) => Promise<void>;
};

/** null in local development without login, where the game runs without an account as before, and for guests. */
export const AccountContext = createContext<AccountContextValue | null>(null);

/** Set while a guest plays: single player only, and a way to the login. */
export type GuestContextValue = { signIn: () => void };
export const GuestContext = createContext<GuestContextValue | null>(null);

/** Remembers on this device that the player chose to play as a guest. */
const GUEST_MODE_KEY = "goalClickerGuestModeV1";

const PROFILE_CACHE_KEY = "goalClickerProfileCacheV1";
const LOGIN_MESSAGES: Record<string, string> = {
  abgebrochen: "Die Anmeldung wurde abgebrochen.",
  fehler: "Die Anmeldung hat nicht geklappt. Bitte erneut versuchen.",
  "nicht-konfiguriert": "Der Login ist auf diesem Server noch nicht eingerichtet.",
  vergeben: "Dieses Google Konto gehört schon zu einem anderen Spielerkonto.",
  geloescht: "Dein Profil, dein Spielstand und dein Login sind gelöscht.",
  loeschauftrag: "Dein Profil und dein Spielstand sind gelöscht. Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.",
};

type SessionUser = { id: string; email: string | null; passwordLogin: boolean; suggestedName: string };
type Phase =
  | { name: "checking" }
  | { name: "signed-out"; message?: string }
  | { name: "guest" }
  | { name: "profile"; user: SessionUser }
  | { name: "unreachable"; message: string; user: SessionUser | null; offlineProfile: PublicProfile | null }
  | { name: "deletion"; message: string }
  // A save from a newer version of the game is in this browser or the cloud: this (older) page must not touch it.
  | { name: "outdated" }
  // The browser storage could not take the account's save; nothing was replaced.
  | { name: "storage-full"; user: SessionUser; profile: PublicProfile }
  // A guest's save meets an account that already has a different save: the player chooses.
  | { name: "choose-save"; user: SessionUser; profile: PublicProfile; cloud: CloudSaveState; local: SaveSummary | null; account: SaveSummary | null }
  | { name: "ready"; user: SessionUser; profile: PublicProfile };

/** The account and profile this device last started with: lets a signed in player continue offline. */
function readProfileCache(): { user: SessionUser; profile: PublicProfile } | null {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? "null") as { userId?: string; profile?: PublicProfile; email?: string | null; passwordLogin?: boolean } | null;
    if (typeof cached?.userId !== "string" || !cached.profile) return null;
    return { user: { id: cached.userId, email: cached.email ?? null, passwordLogin: cached.passwordLogin === true, suggestedName: "" }, profile: cached.profile };
  } catch {
    return null;
  }
}

function writeProfileCache(user: SessionUser, profile: PublicProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId: user.id, email: user.email, passwordLogin: user.passwordLogin, profile }));
  } catch {
    // Only needed to start offline.
  }
}

type AccountSession = { signedIn?: boolean; accountId?: string; email?: string | null; passwordLogin?: boolean; suggestedName?: string };

function sessionUser(body: AccountSession): SessionUser {
  const fromEmail = body.email && !body.passwordLogin ? body.email.split("@")[0] : "";
  return { id: body.accountId!, email: body.passwordLogin ? null : body.email ?? null, passwordLogin: body.passwordLogin === true, suggestedName: cleanDisplayName(body.suggestedName || fromEmail).slice(0, DISPLAY_NAME_MAX) };
}

/** Answers of POST /api/account that mean this login cannot open a game account; it is signed out again. */
const REFUSED_LOGINS = new Set(["ACCOUNT_ALREADY_CLAIMED", "IDENTITY_UNBOUND", "LEGACY_ACCOUNT_MISSING", "AUTH_NOT_CONFIGURED"]);

async function readJson<T>(response: Response) {
  return await response.json().catch(() => ({})) as T & { error?: string; errorCode?: string };
}

export function AccountGate({ children }: { children: ReactNode }) {
  // Without login (local development, tests) the game starts right away without an account. A hosted build without
  // a complete login configuration shows the login screen with a notice instead (fail closed).
  if (!browserAuthMode()) return <>{children}</>;
  return <RequiredAccount>{children}</RequiredAccount>;
}

function RequiredAccount({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const syncRef = useRef<CloudSync | null>(null);

  const startGame = useCallback((user: SessionUser, profile: PublicProfile) => {
    localStorage.setItem(PLAYER_NAME_KEY, profile.displayName);
    syncRef.current?.stop();
    const sync = new CloudSync(user.id, {
      onNewerSave: (cloud) => {
        suspendLocalPersistence();
        try {
          applyCloudSave(user.id, cloud);
        } catch {
          // Storage full: the previous game is back in place and keeps saving locally. The sync stays stopped,
          // so this older game is never uploaded over the newer cloud save; the next start tries again.
          resumeLocalPersistence();
          reportSyncProblem(STORAGE_FULL_MESSAGE);
          return;
        }
        window.location.reload();
      },
    });
    syncRef.current = sync;
    sync.start();
    setPhase({ name: "ready", user, profile });
  }, []);

  const syncAndStart = useCallback(async (user: SessionUser, profile: PublicProfile) => {
    setPhase({ name: "checking" });
    let cloud: CloudSaveState;
    try {
      cloud = await fetchCloudSave();
    } catch {
      setPhase({ name: "unreachable", message: "Dein Spielstand konnte nicht geladen werden.", user, offlineProfile: readCloudMeta(user.id) ? profile : null });

      return;
    }
    try {
      // Only a save that never belonged to an account may move into this one; another account's save is removed.
      if (holdsOtherAccountSave(user.id)) clearLocalAccountData();
      // A newer version of the game wrote one of the saves: this page leaves both untouched.
      if (isSaveFromNewerVersion(cloud.keys) || isSaveFromNewerVersion(cleanCloudSaveKeys(readLocalSaveKeys()))) { setPhase({ name: "outdated" }); return; }
      // An upload that went through while the page closed is this device's own save, not another device's.
      const own = adoptOwnUpload(readCloudMeta(user.id), cloud);
      if (own) writeCloudMeta(own);
      const local = readLocalSaveKeys();
      const plan = planInitialSync(readCloudMeta(user.id), cloud, local);
      if (plan === "choose") { setPhase({ name: "choose-save", user, profile, cloud, local: summarizeSave(cleanCloudSaveKeys(local)), account: summarizeSave(cloud.keys) }); return; }
      if (plan === "use-cloud") applyCloudSave(user.id, cloud);
      // The next upload replaces the cloud save on top of its current version.
      else if (plan === "keep-local") writeCloudMeta({ userId: user.id, version: cloud.version, hash: "", played: true });
      else if (!cloud.keys) writeCloudMeta({ userId: user.id, version: cloud.version, hash: "" });
    } catch {
      // applyCloudSave put the previous game back; nothing starts that could upload it over the cloud save.
      setPhase({ name: "storage-full", user, profile });
      return;
    }
    startGame(user, profile);
  }, [startGame]);

  const enter = useCallback(async () => {
    setPhase({ name: "checking" });
    if (browserAuthMode() !== "neon") {
      setPhase(localStorage.getItem(GUEST_MODE_KEY) === "1" ? { name: "guest" } : { name: "signed-out", message: LOGIN_MESSAGES["nicht-konfiguriert"] });
      return;
    }
    let body: AccountSession & { error?: string; errorCode?: string };
    try {
      // Verifies the login with Neon Auth and opens its game account (recovering an original account on first use).
      const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store" });
      body = await readJson<AccountSession>(response);
      if (response.status === 401) {
        setPhase(localStorage.getItem(GUEST_MODE_KEY) === "1" ? { name: "guest" } : { name: "signed-out" });
        return;
      }
      if (response.status === 410) { setPhase({ name: "deletion", message: body.error ?? "Dein Konto wird gerade gelöscht." }); return; }
      if (body.errorCode && REFUSED_LOGINS.has(body.errorCode)) {
        await signOutOfAuth();
        setPhase({ name: "signed-out", message: body.error });
        return;
      }
      if (!response.ok || !body.accountId) throw new Error(body.error);
    } catch {
      const cached = readProfileCache();
      const offline = cached && readCloudMeta(cached.user.id) ? cached : null;
      setPhase({ name: "unreachable", message: "Keine Verbindung zum Server.", user: offline?.user ?? null, offlineProfile: offline?.profile ?? null });
      return;
    }
    localStorage.removeItem(GUEST_MODE_KEY);
    // Lets the SDK renew the session cookie when Neon Auth renews the session.
    void refreshAuthSession();
    const user = sessionUser(body);
    let profile: PublicProfile | null;
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.status === 401) {
        await signOutOfAuth();
        setPhase({ name: "signed-out", message: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an." });
        return;
      }
      const profileBody = await readJson<{ profile: PublicProfile | null }>(response);
      if (!response.ok) throw new Error(profileBody.error);
      profile = profileBody.profile;
    } catch {
      const cached = readProfileCache();
      setPhase({ name: "unreachable", message: "Keine Verbindung zum Server.", user, offlineProfile: cached?.user.id === user.id && readCloudMeta(user.id) ? cached.profile : null });
      return;
    }
    if (!profile) {
      setPhase({ name: "profile", user });
      return;
    }
    writeProfileCache(user, profile);
    await syncAndStart(user, profile);
  }, [syncAndStart]);

  useEffect(() => {
    const login = new URLSearchParams(window.location.search).get("login");
    const timer = window.setTimeout(() => {
      void enter().then(() => {
        if (login && LOGIN_MESSAGES[login]) setPhase((current) => current.name === "signed-out" ? { name: "signed-out", message: LOGIN_MESSAGES[login] } : current);
      });
    }, 0);
    if (login) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    // Signing out in another tab (or a revoked session) ends the game here too, checked when the tab comes back.
    const checkSignedIn = () => {
      if (document.visibilityState !== "visible" || !syncRef.current) return;
      void fetch("/api/account", { cache: "no-store" }).then((response) => response.json()).then((state: { signedIn?: boolean | null }) => {
        if (state.signedIn !== false) return;
        syncRef.current?.stop();
        setPhase((current) => current.name === "ready" ? { name: "signed-out", message: "Du wurdest abgemeldet." } : current);
      }).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", checkSignedIn);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkSignedIn);
      syncRef.current?.stop();
    };
  }, [enter]);

  const signOut = useCallback(async () => {
    const sync = syncRef.current;
    const saved = sync ? await sync.upload() : true;
    if (!saved && !window.confirm("Dein letzter Spielstand konnte nicht gespeichert werden. Trotzdem abmelden? Der Fortschritt seit dem letzten Speichern geht dann verloren.")) return;
    sync?.stop();
    suspendLocalPersistence();
    clearLocalAccountData();
    await signOutOfAuth();
    window.location.replace("/");
  }, []);

  const deleteProfile = useCallback(async (confirm: string) => {
    // No upload may run alongside the deletion, or it could store the save again right after.
    const sync = syncRef.current;
    sync?.stop();
    await sync?.settle();
    let response: Response;
    try {
      response = await fetch("/api/profile", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    } catch (error) {
      sync?.start();
      throw error;
    }
    const body = await readJson<{ deleted?: boolean; dataDeleted?: boolean; loginDeleted?: boolean }>(response);
    if (!response.ok || !body.dataDeleted) {
      sync?.start();
      throw new Error(body.error ?? "Das Profil konnte nicht gelöscht werden.");
    }
    suspendLocalPersistence();
    clearLocalAccountData();
    localStorage.removeItem(PROFILE_CACHE_KEY);
    await signOutOfAuth();
    // The login screen says what happened: everything deleted, or the data deleted and the login still to be removed.
    window.location.replace(body.loginDeleted ? "/?login=geloescht" : "/?login=loeschauftrag");
  }, []);

  // A guest's save stays in this browser. A save another account left behind is not the guest's, so it goes first.
  const playAsGuest = useCallback(() => {
    if (readCloudMetaOwner()) clearLocalAccountData();
    localStorage.setItem(GUEST_MODE_KEY, "1");
    setPhase({ name: "guest" });
  }, []);

  const guestSignIn = useCallback(() => {
    // The running game writes its last state first; signing in then takes it into a new account.
    window.dispatchEvent(new Event(FLUSH_SAVE_EVENT));
    localStorage.removeItem(GUEST_MODE_KEY);
    setPhase({ name: "signed-out", message: "Dein Gast Spielstand kommt in dein Konto. Hat dein Konto schon einen Spielstand, wählst du nach der Anmeldung, welcher weitergespielt wird." });
  }, []);
  const guestContext = useMemo<GuestContextValue>(() => ({ signIn: guestSignIn }), [guestSignIn]);

  const ready = phase.name === "ready" ? phase : null;
  const setProfile = useCallback((profile: PublicProfile) => {
    setPhase((current) => current.name === "ready" ? { ...current, profile } : current);
    if (ready) writeProfileCache(ready.user, profile);
    localStorage.setItem(PLAYER_NAME_KEY, profile.displayName);
  }, [ready]);
  const context = useMemo<AccountContextValue | null>(() => ready ? { userId: ready.user.id, email: ready.user.email, passwordLogin: ready.user.passwordLogin, profile: ready.profile, setProfile, signOut, deleteProfile } : null, [ready, setProfile, signOut, deleteProfile]);

  if (phase.name === "ready") {
    return <AccountContext.Provider value={context}>
      {children}
    </AccountContext.Provider>;
  }
  if (phase.name === "guest") {
    return <GuestContext.Provider value={guestContext}>
      {children}
    </GuestContext.Provider>;
  }

  // The start while the session and the cloud save are checked: a bouncing ball instead of a bare status card. The
  // animation runs on its own (CSS only), so it never waits for the network; the game still appears only after the
  // identity and save check, never earlier.
  if (phase.name === "checking") return <main className="account-screen account-boot" aria-busy="true">
    <div className="account-boot-stage">
      <div className="account-boot-ball-wrap" aria-hidden="true">
        <svg className="account-boot-ball" viewBox="0 0 64 64" width="84" height="84" focusable="false"><circle cx="32" cy="32" r="29" fill="#fff" stroke="#1d1d1f" strokeWidth="2.4" /><g fill="#1d1d1f" stroke="#1d1d1f" strokeWidth="2" strokeLinejoin="round"><polygon points="32 22.5 40.6 28.7 37.3 38.8 26.7 38.8 23.4 28.7" /><polygon points="32 3.4 25.5 8.3 28 15.8 36 15.8 38.5 8.3" /><polygon points="56.3 20.8 58.9 28.8 52.8 34.2 46.6 30.6 48.4 23" /><polygon points="7.7 20.8 15.6 23 17.4 30.6 11.2 34.2 5.1 28.8" /><polygon points="44.5 52.8 38.5 57.6 32 54.3 33.5 47.2 41 46.7" /><polygon points="19.5 52.8 23 46.7 30.5 47.2 32 54.3 25.5 57.6" /></g><g fill="none" stroke="#1d1d1f" strokeWidth="2"><path d="M32 22.5V15.8M40.6 28.7l7.8-5.7M37.3 38.8l3.7 7.9M26.7 38.8l-3.7 7.9M23.4 28.7l-7.8-5.7" /></g></svg>
        <span className="account-boot-shadow" />
      </div>
      <strong className="account-boot-title">Goal Clicker</strong>
      <p className="account-boot-status" role="status">Anmeldung wird geprüft …</p>
    </div>
  </main>;

  return <main className="account-screen">
    <section className="account-card">
      <div className="account-brand"><span className="account-brand-ball" aria-hidden="true">⚽</span><div><p className="eyebrow">FOOTBALL IDLE CLUB</p><strong>Goal Clicker</strong></div></div>
      {phase.name === "signed-out" && <LoginForm message={phase.message} onSignedIn={() => void enter()} onGuest={playAsGuest} />}
      {phase.name === "profile" && <ProfileSetup user={phase.user} onCreated={(profile) => { writeProfileCache(phase.user, profile); void syncAndStart(phase.user, profile); }} onSignOut={() => void signOut()} />}
      {phase.name === "deletion" && <FinishDeletion message={phase.message} />}
      {phase.name === "outdated" && <>
        <h2>Neue Version verfügbar</h2>
        <p role="alert">{NEWER_VERSION_MESSAGE}</p>
        <div className="account-actions">
          <button type="button" className="mode-primary" onClick={() => window.location.reload()}>Neu laden</button>
        </div>
      </>}
      {phase.name === "storage-full" && <>
        <h2>Speicher voll</h2>
        <p role="alert">{STORAGE_FULL_MESSAGE} Der Spielstand aus deinem Profil konnte nicht in diesem Browser gespeichert werden; dein bisheriger Spielstand hier ist unverändert.</p>
        <div className="account-actions">
          <button type="button" className="mode-primary" onClick={() => void syncAndStart(phase.user, phase.profile)}>Erneut versuchen</button>
          <button type="button" className="mode-secondary" onClick={() => exportCurrentSave(undefined)}>Spielstand als Datei sichern</button>
        </div>
      </>}
      {phase.name === "choose-save" && <ChooseSave phase={phase} onAccount={() => { exportCurrentSave(undefined); try { applyCloudSave(phase.user.id, phase.cloud); } catch { setPhase({ name: "storage-full", user: phase.user, profile: phase.profile }); return; } startGame(phase.user, phase.profile); }} onGuest={() => { writeCloudMeta({ userId: phase.user.id, version: phase.cloud.version, hash: "", played: true }); startGame(phase.user, phase.profile); }} />}
      {phase.name === "unreachable" && <>
        <h2>Keine Verbindung</h2>
        <p>{phase.message} Prüfe dein Internet und versuche es nochmal.{phase.offlineProfile ? " Du kannst auch offline weiterspielen; dein Fortschritt wird gespeichert, sobald die Verbindung zurück ist." : ""}</p>
        <div className="account-actions">
          <button type="button" className="mode-primary" onClick={() => void enter()}>Erneut versuchen</button>
          {phase.user && phase.offlineProfile && <button type="button" className="mode-secondary" onClick={() => startGame(phase.user!, phase.offlineProfile!)}>Offline weiterspielen</button>}
        </div>
      </>}
    </section>
  </main>;
}

const describeSave = (summary: SaveSummary | null) => summary ? `${Math.floor(summary.totalGoals).toLocaleString("de-CH")} Tore insgesamt, ${summary.seasons} Saisons, ${summary.stars} Sterne` : "kein Spielstand";

/** A guest signs in to an account that already has a save: which one continues. Nothing is replaced silently. */
function ChooseSave({ phase, onAccount, onGuest }: { phase: { local: SaveSummary | null; account: SaveSummary | null }; onAccount: () => void; onGuest: () => void }) {
  return <>
    <h2>Welcher Spielstand?</h2>
    <p>Dein Konto hat schon einen Spielstand. In diesem Browser liegt dein Gast Spielstand. Nur einer kann weitergespielt werden.</p>
    <p><strong>Konto:</strong> {describeSave(phase.account)}<br /><strong>Gast:</strong> {describeSave(phase.local)}</p>
    <p className="account-hint">Lädst du den Kontospielstand, wird dein Gast Spielstand vorher als Datei gesichert. Behältst du den Gast Spielstand, ersetzt er den Spielstand in deinem Konto.</p>
    <div className="account-actions">
      <button type="button" className="mode-primary" onClick={onAccount}>Kontospielstand laden</button>
      <button type="button" className="mode-secondary" onClick={onGuest}>Gast Spielstand behalten</button>
      <button type="button" className="mode-secondary quiet" onClick={() => exportCurrentSave(undefined)}>Gast Spielstand als Datei sichern</button>
    </div>
  </>;
}

/** The live "free or taken" check while a username is typed. */
function useUsernameCheck(username: string) {
  const [availability, setAvailability] = useState<{ name: string; available: boolean; error?: string } | null>(null);
  const trimmed = username.trim();
  const localProblem = trimmed ? usernameError(trimmed) : null;

  useEffect(() => {
    if (!trimmed || localProblem) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/profile/username?name=${encodeURIComponent(trimmed)}`, { cache: "no-store" })
        .then((response) => readJson<{ available?: boolean }>(response))
        .then((body) => { if (active) setAvailability({ name: trimmed, available: Boolean(body.available), error: body.error }); })
        .catch(() => undefined);
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [trimmed, localProblem]);

  const checked = availability?.name === trimmed ? availability : null;
  const message = localProblem ?? (checked ? (checked.available ? "Dieser Benutzername ist frei." : checked.error ?? "Dieser Benutzername ist schon vergeben.") : "");
  const tone = localProblem || checked?.available === false ? " bad" : checked?.available ? " good" : "";
  return { trimmed, message, tone, blocked: Boolean(localProblem) || checked?.available === false };
}

function UsernameHint({ check }: { check: ReturnType<typeof useUsernameCheck> }) {
  return <small className={`account-hint${check.tone}`}>{check.message || "3 bis 20 Zeichen: Buchstaben, Zahlen und _. Änderbar alle 30 Tage."}</small>;
}

/** A login whose account was deleted: the data is gone, the login is locked until the owner removes it. */
function FinishDeletion({ message }: { message: string }) {
  return <>
    <h2>Konto gelöscht</h2>
    <p>{message}</p>
    <div className="account-actions">
      <button type="button" className="mode-primary" onClick={() => { clearLocalAccountData(); localStorage.removeItem(PROFILE_CACHE_KEY); void signOutOfAuth().then(() => window.location.replace("/")); }}>Abmelden</button>
    </div>
  </>;
}

/**
 * A password field with an eye button on its right: masked by default, one tap shows the characters of this field only,
 * another hides them again. The state is local to the field (a new form starts masked), is never stored and does not
 * touch the value, the focus or the cursor position. The button is no submit button and keeps password managers working.
 */
export function PasswordInput({ fieldName, labelId, value, onChange, autoComplete, minLength }: { fieldName: string; /** The id of the visible label text: the field is named by it alone, not by the eye button inside the same label. */ labelId?: string; value: string; onChange: (next: string) => void; autoComplete: string; minLength?: number }) {
  const [shown, setShown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    const input = inputRef.current, caret = caretRef.current;
    caretRef.current = null;
    if (!input || !caret) return;
    // The browser resets the selection when the field type changes; put it back after that has happened.
    const restore = () => { input.focus(); try { input.setSelectionRange(caret[0], caret[1]); } catch { /* not supported for this input type */ } };
    restore();
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [shown]);
  return <span className="account-password">
    <input ref={inputRef} className="mode-input" type={shown ? "text" : "password"} aria-labelledby={labelId} autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} minLength={minLength} maxLength={PASSWORD_MAX} required value={value} onChange={(event) => onChange(event.target.value)} />
    <button type="button" className="account-password-toggle" aria-label={`${fieldName} ${shown ? "verbergen" : "anzeigen"}`} aria-pressed={shown}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => { const input = inputRef.current; caretRef.current = [input?.selectionStart ?? value.length, input?.selectionEnd ?? value.length]; setShown((current) => !current); }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{shown && <path d="M4 4l16 16" />}
      </svg>
    </button>
  </span>;
}

function LoginForm({ message, onSignedIn, onGuest }: { message?: string; onSignedIn: () => void; onGuest: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(mode === "register" ? username : "");
  const passwordLabelId = useId(), repeatLabelId = useId();

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError("");
    setPassword("");
    setPasswordRepeat("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (mode === "register") {
      const problem = usernameError(username) ?? displayNameError(displayName) ?? passwordError(password) ?? (password !== passwordRepeat ? "Die beiden Passwörter stimmen nicht überein." : null);
      if (problem) { setError(problem); return; }
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await signInWithUsername(username.trim(), password);
      else await registerWithUsername(username.trim(), displayName, password);
      onSignedIn();
    } catch (failure) {
      setError(authErrorMessage(failure));
      setBusy(false);
    }
  }

  return <>
    <h2>{mode === "login" ? "Anmelden" : "Konto erstellen"}</h2>
    <p>Melde dich an, damit dein Spielstand auf allen deinen Geräten gleich ist.</p>
    {message && <p className="account-notice" role="status">{message}</p>}
    <button type="button" className="account-google" disabled={busy} onClick={() => void signInWithGoogle(window.location.pathname).catch((failure: unknown) => setError(authErrorMessage(failure)))}><span aria-hidden="true">G</span>Mit Google anmelden</button>
    <div className="account-divider"><span>oder mit Benutzername</span></div>
    <div className="account-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Anmelden</button>
      <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Konto erstellen</button>
    </div>
    <form className="account-form" onSubmit={(event) => void submit(event)}>
      <label className="account-field"><span>Benutzername</span><input className="mode-input" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={USERNAME_MAX} required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      {mode === "register" && <UsernameHint check={check} />}
      {mode === "register" && <><label className="account-field"><span>Anzeigename</span><input className="mode-input" autoComplete="nickname" maxLength={DISPLAY_NAME_MAX} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <small className="account-hint">So heisst du im Spiel und im Multiplayer. Jederzeit änderbar.</small></>}
      <label className="account-field"><span id={passwordLabelId}>{mode === "register" ? `Passwort (mindestens ${PASSWORD_MIN} Zeichen)` : "Passwort"}</span><PasswordInput key={`password-${mode}`} fieldName="Passwort" labelId={passwordLabelId} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : PASSWORD_MIN} value={password} onChange={setPassword} /></label>
      {mode !== "login" && <label className="account-field"><span id={repeatLabelId}>Passwort wiederholen</span><PasswordInput fieldName="Passwort wiederholen" labelId={repeatLabelId} autoComplete="new-password" value={passwordRepeat} onChange={setPasswordRepeat} /></label>}
      {mode === "register" && <small className="account-hint">Merk dir dein Passwort gut: Ohne E-Mail Adresse lässt es sich nicht zurücksetzen.</small>}
      <button type="submit" className="mode-primary" disabled={busy || (mode === "register" && check.blocked)}>{mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
    <div className="account-guest">
      <button type="button" className="mode-secondary quiet" disabled={busy} onClick={onGuest}>Als Gast fortfahren</button>
      <small className="account-hint">Als Gast spielst du nur Einzelspieler, und dein Spielstand bleibt in diesem Browser. Anmelden kannst du dich jederzeit.</small>
    </div>
  </>;
}

function ProfileSetup({ user, onCreated, onSignOut }: { user: SessionUser; onCreated: (profile: PublicProfile) => void; onSignOut: () => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user.suggestedName);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(username);
  const trimmed = check.trimmed;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = usernameError(trimmed) ?? displayNameError(displayName);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: trimmed, displayName }) });
      const body = await readJson<{ profile?: PublicProfile }>(response);
      if (response.ok && body.profile) onCreated(body.profile);
      else setError(body.error ?? "Das Profil konnte nicht erstellt werden.");
    } catch {
      setError("Keine Verbindung. Prüfe dein Internet.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <h2>Dein Profil</h2>
    <p>Angemeldet als {user.email ?? "neues Konto"}. Wähle einen Benutzernamen, den es nur einmal gibt, und einen Namen, den die anderen im Spiel sehen.</p>
    <form className="account-form" onSubmit={(event) => void submit(event)}>
      <label className="account-field"><span>Benutzername</span><input className="mode-input" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={USERNAME_MAX} required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      <UsernameHint check={check} />
      <label className="account-field"><span>Anzeigename</span><input className="mode-input" autoComplete="nickname" maxLength={DISPLAY_NAME_MAX} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
      <small className="account-hint">So heisst du im Spiel und im Multiplayer. Jederzeit änderbar.</small>
      <button type="submit" className="mode-primary" disabled={busy || check.blocked}>Profil erstellen</button>
      <button type="button" className="mode-secondary quiet" onClick={onSignOut}>Abmelden</button>
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
  </>;
}
