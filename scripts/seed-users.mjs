// Seed test users, kavling mappings, invoices for UAT
// Run once after: supabase db reset && supabase start
//
// Usage: node scripts/seed-users.mjs

const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SUPABASE_URL = "http://127.0.0.1:54321";
const PASSWORD = "password123";

const adminHeaders = (serviceRole = true) => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SERVICE_KEY}`,
  ...(serviceRole ? { "apikey": SERVICE_KEY } : {}),
});

const users = [
  { email: "admin@jatiloka.test",    full_name: "Admin Test",      role: "super_admin" },
  { email: "treasurer@jatiloka.test", full_name: "Bendahara Test",  role: "treasurer" },
  { email: "resident1@jatiloka.test", full_name: "Warga Satu",      role: "resident" },
  { email: "resident2@jatiloka.test", full_name: "Warga Dua",       role: "resident" },
];

async function api(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { ...adminHeaders(), ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${SUPABASE_URL}${path}`, opts);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${method} ${path}: ${resp.status} — ${text.slice(0, 300)}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

async function seed() {
  // ==========================================================
  // 1. Create auth users via admin API
  // ==========================================================
  console.log("Creating test users...");
  const userIdByEmail = {};

  for (const user of users) {
    try {
      const data = await api("POST", "/auth/v1/admin/users", {
        email: user.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });
      userIdByEmail[user.email] = data.id;
      console.log(`  ✓ ${user.email} (${user.role})`);
    } catch (err) {
      if (err.message.includes("422") && err.message.includes("already")) {
        const list = await api("GET", `/auth/v1/admin/users?filter=${encodeURIComponent(user.email)}`);
        const match = list?.users?.find(u => u.email === user.email);
        if (match) {
          userIdByEmail[user.email] = match.id;
          console.log(`  • ${user.email} — already exists`);
        }
      } else {
        throw err;
      }
    }
  }

  // ==========================================================
  // 2. Update profile roles
  // ==========================================================
  console.log("\nUpdating profile roles...");
  for (const user of users) {
    const id = userIdByEmail[user.email];
    await api("PATCH", `/rest/v1/profiles?id=eq.${id}`, {
      role: user.role,
      full_name: user.full_name,
      display_name: user.full_name,
      is_active: true,
    }, { "Prefer": "return=minimal" });
    console.log(`  ✓ ${user.email} → ${user.role}`);
  }

  // ==========================================================
  // 3. Kavling-resident mappings
  // ==========================================================
  const mappings = [
    { email: "resident1@jatiloka.test", code: "Kav 2",  relation: "Pemilik" },
    { email: "resident2@jatiloka.test", code: "Kav 3B", relation: "Pemilik" },
    { email: "resident2@jatiloka.test", code: "Kav 5",  relation: "Pemilik" },
  ];

  console.log("\nCreating kavling-resident mappings...");
  const kavIds = {};
  for (const mapping of mappings) {
    if (!kavIds[mapping.code]) {
      const rows = await api("GET", `/rest/v1/kavlings?code=eq.${encodeURIComponent(mapping.code)}&select=id`);
      kavIds[mapping.code] = rows?.[0]?.id;
    }
    const kavId = kavIds[mapping.code];
    if (!kavId) { console.error(`  ✗ Kavling '${mapping.code}' not found`); continue; }

    try {
      await api("POST", "/rest/v1/kavling_residents", {
        kavling_id: kavId,
        profile_id: userIdByEmail[mapping.email],
        relation: mapping.relation,
        is_primary: true,
        active: true,
      }, { "Prefer": "return=minimal" });
      console.log(`  ✓ ${mapping.email} → ${mapping.code}`);
    } catch (err) {
      if (err.message.includes("duplicate") || err.message.includes("23505")) {
        console.log(`  • ${mapping.email} → ${mapping.code} (already exists)`);
      } else {
        throw err;
      }
    }
  }

  // ==========================================================
  // 4. Fee overrides
  // ==========================================================
  console.log("\nCreating fee overrides...");
  const feeRows = await api("GET", "/rest/v1/fee_types?code=eq.IPL&select=id");
  const iplId = feeRows?.[0]?.id;

  const overrides = [
    { code: "Kav 2",  amount: 400000, notes: "Override dev: IPL Kav 2 naik 50rb" },
    { code: "Kav 3B", amount: 300000, notes: "Override dev: IPL Kav 3B turun 50rb" },
  ];

  for (const ov of overrides) {
    if (!kavIds[ov.code]) {
      const rows = await api("GET", `/rest/v1/kavlings?code=eq.${encodeURIComponent(ov.code)}&select=id`);
      kavIds[ov.code] = rows?.[0]?.id;
    }
    try {
      await api("POST", "/rest/v1/kavling_fee_overrides", {
        kavling_id: kavIds[ov.code],
        fee_type_id: iplId,
        amount: ov.amount,
        active_from: "2026-01-01",
        notes: ov.notes,
      }, { "Prefer": "return=minimal" });
      console.log(`  ✓ ${ov.code}: Rp ${ov.amount.toLocaleString("id-ID")}`);
    } catch (err) {
      if (err.message.includes("duplicate") || err.message.includes("overlap")) {
        console.log(`  • ${ov.code} already exists`);
      } else {
        throw err;
      }
    }
  }

  // ==========================================================
  // 5. Sign in as admin to call auth-gated RPCs
  // ==========================================================
  console.log("\nSigning in as admin...");
  const signInResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY },
    body: JSON.stringify({ email: "admin@jatiloka.test", password: PASSWORD }),
  });
  if (!signInResp.ok) {
    const text = await signInResp.text();
    throw new Error(`Sign in failed: ${text.slice(0, 200)}`);
  }
  const session = await signInResp.json();
  const userToken = session.access_token;
  console.log(`  ✓ Signed in as admin`);

  // Use user's JWT for auth-gated RPCs
  async function userApi(method, path, body) {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userToken}`,
        "apikey": SERVICE_KEY,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${SUPABASE_URL}${path}`, opts);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`${method} ${path}: ${resp.status} — ${text.slice(0, 300)}`);
    }
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  }

  // ==========================================================
  // 6. Generate invoices via RPC
  // ==========================================================
  console.log("\nGenerating invoices...");

  const periods = await api("GET", "/rest/v1/billing_periods?select=id,label,status&order=year.asc,month.asc");
  const openPeriod = periods.find(p => p.status === "open");
  const closedPeriod = periods.find(p => p.status === "closed");
  const archivedPeriod = periods.find(p => p.status === "archived");

  for (const period of [openPeriod, closedPeriod, archivedPeriod].filter(Boolean)) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/generate_invoices_for_period`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${userToken}`,
          "apikey": SERVICE_KEY,
          "Prefer": "params=single-object",
        },
        body: JSON.stringify({ target_period_id: period.id }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        if (text.includes("already")) {
          console.log(`  • ${period.label}: already generated`);
          continue;
        }
        throw new Error(text.slice(0, 200));
      }
      const count = await resp.json();
      console.log(`  ✓ ${period.label} (${period.status}): ${count} invoices`);
    } catch (err) {
      if (err.message.includes("already")) {
        console.log(`  • ${period.label}: already generated`);
      } else {
        throw err;
      }
    }
  }

  // ==========================================================
  // 7. Mark invoice statuses
  // ==========================================================
  console.log("\nSetting invoice statuses...");
  const invoiceUpdates = [
    { periodStatus: "closed",   code: "Kav 2",  action: "paid" },
    { periodStatus: "archived", code: "Kav 2",  action: "paid" },
    { periodStatus: "closed",   code: "Kav 3B", action: "overdue" },
    { periodStatus: "open",     code: "Kav 5",  action: "partial" },
  ];

  for (const update of invoiceUpdates) {
    const period = periods.find(x => x.status === update.periodStatus);
    const kavId = kavIds[update.code];
    if (!period || !kavId) continue;

    const rows = await userApi("GET",
      `/rest/v1/invoices?select=id,amount_due&billing_period_id=eq.${period.id}&kavling_id=eq.${kavId}`
    );
    const invoice = rows?.[0];
    if (!invoice) { console.log(`  ⚠ ${update.code}/${update.periodStatus}: no invoice`); continue; }

    if (update.action === "paid") {
      await userApi("PATCH", `/rest/v1/invoices?id=eq.${invoice.id}`, {
        amount_paid: invoice.amount_due,
        status: "paid",
        paid_at: new Date().toISOString(),
      });
    } else if (update.action === "overdue") {
      await userApi("PATCH", `/rest/v1/invoices?id=eq.${invoice.id}`, {
        status: "overdue",
      });
    } else if (update.action === "partial") {
      await userApi("PATCH", `/rest/v1/invoices?id=eq.${invoice.id}`, {
        amount_paid: Math.floor(invoice.amount_due / 2),
        status: "partial",
      });
    }
    console.log(`  ✓ ${update.code} — ${update.periodStatus} → ${update.action}`);
  }

  // ==========================================================
  // Done
  // ==========================================================
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Seed complete. Test accounts:");
  for (const user of users) {
    console.log(`  ${user.email}  / password123  (${user.role})`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

seed().catch((err) => {
  console.error("\n✗ Seed failed:", err.message);
  process.exit(1);
});
