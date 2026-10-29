import { useId, type CSSProperties, type ReactNode } from "react";
import type { WalkoutFace, WalkoutHair, WalkoutPresentation } from "./walkout-data";

/*
 * The walkout figure, drawn as a realistic vector illustration: about seven and a half head lengths, a shaded
 * face with eyes, nose, lips and ears, drawn hair and beards, and a kit with collar, sleeves, folds and light.
 * Everything is mirrored around x = 100 of a 200 × 420 canvas; the right arm and leg are the left ones flipped.
 * Colours come from CSS variables on the wrap (skin, hair, kit), so one drawing serves every player.
 */

type Geometry = { tW: number; w: number; j: number; c: number; chin: number; angular: boolean };

const FACES: Record<WalkoutFace, Omit<Geometry, "angular">> = {
  oval: { tW: 18, w: 19, j: 15.4, c: 6, chin: 64 },
  round: { tW: 19, w: 20.4, j: 17.4, c: 8.4, chin: 63 },
  square: { tW: 18.6, w: 19.8, j: 18.4, c: 9.6, chin: 64 },
  long: { tW: 17.2, w: 18, j: 15, c: 6.4, chin: 67 },
  angular: { tW: 18, w: 19.4, j: 17, c: 4.6, chin: 65 },
};

function geometry(face: WalkoutFace, women: boolean): Geometry {
  const f = FACES[face];
  return women
    ? { tW: f.tW * 0.97, w: f.w * 0.95, j: f.j * 0.86, c: f.c * 0.8, chin: f.chin - 1.5, angular: false }
    : { ...f, angular: face === "angular" };
}

const r = (value: number) => Math.round(value * 100) / 100;
/** Builds a path from a template, rounding every number so the markup stays short. */
function d(strings: TemplateStringsArray, ...values: number[]) {
  return strings.reduce((path, part, index) => path + part + (index < values.length ? r(values[index]) : ""), "");
}

function headPath({ tW, w, j, c, chin, angular }: Geometry) {
  const jaw = angular
    ? d`L ${100 + j} ${55} L ${100 + c} ${chin - 0.5} Q 100 ${chin + 0.6} ${100 - c} ${chin - 0.5} L ${100 - j} ${55}`
    : d`C ${100 + j - 1.6} ${58.6} ${100 + c + 3.6} ${chin - 0.6} ${100 + c} ${chin - 0.3} Q 100 ${chin + 0.9} ${100 - c} ${chin - 0.3} C ${100 - c - 3.6} ${chin - 0.6} ${100 - j + 1.6} ${58.6} ${100 - j} ${54}`;
  return d`M 100 12 C ${100 + tW * 0.56} 12 ${100 + tW} 17 ${100 + tW} 26 C ${100 + tW} 31 ${100 + w} 33 ${100 + w} 38.5 C ${100 + w} 45 ${100 + j + 1.2} 50 ${100 + j} ${angular ? 55 : 54} `
    + jaw
    + d` C ${100 - j - 1.2} 50 ${100 - w} 45 ${100 - w} 38.5 C ${100 - w} 33 ${100 - tW} 31 ${100 - tW} 26 C ${100 - tW} 17 ${100 - tW * 0.56} 12 100 12 Z`;
}

/** The hair that hugs the skull: sideburns, a volume on top and a hairline across the forehead. */
function capPath({ tW }: Geometry, volume: number, hairline = 21.5, sideburn = 39.5, temple = 27.5) {
  const L = 100 - tW, R = 100 + tW, top = 11.2 - volume;
  return d`M ${L - 0.5} ${sideburn} L ${L - 0.9} 30 C ${L - 1.3} ${17 - volume * 0.6} ${88 - volume * 0.4} ${top} 100 ${top} C ${112 + volume * 0.4} ${top} ${R + 1.3} ${17 - volume * 0.6} ${R + 0.9} 30 L ${R + 0.5} ${sideburn} L ${R - 1.6} ${sideburn} L ${R - 1.8} ${temple + 2} C ${R - 2.6} ${temple - 2.5} 108 ${hairline} 100 ${hairline} C 92 ${hairline} ${L + 2.6} ${temple - 2.5} ${L + 1.8} ${temple + 2} L ${L + 1.6} ${sideburn} Z`;
}

/** Only the top: for fades, quiffs and mohawks whose sides are shaved shorter. */
function topPath({ tW }: Geometry, volume: number, hairline = 21.5, inset = 2.2) {
  const L = 100 - tW + inset, R = 100 + tW - inset, top = 11.2 - volume;
  return d`M ${L} 28 C ${L - 1.2} ${16 - volume * 0.6} 88 ${top} 100 ${top} C 112 ${top} ${R + 1.2} ${16 - volume * 0.6} ${R} 28 C ${R - 2} 25 108 ${hairline} 100 ${hairline} C 92 ${hairline} ${L + 2} 25 ${L} 28 Z`;
}

/** Hair that frames the face down the cheeks (long hair, bobs, manes): outer contour, then the face opening. */
function framePath({ tW }: Geometry, volume: number, bottom: number, flare: number, part = 100, partY = 15) {
  const L = 100 - tW, R = 100 + tW, top = 11.2 - volume;
  return d`M ${L - 2.8 - flare} ${bottom} C ${L - 4 - flare * 0.5} ${38} ${L - 3 - volume * 0.3} ${17 - volume * 0.6} ${part - 12} ${top + 0.4} C ${part - 4} ${top - 0.3} ${part + 4} ${top - 0.3} ${R - 6} ${top + 1} C ${R + 2 + volume * 0.3} ${15 - volume * 0.4} ${R + 4 + flare * 0.5} ${38} ${R + 2.8 + flare} ${bottom} L ${R + 0.6} ${bottom - 0.6} C ${R + 0.3} 42 ${R - 0.4} 30 ${R - 4} 23.5 C ${R - 8} 18 ${part + 4} ${partY + 1} ${part} ${partY} C ${part - 4} ${partY + 1} ${L + 8} 18 ${L + 4} 23.5 C ${L + 0.4} 30 ${L - 0.3} 42 ${L - 0.6} ${bottom - 0.6} Z`;
}

/** A scalloped outline around an ellipse: curls and afros. */
function curlyOutline(cx: number, cy: number, rx: number, ry: number, from: number, to: number, bumps: number, bump: number) {
  let path = "";
  for (let i = 0; i <= bumps; i += 1) {
    const a = from + ((to - from) * i) / bumps;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    path += i === 0 ? d`M ${x} ${y}` : d` A ${bump} ${bump} 0 0 1 ${x} ${y}`;
  }
  return path;
}

/** A row of short strokes from the hairline towards the crown: the strand texture of short hair. */
function strands(count: number, spread: number, fromY: number, toY: number, bend: number, className = "wf-strand") {
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const x = 100 + t * spread;
    return <path key={i} className={className} d={d`M ${x} ${fromY + Math.abs(t) * 3} Q ${x + t * bend * 0.6 + bend * 0.3} ${(fromY + toY) / 2} ${x + t * bend + bend * 0.5} ${toY + Math.abs(t) * 4}`} />;
  });
}

/** A rope of hair (braid or loc) hanging from a point, drawn as a thick stroke with segment marks. */
function rope(key: string, x: number, y: number, length: number, sway: number, width: number) {
  const path = d`M ${x} ${y} C ${x + sway} ${y + length * 0.35} ${x - sway * 0.6} ${y + length * 0.7} ${x + sway * 0.4} ${y + length}`;
  return <g key={key}><path className="wf-rope" d={path} strokeWidth={width} /><path className="wf-rope-mark" d={path} strokeWidth={width} strokeDasharray={`${width * 0.32} ${width * 0.5}`} /></g>;
}

type HairLayers = { back?: ReactNode; front?: ReactNode; ears?: boolean };

function hairLayers(style: WalkoutHair, g: Geometry, u: string, women: boolean): HairLayers {
  const L = 100 - g.tW, R = 100 + g.tW;
  const sheen = (path: string) => <path d={path} fill={`url(#${u}-hs)`} />;
  const solid = (path: string, extra?: ReactNode) => <><path className="wf-hair" d={path} />{sheen(path)}{extra}</>;
  const shaved = (path: string, opacity: number) => <path className="wf-hair" d={path} opacity={opacity} filter={`url(#${u}-grain)`} />;
  switch (style) {
    case "bald":
      return { front: <><ellipse cx="100" cy="21" rx="15" ry="8" className="wf-skin-shade" opacity=".14" filter={`url(#${u}-soft)`} /><ellipse cx="94" cy="18.5" rx="6.5" ry="3.6" fill="#fff" opacity=".3" filter={`url(#${u}-soft)`} /></> };
    case "buzz":
      return { front: shaved(capPath(g, 0.7, 22), 0.9) };
    case "waves": {
      const cap = capPath(g, 1.1, 21.6);
      return { front: <>{shaved(cap, 1)}<g clipPath={`url(#${u}-cap)`}>{[13.5, 16.5, 19.5, 22.5, 25.5].map((y) => <path key={y} className="wf-strand-light" d={d`M ${L - 2} ${y + 2} q 2.2 -2 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0 t 4.4 0`} />)}</g><clipPath id={`${u}-cap`}><path d={cap} /></clipPath></> };
    }
    case "fade":
      return { front: <>{shaved(capPath(g, 0.6, 22.2), 0.55)}{solid(topPath(g, 3.4, 21.6), strands(9, 22, 22, 9, 2))}</> };
    case "crop": {
      let fringe = d`M ${L + 3} 23.5`;
      for (let x = L + 4.5, i = 0; x < R - 3; x += 2.4, i += 1) fringe += d` L ${x} ${i % 2 ? 23.4 : 26}`;
      fringe += d` L ${R - 3} 23.5 Z`;
      return { front: solid(capPath(g, 3, 22), <><path className="wf-hair" d={fringe} />{strands(11, 26, 25, 10, -1.5)}</>) };
    }
    case "sidepart": {
      const swoop = d`M 91.5 12.5 C 99 6.5 114 7 ${R + 1.6} 18 C ${R + 2.6} 22 ${R + 1.6} 27 ${R + 0.6} 30 C ${R - 2} 23 108 19 97 21 C 94 21.6 92.5 19 91.5 12.5 Z`;
      return { front: <>{solid(capPath(g, 3, 21.4))}{solid(swoop)}<path className="wf-part" d="M 92 12.6 L 90.6 22.4" />{[0, 1, 2, 3, 4, 5].map((i) => <path key={i} className="wf-strand" d={d`M ${93 + i * 1.5} ${13 + i * 1.6} Q ${104 + i * 1.4} ${8.5 + i * 1.6} ${R - 1 + i * 0.3} ${19 + i * 1.6}`} />)}</> };
    }
    case "slick":
      return { front: solid(capPath(g, 2.2, 20.6), <>{strands(13, 30, 21.5, 9, 0)}<ellipse cx="96" cy="14.5" rx="7" ry="2.2" fill="#fff" opacity=".22" filter={`url(#${u}-soft)`} /></>) };
    case "quiff": {
      const quiff = d`M ${L + 2.4} 27.5 C ${L + 0.6} 17 86 8.5 93 3.8 C 98.4 0.4 108 0.8 113 4.8 C 117.4 8.4 ${R - 0.6} 15.4 ${R - 2.2} 27.5 C ${R - 4} 24.2 108 21.6 100 21.6 C 92 21.6 ${L + 4} 24.2 ${L + 2.4} 27.5 Z`;
      return { front: <>{shaved(capPath(g, 0.8, 22.4), 0.7)}{solid(quiff)}{[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} className="wf-strand" d={d`M ${88 + i * 3.4} ${22.5 - Math.abs(i - 3) * 0.5} C ${87 + i * 3.4} ${14} ${92 + i * 2.6} ${6 + Math.abs(i - 3) * 0.6} ${100 + i * 2.2} ${3.2 + Math.abs(i - 3) * 0.8}`} />)}</> };
    }
    case "spiky": {
      const spikes = d`M ${L + 1} 22 L ${L + 1.5} 13 L 87 15 L 88.5 6 L 92 12 L 95 3.4 L 98 10 L 101 2.6 L 104 9.8 L 107 4 L 109.4 12 L 112.6 6.4 L 114 15 L ${R - 1.2} 12.4 L ${R - 1} 22 Z`;
      return { front: <>{solid(capPath(g, 1.6, 22))}{solid(spikes, strands(7, 22, 20, 7, 0))}</> };
    }
    case "mohawk": {
      const strip = d`M 94.6 24 L 93.6 11 L 95.2 3.6 L 97.4 6.4 L 99 -0.6 L 101.2 4.4 L 103.2 -0.2 L 104.6 6 L 106.2 9.6 L 105.4 24 C 103 22.8 97 22.8 94.6 24 Z`;
      return { front: <>{shaved(capPath(g, 0.4, 22.4), 0.3)}{solid(strip, strands(4, 7, 22, 3, 0))}</> };
    }
    case "curls": {
      const outline = curlyOutline(100, 27, g.tW + 2.6, 20.5, Math.PI * 1.02, Math.PI * 1.98, 13, 2.4);
      const fringe = d` L ${R + 0.4} 34 L ${R - 1.6} 34 L ${R - 2} 29` + curlyOutline(100, 22.5, g.tW - 2, 4.2, Math.PI * 0.02, Math.PI * 0.98, 8, 1.8).replace(/^M/, " L") + d` L ${L + 2} 29 L ${L + 1.6} 34 L ${L - 0.4} 34 Z`;
      const path = outline + fringe;
      return { front: solid(path, <g className="wf-curl-marks">{Array.from({ length: 22 }, (_, i) => <circle key={i} cx={r(L + 2 + ((i * 7.3) % (g.tW * 2 - 4)))} cy={r(10 + ((i * 5.7) % 13))} r="1.4" />)}</g>) };
    }
    case "twists": {
      const twists = Array.from({ length: 15 }, (_, i) => {
        const a = Math.PI * (1.08 + (0.84 * i) / 14);
        const x1 = 100 + Math.cos(a) * (g.tW - 1), y1 = 27 + Math.sin(a) * 14;
        const x2 = 100 + Math.cos(a) * (g.tW + 4.4), y2 = 27 + Math.sin(a) * 20.5;
        return <g key={i}><path className="wf-twist" d={d`M ${x1} ${y1} L ${x2} ${y2}`} /><path className="wf-twist-mark" d={d`M ${x1} ${y1} L ${x2} ${y2}`} /></g>;
      });
      return { front: <>{shaved(capPath(g, 0.6, 22.2), 0.6)}{solid(topPath(g, 2.4, 21.8, 1.6))}{twists}</> };
    }
    case "afro": {
      const afro = curlyOutline(100, 25, g.tW + 15, 27, Math.PI * 0.82, Math.PI * 2.18, 22, 4.4) + " Z";
      return {
        back: <><path className="wf-hair" d={afro} /><path d={afro} fill={`url(#${u}-hr)`} /><g className="wf-curl-marks">{Array.from({ length: 18 }, (_, i) => <circle key={i} cx={r(74 + ((i * 11.3) % 52))} cy={r(4 + ((i * 7.7) % 16))} r="1.6" />)}</g></>,
        front: <path className="wf-hair" d={capPath(g, 0, 21.4)} />,
      };
    }
    case "receding": {
      const path = d`M ${L - 0.5} 39.5 L ${L - 0.9} 30 C ${L - 1.3} 16.4 89 10.2 100 10.2 C 111 10.2 ${R + 1.3} 16.4 ${R + 0.9} 30 L ${R + 0.5} 39.5 L ${R - 1.6} 39.5 L ${R - 1.8} 32 C ${R - 3} 26 ${R - 5} 24 ${R - 7.5} 25 C 106 25.6 103 24 100 24.6 C 97 24 94 25.6 ${L + 7.5} 25 C ${L + 5} 24 ${L + 3} 26 ${L + 1.8} 32 L ${L + 1.6} 39.5 Z`;
      return { front: <>{solid(path, strands(7, 16, 24, 12, 0))}<ellipse cx="100" cy="17" rx="7" ry="4" className="wf-skin" opacity=".4" filter={`url(#${u}-soft)`} /></> };
    }
    case "medium": {
      const path = d`M ${L - 2.6} 49 C ${L - 3.8} 38 ${L - 3} 16 98 9.2 C 112 8.6 ${R + 3} 16 ${R + 2.6} 49 L ${R + 0.4} 47.4 C ${R + 0.2} 40 ${R - 0.4} 32 ${R - 2.4} 27.6 C 110 20.6 98 23 ${L + 3} 30 L ${L + 1.2} 40 L ${L + 0.6} 47.4 Z`;
      return { ears: false, front: solid(path, [0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} className="wf-strand" d={d`M ${R - 3 - i * 0.6} ${13 + i * 0.8} C ${110 - i * 2} ${16 + i * 1.4} ${98 - i * 2} ${18 + i * 1.6} ${L + 3 + i * 0.4} ${24 + i * 1.6}`} />)) };
    }
    case "curtain": {
      const left = d`M 100 12.6 C 93 12.4 ${L + 1} 15 ${L - 2.2} 24 C ${L - 3.6} 32 ${L - 3.2} 41 ${L - 2.4} 47.5 L ${L + 0.6} 46 C ${L + 1.2} 38 ${L + 2.6} 31 ${L + 6} 27 C 89 24.6 95.6 19.4 99.4 14.6 Z`;
      const right = d`M 100 12.6 C 107 12.4 ${R - 1} 15 ${R + 2.2} 24 C ${R + 3.6} 32 ${R + 3.2} 41 ${R + 2.4} 47.5 L ${R - 0.6} 46 C ${R - 1.2} 38 ${R - 2.6} 31 ${R - 6} 27 C 111 24.6 104.4 19.4 100.6 14.6 Z`;
      return { ears: false, front: <>{solid(capPath(g, 3.4, 20))}{solid(left)}{solid(right)}{[0, 1, 2, 3].map((i) => <g key={i}><path className="wf-strand" d={d`M ${99 - i * 0.6} ${14 + i} C ${92 - i * 1.8} ${16 + i * 1.6} ${L + 1 + i * 0.6} ${24 + i * 2} ${L - 0.6 + i * 0.6} ${40 + i * 1.4}`} /><path className="wf-strand" d={d`M ${101 + i * 0.6} ${14 + i} C ${108 + i * 1.8} ${16 + i * 1.6} ${R - 1 - i * 0.6} ${24 + i * 2} ${R + 0.6 - i * 0.6} ${40 + i * 1.4}`} /></g>)}</> };
    }
    case "mullet": {
      const back = d`M ${L + 1} 38 C ${L - 1.6} 54 ${L - 0.6} 70 ${L - 3} 82 C ${L + 2} 80.6 ${L + 5} 83 ${L + 8} 81 L ${R - 8} 81 C ${R - 5} 83 ${R - 2} 80.6 ${R + 3} 82 C ${R + 0.6} 70 ${R + 1.6} 54 ${R - 1} 38 Z`;
      return { back: solid(back), front: solid(capPath(g, 2.6, 22), strands(9, 22, 23, 10, -1)) };
    }
    case "long":
    case "mane": {
      const mane = style === "mane";
      const volume = mane ? 6 : 3.2;
      const flare = mane ? 6 : 1;
      const bottom = mane ? 60 : 52;
      const back = mane
        ? d`M ${L - 6} 26 C ${L - 13} 46 ${L - 12} 70 ${L - 8} 92 L ${R + 8} 92 C ${R + 12} 70 ${R + 13} 46 ${R + 6} 26 Z`
        : d`M ${L - 2.6} 26 C ${L - 6} 50 ${L - 7} 90 ${L - 5} 122 L ${R + 5} 122 C ${R + 7} 90 ${R + 6} 50 ${R + 2.6} 26 Z`;
      const lock = (side: 1 | -1) => {
        const x = (v: number) => 100 + side * v;
        const edge = 100 - L;
        return mane
          ? d`M ${x(edge + 0.6)} 50 C ${x(edge + 1.8)} 62 ${x(edge + 6)} 74 ${x(edge + 9)} 86 C ${x(edge + 10)} 92 ${x(edge + 13)} 95 ${x(edge + 15)} 92 C ${x(edge + 17)} 84 ${x(edge + 13.6)} 74 ${x(edge + 12)} 62 C ${x(edge + 10)} 50 ${x(edge + 9)} 40 ${x(edge + 7.4)} 34 Z`
          : d`M ${x(edge + 0.6)} 48 C ${x(edge + 1)} 62 ${x(edge - 2)} 78 ${x(edge - 6)} 92 C ${x(edge - 8)} 100 ${x(edge - 9)} 108 ${x(edge - 7)} 114 C ${x(edge - 3)} 112 ${x(edge + 2)} 104 ${x(edge + 4)} 94 C ${x(edge + 6)} 82 ${x(edge + 5)} 62 ${x(edge + 3.4)} 44 Z`;
      };
      const lockStrands = (side: 1 | -1) => [0, 1, 2].map((i) => <path key={`${side}${i}`} className="wf-strand" d={d`M ${100 + side * (100 - L + 1.6 + i)} 46 C ${100 + side * (100 - L + 2 + i)} 64 ${100 + side * (100 - L - 1 + i * 2)} 82 ${100 + side * (100 - L - 4 + i * 2.4)} ${mane ? 88 : 106}`} />);
      return {
        ears: false,
        back: solid(back),
        front: <>{solid(framePath(g, volume, bottom, flare, women ? 100 : 96, 14.6))}{solid(lock(-1), lockStrands(-1))}{women || mane ? solid(lock(1), lockStrands(1)) : null}{[0, 1, 2, 3, 4].map((i) => <path key={i} className="wf-strand" d={d`M ${97 - i * 2.6} ${14 - volume * 0.4} C ${92 - i * 3} ${16} ${L - 0.6 + i * 0.6} ${24 + i} ${L - 1.2 + i * 0.4} ${40 + i * 2}`} />)}{[0, 1, 2, 3].map((i) => <path key={`r${i}`} className="wf-strand" d={d`M ${101 + i * 2.6} ${14 - volume * 0.4} C ${108 + i * 3} ${16} ${R + 0.6 - i * 0.6} ${24 + i} ${R + 1.2 - i * 0.4} ${40 + i * 2}`} />)}</>,
      };
    }
    case "bob": {
      const path = d`M ${L - 5} 61 C ${L - 6.4} 48 ${L - 4} 22 ${L + 2} 16 C 92 8.6 108 8.6 ${R - 2} 16 C ${R + 4} 22 ${R + 6.4} 48 ${R + 5} 61 C ${R + 3} 63.4 ${R + 1} 63.6 ${R - 0.2} 62.4 C ${R - 0.2} 50 ${R - 0.2} 36 ${R - 2.4} 26.6 C ${R - 6} 19 104 17.6 97 19.6 C 92 21 ${L + 6} 23.6 ${L + 3.4} 28.6 C ${L + 1.4} 36 ${L + 0.2} 50 ${L + 0.2} 62.4 C ${L - 1} 63.6 ${L - 3} 63.4 ${L - 5} 61 Z`;
      return { ears: false, front: solid(path, [0, 1, 2, 3, 4].map((i) => <path key={i} className="wf-strand" d={d`M ${R - 4 - i * 2} ${13 + i * 0.6} C ${104 - i * 3} ${15 + i} ${94 - i * 2} ${19 + i * 1.2} ${L + 3 + i * 1.6} ${28 + i * 1.6}`} />)) };
    }
    case "pony": {
      const tail = d`M ${R - 3} 16 C ${R + 7} 14 ${R + 10.6} 30 ${R + 9.6} 48 C ${R + 8.8} 62 ${R + 11} 72 ${R + 6.4} 86 C ${R + 3} 76 ${R + 2.2} 62 ${R + 2.4} 48 C ${R + 2.6} 34 ${R - 1} 24 ${R - 3} 16 Z`;
      return { back: solid(tail, <path className="wf-strand" d={d`M ${R + 3} 20 C ${R + 8} 32 ${R + 6} 56 ${R + 7} 80`} />), front: <>{solid(capPath(g, 2, 20.8), strands(11, 26, 21.5, 10, 3))}<path className="wf-hair-tie" d={d`M ${R - 1} 16.6 Q ${R + 2.4} 15 ${R + 3.6} 18.6`} /></> };
    }
    case "bun": {
      return { front: <>{solid(d`M 91 9 A 9 8 0 1 1 109 9 Z`, <path className="wf-strand" d="M 94 4 Q 100 0.6 106 4" />)}<path className="wf-hair-tie" d="M 91.6 9.6 Q 100 11.4 108.4 9.6" />{solid(capPath(g, 1.8, 20.8), strands(11, 26, 21.5, 9, 0))}</> };
    }
    case "braids": {
      const cap = capPath(g, 1.2, 21.6);
      const rows = [-3, -2, -1, 0, 1, 2, 3].map((i) => <path key={i} className="wf-cornrow" d={d`M ${100 + i * 4.3} ${22.6 + Math.abs(i) * 0.7} C ${100 + i * 4.8} 17 ${100 + i * 4.2} 13 ${100 + i * 3.2} 10.4`} />);
      const hanging = [0, 1, 2].flatMap((i) => [rope(`l${i}`, L - 0.2 - i * 1.4, 40 + i, 52 - i * 6, -1.6, 2.5), rope(`r${i}`, R + 0.2 + i * 1.4, 40 + i, 52 - i * 6, 1.6, 2.5)]);
      return { back: [0, 1].flatMap((i) => [rope(`bl${i}`, L + 2 - i * 2, 34, 50, -2, 2.6), rope(`br${i}`, R - 2 + i * 2, 34, 50, 2, 2.6)]), front: <>{solid(cap)}{rows}{hanging}</> };
    }
    case "locs": {
      const tops = Array.from({ length: 9 }, (_, i) => <path key={i} className="wf-twist" d={d`M ${84 + i * 4} ${16 + Math.abs(i - 4) * 1.2} Q ${83 + i * 4.2} ${12 - (4 - Math.abs(i - 4)) * 0.4} ${81 + i * 4.6} ${8.4 + Math.abs(i - 4) * 1.6}`} />);
      const hanging = [0, 1, 2, 3].flatMap((i) => [rope(`l${i}`, L - 1 - i * 1.6, 32 + i * 2.2, 54 - i * 4, -2.2, 3.1), rope(`r${i}`, R + 1 + i * 1.6, 32 + i * 2.2, 54 - i * 4, 2.2, 3.1)]);
      return { ears: false, back: [0, 1, 2].flatMap((i) => [rope(`bl${i}`, L + 3 - i * 2, 24, 62, -2.4, 3.2), rope(`br${i}`, R - 3 + i * 2, 24, 62, 2.4, 3.2)]), front: <>{solid(capPath(g, 3.4, 21.8))}{tops}{hanging}</> };
    }
  }
}

function eye(cx: number, y: number, women: boolean, mirror: boolean) {
  const s = mirror ? -1 : 1;
  const x = (v: number) => cx + s * v;
  const w = women ? 3.8 : 3.6;
  return <g>
    <path className="wf-sclera" d={d`M ${x(-w)} ${y + 0.2} Q ${cx} ${y - 2.4} ${x(w)} ${y} Q ${cx} ${y + 2} ${x(-w)} ${y + 0.2} Z`} />
    <circle className="wf-iris" cx={r(cx + s * 0.1)} cy={r(y - 0.1)} r="1.55" />
    <circle cx={r(cx + s * 0.1)} cy={r(y - 0.1)} r=".72" fill="#120b07" />
    <circle cx={r(cx + s * 0.6)} cy={r(y - 0.6)} r=".36" fill="#fff" opacity=".9" />
    <path className="wf-lid" strokeWidth={women ? 1 : 0.75} d={d`M ${x(-w - 0.2)} ${y + 0.3} Q ${cx} ${y - 2.9} ${x(w + 0.2)} ${y - 0.1}` + (women ? d` L ${x(w + 1.3)} ${y - 1}` : "")} />
    <path className="wf-crease" d={d`M ${x(-w + 0.4)} ${y - 1.4} Q ${cx} ${y - 3.8} ${x(w - 0.6)} ${y - 1.7}`} />
    <path className="wf-lower-lid" d={d`M ${x(-w + 0.6)} ${y + 0.9} Q ${cx} ${y + 2.2} ${x(w - 0.2)} ${y + 0.5}`} />
  </g>;
}

function beardShape(g: Geometry, mouthY: number, kind: "full" | "short" | "stubble" | "chinstrap" | "goatee") {
  const { w, j, c, chin } = g;
  if (kind === "goatee") {
    return d`M ${100 - 6.4} ${mouthY - 0.2} C ${100 - 6.8} ${mouthY + 3} ${100 - 5.6} ${chin - 1.4} ${100 - 3} ${chin + 0.6} Q 100 ${chin + 1.6} ${100 + 3} ${chin + 0.6} C ${100 + 5.6} ${chin - 1.4} ${100 + 6.8} ${mouthY + 3} ${100 + 6.4} ${mouthY - 0.2} L ${100 + 5.2} ${mouthY + 0.6} C ${100 + 4.6} ${mouthY + 2.6} ${100 + 2} ${mouthY + 3.3} 100 ${mouthY + 3.3} C ${100 - 2} ${mouthY + 3.3} ${100 - 4.6} ${mouthY + 2.6} ${100 - 5.2} ${mouthY + 0.6} Z`;
  }
  const drop = kind === "full" ? 3.4 : kind === "short" ? 1 : 0.2;
  const outer = d`M ${100 - w + 0.3} 40.5 C ${100 - w + 0.2} 46 ${100 - j - 0.8} 50.5 ${100 - j - 0.2} 54.5 C ${100 - j + 1.4} ${59 + drop * 0.5} ${100 - c - 3.5} ${chin + drop} 100 ${chin + drop * 1.1} C ${100 + c + 3.5} ${chin + drop} ${100 + j - 1.4} ${59 + drop * 0.5} ${100 + j + 0.2} 54.5 C ${100 + j + 0.8} 50.5 ${100 + w - 0.2} 46 ${100 + w - 0.3} 40.5`;
  if (kind === "chinstrap") {
    return outer + d` L ${100 + w - 2.2} 40.5 C ${100 + w - 2.4} 45 ${100 + j - 2.2} 50 ${100 + j - 2.2} 53.6 C ${100 + j - 3.4} 57.4 ${100 + c + 2.4} ${chin - 2.4} 100 ${chin - 2.2} C ${100 - c - 2.4} ${chin - 2.4} ${100 - j + 3.4} 57.4 ${100 - j + 2.2} 53.6 C ${100 - j + 2.2} 50 ${100 - w + 2.4} 45 ${100 - w + 2.2} 40.5 Z`;
  }
  const cheek = kind === "full" ? 45.5 : 47.5;
  return outer + d` L ${100 + w - 2.8} 40.5 C ${100 + w - 3.4} 43.6 ${100 + 13} ${cheek} ${100 + 10} ${cheek + 3.4} C ${100 + 8} ${mouthY - 2.4} ${100 + 6.8} ${mouthY + 0.8} ${100 + 5} ${mouthY + 2} C ${100 + 3} ${mouthY + 3.2} ${100 - 3} ${mouthY + 3.2} ${100 - 5} ${mouthY + 2} C ${100 - 6.8} ${mouthY + 0.8} ${100 - 8} ${mouthY - 2.4} ${100 - 10} ${cheek + 3.4} C ${100 - 13} ${cheek} ${100 - w + 3.4} 43.6 ${100 - w + 2.8} 40.5 Z`;
}

function mustachePath(mouthY: number, thick = 1) {
  return d`M ${100 - 6.2} ${mouthY + 0.2} C ${100 - 5.6} ${mouthY - 2.4 * thick} ${100 - 2} ${mouthY - 3.5 * thick} 100 ${mouthY - 2.7 * thick} C ${100 + 2} ${mouthY - 3.5 * thick} ${100 + 5.6} ${mouthY - 2.4 * thick} ${100 + 6.2} ${mouthY + 0.2} C ${100 + 3.6} ${mouthY - 1} ${100 - 3.6} ${mouthY - 1} ${100 - 6.2} ${mouthY + 0.2} Z`;
}

/* The left arm, hanging. Its sleeve covers the shoulder; keepers get long sleeves and gloves. */
const ARM_SKIN = "M 62 90 C 54 92 50 100 49.5 112 C 49 126 48.6 140 48 152 C 47 165 47.4 185 48 200 L 56 200 C 57.6 186 61 168 61.6 156 C 62.2 146 63 130 65 114 Z";
const HAND = "M 47.6 199 C 45.8 206 45.4 215 46.6 222 C 47.6 228 50.6 230 53.2 229.4 C 56.4 228.6 57.6 224 57.8 218 C 58 211 57.4 204.6 56.2 199 Z";
const THUMB = "M 56.2 203.6 C 59.4 207 59.8 212 58.2 216.4 C 57.4 218.2 56.2 217.2 56.6 215.4 C 57.2 212 56.6 208 55.4 205.4 Z";
const SLEEVE = "M 62 80.5 C 55 82.5 50.3 88 48.6 97 C 47.4 105 46.9 117 46.5 131 Q 55 134.6 63.8 132 L 66 113 C 64.8 102 63.6 90 62 80.5 Z";
const CUFF = "M 46.6 127.4 Q 55 131 64.2 128.4 L 63.8 132 Q 55 134.6 46.5 131 Z";
const KEEPER_SLEEVE = "M 62 80.5 C 55 82.5 50.3 88 48.6 97 C 47.4 110 46.8 135 46.2 152 C 45.5 170 46 186 46.4 198.4 L 57.8 198.4 C 59.2 184 62 166 62.6 154 C 63.2 140 64.5 126 66 113 C 64.8 102 63.6 90 62 80.5 Z";
const KEEPER_CUFF = "M 46.3 193.6 L 58.3 193.6 L 57.8 198.4 L 46.4 198.4 Z";
const GLOVE = "M 45.2 196 C 42.4 205 42.2 216 43.8 224 C 45.2 231 49.6 234.4 53.6 233.6 C 58.2 232.8 60.2 227 60.4 219 C 60.6 210 59.8 202 58.6 196 Z";
const GLOVE_THUMB = "M 59 202 C 63.4 205.6 64 212 61.6 217.6 C 60.6 219.4 59 218.4 59.4 216 C 60 212.4 59.6 208 57.8 205 Z";
const TATTOO = [
  "M 50.6 136 C 54 141 58.6 139 61.4 145",
  "M 49.6 146 C 52.6 150 57 148.6 60.4 153",
  "M 49 170 C 52 166 56 167 59.6 163",
  "M 48.6 188 L 57.4 188",
  "M 48.6 191.4 L 57 191.4",
];

function Arm({ keeper, tattoo, u }: { keeper: boolean; tattoo: boolean; u: string }) {
  return <>
    <path className="wf-skin" d={ARM_SKIN} />
    <path d={ARM_SKIN} fill={`url(#${u}-sc)`} />
    {tattoo && !keeper && <g className="wf-tattoo" clipPath={`url(#${u}-arm)`}>
      {TATTOO.map((path) => <path key={path} d={path} />)}
      <circle cx="54.2" cy="158" r="3.4" /><path d="M 52 157 C 53.4 155 55.6 155.4 56.4 157.6 C 55 159.6 53 159.6 52 157 Z" className="wf-tattoo-fill" />
      <path d="M 50 176 C 52.6 180 56.4 178.6 58.4 183 C 55.4 184.6 51.4 182.6 50 176 Z" className="wf-tattoo-fill" />
    </g>}
    {keeper
      ? <><path className="wf-glove" d={GLOVE} /><path className="wf-glove" d={GLOVE_THUMB} /><path d={GLOVE} fill={`url(#${u}-cc)`} /><path className="wf-glove-band" d="M 44.8 198 L 59 198 L 59.4 205 L 44 205 Z" /><path className="wf-finger" d="M 47.6 222 L 48 232.6 M 51.6 223 L 51.8 233.8 M 55.6 222.6 L 55.6 233.2" /></>
      : <><path className="wf-skin" d={HAND} /><path d={HAND} fill={`url(#${u}-sc)`} /><path className="wf-skin" d={THUMB} /><path className="wf-finger" d="M 48 219 C 48.6 224 49.4 227 50.6 229 M 51.4 220 C 51.8 225 52.2 228 53 229.4 M 54.6 219.4 C 54.8 224 55 226.6 55.6 228.6" /></>}
    <path className="wf-kit" d={keeper ? KEEPER_SLEEVE : SLEEVE} />
    <path className="wf-kit-trim" d={keeper ? KEEPER_CUFF : CUFF} />
    <path d={keeper ? KEEPER_SLEEVE : SLEEVE} fill={`url(#${u}-cc)`} />
    <path className="wf-fold" d={keeper ? "M 50 120 C 54 124 58 123 62 120 M 49 165 C 52 168 56 168 60 165" : "M 50 108 C 53 112 58 112 63 108"} />
  </>;
}

const THIGH = "M 72 238 C 71 262 74 285 78 302 L 96 302 C 97 285 99.2 262 99.4 238 Z";
const SHORTS_LEG = "M 65.6 204 L 100.4 207 L 100.2 247.6 Q 86 253.6 68.4 252 Z";
const SOCK = "M 77.4 298 C 75 318 74 338 77 355 C 79 368 81 378 81.4 388 L 93.6 388 C 94 376 96 362 97.4 348 C 98.4 332 97.6 314 96.2 298 Z";
const SOCK_BAND = "M 77.2 299 L 96.4 299 L 96.6 306.4 L 76.6 306.4 Z";
const BOOT = "M 80.6 384 C 79.6 393 76 401 74.6 405.6 C 73 410 75.6 413.6 80 413.6 L 96 413.6 C 99 413.6 100.6 411 99.6 407 C 98.8 400 96 391 94.6 384 Z";
const SOLE = "M 74.2 409.6 C 75 412.6 77 413.6 80 413.6 L 96 413.6 C 98.6 413.6 100 412 99.9 409.6 Z";

function Leg({ u }: { u: string }) {
  return <>
    <path className="wf-skin" d={THIGH} /><path d={THIGH} fill={`url(#${u}-sc)`} />
    <ellipse cx="87.6" cy="300" rx="7" ry="3.4" className="wf-skin-shade" opacity=".28" filter={`url(#${u}-soft)`} />
    <path className="wf-shorts" d={SHORTS_LEG} /><path d={SHORTS_LEG} fill={`url(#${u}-cc)`} />
    <path className="wf-shorts-trim" d="M 66.2 214 L 68.6 252 L 70.4 252.2 L 68.4 214 Z" />
    <path className="wf-fold" d="M 74 230 C 80 236 88 236 96 232 M 72 246 C 78 249 86 250 94 248" />
    <path className="wf-sock" d={SOCK} /><path className="wf-kit-trim" d={SOCK_BAND} /><path d={SOCK} fill={`url(#${u}-cc)`} />
    <ellipse cx="86" cy="334" rx="6" ry="16" fill="#fff" opacity=".12" filter={`url(#${u}-soft)`} />
    <path className="wf-boot" d={BOOT} /><path d={BOOT} fill={`url(#${u}-cc)`} />
    <path className="wf-boot-stripe" d="M 77.4 402 C 82 398.4 89 397 97.6 398.6" />
    <path className="wf-sole" d={SOLE} />
  </>;
}

/** A men's torso and a fitted women's one; both end in a short V collar. */
const TORSO = {
  men: "M 89 73 C 82 75.6 70 77.6 62 82 L 60 84 C 62 96 65 106 66 114 C 68 135 69 160 68 184 L 67 206 Q 100 211 133 206 L 132 184 C 131 160 132 135 134 114 C 135 106 138 96 140 84 L 138 82 C 130 77.6 118 75.6 111 73 L 100 86 Z",
  women: "M 90 73.4 C 84 76 74 78 68 83 L 66 85 C 67 96 70 106 71 114 C 72 128 74 145 75 165 C 75 180 73 192 72 203 Q 100 208 128 203 C 127 192 125 180 125 165 C 126 145 128 128 129 114 C 130 106 133 96 134 85 L 132 83 C 126 78 116 76 110 73.4 L 100 86 Z",
};

/** Classes for the wrap around the drawing: celebration, women's figure and keeper kit. */
export function walkoutFigureClasses(p: WalkoutPresentation) {
  return ["wf", `celebration-${p.celebration}`, p.body === "women" ? "body-women" : "", p.keeper ? "keeper" : ""].filter(Boolean).join(" ");
}

/** Colours the drawing needs beyond the stage variables. */
export function walkoutFigureStyle(p: WalkoutPresentation) {
  return { "--walkout-headband": p.headband, "--walkout-gloves": p.gloves, "--wf-iris": irisColor(p) } as CSSProperties;
}

/** The drawn figure: shown when the 3D walkout cannot run (no WebGL) or has not loaded yet. */
export function WalkoutFigure({ presentation: p, rating }: { presentation: WalkoutPresentation; rating: number }) {
  const u = `wf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const women = p.body === "women";
  const g = geometry(p.face, women);
  const head = headPath(g);
  const mouthY = 54.5 + (g.chin - 64) * 0.5;
  const noseY = 48 + (g.chin - 64) * 0.3;
  const hair = hairLayers(p.hair, g, u, women);
  const keeper = Boolean(p.keeper);
  const beard = women ? "clean" : p.beard;
  const tattooLeft = p.tattoo === "left" || p.tattoo === "both";
  const tattooRight = p.tattoo === "right" || p.tattoo === "both";
  // Women's limbs are the men's drawing, narrowed around the shoulder and hip.
  const armShape = women ? "translate(66.4 0) scale(.84 1) translate(-61 0)" : undefined;
  const legShape = women ? "translate(88 0) scale(.9 1) translate(-88 0)" : undefined;
  const L = 100 - g.w;
  return <div className="star-walkout-avatar">
      <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${u}-sc`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" className="wf-stop-shade" stopOpacity=".55" /><stop offset=".3" className="wf-stop-shade" stopOpacity="0" /><stop offset=".42" stopColor="#fff" stopOpacity=".1" /><stop offset=".7" className="wf-stop-shade" stopOpacity="0" /><stop offset="1" className="wf-stop-shade" stopOpacity=".6" /></linearGradient>
          <linearGradient id={`${u}-cc`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#000" stopOpacity=".34" /><stop offset=".26" stopColor="#000" stopOpacity="0" /><stop offset=".42" stopColor="#fff" stopOpacity=".12" /><stop offset=".72" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".38" /></linearGradient>
          <linearGradient id={`${u}-cv`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".1" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".26" /></linearGradient>
          <radialGradient id={`${u}-face`} cx=".46" cy=".42" r=".62"><stop offset=".55" className="wf-stop-shade" stopOpacity="0" /><stop offset="1" className="wf-stop-shade" stopOpacity=".62" /></radialGradient>
          <linearGradient id={`${u}-hs`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".06" /><stop offset=".22" stopColor="#fff" stopOpacity=".24" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".34" /></linearGradient>
          <radialGradient id={`${u}-hr`} cx=".42" cy=".3" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".4" /></radialGradient>
          <filter id={`${u}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" /></filter>
          <filter id={`${u}-blur`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".45" /></filter>
          <filter id={`${u}-grain`} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur in="SourceGraphic" stdDeviation=".35" result="b" /><feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" seed="4" result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -.35" result="a" /><feComposite in="b" in2="a" operator="in" /></filter>
          <clipPath id={`${u}-head`}><path d={head} /></clipPath>
          <clipPath id={`${u}-arm`}><path d={ARM_SKIN} /></clipPath>
          <clipPath id={`${u}-torso`}><path d={TORSO[women ? "women" : "men"]} /></clipPath>
        </defs>
        <ellipse cx="100" cy="414" rx="44" ry="5" fill="#000" opacity=".45" filter={`url(#${u}-soft)`} />
        <g className="wf-back-hair">{hair.back}</g>
        <g className="wf-leg left"><g transform={legShape}><Leg u={u} /></g></g>
        <g className="wf-leg right"><g transform="matrix(-1 0 0 1 200 0)"><g transform={legShape}><Leg u={u} /></g></g></g>
        <path className="wf-shorts" d="M 65.6 196 L 134.4 196 L 135.6 222 Q 100 226 64.4 222 Z" transform={legShape ? "translate(100 0) scale(.92 1) translate(-100 0)" : undefined} />
        <g>
          <path className="wf-skin" d={women ? "M 92.6 50 L 107.4 50 C 107.4 60 108.4 70 110.4 78 L 100 89 L 89.6 78 C 91.6 70 92.6 60 92.6 50 Z" : "M 91.4 50 L 108.6 50 C 108.6 60 109.6 70 111.6 77 L 100 89 L 88.4 77 C 90.4 70 91.4 60 91.4 50 Z"} />
          <path d={d`M ${100 - g.j} 52 C ${100 - g.j + 2} 60 ${100 - g.c - 2} ${g.chin + 3} 100 ${g.chin + 3.4} C ${100 + g.c + 2} ${g.chin + 3} ${100 + g.j - 2} 60 ${100 + g.j} 52 Z`} className="wf-skin-shade" opacity=".6" filter={`url(#${u}-soft)`} />
          <path className="wf-neck-line" d="M 93.6 62 C 95 69 97 74 99 78 M 106.4 62 C 105 69 103 74 101 78" />
        </g>
        <g>
          <path className="wf-kit" d={TORSO[women ? "women" : "men"]} />
          <g clipPath={`url(#${u}-torso)`}>
            <path className="wf-kit-trim" d="M 60 108 L 69.4 108 L 71 210 L 60 210 Z M 140 108 L 130.6 108 L 129 210 L 140 210 Z" opacity=".9" />
            <rect x="0" y="0" width="200" height="220" fill={`url(#${u}-cc)`} />
            <rect x="0" y="70" width="200" height="140" fill={`url(#${u}-cv)`} />
            <path className="wf-fold" d="M 72 120 C 80 126 88 128 96 126 M 128 118 C 120 124 112 126 104 125 M 74 176 C 84 182 98 183 110 178 M 80 194 C 92 199 108 199 122 194 M 70 150 C 74 160 78 166 84 170" />
            {women && <path className="wf-fold" d="M 77 124 Q 87 131 97 126 M 123 124 Q 113 131 103 126" />}
          </g>
          <path className="wf-collar" d="M 88.6 73 L 100 86.4 L 111.4 73" />
          <path className="wf-crest" d="M 113.6 99 L 121 99 L 121 104.6 C 121 107.6 119 109.4 117.3 110.4 C 115.6 109.4 113.6 107.6 113.6 104.6 Z" />
          <path className="wf-crest-inner" d="M 115.4 101 L 119.2 101 L 119.2 104.4 C 119.2 106 118.2 107.2 117.3 107.8 C 116.4 107.2 115.4 106 115.4 104.4 Z" />
          <path className="wf-brand" d="M 80 104 C 82 107 85 107 89 101.6 C 86 104.4 83.4 105 80 104 Z" />
          <text className="wf-number" x="100" y="152" textAnchor="middle">{rating}</text>
        </g>
        <g>
          {hair.ears !== false && <>
            <path className="wf-skin" d={d`M ${L + 0.8} 37 C ${L - 3.2} 35 ${L - 4} 41 ${L - 2.6} 45 C ${L - 1.8} 48 ${L + 0.2} 48.6 ${L + 1} 47 Z`} />
            <path className="wf-ear-inner" d={d`M ${L - 0.2} 38.6 C ${L - 2.4} 38.4 ${L - 2.6} 42 ${L - 1.6} 44.4`} />
            <path className="wf-skin" d={d`M ${200 - L - 0.8} 37 C ${200 - L + 3.2} 35 ${200 - L + 4} 41 ${200 - L + 2.6} 45 C ${200 - L + 1.8} 48 ${200 - L - 0.2} 48.6 ${200 - L - 1} 47 Z`} />
            <path className="wf-ear-inner" d={d`M ${200 - L + 0.2} 38.6 C ${200 - L + 2.4} 38.4 ${200 - L + 2.6} 42 ${200 - L + 1.6} 44.4`} />
          </>}
          <path className="wf-skin" d={head} />
          <g clipPath={`url(#${u}-head)`}>
            <path d={head} fill={`url(#${u}-face)`} />
            <ellipse cx="92" cy="37.6" rx="6.2" ry="3.4" className="wf-skin-shade" opacity=".42" filter={`url(#${u}-soft)`} />
            <ellipse cx="108" cy="37.6" rx="6.2" ry="3.4" className="wf-skin-shade" opacity=".42" filter={`url(#${u}-soft)`} />
            <ellipse cx="88.6" cy="44" rx="3.6" ry="2" fill="#fff" opacity=".1" filter={`url(#${u}-soft)`} />
            <ellipse cx="111.4" cy="44" rx="3.6" ry="2" fill="#fff" opacity=".07" filter={`url(#${u}-soft)`} />
            <ellipse cx="100" cy="24" rx="8" ry="4" fill="#fff" opacity=".1" filter={`url(#${u}-soft)`} />
            <ellipse cx="100" cy={r(g.chin - 3)} rx="3.4" ry="1.8" fill="#fff" opacity=".1" filter={`url(#${u}-soft)`} />
          </g>
          {eye(92, 38.6, women, false)}
          {eye(108, 38.6, women, true)}
          <path className="wf-brow" d={women ? "M 87 34.6 C 89.6 32.2 93.4 32 96 33.2 L 95.9 34 C 93.3 33.1 89.8 33.4 87.3 35.1 Z" : "M 86.8 34.6 C 89 32.6 93 32.2 96.4 33.4 L 96.2 34.7 C 93 33.8 89.6 34.1 87.2 35.4 Z"} />
          <path className="wf-brow" d={women ? "M 113 34.6 C 110.4 32.2 106.6 32 104 33.2 L 104.1 34 C 106.7 33.1 110.2 33.4 112.7 35.1 Z" : "M 113.2 34.6 C 111 32.6 107 32.2 103.6 33.4 L 103.8 34.7 C 107 33.8 110.4 34.1 112.8 35.4 Z"} />
          <path className="wf-nose-shade" d={d`M 97.6 38.6 C 97.2 42 96.6 ${noseY - 3} 95.8 ${noseY - 1}`} filter={`url(#${u}-blur)`} />
          <ellipse cx="100" cy={r(noseY - 1.7)} rx="1.4" ry="1" fill="#fff" opacity=".2" />
          <path className="wf-nose-line" d={d`M 95.6 ${noseY - 0.8} C 94.8 ${noseY + 0.6} 95.8 ${noseY + 1.6} 97.4 ${noseY + 1.3} M 104.4 ${noseY - 0.8} C 105.2 ${noseY + 0.6} 104.2 ${noseY + 1.6} 102.6 ${noseY + 1.3}`} />
          <ellipse cx="97.9" cy={r(noseY + 0.9)} rx="1.1" ry=".55" className="wf-nostril" />
          <ellipse cx="102.1" cy={r(noseY + 0.9)} rx="1.1" ry=".55" className="wf-nostril" />
          <path className="wf-skin-shade" d={d`M 96.8 ${noseY + 2} Q 100 ${noseY + 3.2} 103.2 ${noseY + 2} Q 100 ${noseY + 2.6} 96.8 ${noseY + 2} Z`} opacity=".5" filter={`url(#${u}-blur)`} />
          {beard !== "clean" && beard !== "mustache" && <path className={beard === "stubble" ? "wf-beard wf-stubble" : "wf-beard"} d={beardShape(g, mouthY, beard)} filter={`url(#${u}-${beard === "stubble" ? "grain" : "blur"})`} />}
          <path className="wf-lip-upper" d={d`M ${women ? 94.8 : 95.2} ${mouthY} C 97 ${mouthY - (women ? 1.6 : 1.3)} 99 ${mouthY - (women ? 1.7 : 1.3)} 100 ${mouthY - 0.8} C 101 ${mouthY - (women ? 1.7 : 1.3)} 103 ${mouthY - (women ? 1.6 : 1.3)} ${women ? 105.2 : 104.8} ${mouthY} C 102.5 ${mouthY + 0.5} 97.5 ${mouthY + 0.5} ${women ? 94.8 : 95.2} ${mouthY} Z`} />
          <path className="wf-lip-lower" d={d`M 95.6 ${mouthY + 0.2} C 97.6 ${mouthY + 0.7} 102.4 ${mouthY + 0.7} 104.4 ${mouthY + 0.2} C 103.4 ${mouthY + (women ? 2.9 : 2.3)} 96.6 ${mouthY + (women ? 2.9 : 2.3)} 95.6 ${mouthY + 0.2} Z`} />
          <path className="wf-mouth" d={d`M 95 ${mouthY + 0.1} C 97.5 ${mouthY + 0.7} 102.5 ${mouthY + 0.7} 105 ${mouthY + 0.1}`} />
          <ellipse cx="100" cy={r(mouthY + 1.5)} rx="2" ry=".5" fill="#fff" opacity=".18" />
          <ellipse cx="100" cy={r(mouthY + 3.6)} rx="3" ry=".9" className="wf-skin-shade" opacity=".32" filter={`url(#${u}-blur)`} />
          {(beard === "full" || beard === "short" || beard === "goatee" || beard === "mustache") && <path className="wf-beard" d={mustachePath(mouthY, beard === "full" ? 0.95 : 0.8)} filter={`url(#${u}-blur)`} />}
          {beard === "stubble" && <path className="wf-beard wf-stubble" d={mustachePath(mouthY)} filter={`url(#${u}-grain)`} />}
        </g>
        <g className="wf-front-hair">{hair.front}</g>
        {p.headband && <path className="wf-headband" d={d`M ${100 - g.tW - 1.6} 21.4 C 88 17.4 112 17.4 ${100 + g.tW + 1.6} 21.4 L ${100 + g.tW + 1.7} 25.8 C 112 22 88 22 ${100 - g.tW - 1.7} 25.8 Z`} />}
        {p.helmet && <g><path className="wf-helmet" d={d`M ${100 - g.tW - 3.4} 46 C ${100 - g.tW - 5} 30 ${100 - g.tW - 4} 7 100 6.6 C ${100 + g.tW + 4} 7 ${100 + g.tW + 5} 30 ${100 + g.tW + 3.4} 46 L ${100 + g.tW + 0.6} 46.4 C ${100 + g.tW} 37 ${100 + g.tW - 1} 30 ${100 + g.tW - 3} 26 C 112 21.4 88 21.4 ${100 - g.tW + 3} 26 C ${100 - g.tW + 1} 30 ${100 - g.tW} 37 ${100 - g.tW - 0.6} 46.4 Z`} /><path className="wf-helmet-seam" d={d`M 100 7 L 100 21.6 M 90 9 C 88 14 87.6 18 88 22.6 M 110 9 C 112 14 112.4 18 112 22.6 M ${100 - g.tW - 3} 28 L ${100 - g.tW + 1} 28 M ${100 + g.tW + 3} 28 L ${100 + g.tW - 1} 28`} /></g>}
        {p.glasses && <g className="wf-glasses"><rect x="87" y="35.6" width="10" height="6" rx="2.2" /><rect x="103" y="35.6" width="10" height="6" rx="2.2" /><path d="M 97 37.4 Q 100 36.2 103 37.4 M 87 37.6 L 82 37 M 113 37.6 L 118 37" /></g>}
        {p.cap && <g><path className="wf-cap" d={d`M ${100 - g.tW - 1.6} 30 C ${100 - g.tW - 2} 14 88 8.4 100 8.4 C 112 8.4 ${100 + g.tW + 2} 14 ${100 + g.tW + 1.6} 30 C 112 25.4 88 25.4 ${100 - g.tW - 1.6} 30 Z`} /><path className="wf-hair" d="M 95 26.6 Q 100 22.6 105 26.6 Q 100 25.6 95 26.6 Z" /><path className="wf-cap-seam" d="M 100 8.6 L 100 22 M 92 9.8 C 89 16 88.6 20 89 25.4 M 108 9.8 C 111 16 111.4 20 111 25.4" /></g>}
        <g className="wf-arm left"><g transform={armShape}><Arm keeper={keeper} tattoo={tattooLeft} u={u} /></g></g>
        <g className="wf-arm right"><g transform="matrix(-1 0 0 1 200 0)"><g transform={armShape}><Arm keeper={keeper} tattoo={tattooRight} u={u} /></g></g></g>
      </svg>
  </div>;
}

/** Light eyes for fair players with blond or red hair, otherwise brown in a shade that suits the skin. */
function irisColor(p: WalkoutPresentation) {
  const fair = ["#f7d7c1", "#eec29f"].includes(p.skin.toLowerCase());
  const lightHair = ["#d8bd73", "#a98852", "#b65a2c", "#c07f52"].includes(p.hairColor.toLowerCase());
  if (fair && lightHair) return "#5d7f9c";
  if (fair && p.hairColor.toLowerCase() === "#80604b") return "#6b7a58";
  const dark = ["#7a482d", "#55301f", "#a06642"].includes(p.skin.toLowerCase());
  return dark ? "#2e1b10" : "#4a2e1d";
}
