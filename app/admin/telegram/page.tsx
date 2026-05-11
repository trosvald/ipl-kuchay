import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { AdminTelegramPage } from "@/features/telegram/AdminTelegramPage";

export default function TelegramAdminRoute() {
  return (
    <RequireOperatorRole>
      <AdminTelegramPage />
    </RequireOperatorRole>
  );
}
