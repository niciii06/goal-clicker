"use client";
// "Spielstand als Datei sichern" and "Spielstand aus Datei laden" (Club tab, and the save failed banner).
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { markCloudMetaPlayed } from "./cloud-sync";
import { summarizeSave } from "./cloud-save-rules";
import type { CloudSaveKeys, SaveSummary } from "./cloud-save-rules";
import { collectSaveKeys, downloadSaveFile, parseSaveFile, replaceLocalSave } from "./game/save-export";
import { resumeLocalPersistence, suspendLocalPersistence } from "./game/storage";

const number = (value: number) => Math.floor(value).toLocaleString("de-CH");
const describe = (summary: SaveSummary | null) => summary ? `${number(summary.totalGoals)} Tore insgesamt, ${number(summary.seasons)} Saisons, ${number(summary.stars)} Sterne` : "kein Spielstand";

/** Saves the game as it is on screen (it may be newer than the stored one when the browser storage is full). */
export function exportCurrentSave(currentGame: unknown) {
  try {
    return downloadSaveFile(collectSaveKeys(localStorage, currentGame));
  } catch {
    return false;
  }
}

type PendingImport = { keys: CloudSaveKeys; summary: SaveSummary; exportedAt: string | null; current: SaveSummary | null };

export function SaveFileControls({ getGame, onMessage }: { getGame: () => unknown; onMessage: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);

  function exportSave() {
    onMessage(exportCurrentSave(getGame()) ? "Spielstand als Datei gesichert." : "Der Spielstand konnte nicht als Datei gesichert werden.");
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      onMessage("Die Datei konnte nicht gelesen werden.");
      return;
    }
    const parsed = parseSaveFile(text);
    if (!parsed.ok) { onMessage(parsed.error); return; }
    setPending({ keys: parsed.keys, summary: parsed.summary, exportedAt: parsed.exportedAt, current: summarizeSave(collectSaveKeys(localStorage, getGame())) });
  }

  function confirmImport() {
    if (!pending) return;
    // The current game goes into a file first, so nothing is lost even if the imported one was the wrong file.
    if (!exportCurrentSave(getGame())) {
      setPending(null);
      onMessage("Der aktuelle Spielstand konnte nicht gesichert werden. Es wurde nichts ersetzt.");
      return;
    }
    suspendLocalPersistence();
    try {
      replaceLocalSave(localStorage, pending.keys);
      markCloudMetaPlayed();
    } catch {
      resumeLocalPersistence();
      setPending(null);
      onMessage("Der Spielstand konnte nicht geladen werden, der Browser Speicher ist voll. Dein bisheriger Spielstand ist unverändert.");
      return;
    }
    window.location.reload();
  }

  const exportedAt = pending?.exportedAt ? new Date(pending.exportedAt) : null;
  return <div className="save-file-controls" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
    <button type="button" className="mode-secondary" onClick={exportSave}>Spielstand als Datei sichern</button>
    <button type="button" className="mode-secondary" onClick={() => inputRef.current?.click()}>Spielstand aus Datei laden</button>
    <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void chooseFile(event)} />
    {pending && <ConfirmDialog title="Spielstand aus Datei laden?" confirmLabel="Spielstand ersetzen" onCancel={() => setPending(null)} onConfirm={confirmImport}>
      <p>Datei{exportedAt && !Number.isNaN(exportedAt.getTime()) ? ` vom ${exportedAt.toLocaleString("de-CH")}` : ""}: {describe(pending.summary)}.</p>
      <p>Aktueller Spielstand: {describe(pending.current)}.</p>
      <p>Dein aktueller Spielstand wird vorher als Datei gesichert und bleibt als Sicherung in diesem Browser. Mit einem Konto wird der geladene Spielstand danach in deinem Profil gespeichert.</p>
    </ConfirmDialog>}
  </div>;
}
