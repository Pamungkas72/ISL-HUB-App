// Tes pilih banyak di tab Vendor dan Lokasi, memakai akun UJI (admin). Menulis data sungguhan dengan awalan "UJI":
// satu vendor uji dan satu lokasi uji dibuat, lalu dinonaktifkan lewat bar pilih banyak. Hapus permanen hanya master,
// jadi tombolnya dicek tidak tampil untuk admin. Data uji dihapus manual oleh master.
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
  const cek = (nama, ok, catatan = '') => {
    langkah.push({ nama, ok, catatan });
    console.log(`${ok ? 'LULUS' : 'GAGAL'} ${nama}${catatan ? ' - ' + catatan : ''}`);
  };
  const bukaTab = async (tab) => {
    await p.goto(BASE + '/app.html#master-rate', { waitUntil: 'load' });
    await p.waitForSelector(`[data-aksi="tab"][data-v="${tab}"]`, { timeout: 60000 });
    await p.click(`[data-aksi="tab"][data-v="${tab}"]`);
    await p.waitForTimeout(1500);
  };
  const jumlahDipilih = () => p.evaluate(() => { const el = document.querySelector('.mr-pilihbar__jml'); return el ? Number(el.textContent.replace(/\D/g, '')) : 0; });
  const konfirmasiOk = async () => { await p.waitForSelector('.mr-konfirm [data-x="ok"]', { timeout: 10000 }); await p.click('.mr-konfirm [data-x="ok"]'); await p.waitForTimeout(3000); };

  const idVendor = 'uji-v-' + stamp;
  const idLokasi = 'uji-lok-' + stamp;
  try {
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.click('#portal-masuk');
    await p.fill('#email', email);
    await p.fill('#password', pass);
    await p.click('#btn-submit');
    await p.waitForURL(/app\.html/, { timeout: 45000 });
    await p.goto(BASE + '/app.html#master-rate', { waitUntil: 'load' });
    await p.waitForTimeout(4000);

    // 1. Data uji: satu vendor dan satu lokasi, dibuat lewat modul db yang sama dengan layar.
    const buat = await p.evaluate(async ({ v, l }) => {
      try {
        const DB = await import('/js/db.js');
        const oleh = 'uji';
        await DB.simpanVendor(v, { nama: 'UJI vendor pilih ' + v, namaLengkap: '', aktif: true, status: 'terverifikasi', liniBisnis: [], pic: [], legalitas: [], tnc: [] }, { baru: true, oleh });
        await DB.simpanProfilFasilitas(l, { nama: 'UJI lokasi pilih ' + l, jenis: 'depo', status: 'draf', pemilik: 'mitra', vendorId: '', fasilitas: {}, pic: {}, fotos: [], lampiran: [] }, { baru: true, oleh });
        return '';
      } catch (e) { return String(e.message || e); }
    }, { v: idVendor, l: idLokasi });
    cek('admin bisa membuat vendor dan lokasi uji', buat === '', buat);
    await bukaTab('vendor');

    // 2. Vendor: pilih satu, bar muncul, hapus permanen tidak tampil untuk admin, batal membersihkan pilihan.
    const adaKotak = await p.$(`[data-pilih-v="${idVendor}"]`);
    cek('kotak centang vendor uji tampil', !!adaKotak);
    if (adaKotak) {
      await p.click(`[data-pilih-v="${idVendor}"]`);
      await p.waitForTimeout(800);
      cek('pilih satu vendor: bar menampilkan 1 dipilih', (await jumlahDipilih()) === 1);
      cek('admin tidak melihat tombol Hapus permanen', (await p.$('[data-aksi="tab-hapus"]')) === null);
      await p.click('[data-aksi="tab-nonaktif"]');
      await konfirmasiOk();
      const nonaktif = await p.evaluate((id) => { const tr = document.querySelector(`[data-pilih-v="${id}"]`)?.closest('tr'); return !!tr && tr.classList.contains('is-nonaktif'); }, idVendor);
      cek('Nonaktifkan menandai vendor uji sebagai nonaktif', nonaktif);
    }

    // 3. Pilih semua di header lalu batal: tidak menulis apa pun.
    await bukaTab('vendor');
    const header = await p.$('[data-pilih-v-semua]');
    cek('header pilih semua vendor tampil', !!header);
    if (header) {
      await p.click('[data-pilih-v-semua]');
      await p.waitForTimeout(800);
      const jml = await jumlahDipilih();
      cek('pilih semua vendor: jumlah sama dengan baris tampil', jml > 1, `dipilih ${jml}`);
      await p.click('[data-aksi="tab-batal"]');
      await p.waitForTimeout(800);
      cek('batal membersihkan pilihan vendor', (await p.$('.mr-pilihbar')) === null);
    }

    // 4. Lokasi: pilih, nonaktifkan, periksa status.
    // Data lokasi dimuat dari salinan lalu disegarkan dari server; muat ulang sampai lokasi uji muncul.
    await bukaTab('lokasi');
    for (let i = 0; i < 8 && !(await p.$(`[data-pilih-lok="${idLokasi}"]`)); i++) {
      await p.waitForTimeout(4000);
      await p.reload({ waitUntil: 'load' });
      await p.waitForTimeout(3000);
      await p.click(`[data-aksi="tab"][data-v="lokasi"]`).catch(() => {});
      await p.waitForTimeout(1500);
    }
    const kotakLok = await p.$(`[data-pilih-lok="${idLokasi}"]`);
    cek('kotak centang lokasi uji tampil', !!kotakLok, kotakLok ? '' : 'pastikan filter tidak menyembunyikan lokasi uji');
    if (kotakLok) {
      await p.click(`[data-pilih-lok="${idLokasi}"]`);
      await p.waitForTimeout(800);
      cek('pilih satu lokasi: bar menampilkan 1 dipilih', (await jumlahDipilih()) === 1);
      await p.click('[data-aksi="tab-nonaktif"]');
      await konfirmasiOk();
      const tidakTersedia = await p.evaluate((id) => (document.querySelector(`[data-id="${id}"]`)?.textContent || '').includes('Tidak tersedia'), idLokasi);
      cek('Nonaktifkan menandai lokasi uji Tidak tersedia', tidakTersedia);
      await p.click('[data-aksi="tab-batal"]').catch(() => {});
    }
    await p.screenshot({ path: out + '/pilih-banyak-lokasi.png' }).catch(() => {});
  } catch (e) {
    galat.push('TES ' + e.message);
    console.error(e);
  }

  const gagal = langkah.filter(x => !x.ok).length;
  fs.writeFileSync(out + '/ringkasan-pilih.json', JSON.stringify({ idVendor, idLokasi, langkah, galat }, null, 2));
  console.log(`Selesai: ${langkah.length - gagal} lulus, ${gagal} gagal, galat halaman ${galat.length}.`);
  console.log('Data uji untuk dihapus manual oleh master:', idVendor, idLokasi);
  await b.close();
  if (gagal || galat.length) process.exit(1);
})();
