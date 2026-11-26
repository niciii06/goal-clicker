// Rules for the in game feedback form (Notion: In-Game-Feedbackformular). Shared by the form and /api/feedback, so
// the browser and the server refuse the same input. A screenshot travels as a data URL and must really be a PNG,
// JPEG or WebP image: the first bytes decide, not the name or the declared type.

export const FEEDBACK_KINDS = ["bug", "improvement", "feature"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_TITLE = { min: 3, max: 120 } as const;
export const FEEDBACK_DESCRIPTION = { min: 10, max: 4000 } as const;
/** The decoded image; phone screenshots as JPEG or WebP fit, a large PNG is refused with a clear message. */
export const FEEDBACK_SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
/** The whole request: text, a base64 screenshot (4/3 of its bytes) and some room. */
export const FEEDBACK_MAX_BODY_BYTES = Math.ceil(FEEDBACK_SCREENSHOT_MAX_BYTES * 4 / 3) + 64 * 1024;

export type FeedbackImageType = "image/png" | "image/jpeg" | "image/webp";
export type FeedbackInput = { kind: FeedbackKind; title: string; description: string; screenshot: { type: FeedbackImageType; base64: string } | null };
export type FeedbackError = "kind" | "titleShort" | "titleLong" | "descriptionShort" | "descriptionLong" | "imageType" | "imageSize";

/** The image type from the first bytes, or null for anything else (also for an SVG, GIF or an executable). */
export function sniffImageType(bytes: Uint8Array): FeedbackImageType | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

const clean = (value: unknown) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
const length = (value: string) => [...value].length;

function decodeBase64(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  try { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); } catch { return null; }
}

/** Checks a submitted report; returns the cleaned input or the first problem. */
export function parseFeedback(body: { kind?: unknown; title?: unknown; description?: unknown; screenshot?: unknown }): { ok: true; input: FeedbackInput } | { ok: false; error: FeedbackError } {
  const kind = FEEDBACK_KINDS.find((value) => value === body.kind);
  if (!kind) return { ok: false, error: "kind" };
  const title = clean(body.title).replace(/\s+/g, " "), description = clean(body.description);
  if (length(title) < FEEDBACK_TITLE.min) return { ok: false, error: "titleShort" };
  if (length(title) > FEEDBACK_TITLE.max) return { ok: false, error: "titleLong" };
  if (length(description) < FEEDBACK_DESCRIPTION.min) return { ok: false, error: "descriptionShort" };
  if (length(description) > FEEDBACK_DESCRIPTION.max) return { ok: false, error: "descriptionLong" };
  if (body.screenshot === null || body.screenshot === undefined || body.screenshot === "") return { ok: true, input: { kind, title, description, screenshot: null } };
  if (typeof body.screenshot !== "string") return { ok: false, error: "imageType" };
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(body.screenshot);
  if (!match) return { ok: false, error: "imageType" };
  // Rough size check before decoding, so a huge string is never turned into bytes.
  if (match[2].length > Math.ceil(FEEDBACK_SCREENSHOT_MAX_BYTES * 4 / 3) + 4) return { ok: false, error: "imageSize" };
  const bytes = decodeBase64(match[2]);
  if (!bytes) return { ok: false, error: "imageType" };
  if (bytes.length > FEEDBACK_SCREENSHOT_MAX_BYTES) return { ok: false, error: "imageSize" };
  const type = sniffImageType(bytes);
  if (!type || type !== `image/${match[1]}`) return { ok: false, error: "imageType" };
  return { ok: true, input: { kind, title, description, screenshot: { type, base64: match[2] } } };
}
