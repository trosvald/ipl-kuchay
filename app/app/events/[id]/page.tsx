import { ResidentEventDetailPage } from "@/features/events/ResidentEventDetailPage";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ResidentEventDetailPage params={params} />;
}