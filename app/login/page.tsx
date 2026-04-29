import { LoginPage } from "@/features/auth/LoginPage";

export default async function LoginRoutePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ reason?: string }> }>) {
  const params = await searchParams;
  return <LoginPage reason={params.reason} />;
}
