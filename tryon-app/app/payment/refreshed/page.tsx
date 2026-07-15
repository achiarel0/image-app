import { AuthShell } from "../../components/AuthShell";
import { SessionRefresher } from "../success/SessionRefresher";

export const dynamic = "force-dynamic";

// Route handlers can't swap the browser's JWT; this page closes the loop
// after /payment/revalidate extends paid_until — the client refreshes its
// session and returns to the studio.
export default function PaymentRefreshedPage() {
  return (
    <AuthShell
      eyebrow="Membership"
      title="Welcome back"
      subtitle="Your subscription is active."
    >
      <SessionRefresher label="Renewing your access…" />
    </AuthShell>
  );
}
