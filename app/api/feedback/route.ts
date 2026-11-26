// In game feedback (app/feedback-api.ts): GET says whether the form is available, POST stores a report.
import { feedbackStatusResponse, feedbackSubmitResponse } from "../../feedback-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = () => feedbackStatusResponse();
export const POST = (request: Request) => feedbackSubmitResponse(request);
