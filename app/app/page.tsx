import { ResidentHomePage } from "@/features/resident/ResidentHomePage";
import { RequireAuth } from "@/features/auth/RequireAuth";

export default function ResidentAppPage() {
  return (
    <RequireAuth>
      <ResidentHomePage />
    </RequireAuth>
  );
}
