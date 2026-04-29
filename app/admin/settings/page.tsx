import { FeeOverridesPage } from "@/features/settings/FeeOverridesPage";
import { FeeTypesPage } from "@/features/settings/FeeTypesPage";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <FeeTypesPage />
      <FeeOverridesPage />
    </div>
  );
}
