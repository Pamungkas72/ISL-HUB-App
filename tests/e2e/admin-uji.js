// Tes akun ADMIN di situs produksi. Menulis data sungguhan, semuanya diberi awalan "UJI" supaya bisa dihapus manual oleh master.
// Yang dicek: admin bisa menyimpan customer uji dan layanan tambahan uji, data bertahan setelah dimuat ulang,
// dan admin ditolak server saat menghapus (hapus tetap master).
// Kredensial dari secret GitHub UJI_EMAIL dan UJI_PASSWORD, tidak pernah dicetak.
const { chromium } = require('playwright');
const fs = require('fs');

const email = process.env.UJI_EMAIL;
const pass = process.env.UJI_PASSWORD;
const BASE = 'https://system-marketing-bd-isl-2026.web.app';
const out = process.env.HASIL_DIR || 'hasil';

if (!email || !pass) {
  console.error('Secret UJI_EMAIL dan UJI_PASSWORD belum diisi di GitHub.');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const galat = [];
  const langkah = [];
  p.on('pageerror', e => galat.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') galat.push('CONSOLE ' + m.text()); });

  const cek = (nama, ok, catatan = '') => {
    langkah.push({ nama, ok, catatan });
    console.log(`${ok ? 'LULUS' : 'GAGAL'} ${nama}${catatan ? ' - ' + catatan : ''}`);
  };

  let idCust = '', idLayanan = '';
  try {
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.click('#portal-masuk');
    await p.fill('#email', email);
    await p.fill('#password', pass);
    await p.click('#btn-submit');
    await p.waitForURL(/app\.html/, { timeout: 45000 });
    await p.goto(BASE + '/app.html#customer', { waitUntil: 'load' });
    await p.waitForTimeout(5000);

    const peranAdmin = await p.evaluate(() => !!(window.__ISL && window.__ISL.admin && !window.__ISL.master));
    cek('login sebagai admin', peranAdmin);
    // Modul aplikasi dimuat setelah login; tunggu sampai siap sebelum membacanya.
    // Tidak memakai waitForFunction: Content Security Policy aplikasi memblokir evaluasi string di halaman.
    let siap = false;
    for (let i = 0; i < 60 && !siap; i++) {
      siap = await p.evaluate(() => !!(window.__islCU && window.__islCU.S && window.ISLFL));
      if (!siap) await p.waitForTimeout(1000);
    }
    if (!siap) throw new Error('Modul customer atau layanan tidak siap setelah 60 detik');

    // 1. Customer uji lewat jalur simpan yang sama dengan layar.
    idCust = 'uji-c-' + stamp;
    const tulisCust = await p.evaluate(async (id) => {
      const c = window.__islCU, S = c.S;
      try {
        await c.tulisDB(() => { S.customers.push({ id, nama: 'UJI customer admin ' + id, alias: '', kategori: 'reguler', status: 'prospek', kontak: [], npwp: '', nib: '', alamat: '', alamatTagih: '', ttd: { nama: '', jabatan: '' }, termin: 30, catatanTagih: '', catatan: 'DATA UJI, hapus manual' }); }, () => S.customers.some(x => x.id === id));
        return '';
      } catch (e) { return String(e.message || e); }
    }, idCust);
    cek('admin bisa simpan customer uji', tulisCust === '', tulisCust);

    // 2. Layanan tambahan uji.
    idLayanan = 'uji-l-' + stamp;
    const tulisLayanan = await p.evaluate(async (id) => {
      const c = window.__islCU, FL = window.ISLFL;
      try {
        await c.tulisDB(() => { FL.katalog.push({ id, lini: 'uji', grup: 'tambahan', n: 'UJI layanan admin', satuan: '', modal: null, jual: null, dibuat: Date.now(), oleh: 'uji' }); }, () => FL.katalog.some(x => x.id === id));
        return '';
      } catch (e) { return String(e.message || e); }
    }, idLayanan);
    cek('admin bisa simpan layanan tambahan uji', tulisLayanan === '', tulisLayanan);

    // 3. Muat ulang: data harus tetap ada di server.
    await p.goto(BASE + '/app.html#customer', { waitUntil: 'load' });
    await p.waitForTimeout(6000);
    const bertahan = await p.evaluate(({ a, b }) => {
      const c = window.__islCU, FL = window.ISLFL;
      return { cust: c.S.customers.some(x => x.id === a), layanan: FL.katalog.some(x => x.id === b) };
    }, { a: idCust, b: idLayanan });
    cek('customer uji bertahan setelah muat ulang', bertahan.cust);
    cek('layanan uji bertahan setelah muat ulang', bertahan.layanan);

    // 4. Hapus harus ditolak server untuk admin.
    const tolakHapus = await p.evaluate(async (id) => {
      const c = window.__islCU, FL = window.ISLFL;
      try {
        await c.tulisDB(() => { FL.katalog = FL.katalog.filter(x => x.id !== id); }, () => !FL.katalog.some(x => x.id === id));
        return 'BERHASIL (seharusnya ditolak)';
      } catch (e) { return ''; }
    }, idLayanan);
    cek('admin ditolak saat hapus layanan tambahan', tolakHapus === '', tolakHapus);

    // 5. Pengaturan dokumen: field nomor harus bisa diubah (tidak disabled) untuk admin.
    await p.evaluate(() => { if (window.__qt && window.__qt.bukaPengaturan) window.__qt.bukaPengaturan(); });
    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    // Tombol Pengaturan dokumen ada di bilah halaman daftar quotation (data-qt="pengaturan").
    await p.waitForSelector('[data-qt="pengaturan"]', { timeout: 60000 });
    await p.click('[data-qt="pengaturan"]');
    // Halaman Pengaturan menampilkan daftar bagian dulu; isi "Penomoran quotation" baru dirender setelah dibuka.
    await p.waitForSelector('[data-qt="pg-buka"][data-seksi="penomoranquotation"]', { timeout: 30000 });
    await p.click('[data-qt="pg-buka"][data-seksi="penomoranquotation"]');
    await p.waitForSelector('[data-pg="nomor.digit"]', { timeout: 30000 });
    const nomorBisa = await p.evaluate(() => {
      const el = document.querySelector('[data-pg="nomor.digit"]');
      return el ? !el.disabled : null;
    });
    cek('field nomor di Pengaturan dokumen bisa diubah admin', nomorBisa === true, nomorBisa === null ? 'field nomor tidak ditemukan' : '');
    await p.screenshot({ path: out + '/quotation.png' }).catch(() => {});

    // 6. Quotation manual (Word): panelnya harus terbuka untuk admin. Hanya dibuka, tidak disimpan (tidak memakai nomor).
    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    await p.waitForSelector('[data-qt="menu-tambah"]', { timeout: 60000 });
    await p.click('[data-qt="menu-tambah"]');
    await p.click('[data-qt="manual-word"]');
    await p.waitForSelector('#wm-cust', { timeout: 30000 });
    cek('admin bisa membuka panel quotation manual (Word)', true);

    // 7. Terbitkan quotation manual uji. Memakai satu nomor dan membuat satu customer uji; hapus manual setelahnya.
    const besok = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    // Nama dibuat tidak mirip customer uji sebelumnya, supaya tidak memunculkan dialog "customer yang sama?".
    await p.fill('#wm-cust', 'Uji Pembeli ' + stamp);
    await p.fill('#wm-judul', 'UJI perihal manual ' + stamp);
    await p.fill('#wm-berlaku', besok);
    await p.click('[data-wm="terbit"]');
    // Kalau nama customer mirip dengan yang sudah ada, muncul dialog; pilih buat customer baru.
    await p.click('button:has-text("Tetap buat customer baru")', { timeout: 5000 }).catch(() => {});
    // Muncul dialog konfirmasi sebelum nomor dipakai; tombol kedua yang menerbitkan.
    await p.click('button:has-text("Beri nomor dan unduh Word")', { timeout: 30000 });
    await p.waitForSelector('text=terbit dan terverifikasi', { timeout: 60000 });
    cek('admin bisa menerbitkan quotation manual uji', true);

    // 8. Format lini uji lewat pembuat format (5 langkah). Membuat satu lini uji di Master Rate; hapus manual setelahnya.
    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    await p.waitForTimeout(3000);
    await p.evaluate(() => window.ISLPembuat && window.ISLPembuat.buka());
    await p.waitForSelector('[data-pf="nama"]', { timeout: 30000 });
    await p.fill('[data-pf="nama"]', 'UJI format ' + stamp);
    await p.fill('[data-pf="kode"]', 'uji_' + stamp);
    for (let i = 0; i < 4; i++) {
      await p.click('[data-pf-a="maju"]');
      await p.waitForTimeout(500);
    }
    await p.click('[data-pf-a="simpan"]');
    // Setelah tersimpan dan tervalidasi ke server, panel ditutup. Cek panel tertutup dan format ada di data aplikasi.
    await p.waitForSelector('[data-pf="nama"]', { state: 'detached', timeout: 60000 });
    const formatAda = await p.evaluate(k => !!(window.ISLFL && window.ISLFL.formatBuatan.some(x => x.id === k)), 'uji_' + stamp);
    cek('admin bisa menyimpan format lini uji', formatAda, 'kode uji_' + stamp);

    // 9. Unggah PDF dengan nomor ber-penanda M di tengah. Nomor yang diunggah = nomor berikutnya,
    // sehingga hanya satu nomor yang terlewati di penomoran sungguhan. Data uji diberi awalan UJI dan dihapus manual.
    const bacaNomorBerikut = async () => {
      await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
      await p.waitForSelector('[data-qt="pengaturan"]', { timeout: 60000 });
      await p.click('[data-qt="pengaturan"]');
      await p.waitForSelector('[data-qt="pg-buka"][data-seksi="penomoranquotation"]', { timeout: 30000 });
      await p.click('[data-qt="pg-buka"][data-seksi="penomoranquotation"]');
      await p.waitForSelector('[data-pg="nomor.digit"]', { timeout: 30000 });
      const teks = await p.evaluate(() => document.body.innerText);
      const m = /Nomor berikutnya:\s*(\d{3})/.exec(teks);
      return m ? parseInt(m[1], 10) : null;
    };
    const n0 = await bacaNomorBerikut();
    cek('nomor berikutnya terbaca sebelum unggah PDF', n0 !== null, n0 === null ? '' : 'berikutnya ' + n0);
    if (n0 !== null) {
      // Bentuk dengan "-" setelah urutan, seperti 021-QL-ISL-M/X/2026 yang ada di daftar.
      const nomorPdf = String(n0).padStart(3, '0') + '-QL-ISL-M/X/2026';
      const berkas = out + '/uji.pdf';
      fs.writeFileSync(berkas, '%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
      await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
      await p.waitForSelector('[data-qt="rw-unggah"]', { timeout: 60000 });
      await p.click('[data-qt="rw-unggah"]');
      await p.setInputFiles('#rw-file', berkas);
      await p.waitForSelector('[data-rw="nomor"]', { timeout: 30000 });
      await p.fill('[data-rw="nomor"]', nomorPdf);
      await p.fill('[data-rw="customerNama"]', 'Uji Pembeli ' + stamp);
      await p.click('[data-qt="rw-simpan"]');
      // Kalau nomor terdeteksi bentrok, sistem minta konfirmasi; lanjutkan saja (nomor ini belum terpakai).
      await p.click('button:has-text("Tetap simpan")', { timeout: 5000 }).catch(() => {});
      await p.waitForSelector('text=masuk daftar dan terverifikasi', { timeout: 60000 });
      cek('admin bisa mengunggah PDF dengan penanda M', true, nomorPdf);
      const n1 = await bacaNomorBerikut();
      cek('nomor berikutnya naik di atas PDF yang diunggah', n1 === n0 + 1, 'sebelum ' + n0 + ', sesudah ' + n1);
    }

    // 11. Pratinjau penawaran baru (tanpa disimpan) untuk contoh desain. Tidak membuat nomor atau data.
    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    await p.waitForSelector('[data-qt="baru"]', { timeout: 60000 });
    await p.click('[data-qt="baru"]');
    // Muncul pemilih format dulu; pilih "Format bebas layanan" (tidak membuat data).
    await p.click('text=Format bebas layanan', { timeout: 30000 });
    await p.waitForSelector('[data-qt="pratinjau"]', { timeout: 60000 });
    await p.click('[data-qt="pratinjau"]');
    await p.waitForSelector('#qt-dokinfo', { timeout: 30000 });
    for (let i = 0; i < 60; i++) {
      const siap = await p.evaluate(() => { const el = document.querySelector('#qt-dokinfo'); return !!el && !/Menyusun/.test(el.textContent); });
      if (siap) break;
      await p.waitForTimeout(1000);
    }
    await p.screenshot({ path: out + '/pratinjau-penawaran.png', fullPage: true });
    cek('pratinjau penawaran baru dibuat (tanpa disimpan)', true);
  } catch (e) {
    cek('alur tes', false, String(e.message).split('\n')[0]);
    await p.screenshot({ path: out + '/galat.png' }).catch(() => {});
  }

  cek('tanpa error di halaman', galat.length === 0, galat.slice(0, 3).join(' | '));
  fs.writeFileSync(out + '/ringkasan.json', JSON.stringify({ idCust, idLayanan, langkah, galat }, null, 2));
  await b.close();
  process.exit(langkah.every(x => x.ok) ? 0 : 1);
})();
