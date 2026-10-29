import { gunzipSync } from "node:zlib";

export const MAX_MULTIPLAYER_BODY_BYTES = 64 * 1024;
export const MAX_GAME_STATE_BODY_BYTES = 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super("Die Anfrage ist zu gross.");
    this.name = "RequestBodyTooLargeError";
  }
}

// Reads a JSON body without buffering more than maxBytes, also for chunked requests without Content-Length.
// A gzipped body (Content-Encoding: gzip) may also unpack to at most maxBytes.
export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
  if (!request.body) return JSON.parse("") as T;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const gzipped = /\bgzip\b/i.test(request.headers.get("content-encoding") ?? "");
  let text: Uint8Array = bytes;
  if (gzipped) {
    try {
      text = gunzipSync(bytes, { maxOutputLength: maxBytes });
    } catch (error) {
      if (error instanceof RangeError || (error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new RequestBodyTooLargeError(maxBytes);
      throw error;
    }
  }
  return JSON.parse(new TextDecoder().decode(text)) as T;
}
