const base = 'http://127.0.0.1:54321';
const web = 'http://10.25.12.221:3000';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function api(method, path, body) {
  const resp = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${method} ${path}: ${resp.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function ensureUser(email, password, fullName, role) {
  const users = await api('GET', '/auth/v1/admin/users?page=1&per_page=500');
  let user = users.users?.find((x) => x.email === email);
  if (!user) {
    user = await api('POST', '/auth/v1/admin/users', { email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  } else {
    await api('PUT', `/auth/v1/admin/users/${user.id}`, { password, email_confirm: true, user_metadata: { full_name: fullName } });
  }
  await api('PATCH', `/rest/v1/profiles?id=eq.${user.id}`, { full_name: fullName, display_name: fullName, role, is_active: true });
  return user.id;
}

async function setupData() {
  const userId = await ensureUser('resident-paid@jatiloka.test', 'password123', 'Warga Lunas', 'resident');
  const kav = (await api('GET', '/rest/v1/kavlings?code=eq.Kav%206&select=id'))[0];
  try {
    await api('POST', '/rest/v1/kavling_residents', { kavling_id: kav.id, profile_id: userId, relation: 'Pemilik', is_primary: true, active: true });
  } catch {}

  const invoices = await api('GET', `/rest/v1/invoices?kavling_id=eq.${kav.id}&select=id,amount_due`);
  for (const inv of invoices) {
    await api('PATCH', `/rest/v1/invoices?id=eq.${inv.id}`, { amount_paid: inv.amount_due, status: 'paid', paid_at: new Date().toISOString() });
  }

  // For former-resident UI check: disable active mapping but keep historical invoices
  await api('PATCH', `/rest/v1/kavling_residents?profile_id=eq.${userId}&kavling_id=eq.${kav.id}`, {
    active: false,
    is_primary: false,
    ended_at: '2026-05-01',
  });
}

async function login(page, email, password) {
  await page.goto(web + '/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: 'Masuk dengan password' }).click();
  await page.waitForTimeout(2000);
  if (!/\/app(\/|$)/.test(page.url())) {
    const text = await page.textContent('main');
    throw new Error(`Login failed for ${email}. URL=${page.url()} | main=${(text || '').slice(0, 300)}`);
  }
}

(async () => {
  await setupData();
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await login(page, 'resident-paid@jatiloka.test', 'password123');
  await page.goto(web + '/app/invoices');
  await page.waitForLoadState('networkidle');

  const result = {
    item4_all_paid: {
      hasSummary: await page.getByText('Ringkasan Tunggakan', { exact: true }).isVisible(),
      hasAllPaidMessage: await page.getByText('Semua tagihan Anda sudah lunas.').isVisible(),
    },
    item6_readonly_warning: {
      hasWarning: await page.getByText('Anda tidak punya kavling aktif saat ini').isVisible(),
      hasReadonlyText: await page.getByText('histori tagihan Anda (read-only)').isVisible(),
    },
  };

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
})();
