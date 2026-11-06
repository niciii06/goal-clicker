"use client";

import { useState } from "react";

export default function RecoverAccountPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, code, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Die Wiederherstellung ist fehlgeschlagen.");
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bitte nochmals versuchen.");
    } finally {
      setBusy(false);
    }
  }
  return <main style={{ maxWidth: 420, margin: "60px auto", padding: 24, fontFamily: "system-ui" }}>
    <h1>Goal Clicker: Konto wiederherstellen</h1>
    <p>Für bestehende Konten ohne Zugriff auf das alte Passwort. Den einmaligen Code erhältst du vom Spielbesitzer.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
      <label>Benutzername<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} style={{ display: "block", width: "100%", padding: 10 }} /></label>
      <label>Wiederherstellungscode<input required autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} style={{ display: "block", width: "100%", padding: 10 }} /></label>
      <label>Neues Passwort<input required type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} style={{ display: "block", width: "100%", padding: 10 }} /></label>
      <button disabled={busy} type="submit" style={{ padding: 12, cursor: "pointer" }}>{busy ? "Bitte warten…" : "Konto wiederherstellen"}</button>
    </form>
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    <p><a href="/">Zurück zum Spiel</a></p>
  </main>;
}
