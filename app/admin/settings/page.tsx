import { FeeOverridesPage } from "@/features/settings/FeeOverridesPage";
import { FeeTypesPage } from "@/features/settings/FeeTypesPage";
import { PaymentGatewaySettingsCard } from "@/features/settings/PaymentGatewaySettingsCard";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PaymentGatewaySettingsCard />
      <FeeTypesPage />
      <FeeOverridesPage />
    </div>
  );
}
