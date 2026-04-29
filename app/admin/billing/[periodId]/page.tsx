import { BillingPeriodDetailPage } from "@/features/billing/BillingPeriodDetailPage";

interface AdminBillingPeriodDetailRouteProps {
  params: Promise<{
    periodId: string;
  }>;
}

export default async function AdminBillingPeriodDetailRoute({ params }: Readonly<AdminBillingPeriodDetailRouteProps>) {
  const { periodId } = await params;
  return <BillingPeriodDetailPage periodId={periodId} />;
}
