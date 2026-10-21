"use client";
// Google login (Supabase Auth) and the save file export/import for single player saves.
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { browserSupabase, signInWithGoogle } from "./auth/browser";
import { AUTH_SIGNOUT_PATH, authConfigured } from "./auth/config";
import { suspendLocalPersistence } from "./game/storage";
import { applySaveFile, createSaveFile, parseSaveFile, saveFileName, savedPlayerId } from "./save-file";

const LOGIN_MESSAGES: Record<string, string> = {
  abgebrochen: "Die Anmeldung wurde abgebrochen.",
  fehler: "Die Anmeldung hat nicht geklappt. Bitte erneut versuchen.",
  "nicht-konfiguriert": "Der Login ist auf diesem Server noch nicht eingerichtet.",
};
const ADOPT_AFTER_IMPORT_KEY = "goalClickerAdoptAfterImport";

type AccountState = { status: "loading" | "signed-out" | "signed-in" | "off"; email: string | null };

async function linkAccount(playerId: string, adopt: boolean) {
  const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId, adopt }) });
  const data = await response.json() as { playerId?: string; email?: string | null; error?: string; adoptError?: string };
  if (!response.ok) throw new Error(data.error ?? "Das Konto konnte nicht geladen werden.");
  return data;
}

/**
 * Login chip for the header. Once signed in, the account's player ID becomes this browser's player ID,
 * so every device of the account sees the same worlds.
 */
export function AccountChip({ playerId, onPlayerId, onMessage }: { playerId: string; onPlayerId: (id: string) => void; onMessage: (text: string) => void }) {
  const [account, setAccount] = useState<AccountState>({ status: authConfigured() ? "loading" : "off", email: null });
  const linked = useRef("");

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;
    const login = new URLSearchParams(window.location.search).get("login");
    if (login && LOGIN_MESSAGES[login]) {
      onMessage(LOGIN_MESSAGES[login]);
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
    const apply = (email: string | null | undefined, signedIn: boolean) => setAccount({ status: signedIn ? "signed-in" : "signed-out", email: email ?? null });
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user.email, Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user.email, Boolean(session)));
    return () => data.subscription.unsubscribe();
    // onMessage only reports the result of the redirect once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (account.status !== "signed-in" || !playerId || linked.current === playerId) return;
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
  }, [account.status, playerId, onPlayerId, onMessage]);

  if (account.status === "off" || account.status === "loading") return null;
  if (account.status === "signed-out") {
    return <button type="button" className="account-chip" onClick={() => { void signInWithGoogle(window.location.pathname).catch((error: Error) => onMessage(error.message)); }}>Mit Google anmelden</button>;
  }
  return <form className="account-chip signed-in" method="post" action={AUTH_SIGNOUT_PATH}>
    <span title={account.email ?? undefined}>{account.email ?? "Angemeldet"}</span>
    <button type="submit">Abmelden</button>
  </form>;
}

/** Download and upload of the single player save, for moving to a new address or device. */
export function SaveTransferPanel({ onMessage }: { onMessage: (text: string) => void }) {
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
    <div><p className="eyebrow">SPIELSTAND / SICHERN</p><h4>Spielstand als Datei</h4><p>Der Einzelspieler Spielstand liegt nur in diesem Browser. Lade ihn als Datei herunter, um ihn auf einer neuen Adresse oder einem anderen Gerät wieder hochzuladen. Die Datei enthält auch deine Spieler ID für deine Multiplayer Welten.</p></div>
    <div className="save-transfer-actions">
      <button type="button" className="mode-secondary" onClick={exportSave}>Spielstand herunterladen</button>
      <button type="button" className="mode-secondary" disabled={busy} onClick={() => input.current?.click()}>Spielstand hochladen</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => void importSave(event)} />
    </div>
  </section>;
}
