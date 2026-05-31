import { RequireOperatorRole } from "@/features/auth/RequireOperatorRole";
import { PageHeader } from "@/features/layout/PageHeader";
import { FeeOverridesPage } from "@/features/settings/FeeOverridesPage";
import { FeeTypesPage } from "@/features/settings/FeeTypesPage";
import { PaymentGatewaySettingsCard } from "@/features/settings/PaymentGatewaySettingsCard";

export default function AdminSettingsPage() {
  return (
    <RequireOperatorRole>
      <section className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Pengaturan"
          subtitle="Kelola gateway pembayaran, jenis iuran, dan override biaya per kavling."
        />

        <PaymentGatewaySettingsCard />

        <div className="space-y-6">
          <FeeTypesPage />
          <FeeOverridesPage />
        </div>
      </section>
    </RequireOperatorRole>
  );
}
