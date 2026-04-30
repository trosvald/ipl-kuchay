import { ResidentAnnouncementDetailPage } from "@/features/announcements/ResidentAnnouncementDetailPage";

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ResidentAnnouncementDetailPage params={params} />;
}