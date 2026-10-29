// Fast Origin Transfer on Vercel counts every byte between the CDN and the functions. Game states are
// large, repetitive JSON (card ids), so gzip shrinks them to about a tenth in both directions.
import { gzipSync } from "node:zlib";

const MIN_GZIP_BYTES = 1024;

/** Gzips a JSON response when the client accepts it and the body is worth it; other responses pass unchanged. */
export async function gzipJsonResponse(request: Request, response: Response): Promise<Response> {
  if (!/\bgzip\b/i.test(request.headers.get("accept-encoding") ?? "")) return response;
  if (!response.body || response.headers.has("content-encoding")) return response;
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return response;
  const body = new Uint8Array(await response.arrayBuffer());
  const headers = new Headers(response.headers);
  headers.append("vary", "accept-encoding");
  if (body.byteLength < MIN_GZIP_BYTES) return new Response(body, { status: response.status, statusText: response.statusText, headers });
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  return new Response(gzipSync(body), { status: response.status, statusText: response.statusText, headers });
}

/** Wraps a route handler so its JSON answers go out gzipped. */
export function withGzip<Args extends unknown[]>(handler: (request: Request, ...args: Args) => Promise<Response> | Response) {
  return async (request: Request, ...args: Args) => gzipJsonResponse(request, await handler(request, ...args));
}
