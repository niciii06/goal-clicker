"use client";
// "Spielstand als Datei sichern" and "Spielstand aus Datei laden" (Club tab, and the save failed banner).
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { markCloudMetaPlayed } from "./cloud-sync";
import { summarizeSave } from "./cloud-save-rules";
import type { CloudSaveKeys, SaveSummary } from "./cloud-save-rules";
import { collectSaveKeys, downloadSaveFile, parseSaveFile, replaceLocalSave } from "./game/save-export";
import { resumeLocalPersistence, suspendLocalPersistence } from "./game/persistence";
import { currentIntlTag, t } from "./i18n/runtime";

const number = (value: number) => Math.floor(value).toLocaleString("de-CH");
const describe = (summary: SaveSummary | null) => summary ? t("saveFile.summary", { goals: number(summary.totalGoals), seasons: number(summary.seasons), stars: number(summary.stars) }) : t("saveFile.none");

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
    onMessage(exportCurrentSave(getGame()) ? t("saveFile.saved") : t("saveFile.failed"));
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      onMessage(t("saveFile.unreadable"));
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
      onMessage(t("saveFile.backupFailed"));
      return;
    }
    suspendLocalPersistence();
    try {
      replaceLocalSave(localStorage, pending.keys);
      markCloudMetaPlayed();
    } catch {
      resumeLocalPersistence();
      setPending(null);
      onMessage(t("saveFile.storageFull"));
      return;
    }
    window.location.reload();
  }

  const exportedAt = pending?.exportedAt ? new Date(pending.exportedAt) : null;
  return <div className="save-file-controls" style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
    <button type="button" className="mode-secondary" onClick={exportSave}>{t("saveFile.saveAs")}</button>
    <button type="button" className="mode-secondary" onClick={() => inputRef.current?.click()}>{t("saveFile.load")}</button>
    <input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={(event) => void chooseFile(event)} />
    {pending && <ConfirmDialog title={t("saveFile.loadTitle")} confirmLabel={t("saveFile.replace")} onCancel={() => setPending(null)} onConfirm={confirmImport}>
      <p>{t("saveFile.file")}{exportedAt && !Number.isNaN(exportedAt.getTime()) ? t("saveFile.from", { date: exportedAt.toLocaleString(currentIntlTag()) }) : ""}: {describe(pending.summary)}.</p>
      <p>{t("saveFile.current")} {describe(pending.current)}.</p>
      <p>{t("saveFile.loadBody")}</p>
    </ConfirmDialog>}
  </div>;
}
