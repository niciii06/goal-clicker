// Owner-issued recovery codes are retired. Legacy players sign in normally.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function POST() {
  return Response.json({ error: "Bitte melde dich mit deinem Benutzernamen und Passwort an." }, { status: 410, headers: { "cache-control": "no-store" } });
}
