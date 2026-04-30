import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { AdminAnnouncementsPage } from "@/features/announcements/AdminAnnouncementsPage";

export default function Page() {
  return (
    <RequireOperatorRole>
      <AdminAnnouncementsPage />
    </RequireOperatorRole>
  );
}
