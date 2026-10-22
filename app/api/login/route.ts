// Turns a username into the login address the browser then signs in with.
import { loginEmailResponse } from "../../account-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = (request: Request) => loginEmailResponse(request);
