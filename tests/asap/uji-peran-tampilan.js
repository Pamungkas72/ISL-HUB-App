// Tampilan per peran (Firebase tiruan): akun tanpa modul tidak melihat pintasan atau cadangan, akun lihat saja tidak diajak mencatat, label peran benar.
// Jalankan: NODE_PATH=<node_modules berisi playwright> node tests/asap/uji-peran-tampilan.js
const { chromium } = require('playwright');
const path = require('path');
const { pasang } = require('../audit/firebase-tiruan.js');
const { awal } = require('../audit/data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
let gagal = 0; const cek = (n, ok, cat = '') => { if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', n, ok ? '' : '- ' + cat); };
const dipisah = (a) => { Object.values(a.master_tarif).forEach((t) => { delete t.modal; t.hargaMin = t.hargaMin ?? 1; }); return a; };
const PERAN = {
  belum: { nama: 'Beni', peran: 'lihat', status: 'aktif', akses: { mr: 0, qt: 0, cu: 0, dj: 0, lg: 0 } },
  finance: { nama: 'Fina', peran: 'lihat', status: 'aktif', akses: { mr: 0, qt: 1, cu: 1, dj: 0, lg: 0, jabatan: 'Finance' } },
  sales: { nama: 'Sari', peran: 'sales', status: 'aktif', kodeSales: 'SLS-01' },
  djquot: { nama: 'Dodi', peran: 'dj', status: 'aktif', kelompokDJ: 'k1', akses: { mr: 0, qt: 2, cu: 2, dj: 2, lg: 0 } },
  djview: { nama: 'Dina', peran: 'dj', status: 'aktif', kelompokDJ: 'k1', akses: { mr: 0, qt: 1, cu: 1, dj: 1, lg: 0 } },
};
(async () => {
  const b = await chromium.launch(); const hasil = {};
  for (const [k, doc] of Object.entries(PERAN)) {
    const email = k + '@isl.test', c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), p = await c.newPage(), galat = [];
    p.on('pageerror', (e) => galat.push(e.message.slice(0, 100)));
    const data = dipisah(JSON.parse(JSON.stringify({ ...awal, pengguna: { ['u-' + k]: { email, ...doc } }, dj_kelompok: { k1: { nama: 'Marketing BD', profil: 'marketing', kepala: [] } }, sistem: { modal: { siap: true } } })));
    await pasang(p, PUBLIK, { email, awal: data });
    await p.goto('http://isl.test/app.html#beranda', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll('.ip-lapis').forEach((x) => x.remove()));
    const ber = await p.evaluate(() => ({ pin: [...document.querySelectorAll('.bd-pin a')].map((x) => x.textContent.trim()), ingat: !!document.getElementById('dj-ingat'), kartuPin: [...document.querySelectorAll('.app-main h3')].some((h) => /Pintasan/.test(h.textContent)) }));
    await p.evaluate(() => { location.hash = '#pengaturan'; }); await p.waitForTimeout(1200);
    const set = await p.evaluate(() => { const b = document.querySelector('[data-st=bag][data-v=umum]'); if (b) b.click(); return [...document.querySelectorAll('[data-st=bag]')].map((x) => x.dataset.v); });
    await p.waitForTimeout(400);
    const peran = await p.evaluate(() => (document.body.innerText.match(/Peran:[^\n]*/) || [''])[0]);
    hasil[k] = { ber, set, peran, galat }; await c.close();
  }
  await b.close();
  const h = hasil;
  cek('tanpa galat halaman di semua peran', Object.values(h).every((x) => !x.galat.length), JSON.stringify(Object.values(h).map((x) => x.galat)));
  cek('akun Belum diatur: tanpa kartu Pintasan', !h.belum.ber.kartuPin && !h.belum.ber.pin.length);
  cek('akun Belum diatur: tanpa Cadangan data', !h.belum.set.includes('cadangan'), h.belum.set.join(','));
  cek('akun Belum diatur: label peran', /Belum diatur/.test(h.belum.peran), h.belum.peran);
  cek('Finance (Lihat): pintasan tanpa kata Buat/Catat', h.finance.ber.pin.join(',') === 'Quotation,Customer', h.finance.ber.pin.join(','));
  cek('Finance: label memuat peran siap pakai', /Finance/.test(h.finance.peran), h.finance.peran);
  cek('Sales: pintasan Buat quotation dan label Sales', /Buat quotation/.test(h.sales.ber.pin.join()) && /Sales/.test(h.sales.peran), h.sales.peran);
  cek('Daily Job + Quotation Kelola: boleh Buat quotation dan label tambahan', /Buat quotation/.test(h.djquot.ber.pin.join()) && /membuat quotation/.test(h.djquot.peran), h.djquot.peran);
  cek('Daily Job lihat saja: tanpa pengingat Catat', !h.djview.ber.ingat);
  cek('Daily Job lihat saja: pintasan tanpa kata Catat', !/Catat/.test(h.djview.ber.pin.join()), h.djview.ber.pin.join(','));
  cek('Cadangan data hanya untuk master/admin', Object.values(h).every((x) => !x.set.includes('cadangan')));
  console.log(gagal ? `${gagal} gagal` : 'semua lulus'); process.exit(gagal ? 1 : 0);
})();
