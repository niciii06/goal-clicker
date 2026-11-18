// Outbound JSON answers (cloud save, Koop, travel) are large, repetitive JSON (card ids). They are compressed exactly
// once, by Next's own compression layer (`compress`, on by default), which negotiates with the client's
// Accept-Encoding. A route must NOT set `content-encoding` itself: since Next 16.4.5 the server drops that header
// from a route response and then compresses the already gzipped body a second time, which left the browser with
// gzip bytes after normal HTTP decoding (the cloud save would not load). Routes therefore answer with identity JSON.
// Inbound bodies are unaffected: request-body.ts still reads gzipped requests.

/** Passes a route's answer through untouched; compression is the framework's single layer (see above). */
export async function gzipJsonResponse(_request: Request, response: Response): Promise<Response> {
  return response;
}

/** Wraps a route handler so its JSON answers go out through the framework's compression layer. */
export function withGzip<Args extends unknown[]>(handler: (request: Request, ...args: Args) => Promise<Response> | Response) {
  return async (request: Request, ...args: Args) => gzipJsonResponse(request, await handler(request, ...args));
}
