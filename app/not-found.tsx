import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-4 py-10">
      <Card className="w-full border-slate-200 bg-white/90 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Compass className="size-6 text-slate-600" />
            Halaman tidak ditemukan
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm text-slate-600">
          <p className="w-full">Rute yang Anda cari tidak tersedia.</p>
          <Button asChild>
            <Link href="/">Kembali ke login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
