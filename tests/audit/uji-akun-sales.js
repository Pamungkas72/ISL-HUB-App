// Uji alur akun sales di aplikasi ASLI dengan Firebase tiruan (tanpa jaringan): daftar, kode otomatis, setujui, kabari WA, akun manual.
// Jalankan: NODE_PATH=<node_modules berisi playwright> node tests/audit/uji-akun-sales.js [hp|desktop]
const { chromium } = require('playwright');
const path = require('path');
const { pasang } = require('./firebase-tiruan.js');
const { awal } = require('./data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const LAYAR = process.argv.includes('hp') ? { width: 390, height: 800 } : { width: 1280, height: 900 };
let gagal = 0; const cek = (n, ok, cat = '') => { if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', n, ok ? '' : '- ' + cat); };
const MASTER = 'codcodan1@gmail.com';
const data = () => dipisah(JSON.parse(JSON.stringify({ ...awal, pengguna: { s1: { email: 'lama@isl.test', nama: 'Budi Lama', peran: 'sales', status: 'aktif', kodeSales: 'BUD' }, 'u-budi': { email: 'budi@isl.test', nama: 'Budi Darmawan', peranDiminta: 'sales', peran: null, status: 'menunggu', telepon: '6281234567890' } }, sales_publik: { s1: { uid: 's1', nama: 'Budi Lama', kode: 'BUD' } }, sistem: { modal: { siap: true } } })));
// data contoh menyimpan modal di dokumen tarif; pemisahan modal dianggap sudah dijalankan (syarat Setujui)
const dipisah = a => { Object.values(a.master_tarif).forEach(t => { delete t.modal; t.hargaMin = t.hargaMin ?? 1; }); return a; };

(async () => {
  const b = await chromium.launch(); const galat = [];
  const buka = async (email, url, aw, tamu) => { const c = await b.newContext({ viewport: LAYAR }); const p = await c.newPage(); p.on('pageerror', e => galat.push(url + ' ' + e.message)); await pasang(p, PUBLIK, { email, awal: aw || data() }); if (tamu) await p.addInitScript(() => { window.__USER = null; }); await p.goto('http://isl.test/' + url, { waitUntil: 'load' }); return p; };

  // 1. Form daftar: hanya sales, WhatsApp wajib
  let p = await buka('x@isl.test', 'index.html', null, true);
  if (LAYAR.width > 760) { await p.click('#portal-masuk'); await p.waitForTimeout(1500); }
  await p.evaluate(() => document.getElementById('tog-daftar').click());
  cek('form daftar tanpa pilihan status', await p.$('#df-peran') === null);
  cek('form daftar punya kolom WhatsApp', await p.$('#df-wa') !== null);
  cek('tidak ada kata CS/Admin di form daftar', !/\bCS\b|\bAdmin\b/.test(await p.evaluate(() => document.getElementById('daftar-form').innerText)));
  await p.fill('#df-nama', 'Budi Darmawan'); await p.fill('#df-email', 'budi@isl.test'); await p.fill('#df-pass', 'rahasia1'); await p.fill('#df-wa', '123');
  await p.click('#df-submit'); await p.waitForTimeout(300);
  cek('WhatsApp tidak valid ditolak', /WhatsApp/.test(await p.textContent('#login-error')));
  await p.fill('#df-wa', '0812-3456-7890'); await p.click('#df-submit'); await p.waitForTimeout(800);
  cek('pop-up pendaftaran terkirim', await p.$('.ip-lapis') !== null);
  cek('nomor tersimpan normal (62…)', await p.evaluate(() => sessionStorage.getItem('islhub-telepon-daftar')) === '6281234567890');
  await p.context().close();

  // 2. Profil baru memuat telepon dan peran diminta sales
  p = await buka('budi@isl.test', 'app.html', { ...data(), pengguna: {} }); await p.waitForTimeout(1500);
  const prof = await p.evaluate(async () => { sessionStorage.setItem('islhub-telepon-daftar', '6281234567890'); const m = await import('/js/akses.js'); await m.muatProfil({ uid: 'u-baru', email: 'baru@isl.test', displayName: 'Baru' }); return window.__FS.pengguna['u-baru']; });
  cek('profil pendaftar: sales + telepon + menunggu', prof && prof.peranDiminta === 'sales' && prof.telepon === '6281234567890' && prof.status === 'menunggu', JSON.stringify(prof));
  await p.context().close();

  // 3. Master: kartu pendaftar dengan kode otomatis, setujui, kabari WA
  p = await buka(MASTER, 'app.html'); await p.waitForTimeout(2000);
  await p.evaluate(async () => { const m = await import('/js/pendaftar-aksi.js'); m.bukaPendaftarAksi(); }); await p.waitForTimeout(800);
  const kode = await p.inputValue('.ip-item [data-f=kode]').catch(() => null);
  cek('kode otomatis terisi (BUD dipakai → BUDI)', kode === 'BUDI', String(kode));
  cek('peran terpilih Sales', await p.inputValue('.ip-item [data-f=peran]') === 'sales');
  cek('kartu menampilkan nomor WhatsApp', /6281234567890/.test(await p.textContent('.ip-item .ip-mail')));
  await p.click('.ip-item [data-a=setujui]'); await p.waitForTimeout(1500);
  const teksKartu = await p.textContent('.ip-isi');
  if (/Belum bisa disetujui/.test(teksKartu)) cek('setujui (modal belum dipisah di data uji)', false, 'terkunci modal');
  else {
    const u = await p.evaluate(() => window.__FS.pengguna['u-budi']);
    cek('akun aktif sebagai sales dengan kode BUDI', u.status === 'aktif' && u.peran === 'sales' && u.kodeSales === 'BUDI', JSON.stringify(u));
    cek('masuk daftar sales_publik', !!Object.values(await p.evaluate(() => window.__FS.sales_publik)).find(x => x.kode === 'BUDI'));
    const href = await p.getAttribute('.ip-btn--wa', 'href');
    cek('tombol Kabari via WhatsApp ke nomor sales', /wa\.me\/6281234567890\?text=/.test(href) && /BUDI/.test(decodeURIComponent(href)), String(href));
  }
  await p.context().close();

  // 4. Pengaturan > Akun: kode otomatis di tabel dan akun manual
  p = await buka(MASTER, 'pengaturan.html'); await p.waitForTimeout(3000);
  // desktop: pop-up; HP: hanya lonceng (aturan notifikasi.js)
  if (LAYAR.width > 760) cek('pop-up pendaftar baru muncul untuk master', await p.$('.ip-lapis[aria-label^="Sales baru"]') !== null);
  else cek('lonceng menandai pendaftar baru (HP)', Number(await p.textContent('#nf-lencana').catch(() => 0)) >= 1);
  await p.evaluate(() => document.querySelectorAll('.ip-lapis').forEach(x => x.remove()));
  cek('tabel menunggu: kode terisi otomatis', await p.evaluate(() => { const i = document.querySelector('tr[data-uid="u-budi"] [data-akun=kode]'); return i && i.value === 'BUDI'; }));
  await p.evaluate(() => document.querySelectorAll('details.st-laci').forEach(d => d.open = true));
  await p.fill('#ta-nama', 'Siti Aminah');
  cek('form manual: kode ikut nama (SIT)', await p.inputValue('#ta-kode') === 'SIT');
  await p.fill('#ta-email', 'siti@isl.test'); await p.fill('#ta-wa', '081200000001');
  await p.click('[data-st=akun-tambah]'); await p.waitForTimeout(600);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.mr-konfirm button')].find(x => /Buat akun/.test(x.textContent)); if (b) b.click(); }); await p.waitForTimeout(1500);
  const sandi = await p.inputValue('#db-sandi').catch(() => null);
  cek('sandi sementara tampil (10 karakter)', !!sandi && sandi.length === 10, String(sandi));
  const wa = await p.getAttribute('.mr-konfirm a', 'href').catch(() => null);
  cek('tombol WhatsApp berisi email dan sandi', !!wa && /62812000000/.test(wa) && decodeURIComponent(wa).includes(sandi) && /siti%40isl\.test|siti@isl\.test/.test(decodeURIComponent(wa)), String(wa));
  const pg = await p.evaluate(() => Object.values(window.__FS.pengguna).find(x => x.email === 'siti@isl.test'));
  cek('profil manual: aktif, sales, kode SIT, telepon', pg && pg.status === 'aktif' && pg.peran === 'sales' && pg.kodeSales === 'SIT' && pg.telepon === '6281200000001', JSON.stringify(pg));
  await p.context().close();

  cek('tanpa galat halaman', galat.length === 0, galat.slice(0, 3).join(' | '));
  await b.close(); process.exit(gagal ? 1 : 0);
})();
