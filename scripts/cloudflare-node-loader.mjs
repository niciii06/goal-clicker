const cloudflareWorkersStub =
  "data:text/javascript,export const env = globalThis.__SITES_TEST_ENV__ ?? {};";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return { shortCircuit: true, url: cloudflareWorkersStub };
  }

  return nextResolve(specifier, context);
}
