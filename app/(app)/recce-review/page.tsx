import { ReviewHome } from "@/components/recce-review/review-home";

// Renders only after the client-side sign-in check in AppShell (a server page: "instant" is not allowed in a client module).
export const instant = false;

export default function RecceReviewPage() {
  return <ReviewHome />;
}
