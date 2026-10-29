import type { AnimationEvent, CSSProperties } from "react";
import type { WalkoutPresentation } from "./walkout-data";

/** The full body block figure of a walkout. Hair, beard, face, accessories and kit come from the presentation. */
export function WalkoutAvatar({ presentation: p, rating, label, onAnimationEnd }: { presentation: WalkoutPresentation; rating: number; label: string; onAnimationEnd?: (event: AnimationEvent<HTMLDivElement>) => void }) {
  const classes = [
    "star-walkout-avatar-wrap",
    `hair-${p.hair}`,
    `beard-${p.beard}`,
    `face-${p.face}`,
    `celebration-${p.celebration}`,
    p.cap ? "with-cap" : "",
    p.headband ? "with-headband" : "",
    p.helmet ? "with-helmet" : "",
    p.tattoo ? `tattoo-${p.tattoo}` : "",
    p.keeper ? "keeper" : "",
    p.body === "women" ? "body-women" : "",
  ].filter(Boolean).join(" ");
  const style = { "--walkout-headband": p.headband, "--walkout-gloves": p.gloves } as CSSProperties;
  return <div className={classes} style={style} aria-label={label} onAnimationEnd={onAnimationEnd}>
    <div className="star-walkout-avatar">
      <div className="avatar-head"><i className="avatar-ear left" /><i className="avatar-ear right" /><i className="avatar-hair" /><i className="avatar-brow left" /><i className="avatar-brow right" /><i className="avatar-eye left" /><i className="avatar-eye right" /><i className="avatar-nose" /><i className="avatar-mouth" /><i className="avatar-beard" />{p.headband && <i className="avatar-headband" />}{p.helmet && <i className="avatar-helmet" />}{p.glasses && <i className="avatar-glasses" />}{p.cap && <i className="avatar-cap" />}</div>
      <div className="avatar-neck" />
      <div className="avatar-torso"><i className="avatar-kit-stripe" /><span>{rating}</span></div>
      <div className="avatar-arm left"><i /></div><div className="avatar-arm right"><i /></div>
      <div className="avatar-leg left"><i /></div><div className="avatar-leg right"><i /></div>
    </div>
  </div>;
}
