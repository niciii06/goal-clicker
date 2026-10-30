"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "./confirm-dialog";
import { TUTORIAL_INTRO_PAGES, TUTORIAL_STEPS, currentTutorialStep, type TutorialGame, type TutorialState, type TutorialStep } from "./tutorial";

/** The welcome window of the tutorial: a few short pages, then the guided tasks start. Escape skips it. */
export function TutorialIntroDialog({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  useDialogFocus(true, dialogRef, onSkip);
  const current = TUTORIAL_INTRO_PAGES[page];
  const last = page === TUTORIAL_INTRO_PAGES.length - 1;
  return createPortal(<div className="account-overlay" role="presentation">
    <div ref={dialogRef} className="account-dialog tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-text">
      <p className="eyebrow">TUTORIAL · {page + 1} / {TUTORIAL_INTRO_PAGES.length}</p>
      <h2 id="tutorial-title">{current.title}</h2>
      <p id="tutorial-text">{current.text}</p>
      <div className="tutorial-dots" aria-hidden="true">{TUTORIAL_INTRO_PAGES.map((item, index) => <i key={item.title} className={index === page ? "active" : ""} />)}</div>
      <div className="tutorial-dialog-actions">
        <button type="button" className="mode-secondary quiet" onClick={onSkip}>Überspringen</button>
        <div>
          {page > 0 && <button type="button" className="mode-secondary" onClick={() => setPage(page - 1)}>Zurück</button>}
          <button type="button" className="mode-primary" onClick={() => last ? onStart() : setPage(page + 1)}>{last ? "Los geht's" : "Weiter"}</button>
        </div>
      </div>
    </div>
  </div>, document.body);
}

/** The card with the next tutorial task; done tasks tick off by themselves. */
export function TutorialCoach({ state, game, onShow, onEnd }: { state: TutorialState; game: TutorialGame; onShow: (step: TutorialStep) => void; onEnd: () => void }) {
  const step = currentTutorialStep(state);
  if (!step) return null;
  const index = TUTORIAL_STEPS.indexOf(step);
  const progress = step.progress?.(game);
  const share = progress ? progress.value / progress.goal : 0;
  return <section className="tutorial-coach" aria-label="Tutorial" aria-live="polite">
    <div className="tutorial-coach-copy">
      <p className="eyebrow">TUTORIAL · SCHRITT {index + 1} / {TUTORIAL_STEPS.length}</p>
      <strong>{step.title}</strong>
      <small>{step.text}</small>
      {progress && <div className="tutorial-coach-progress"><span><i style={{ width: `${Math.round(share * 100)}%` }} /></span><b>{progress.value} / {progress.goal}</b></div>}
      <ol className="tutorial-coach-steps" aria-label="Fortschritt">{TUTORIAL_STEPS.map((item) => <li key={item.id} className={state.done.includes(item.id) ? "done" : item === step ? "current" : ""} aria-label={`${item.title}${state.done.includes(item.id) ? ", erledigt" : ""}`} />)}</ol>
    </div>
    <div className="tutorial-coach-actions">
      <button type="button" className="mode-primary" onClick={() => onShow(step)}>Zeig es mir</button>
      <button type="button" className="mode-secondary quiet" onClick={onEnd}>Tutorial beenden</button>
    </div>
  </section>;
}
