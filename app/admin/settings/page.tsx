import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { FeeOverridesPage } from "@/features/settings/FeeOverridesPage";
import { FeeTypesPage } from "@/features/settings/FeeTypesPage";
import { PaymentGatewaySettingsCard } from "@/features/settings/PaymentGatewaySettingsCard";

export default function AdminSettingsPage() {
  return (
    <RequireOperatorRole>
      <div className="space-y-6">
        <PaymentGatewaySettingsCard />
        <FeeTypesPage />
        <FeeOverridesPage />
      </div>
    </RequireOperatorRole>
  );
}
