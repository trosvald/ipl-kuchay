import { AdminDashboardPage } from "@/features/admin/AdminDashboardPage";
import { RequireAdminLike } from "@/features/auth/RequireAdminLike";

export default function AdminRoutePage() {
  return (
    <RequireAdminLike>
      <AdminDashboardPage />
    </RequireAdminLike>
  );
}
