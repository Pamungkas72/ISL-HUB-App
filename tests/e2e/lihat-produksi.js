// Tes hanya-baca di situs produksi, memakai akun peran "lihat".
// Tidak membuat, mengubah, atau menghapus data. Kredensial dari secret GitHub, tidak pernah dicetak.
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
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const galat = [];
  const langkah = [];
  p.on('pageerror', e => galat.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') galat.push('CONSOLE ' + m.text()); });

  const cek = (nama, ok, catatan = '') => {
    langkah.push({ nama, ok, catatan });
    console.log(`${ok ? 'LULUS' : 'GAGAL'} ${nama}${catatan ? ' - ' + catatan : ''}`);
  };

  try {
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.click('#portal-masuk');
    await p.fill('#email', email);
    await p.fill('#password', pass);
    await p.click('#btn-submit');
    await p.waitForURL(/app\.html/, { timeout: 45000 });
    cek('login', true);

    await p.goto(BASE + '/app.html#customer', { waitUntil: 'load' });
    await p.waitForTimeout(4000);
    const tampil = await p.evaluate(() => document.body.innerText.includes('Customer'));
    cek('halaman Customer tampil', tampil);
    await p.screenshot({ path: out + '/customer.png' });
  } catch (e) {
    cek('alur tes', false, String(e.message).split('\n')[0]);
    await p.screenshot({ path: out + '/galat.png' }).catch(() => {});
  }

  cek('tanpa error di halaman', galat.length === 0, galat.slice(0, 3).join(' | '));
  fs.writeFileSync(out + '/ringkasan.json', JSON.stringify({ langkah, galat }, null, 2));
  await b.close();
  process.exit(langkah.every(x => x.ok) ? 0 : 1);
})();
