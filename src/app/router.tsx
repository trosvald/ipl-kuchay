import { Route, Routes } from "react-router-dom";

import { APP_NAME } from "./constants";
import { formatDateId, formatRupiah } from "../lib/format";

function PublicDashboardPlaceholder() {
  return (
    <main className="page-shell">
      <section className="hero-panel" aria-labelledby="dashboard-title">
        <p className="eyebrow">Dashboard publik</p>
        <h1 id="dashboard-title">{APP_NAME}</h1>
        <p className="hero-copy">
          Fondasi aplikasi sedang disiapkan. Data produksi, autentikasi, dan
          pembayaran aman akan masuk di milestone berikutnya.
        </p>
        <dl className="summary-grid" aria-label="Ringkasan contoh">
          <div>
            <dt>Mode</dt>
            <dd>Aggregate</dd>
          </div>
          <div>
            <dt>Contoh iuran</dt>
            <dd>{formatRupiah(350000)}</dd>
          </div>
          <div>
            <dt>Tanggal</dt>
            <dd>{formatDateId(new Date())}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page-shell">
      <section className="hero-panel" aria-labelledby="not-found-title">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">Halaman tidak ditemukan</h1>
        <p className="hero-copy">Rute ini belum tersedia di milestone 0.</p>
      </section>
    </main>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicDashboardPlaceholder />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
