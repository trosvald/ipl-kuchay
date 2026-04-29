import { RequireAdminLike } from "@/features/auth/RequireAdminLike";
import { AdminShell } from "@/features/layout/AdminShell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAdminLike>
      <AdminShell>{children}</AdminShell>
    </RequireAdminLike>
  );
}
