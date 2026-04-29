import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const KAVLINGS = [
  "Kav 1","Kav 2","Kav 3A","Kav 3B","Kav 5",
  "Kav 6","Kav 7","Kav 8","Kav 9","Kav 10",
  "Kav 11","Kav 12","Kav 15A","Kav 15B","Kav 16",
  "Kav 17","Kav 18","Kav 19","Kav 20","Kav 21",
  "Kav 22","Kav 23A","Kav 23B","Kav 25","Kav 26",
  "Kav 27","Kav 28","Kav 30","Kav 31","Kav 32A",
  "Kav 32B","Kav 35","Kav 36","Kav 37"
];

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

const now = new Date();
const ADMIN_PIN = "1234"; // Ganti sesuai keinginan pengurus

export default function App() {
  const [view, setView] = useState("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ kavling: "", nominal: "", catatan: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [toast, setToast] = useState(null);
  const [expandedKav, setExpandedKav] = useState(null);

  useEffect(() => { fetchPayments(); }, [selectedMonth, selectedYear]);

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      const map = {};
      data.forEach(p => { map[p.kavling] = p; });
      setPayments(map);
    } catch (e) {
      showToast("Gagal load data: " + e.message, "error");
    }
    setLoading(false);
  }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!formData.kavling || !formData.nominal) return;
    setSubmitting(true);
    try {
      let buktiUrl = null;

      if (uploadFile) {
        const ext = uploadFile.name.split(".").pop();
        const fileName = `${selectedYear}-${selectedMonth}-${formData.kavling}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("bukti-transfer")
          .upload(fileName, uploadFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage
          .from("bukti-transfer")
          .getPublicUrl(fileName);
        buktiUrl = urlData.publicUrl;
      }

      const payload = {
        kavling: formData.kavling,
        month: selectedMonth,
        year: selectedYear,
        nominal: formData.nominal,
        catatan: formData.catatan || null,
        bukti_url: buktiUrl,
        waktu: new Date().toISOString(),
        status: "lunas",
      };

      const { error } = await supabase
        .from("payments")
        .upsert(payload, { onConflict: "kavling,month,year" });
      if (error) throw error;

      await fetchPayments();
      setSubmitted(true);
      showToast(`${formData.kavling} berhasil dikonfirmasi! ✅`);
    } catch (e) {
      showToast("Gagal submit: " + e.message, "error");
    }
    setSubmitting(false);
  }

  async function adminToggle(kav) {
    try {
      if (payments[kav]) {
        const { error } = await supabase
          .from("payments")
          .delete()
          .eq("kavling", kav)
          .eq("month", selectedMonth)
          .eq("year", selectedYear);
        if (error) throw error;
        showToast(`${kav} direset ke belum bayar`);
      } else {
        const { error } = await supabase
          .from("payments")
          .upsert({
            kavling: kav, month: selectedMonth, year: selectedYear,
            nominal: "0", catatan: "Manual admin", status: "lunas",
            waktu: new Date().toISOString(),
          }, { onConflict: "kavling,month,year" });
        if (error) throw error;
        showToast(`${kav} ditandai lunas`);
      }
      await fetchPayments();
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  }

  async function adminReset() {
    if (!confirm(`Reset semua data ${selectedMonth} ${selectedYear}?`)) return;
    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("month", selectedMonth)
        .eq("year", selectedYear);
      if (error) throw error;
      await fetchPayments();
      showToast("Data direset", "error");
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  }

  // Export bulan ini ke CSV
  function exportMonthCSV() {
    const rows = [["Kavling","Status","Nominal (Rp)","Waktu Bayar","Catatan","Link Bukti"]];
    KAVLINGS.forEach(kav => {
      const p = payments[kav];
      if (p) {
        rows.push([kav,"Lunas",p.nominal,new Date(p.waktu).toLocaleString("id-ID"),p.catatan||"",p.bukti_url||""]);
      } else {
        rows.push([kav,"Belum Bayar","","","",""]);
      }
    });
    downloadCSV(rows, `IPL-Jatiloka-${selectedMonth}-${selectedYear}.csv`);
    showToast("Export berhasil! 📊");
  }

  // Export semua bulan semua tahun
  async function exportAllCSV() {
    showToast("Mengambil semua data...");
    try {
      const { data, error } = await supabase.from("payments").select("*").order("year").order("month").order("kavling");
      if (error) throw error;
      const rows = [["Bulan","Tahun","Kavling","Status","Nominal (Rp)","Waktu Bayar","Catatan","Link Bukti"]];
      data.forEach(p => {
        rows.push([p.month,p.year,p.kavling,"Lunas",p.nominal,new Date(p.waktu).toLocaleString("id-ID"),p.catatan||"",p.bukti_url||""]);
      });
      downloadCSV(rows, `IPL-Jatiloka-SEMUA-DATA.csv`);
      showToast(`Export selesai! ${data.length} data 📊`);
    } catch (e) {
      showToast("Gagal export: " + e.message, "error");
    }
  }

  function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM biar Excel baca dengan benar
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const lunas = KAVLINGS.filter(k => payments[k]);
  const belum = KAVLINGS.filter(k => !payments[k]);
  const pct = Math.round((lunas.length / KAVLINGS.length) * 100);

  // ─── FORM VIEW ───────────────────────────────────────────────
  if (view === "form") {
    return (
      <div style={s.page}>
        <TopBar onBack={() => { setView("dashboard"); setSubmitted(false); setFormData({ kavling:"", nominal:"", catatan:"" }); setUploadFile(null); setUploadPreview(null); }} title="Konfirmasi Pembayaran" />
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <div style={s.bigIcon}>🏠</div>
            <div style={s.formTitle}>IPL Jatiloka Residence</div>
            <div style={s.formSub}>{selectedMonth} {selectedYear}</div>
          </div>

          {submitted ? (
            <div style={s.successBox}>
              <div style={{ fontSize: 56 }}>✅</div>
              <div style={s.successTitle}>Terkonfirmasi!</div>
              <div style={s.successSub}>{formData.kavling} · {selectedMonth} {selectedYear}</div>
              <button style={s.btnPrimary} onClick={() => {
                setSubmitted(false);
                setFormData({ kavling:"", nominal:"", catatan:"" });
                setUploadFile(null); setUploadPreview(null);
              }}>Konfirmasi Kavling Lain</button>
            </div>
          ) : (
            <div style={s.formBody}>
              <Field label="Kavling Anda *">
                <select style={s.select} value={formData.kavling}
                  onChange={e => setFormData({...formData, kavling: e.target.value})}>
                  <option value="">-- Pilih Kavling --</option>
                  {KAVLINGS.map(k => (
                    <option key={k} value={k}>{k}{payments[k] ? " ✓ Sudah Lunas" : ""}</option>
                  ))}
                </select>
              </Field>

              <Field label="Nominal Transfer (Rp) *">
                <input style={s.input} type="number" placeholder="Contoh: 350000"
                  value={formData.nominal}
                  onChange={e => setFormData({...formData, nominal: e.target.value})} />
              </Field>

              <Field label="Bukti Transfer (foto/screenshot)">
                <label style={s.uploadBox}>
                  {uploadPreview
                    ? <img src={uploadPreview} style={s.previewImg} alt="preview" />
                    : <div style={s.uploadPlaceholder}>
                        <div style={{ fontSize: 32 }}>📎</div>
                        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Tap untuk upload bukti transfer</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>JPG, PNG, PDF</div>
                      </div>
                  }
                  <input type="file" accept="image/*,application/pdf" style={{ display:"none" }}
                    onChange={handleFileChange} />
                </label>
                {uploadFile && (
                  <div style={{ fontSize: 12, color: "#16a34a", marginTop: 4 }}>
                    ✓ {uploadFile.name}
                    <button style={{ marginLeft: 8, color: "#ef4444", background:"none", border:"none", cursor:"pointer", fontSize:12 }}
                      onClick={() => { setUploadFile(null); setUploadPreview(null); }}>Hapus</button>
                  </div>
                )}
              </Field>

              <Field label="Catatan (opsional)">
                <input style={s.input} type="text" placeholder="Contoh: transfer pagi"
                  value={formData.catatan}
                  onChange={e => setFormData({...formData, catatan: e.target.value})} />
              </Field>

              <div style={s.infoBox}>
                <InfoRow label="Transfer ke" value="CIMB Niaga 708765755400" />
                <InfoRow label="Atas Nama" value="Sagung Dian Rosinta" />
                <InfoRow label="Deadline" value={`30 ${selectedMonth} ${selectedYear}`} danger />
              </div>

              <button style={{ ...s.btnPrimary, opacity: (!formData.kavling || !formData.nominal || submitting) ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={!formData.kavling || !formData.nominal || submitting}>
                {submitting ? "Menyimpan..." : "Konfirmasi Pembayaran"}
              </button>
            </div>
          )}
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ─── ADMIN PIN VIEW ──────────────────────────────────────────
  if (view === "admin" && !adminMode) {
    return (
      <div style={s.page}>
        <TopBar onBack={() => setView("dashboard")} title="Admin" />
        <div style={s.pinCard}>
          <div style={{ fontSize: 48 }}>🔐</div>
          <div style={s.pinTitle}>PIN Admin</div>
          <input style={{ ...s.input, textAlign:"center", letterSpacing:10, fontSize:22, maxWidth:180 }}
            type="password" maxLength={4} value={adminPin}
            onChange={e => { setAdminPin(e.target.value); setPinError(false); }}
            placeholder="••••" />
          {pinError && <div style={{ color:"#ef4444", fontSize:13 }}>PIN salah</div>}
          <button style={s.btnPrimary} onClick={() => {
            if (adminPin === ADMIN_PIN) { setAdminMode(true); setPinError(false); }
            else setPinError(true);
          }}>Masuk</button>
        </div>
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ─── ADMIN PANEL VIEW ────────────────────────────────────────
  if (view === "admin" && adminMode) {
    return (
      <div style={s.page}>
        <TopBar
          onBack={() => { setView("dashboard"); setAdminMode(false); setAdminPin(""); }}
          title="Admin Panel"
          right={<button style={{ fontSize:13, color:"#ef4444", background:"none", border:"none", cursor:"pointer", fontWeight:700 }} onClick={adminReset}>Reset Bulan Ini</button>}
        />
        <div style={{ padding:"12px 16px 4px" }}>
          <div style={s.monthRow}>
            <select style={s.monthSel} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m}>{m}</option>)}
            </select>
            <select style={s.monthSel} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {[2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {/* Export Box */}
        <div style={{ padding:"8px 16px 4px" }}>
          <div style={s.exportBox}>
            <div style={s.exportTitle}>📊 Export Data ke Excel</div>
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button style={s.exportBtn} onClick={exportMonthCSV}>
                📅 Bulan Ini
                <span style={{ fontSize:10, opacity:0.8, display:"block" }}>{selectedMonth} {selectedYear}</span>
              </button>
              <button style={{ ...s.exportBtn, background:"linear-gradient(135deg,#0f766e,#0d9488)" }} onClick={exportAllCSV}>
                🗂️ Semua Data
                <span style={{ fontSize:10, opacity:0.8, display:"block" }}>Semua bulan & tahun</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div style={{ padding:"8px 16px" }}>
            {KAVLINGS.map(kav => {
              const p = payments[kav];
              return (
                <div key={kav} style={s.adminRow}>
                  <div style={{ flex:1 }}>
                    <div style={s.adminKav}>{kav}</div>
                    {p && <div style={s.adminDetail}>Rp {Number(p.nominal).toLocaleString("id-ID")} · {new Date(p.waktu).toLocaleString("id-ID")}</div>}
                    {p?.bukti_url && (
                      <a href={p.bukti_url} target="_blank" rel="noreferrer"
                        style={{ fontSize:11, color:"#2563eb", textDecoration:"none" }}>
                        📎 Lihat Bukti
                      </a>
                    )}
                  </div>
                  <button style={{ ...s.pill, background: p ? "#dcfce7":"#fee2e2", color: p ? "#16a34a":"#dc2626" }}
                    onClick={() => adminToggle(kav)}>
                    {p ? "✓ Lunas" : "Belum"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {toast && <Toast {...toast} />}
      </div>
    );
  }

  // ─── DASHBOARD VIEW ──────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoWrap}>🏘️</div>
          <div>
            <div style={s.logoTitle}>Jatiloka Residence</div>
            <div style={s.logoSub}>IPL Payment Tracker</div>
          </div>
        </div>
        <button style={s.gearBtn} onClick={() => setView("admin")}>⚙️</button>
      </div>

      <div style={s.monthRow2}>
        <select style={s.monthSel} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select style={s.monthSel} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {[2025,2026,2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div style={s.progCard}>
            <div style={s.progTop}>
              <span style={s.progLabel}>Progress {selectedMonth} {selectedYear}</span>
              <span style={s.progPct}>{pct}%</span>
            </div>
            <div style={s.progTrack}><div style={{ ...s.progFill, width:`${pct}%` }} /></div>
            <div style={s.statsRow}>
              <Stat num={lunas.length} label="Lunas" color="#16a34a" />
              <div style={s.divider} />
              <Stat num={belum.length} label="Belum" color="#dc2626" />
              <div style={s.divider} />
              <Stat num={KAVLINGS.length} label="Total" color="#2563eb" />
            </div>
          </div>

          <button style={s.ctaBtn} onClick={() => { setView("form"); setSubmitted(false); }}>
            + Konfirmasi Pembayaran Saya
          </button>

          <SectionLabel text="Status Semua Kavling" />
          <div style={s.grid}>
            {KAVLINGS.map(kav => {
              const p = payments[kav];
              const open = expandedKav === kav;
              return (
                <div key={kav}
                  style={{ ...s.kavCard, background: p ? "#f0fdf4":"#fff", borderColor: p ? "#86efac":"#e5e7eb" }}
                  onClick={() => setExpandedKav(open ? null : kav)}>
                  <div style={s.kavName}>{kav}</div>
                  <div style={{ ...s.kavStatus, color: p ? "#16a34a":"#9ca3af" }}>
                    {p ? "✓ Lunas" : "Belum"}
                  </div>
                  {open && p && (
                    <div style={s.kavDetail}>
                      <div>Rp {Number(p.nominal).toLocaleString("id-ID")}</div>
                      {p.bukti_url && <a href={p.bukti_url} target="_blank" rel="noreferrer" style={{ color:"#2563eb", fontSize:10 }}>📎 Bukti</a>}
                      {p.catatan && <div style={{ color:"#6b7280", fontSize:10 }}>{p.catatan}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {belum.length > 0 && (
            <>
              <SectionLabel text={`⏳ Belum Bayar (${belum.length})`} />
              <div style={s.chips}>
                {belum.map(k => <span key={k} style={s.belumChip}>{k}</span>)}
              </div>
            </>
          )}

          {lunas.length > 0 && (
            <>
              <SectionLabel text={`✅ Sudah Lunas (${lunas.length})`} />
              <div style={s.chips}>
                {lunas.map(k => <span key={k} style={s.lunasChip}>{k}</span>)}
              </div>
            </>
          )}
        </>
      )}

      <div style={{ height: 40 }} />
      {toast && <Toast {...toast} />}
    </div>
  );
}

// ─── REUSABLE COMPONENTS ─────────────────────────────────────
function TopBar({ onBack, title, right }) {
  return (
    <div style={s.topBar}>
      <button style={s.backBtn} onClick={onBack}>← Kembali</button>
      <span style={s.topTitle}>{title}</span>
      {right || <span />}
    </div>
  );
}
function Field({ label, children }) {
  return <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    <label style={s.label}>{label}</label>
    {children}
  </div>;
}
function InfoRow({ label, value, danger }) {
  return <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
    <span style={{ color:"#6b7280" }}>{label}</span>
    <b style={{ color: danger ? "#ef4444":"#111827" }}>{value}</b>
  </div>;
}
function Stat({ num, label, color }) {
  return <div style={{ textAlign:"center" }}>
    <div style={{ fontSize:28, fontWeight:800, color }}>{num}</div>
    <div style={{ fontSize:11, color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
  </div>;
}
function SectionLabel({ text }) {
  return <div style={s.secLabel}>{text}</div>;
}
function Spinner() {
  return <div style={{ textAlign:"center", padding:40, color:"#9ca3af", fontSize:14 }}>Memuat data...</div>;
}
function Toast({ msg, type }) {
  return (
    <div style={{
      position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
      background: type==="error" ? "#ef4444":"#16a34a",
      color:"#fff", padding:"12px 24px", borderRadius:99,
      fontSize:14, fontWeight:600, zIndex:999,
      boxShadow:"0 4px 20px rgba(0,0,0,0.25)", whiteSpace:"nowrap", maxWidth:"90vw"
    }}>{msg}</div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────
const s = {
  page: { minHeight:"100vh", background:"#f8fafc", fontFamily:"'Segoe UI',system-ui,sans-serif", paddingBottom:32 },
  topBar: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:"#fff", borderBottom:"1px solid #e5e7eb", position:"sticky", top:0, zIndex:10 },
  backBtn: { fontSize:14, color:"#2563eb", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0 },
  topTitle: { fontSize:16, fontWeight:700, color:"#111827" },

  header: { background:"linear-gradient(135deg,#0f2444 0%,#1e40af 100%)", padding:"20px 16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  logoWrap: { fontSize:30, background:"rgba(255,255,255,0.15)", borderRadius:14, width:50, height:50, display:"flex", alignItems:"center", justifyContent:"center" },
  logoTitle: { color:"#fff", fontSize:17, fontWeight:800, letterSpacing:-0.3 },
  logoSub: { color:"rgba(255,255,255,0.65)", fontSize:11, marginTop:2 },
  gearBtn: { background:"rgba(255,255,255,0.15)", border:"none", borderRadius:12, width:42, height:42, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },

  monthRow: { display:"flex", gap:8, marginBottom:8 },
  monthRow2: { display:"flex", gap:8, padding:"12px 16px", background:"#fff", borderBottom:"1px solid #e5e7eb" },
  monthSel: { flex:1, padding:"9px 12px", borderRadius:10, border:"1.5px solid #e5e7eb", fontSize:14, fontWeight:600, color:"#1e3a8a", background:"#eff6ff" },

  progCard: { margin:"16px", background:"#fff", borderRadius:18, padding:"20px", boxShadow:"0 2px 16px rgba(0,0,0,0.07)" },
  progTop: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 },
  progLabel: { fontSize:13, fontWeight:600, color:"#374151" },
  progPct: { fontSize:24, fontWeight:800, color:"#1e40af" },
  progTrack: { height:10, background:"#e5e7eb", borderRadius:99, overflow:"hidden", marginBottom:16 },
  progFill: { height:"100%", background:"linear-gradient(90deg,#16a34a,#4ade80)", borderRadius:99, transition:"width 0.6s ease" },
  statsRow: { display:"flex", justifyContent:"space-around", alignItems:"center" },
  divider: { width:1, height:36, background:"#e5e7eb" },

  ctaBtn: { display:"block", margin:"0 16px 16px", width:"calc(100% - 32px)", padding:"15px", background:"linear-gradient(135deg,#1e40af,#4338ca)", color:"#fff", border:"none", borderRadius:14, fontSize:15, fontWeight:700, cursor:"pointer", boxSizing:"border-box" },

  secLabel: { fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, padding:"4px 16px 10px" },

  grid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, padding:"0 16px 16px" },
  kavCard: { border:"1.5px solid", borderRadius:13, padding:"10px 8px", textAlign:"center", cursor:"pointer", transition:"all 0.15s" },
  kavName: { fontSize:12, fontWeight:700, color:"#374151" },
  kavStatus: { fontSize:11, fontWeight:600, marginTop:2 },
  kavDetail: { fontSize:10, marginTop:6, display:"flex", flexDirection:"column", gap:2, alignItems:"center", borderTop:"1px solid #e5e7eb", paddingTop:6 },

  chips: { display:"flex", flexWrap:"wrap", gap:7, padding:"0 16px 16px" },
  belumChip: { background:"#fee2e2", color:"#dc2626", fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:99, border:"1px solid #fca5a5" },
  lunasChip: { background:"#dcfce7", color:"#16a34a", fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:99, border:"1px solid #86efac" },

  // Form
  formCard: { margin:16, background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.09)" },
  formHeader: { background:"linear-gradient(135deg,#0f2444,#1e40af)", padding:"28px 20px", textAlign:"center" },
  bigIcon: { fontSize:38, marginBottom:8 },
  formTitle: { color:"#fff", fontSize:17, fontWeight:800 },
  formSub: { color:"rgba(255,255,255,0.7)", fontSize:13, marginTop:4 },
  formBody: { padding:20, display:"flex", flexDirection:"column", gap:16 },
  label: { fontSize:13, fontWeight:600, color:"#374151" },
  input: { padding:"12px 14px", borderRadius:12, border:"1.5px solid #e5e7eb", fontSize:15, color:"#111827", outline:"none", width:"100%", boxSizing:"border-box" },
  select: { padding:"12px 14px", borderRadius:12, border:"1.5px solid #e5e7eb", fontSize:14, color:"#111827", background:"#fff", width:"100%", boxSizing:"border-box" },
  uploadBox: { display:"block", border:"2px dashed #cbd5e1", borderRadius:14, overflow:"hidden", cursor:"pointer", minHeight:120, display:"flex", alignItems:"center", justifyContent:"center" },
  uploadPlaceholder: { textAlign:"center", padding:20 },
  previewImg: { width:"100%", maxHeight:200, objectFit:"cover" },
  infoBox: { background:"#eff6ff", borderRadius:12, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, border:"1px solid #bfdbfe" },
  btnPrimary: { background:"linear-gradient(135deg,#1e40af,#4338ca)", color:"#fff", border:"none", borderRadius:12, padding:"15px", fontSize:15, fontWeight:700, cursor:"pointer", width:"100%" },
  successBox: { padding:"48px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:12, textAlign:"center" },
  successTitle: { fontSize:22, fontWeight:800, color:"#16a34a" },
  successSub: { fontSize:14, color:"#6b7280" },

  // Admin
  pinCard: { margin:"48px 20px", background:"#fff", borderRadius:20, padding:"36px 24px", display:"flex", flexDirection:"column", gap:16, alignItems:"center", boxShadow:"0 4px 24px rgba(0,0,0,0.09)" },
  pinTitle: { fontSize:18, fontWeight:700, color:"#0f2444" },
  adminRow: { background:"#fff", borderRadius:12, padding:"14px 16px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", border:"1px solid #e5e7eb", gap:8 },
  adminKav: { fontSize:14, fontWeight:700, color:"#111827" },
  adminDetail: { fontSize:11, color:"#9ca3af", marginTop:2 },
  pill: { fontSize:12, fontWeight:700, padding:"7px 14px", borderRadius:99, border:"none", cursor:"pointer", flexShrink:0 },

  // Export
  exportBox: { background:"#fff", borderRadius:14, padding:"14px 16px", border:"1px solid #e5e7eb", marginBottom:8 },
  exportTitle: { fontSize:13, fontWeight:700, color:"#374151" },
  exportBtn: { flex:1, background:"linear-gradient(135deg,#1e40af,#4338ca)", color:"#fff", border:"none", borderRadius:10, padding:"10px 8px", fontSize:13, fontWeight:700, cursor:"pointer", textAlign:"center", lineHeight:1.4 },
};
