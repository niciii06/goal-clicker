// A new account with username, display name and password; no e-mail is involved.
import { registerResponse } from "../../account-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = (request: Request) => registerResponse(request);
