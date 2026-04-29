import { RequireAuth } from "@/features/auth/RequireAuth";
import { ResidentShell } from "@/features/layout/ResidentShell";

export default function ResidentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <RequireAuth>
      <ResidentShell>{children}</ResidentShell>
    </RequireAuth>
  );
}
