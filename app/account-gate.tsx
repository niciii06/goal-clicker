"use client";
// Login is required once Supabase is configured: Google, or username and password (no e-mail involved). Every
// account has a profile with a unique username and a display name; Google accounts create it after their first
// login, username accounts when they register. Before the game starts, the account's cloud save is written to
// localStorage; while it runs, CloudSync uploads every change.
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authErrorMessage, browserSupabase, registerWithUsername, signInWithGoogle, signInWithUsername } from "./auth/browser";
import { authConfigured } from "./auth/config";
import { summarizeSave } from "./cloud-save-rules";
import type { CloudSaveKeys, SaveSummary } from "./cloud-save-rules";
import { applyCloudSave, clearLocalAccountData, CloudSync, fetchCloudSave, planInitialSync, readCloudMeta, readLocalSaveKeys, writeCloudMeta } from "./cloud-sync";
import type { CloudSaveState } from "./cloud-sync";
import { PLAYER_NAME_KEY } from "./game/constants";
import { formatNumber } from "./game/format";
import { suspendLocalPersistence } from "./game/storage";
import { cleanDisplayName, DISPLAY_NAME_MAX, displayNameError, isPasswordLoginEmail, PASSWORD_MAX, PASSWORD_MIN, passwordError, USERNAME_MAX, usernameError } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

export type AccountContextValue = {
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

/** null in local development without Supabase, where the game runs without an account as before. */
export const AccountContext = createContext<AccountContextValue | null>(null);

const PROFILE_CACHE_KEY = "goalClickerProfileCacheV1";
const LOGIN_MESSAGES: Record<string, string> = {
  abgebrochen: "Die Anmeldung wurde abgebrochen.",
  fehler: "Die Anmeldung hat nicht geklappt. Bitte erneut versuchen.",
  "nicht-konfiguriert": "Der Login ist auf diesem Server noch nicht eingerichtet.",
};

type SessionUser = { id: string; email: string | null; passwordLogin: boolean; suggestedName: string };
type Phase =
  | { name: "checking" }
  | { name: "signed-out"; message?: string }
  | { name: "profile"; user: SessionUser }
  | { name: "choose"; user: SessionUser; profile: PublicProfile; cloud: CloudSaveState; local: CloudSaveKeys }
  | { name: "unreachable"; message: string; user: SessionUser | null; offlineProfile: PublicProfile | null }
  | { name: "ready"; user: SessionUser; profile: PublicProfile };

function readProfileCache(userId: string): PublicProfile | null {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? "null") as { userId?: string; profile?: PublicProfile } | null;
    return cached?.userId === userId && cached.profile ? cached.profile : null;
  } catch {
    return null;
  }
}

function writeProfileCache(userId: string, profile: PublicProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ userId, profile }));
  } catch {
    // Only needed to start offline.
  }
}

function sessionUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): SessionUser {
  const metadata = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name, metadata.given_name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const passwordLogin = isPasswordLoginEmail(user.email);
  const fromEmail = user.email && !passwordLogin ? user.email.split("@")[0] : "";
  return { id: user.id, email: passwordLogin ? null : user.email ?? null, passwordLogin, suggestedName: cleanDisplayName(name ?? fromEmail).slice(0, DISPLAY_NAME_MAX) };
}

async function readJson<T>(response: Response) {
  return await response.json().catch(() => ({})) as T & { error?: string; errorCode?: string };
}

export function AccountGate({ children }: { children: ReactNode }) {
  // Without Supabase (local development, tests) the game starts right away without an account.
  if (!authConfigured()) return <>{children}</>;
  return <RequiredAccount>{children}</RequiredAccount>;
}

function RequiredAccount({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: "checking" });
  const [conflict, setConflict] = useState<CloudSaveState | null>(null);
  const syncRef = useRef<CloudSync | null>(null);

  const startGame = useCallback((user: SessionUser, profile: PublicProfile) => {
    localStorage.setItem(PLAYER_NAME_KEY, profile.displayName);
    syncRef.current?.stop();
    const sync = new CloudSync(user.id, {
      onConflict: setConflict,
      onNewerSave: (cloud) => {
        suspendLocalPersistence();
        applyCloudSave(user.id, cloud);
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
    const plan = planInitialSync(readCloudMeta(user.id), cloud, readLocalSaveKeys());
    if (plan === "ask") {
      setPhase({ name: "choose", user, profile, cloud, local: readLocalSaveKeys() });
      return;
    }
    if (plan === "use-cloud") applyCloudSave(user.id, cloud);
    // The next upload replaces the cloud save on top of its current version.
    else if (plan === "keep-local") writeCloudMeta({ userId: user.id, version: cloud.version, hash: "", played: true });
    else if (!cloud.keys) writeCloudMeta({ userId: user.id, version: cloud.version, hash: "" });
    startGame(user, profile);
  }, [startGame]);

  const enter = useCallback(async () => {
    setPhase({ name: "checking" });
    const supabase = browserSupabase()!;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setPhase({ name: "signed-out" });
      return;
    }
    const user = sessionUser(data.session.user);
    let profile: PublicProfile | null;
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.status === 401) {
        await supabase.auth.signOut({ scope: "local" });
        setPhase({ name: "signed-out", message: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an." });
        return;
      }
      const body = await readJson<{ profile: PublicProfile | null }>(response);
      if (!response.ok) throw new Error(body.error);
      profile = body.profile;
    } catch {
      setPhase({ name: "unreachable", message: "Keine Verbindung zum Server.", user, offlineProfile: readCloudMeta(user.id) ? readProfileCache(user.id) : null });
      return;
    }
    if (!profile) {
      setPhase({ name: "profile", user });
      return;
    }
    writeProfileCache(user.id, profile);
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
    // Signing out in another tab ends the session here too.
    const { data } = browserSupabase()!.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      syncRef.current?.stop();
      setPhase((current) => current.name === "signed-out" ? current : { name: "signed-out", message: "Du wurdest abgemeldet." });
    });
    return () => {
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
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
    await browserSupabase()!.auth.signOut().catch(() => undefined);
    window.location.replace("/");
  }, []);

  const deleteProfile = useCallback(async (confirm: string) => {
    const response = await fetch("/api/profile", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    const body = await readJson<{ deleted?: boolean }>(response);
    if (!response.ok || !body.deleted) throw new Error(body.error ?? "Das Profil konnte nicht gelöscht werden.");
    syncRef.current?.stop();
    suspendLocalPersistence();
    clearLocalAccountData();
    localStorage.removeItem(PROFILE_CACHE_KEY);
    await browserSupabase()!.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.replace("/");
  }, []);

  const ready = phase.name === "ready" ? phase : null;
  const setProfile = useCallback((profile: PublicProfile) => {
    setPhase((current) => current.name === "ready" ? { ...current, profile } : current);
    if (ready) writeProfileCache(ready.user.id, profile);
    localStorage.setItem(PLAYER_NAME_KEY, profile.displayName);
  }, [ready]);
  const context = useMemo<AccountContextValue | null>(() => ready ? { userId: ready.user.id, email: ready.user.email, passwordLogin: ready.user.passwordLogin, profile: ready.profile, setProfile, signOut, deleteProfile } : null, [ready, setProfile, signOut, deleteProfile]);

  const keepThisDevice = useCallback(async (current: CloudSaveState) => {
    const sync = syncRef.current;
    if (sync && await sync.upload({ overwriteVersion: current.version })) {
      setConflict(null);
      sync.start();
    }
  }, []);

  const loadCloud = useCallback((userId: string, current: CloudSaveState) => {
    suspendLocalPersistence();
    applyCloudSave(userId, current);
    window.location.reload();
  }, []);

  if (phase.name === "ready") {
    return <AccountContext.Provider value={context}>
      {children}
      {conflict && <div className="account-overlay" role="dialog" aria-modal="true" aria-labelledby="save-conflict-title">
        <section className="account-card">
          <p className="eyebrow">SPIELSTAND / ANDERES GERÄT</p>
          <h2 id="save-conflict-title">Auf einem anderen Gerät wurde weitergespielt</h2>
          <p>Dein Profil hat inzwischen einen neueren Spielstand. Welchen willst du behalten? Der andere wird überschrieben.</p>
          <SaveChoice cloud={conflict} local={readLocalSaveKeys()} onCloud={() => loadCloud(phase.user.id, conflict)} onLocal={() => void keepThisDevice(conflict)} />
        </section>
      </div>}
    </AccountContext.Provider>;
  }

  return <main className="account-screen">
    <section className="account-card">
      <div className="account-brand"><span className="account-brand-ball" aria-hidden="true">⚽</span><div><p className="eyebrow">FOOTBALL IDLE CLUB</p><strong>Goal Clicker</strong></div></div>
      {phase.name === "checking" && <p className="account-status" role="status">Anmeldung wird geprüft …</p>}
      {phase.name === "signed-out" && <LoginForm message={phase.message} onSignedIn={() => void enter()} />}
      {phase.name === "profile" && <ProfileSetup user={phase.user} onCreated={(profile) => { writeProfileCache(phase.user.id, profile); void syncAndStart(phase.user, profile); }} onSignOut={() => void signOut()} />}
      {phase.name === "choose" && <>
        <h2>Welchen Spielstand willst du?</h2>
        <p>Auf diesem Gerät gibt es einen Spielstand, und in deinem Profil liegt ein anderer. Der nicht gewählte wird überschrieben.</p>
        <SaveChoice cloud={phase.cloud} local={phase.local} onCloud={() => { applyCloudSave(phase.user.id, phase.cloud); startGame(phase.user, phase.profile); }} onLocal={() => { writeCloudMeta({ userId: phase.user.id, version: phase.cloud.version, hash: "", played: true }); startGame(phase.user, phase.profile); }} />
      </>}
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

function SaveSummaryText({ summary }: { summary: SaveSummary | null }) {
  if (!summary) return <small>Kein Spielstand</small>;
  return <small>{formatNumber(summary.totalGoals)} Tore insgesamt · Saison {summary.seasons + 1} · {summary.stars} Sterne</small>;
}

function SaveChoice({ cloud, local, onCloud, onLocal }: { cloud: CloudSaveState; local: CloudSaveKeys; onCloud: () => void; onLocal: () => void }) {
  const savedAt = cloud.updatedAt ? new Date(cloud.updatedAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" }) : "";
  return <div className="save-choice">
    <button type="button" onClick={onCloud}><span className="eyebrow">IM PROFIL</span><strong>Stand aus dem Profil laden</strong><SaveSummaryText summary={summarizeSave(cloud.keys)} />{savedAt && <small>Gespeichert am {savedAt}</small>}</button>
    <button type="button" onClick={onLocal}><span className="eyebrow">DIESES GERÄT</span><strong>Diesen Stand behalten</strong><SaveSummaryText summary={summarizeSave(local)} /></button>
  </div>;
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

function LoginForm({ message, onSignedIn }: { message?: string; onSignedIn: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(mode === "register" ? username : "");

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
      <label className="account-field"><span>{mode === "register" ? `Passwort (mindestens ${PASSWORD_MIN} Zeichen)` : "Passwort"}</span><input className="mode-input" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? PASSWORD_MIN : undefined} maxLength={PASSWORD_MAX} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {mode === "register" && <label className="account-field"><span>Passwort wiederholen</span><input className="mode-input" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} /></label>}
      {mode === "register" && <small className="account-hint">Merk dir dein Passwort gut: Ohne E-Mail Adresse lässt es sich nicht zurücksetzen.</small>}
      <button type="submit" className="mode-primary" disabled={busy || (mode === "register" && check.blocked)}>{mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
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
