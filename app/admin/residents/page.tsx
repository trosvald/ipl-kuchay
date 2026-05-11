import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { ResidentListPage } from "@/features/residents/ResidentListPage";

export default function AdminResidentsPage() {
  return (
    <RequireOperatorRole>
      <ResidentListPage />
    </RequireOperatorRole>
  );
}
