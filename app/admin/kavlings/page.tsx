import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { KavlingListPage } from "@/features/kavlings/KavlingListPage";

export default function AdminKavlingsPage() {
  return (
    <RequireOperatorRole>
      <KavlingListPage />
    </RequireOperatorRole>
  );
}
