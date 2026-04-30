import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { AdminEventsPage } from "@/features/events/AdminEventsPage";

export default function Page() {
  return (
    <RequireOperatorRole>
      <AdminEventsPage />
    </RequireOperatorRole>
  );
}
