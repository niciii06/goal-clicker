"use client";
// Login is required once Supabase is configured: Google, a code by e-mail or e-mail and password. After the
// first login every account creates a profile (unique username, display name). Before the game starts, the
// account's cloud save is written to localStorage; while it runs, CloudSync uploads every change.
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { authErrorMessage, browserSupabase, resendSignupCode, sendLoginCode, sendPasswordResetCode, setAccountPassword, signInWithGoogle, signInWithPassword, signUpWithPassword, verifyEmailCode } from "./auth/browser";
import type { EmailCodeKind } from "./auth/browser";
import { authConfigured } from "./auth/config";
import { summarizeSave } from "./cloud-save-rules";
import type { CloudSaveKeys, SaveSummary } from "./cloud-save-rules";
import { applyCloudSave, clearLocalAccountData, CloudSync, fetchCloudSave, planInitialSync, readCloudMeta, readLocalSaveKeys, writeCloudMeta } from "./cloud-sync";
import type { CloudSaveState } from "./cloud-sync";
import { PLAYER_NAME_KEY } from "./game/constants";
import { formatNumber } from "./game/format";
import { suspendLocalPersistence } from "./game/storage";
import { cleanDisplayName, DISPLAY_NAME_MAX, displayNameError, PASSWORD_MIN, USERNAME_MAX, usernameError } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

export type AccountContextValue = {
  userId: string;
  email: string | null;
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

type SessionUser = { id: string; email: string | null; suggestedName: string };
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
  const fromEmail = user.email ? user.email.split("@")[0] : "";
  return { id: user.id, email: user.email ?? null, suggestedName: cleanDisplayName(name ?? fromEmail).slice(0, DISPLAY_NAME_MAX) };
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
  const context = useMemo<AccountContextValue | null>(() => ready ? { userId: ready.user.id, email: ready.user.email, profile: ready.profile, setProfile, signOut, deleteProfile } : null, [ready, setProfile, signOut, deleteProfile]);

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

type LoginView = { name: "start"; tab: "code" | "password" } | { name: "signup" } | { name: "verify"; kind: EmailCodeKind } | { name: "reset" } | { name: "reset-verify" };

function LoginForm({ message, onSignedIn }: { message?: string; onSignedIn: () => void }) {
  const [view, setView] = useState<LoginView>({ name: "start", tab: "code" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState(message ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (resendAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [resendAt, now]);

  const cleanEmail = email.trim().toLowerCase();
  const go = (next: LoginView, info = "") => { setView(next); setError(""); setNotice(info); setCode(""); };

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function codeSent(kind: EmailCodeKind | "recovery-form") {
    const started = Date.now();
    setNow(started);
    setResendAt(started + 60_000);
    if (kind === "recovery-form") go({ name: "reset-verify" }, `Wir haben dir einen Code an ${cleanEmail} geschickt.`);
    else go({ name: "verify", kind }, `Wir haben dir einen Code an ${cleanEmail} geschickt. Schau auch im Spam Ordner nach.`);
  }

  function passwordProblem() {
    if (password.length < PASSWORD_MIN) return `Das Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`;
    if (password !== passwordRepeat) return "Die beiden Passwörter stimmen nicht überein.";
    return "";
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (view.name === "start" && view.tab === "code") void run(async () => { await sendLoginCode(cleanEmail); codeSent("email"); });
    if (view.name === "start" && view.tab === "password") void run(async () => {
      try {
        await signInWithPassword(cleanEmail, password);
        onSignedIn();
      } catch (failure) {
        if ((failure as { code?: string }).code !== "email_not_confirmed") throw failure;
        await resendSignupCode(cleanEmail);
        codeSent("signup");
      }
    });
    if (view.name === "signup") {
      const problem = passwordProblem();
      if (problem) { setError(problem); return; }
      void run(async () => {
        const { alreadyRegistered } = await signUpWithPassword(cleanEmail, password);
        if (alreadyRegistered) { go({ name: "start", tab: "password" }, "Für diese Adresse gibt es schon ein Konto. Melde dich an oder nutze Passwort vergessen."); return; }
        codeSent("signup");
      });
    }
    if (view.name === "verify") void run(async () => { await verifyEmailCode(cleanEmail, code.trim(), view.kind); onSignedIn(); });
    if (view.name === "reset") void run(async () => { await sendPasswordResetCode(cleanEmail); codeSent("recovery-form"); });
    if (view.name === "reset-verify") {
      const problem = passwordProblem();
      if (problem) { setError(problem); return; }
      void run(async () => { await verifyEmailCode(cleanEmail, code.trim(), "recovery"); await setAccountPassword(password); onSignedIn(); });
    }
  }

  function resend() {
    if (view.name !== "verify" && view.name !== "reset-verify") return;
    const kind = view.name === "reset-verify" ? "recovery" : view.kind;
    void run(async () => {
      if (kind === "email") await sendLoginCode(cleanEmail);
      else if (kind === "signup") await resendSignupCode(cleanEmail);
      else await sendPasswordResetCode(cleanEmail);
      codeSent(kind === "recovery" ? "recovery-form" : kind);
    });
  }

  const emailField = <label className="account-field"><span>E-Mail</span><input className="mode-input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>;
  const codeField = <label className="account-field"><span>Code aus der Mail</span><input className="mode-input account-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>;
  const newPasswordFields = <>
    <label className="account-field"><span>Passwort (mindestens {PASSWORD_MIN} Zeichen)</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label className="account-field"><span>Passwort wiederholen</span><input className="mode-input" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} /></label>
  </>;
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  return <>
    <h2>{view.name === "signup" ? "Konto erstellen" : view.name === "reset" || view.name === "reset-verify" ? "Neues Passwort" : view.name === "verify" ? "Code eingeben" : "Anmelden"}</h2>
    {view.name === "start" && <>
      <p>Melde dich an, damit dein Spielstand auf allen deinen Geräten gleich ist.</p>
      <button type="button" className="account-google" disabled={busy} onClick={() => void run(() => signInWithGoogle("/"))}><span aria-hidden="true">G</span>Mit Google anmelden</button>
      <div className="account-divider"><span>oder mit E-Mail</span></div>
      <div className="account-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view.tab === "code"} className={view.tab === "code" ? "active" : ""} onClick={() => go({ name: "start", tab: "code" })}>Code per Mail</button>
        <button type="button" role="tab" aria-selected={view.tab === "password"} className={view.tab === "password" ? "active" : ""} onClick={() => go({ name: "start", tab: "password" })}>Passwort</button>
      </div>
    </>}
    {notice && <p className="account-notice" role="status">{notice}</p>}
    <form className="account-form" onSubmit={submit}>
      {view.name === "start" && view.tab === "code" && <>{emailField}<small className="account-hint">Du bekommst einen Code per Mail. Ohne Konto wird automatisch eines erstellt.</small><button type="submit" className="mode-primary" disabled={busy}>Code senden</button></>}
      {view.name === "start" && view.tab === "password" && <>
        {emailField}
        <label className="account-field"><span>Passwort</span><input className="mode-input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button type="submit" className="mode-primary" disabled={busy}>Anmelden</button>
        <div className="account-links"><button type="button" onClick={() => go({ name: "signup" })}>Neues Konto mit Passwort</button><button type="button" onClick={() => go({ name: "reset" })}>Passwort vergessen?</button></div>
      </>}
      {view.name === "signup" && <>{emailField}{newPasswordFields}<small className="account-hint">Danach schicken wir dir einen Code, um die Adresse zu bestätigen.</small><button type="submit" className="mode-primary" disabled={busy}>Konto erstellen</button></>}
      {view.name === "verify" && <>{codeField}<button type="submit" className="mode-primary" disabled={busy || code.length < 6}>Bestätigen</button></>}
      {view.name === "reset" && <>{emailField}<button type="submit" className="mode-primary" disabled={busy}>Code senden</button></>}
      {view.name === "reset-verify" && <>{codeField}{newPasswordFields}<button type="submit" className="mode-primary" disabled={busy || code.length < 6}>Passwort speichern</button></>}
      {(view.name === "verify" || view.name === "reset-verify") && <button type="button" className="mode-secondary" disabled={busy || waitSeconds > 0} onClick={resend}>{waitSeconds > 0 ? `Neuer Code in ${waitSeconds} s` : "Neuen Code senden"}</button>}
      {view.name !== "start" && <button type="button" className="mode-secondary quiet" onClick={() => go({ name: "start", tab: view.name === "verify" && view.kind === "email" ? "code" : "password" })}>Zurück</button>}
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
  </>;
}

function ProfileSetup({ user, onCreated, onSignOut }: { user: SessionUser; onCreated: (profile: PublicProfile) => void; onSignOut: () => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user.suggestedName);
  const [availability, setAvailability] = useState<{ name: string; available: boolean; error?: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  const usernameMessage = localProblem ?? (checked ? (checked.available ? "Dieser Benutzername ist frei." : checked.error ?? "Dieser Benutzername ist schon vergeben.") : "");

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
      <small className={`account-hint${usernameMessage && (localProblem || checked?.available === false) ? " bad" : checked?.available ? " good" : ""}`}>{usernameMessage || "3 bis 20 Zeichen: Buchstaben, Zahlen und _. Änderbar alle 30 Tage."}</small>
      <label className="account-field"><span>Anzeigename</span><input className="mode-input" autoComplete="nickname" maxLength={DISPLAY_NAME_MAX} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
      <small className="account-hint">So heisst du im Spiel und im Multiplayer. Jederzeit änderbar.</small>
      <button type="submit" className="mode-primary" disabled={busy || Boolean(localProblem) || checked?.available === false}>Profil erstellen</button>
      <button type="button" className="mode-secondary quiet" onClick={onSignOut}>Abmelden</button>
    </form>
    {error && <p className="account-error" role="alert">{error}</p>}
  </>;
}
