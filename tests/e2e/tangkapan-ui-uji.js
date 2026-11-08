// Mengambil screenshot UI setelah login dengan akun UJI, hanya membaca data (tidak menulis apa pun).
// Hasil: daftar quotation dan Pengaturan dokumen, plus status tombol unduh riwayat dan tombol Kembali.
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

(async () => {
  const b = await chromium.launch();
  const info = {};
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.click('#portal-masuk');
    await p.fill('#email', email);
    await p.fill('#password', pass);
    await p.click('#btn-submit');
    await p.waitForURL(/app\.html/, { timeout: 45000 });

    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    await p.waitForSelector('[data-qt="pengaturan"]', { timeout: 60000 });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: out + '/quotation-daftar.png', fullPage: true });
    info.tombolUnduhRiwayat = await p.$$eval('[data-qt="rw-unduh"]', els => els.length);
    // Diagnosis unduhan: ambil file PDF riwayat dari halaman yang sama dengan pengguna, lalu catat hasil atau pesan galatnya.
    info.unduhDariHalaman = await p.evaluate(async () => {
      const a = document.querySelector('.qt-ikonmata');
      if (!a) return 'tidak ada baris PDF';
      const host = new URL(a.href).host;
      let biasa, tanpaCors;
      try { const r = await fetch(a.href); const b = await r.blob(); biasa = 'status ' + r.status + ', ukuran ' + b.size + ' byte'; }
      catch (e) { biasa = 'galat: ' + e.message; }
      try { const r = await fetch(a.href, { mode: 'no-cors' }); tanpaCors = 'no-cors tipe ' + r.type; }
      catch (e) { tanpaCors = 'no-cors galat: ' + e.message; }
      return { host, biasa, tanpaCors };
    });

    await p.click('[data-qt="pengaturan"]');
    await p.waitForSelector('[data-qt="pg-kembali"]', { timeout: 30000 });
    await p.waitForTimeout(1000);
    await p.screenshot({ path: out + '/pengaturan-dokumen.png', fullPage: true });
    info.tombolKembaliAtas = await p.evaluate(() => {
      const t = document.querySelector('.cu-judul [data-qt="pg-kembali"]');
      return !!t;
    });
    fs.writeFileSync(out + '/ringkasan-ui.json', JSON.stringify(info, null, 2));
    console.log(JSON.stringify(info));
  } catch (e) {
    console.error('GAGAL', e.message);
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
