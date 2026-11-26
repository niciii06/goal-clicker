"use client";
// In game feedback (Notion: In-Game-Feedbackformular). A card under «Club & Mehr» with two entries: a bug or an
// improvement, and a feature wish. Shown only when the server offers the form (GET /api/feedback). The dialog follows
// the confirm and account dialogs: focus stays inside, Escape closes, every control is at least 44 pt high.
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { FEEDBACK_DESCRIPTION, FEEDBACK_SCREENSHOT_MAX_BYTES, FEEDBACK_TITLE, parseFeedback } from "./feedback-rules";
import type { FeedbackError, FeedbackKind } from "./feedback-rules";
import { currentLocale, t } from "./i18n/runtime";

const MB = FEEDBACK_SCREENSHOT_MAX_BYTES / 1024 / 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";
type Entry = "issue" | "feature";

function errorText(error: FeedbackError | "rateLimited" | "unavailable") {
  switch (error) {
    case "titleShort": return t("feedback.error.titleShort", { min: FEEDBACK_TITLE.min });
    case "titleLong": return t("feedback.error.titleLong", { max: FEEDBACK_TITLE.max });
    case "descriptionShort": return t("feedback.error.descriptionShort", { min: FEEDBACK_DESCRIPTION.min });
    case "descriptionLong": return t("feedback.error.descriptionLong", { max: FEEDBACK_DESCRIPTION.max });
    case "imageSize": return t("feedback.error.imageSize", { mb: MB });
    case "imageType": return t("feedback.error.imageType");
    case "rateLimited": return t("feedback.error.rateLimited");
    case "unavailable": return t("feedback.error.unavailable");
    default: return t("feedback.error.kind");
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FeedbackDialog({ entry, playerId, onClose, onSent }: { entry: Entry; playerId: string; onClose: () => void; onSent: () => void }) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const [kind, setKind] = useState<FeedbackKind>(entry === "feature" ? "feature" : "bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  useDialogFocus(true, dialogRef, () => { if (!sending) onClose(); });

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setProblem("");
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) { setProblem(errorText("imageType")); event.target.value = ""; return; }
    if (file.size > FEEDBACK_SCREENSHOT_MAX_BYTES) { setProblem(errorText("imageSize")); event.target.value = ""; return; }
    try { setScreenshot(await readAsDataUrl(file)); } catch { setProblem(errorText("imageType")); }
  }

  function removeScreenshot() {
    setScreenshot(null);
    if (fileRef.current) { fileRef.current.value = ""; fileRef.current.focus(); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const checked = parseFeedback({ kind, title, description, screenshot });
    if (!checked.ok) { setProblem(errorText(checked.error)); return; }
    setSending(true);
    setProblem("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, title, description, screenshot, playerId, locale: currentLocale() }) });
      if (response.ok) { onSent(); return; }
      const data = await response.json().catch(() => ({})) as { errorCode?: string };
      const code = data.errorCode ?? "";
      setProblem(response.status === 429 ? errorText("rateLimited") : code === "IMAGE_SIZE" ? errorText("imageSize") : ["kind", "titleShort", "titleLong", "descriptionShort", "descriptionLong", "imageType", "imageSize"].includes(code) ? errorText(code as FeedbackError) : errorText("unavailable"));
    } catch {
      setProblem(errorText("unavailable"));
    } finally {
      setSending(false);
    }
  }

  const heading = entry === "feature" ? t("feedback.dialogFeature") : t("feedback.dialogIssue");
  return createPortal(<div className="account-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !sending) onClose(); }}>
    <form ref={dialogRef} className="account-dialog feedback-dialog" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} onSubmit={submit} noValidate>
      <h2 id={`${ids}-title`}>{heading}</h2>
      {entry === "issue" && <fieldset className="feedback-kind">
        <legend>{t("feedback.kind")}</legend>
        {(["bug", "improvement"] as const).map((value) => <label key={value} className={kind === value ? "selected" : ""}>
          <input type="radio" name={`${ids}-kind`} value={value} checked={kind === value} onChange={() => setKind(value)} />
          <span>{value === "bug" ? t("feedback.kindBug") : t("feedback.kindImprovement")}</span>
        </label>)}
      </fieldset>}
      <label className="account-field"><span>{t("feedback.fieldTitle")}</span>
        <input className="mode-input" value={title} maxLength={FEEDBACK_TITLE.max} required onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="account-field"><span>{t("feedback.fieldDescription")}</span>
        <textarea className="mode-input feedback-description" value={description} maxLength={FEEDBACK_DESCRIPTION.max} rows={5} required aria-describedby={`${ids}-description-hint`} onChange={(event) => setDescription(event.target.value)} />
        <small id={`${ids}-description-hint`}>{t("feedback.descriptionHint", { min: FEEDBACK_DESCRIPTION.min })}</small>
      </label>
      <div className="account-field feedback-screenshot">
        <span id={`${ids}-file-label`}>{t("feedback.screenshot")}</span>
        {/* The native file field labels itself in the browser's language; it stays focusable and is shown as a localized button. */}
        <input ref={fileRef} id={`${ids}-file`} className="feedback-file-input" type="file" accept={ACCEPT} aria-labelledby={`${ids}-file-label`} aria-describedby={`${ids}-file-hint`} onChange={(event) => void chooseFile(event)} />
        <label htmlFor={`${ids}-file`} className="mode-secondary feedback-file-button" aria-hidden="true">{screenshot ? t("feedback.otherImage") : t("feedback.chooseImage")}</label>
        <small id={`${ids}-file-hint`}>{t("feedback.screenshotHint", { mb: MB })}</small>
        {screenshot && <div className="feedback-preview">
          {/* A local data URL of the chosen file: nothing to optimise or load, so no next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={screenshot} alt={t("feedback.screenshotPreview")} />
          <button type="button" className="mode-secondary quiet" onClick={removeScreenshot}>{t("feedback.removeScreenshot")}</button>
        </div>}
      </div>
      {problem && <p className="account-error" role="alert">{problem}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" className="mode-secondary" disabled={sending} onClick={onClose}>{t("feedback.cancel")}</button>
        <button type="submit" className="mode-primary" disabled={sending}>{sending ? t("feedback.sending") : t("feedback.send")}</button>
      </div>
    </form>
  </div>, document.body);
}

/** The card under «Club & Mehr»; nothing at all while the server does not offer the form. */
export function FeedbackPanel({ playerId, onMessage }: { playerId: string; onMessage: (text: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [entry, setEntry] = useState<Entry | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/feedback", { cache: "no-store" }).then((response) => response.ok ? response.json() : { enabled: false }).then((data: { enabled?: boolean }) => { if (active) setEnabled(data.enabled === true); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!enabled) return null;
  return <section className="tutorial-restart feedback-card" aria-label={t("feedback.eyebrow")}>
    <div><p className="eyebrow">{t("feedback.eyebrow")}</p><strong>{t("feedback.title")}</strong><small>{t("feedback.body")}</small></div>
    <div className="feedback-actions">
      <button type="button" className="mode-secondary" onClick={() => setEntry("issue")}>{t("feedback.reportIssue")}</button>
      <button type="button" className="mode-secondary" onClick={() => setEntry("feature")}>{t("feedback.suggestFeature")}</button>
    </div>
    {entry && <FeedbackDialog entry={entry} playerId={playerId} onClose={() => setEntry(null)} onSent={() => { setEntry(null); onMessage(t("feedback.thanks")); }} />}
  </section>;
}
