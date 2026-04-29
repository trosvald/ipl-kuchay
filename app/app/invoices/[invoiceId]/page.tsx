import { InvoiceDetailPage } from "@/features/billing/InvoiceDetailPage";

interface ResidentInvoiceDetailRouteProps {
  params: Promise<{
    invoiceId: string;
  }>;
}

export default async function ResidentInvoiceDetailRoute({ params }: Readonly<ResidentInvoiceDetailRouteProps>) {
  const { invoiceId } = await params;
  return <InvoiceDetailPage invoiceId={invoiceId} backHref="/app/invoices" backLabel="Kembali ke daftar invoice" />;
}
