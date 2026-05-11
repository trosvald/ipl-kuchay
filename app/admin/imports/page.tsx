import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { ImportJobsPage } from "@/features/imports/ImportJobsPage";

export default function AdminImportsPage() {
  return (
    <RequireOperatorRole>
      <ImportJobsPage />
    </RequireOperatorRole>
  );
}
