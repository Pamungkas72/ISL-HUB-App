// Pengaturan > Notifikasi (Firebase tiruan), HP dan desktop: kartu/daftar kejadian, editor + pratinjau, simpan, kirim uji, riwayat; sales tidak melihat bagian ini.
// Jalankan: NODE_PATH=<node_modules berisi playwright> node tests/asap/uji-notifikasi-pengaturan.js
const { chromium } = require('playwright');
const path = require('path');
const { pasang } = require('../audit/firebase-tiruan.js');
const { awal } = require('../audit/data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
let gagal = 0; const cek = (n, ok, cat = '') => { if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', n, ok ? '' : '- ' + cat); };
const dipisah = (a) => { Object.values(a.master_tarif).forEach((t) => { delete t.modal; t.hargaMin = t.hargaMin ?? 1; }); return a; };
const DATA = (pengguna) => dipisah(JSON.parse(JSON.stringify({ ...awal, pengguna, sistem: { modal: { siap: true } },
  dj_kelompok: { k1: { nama: 'Tracking', profil: 'tracking', kepala: [] }, k2: { nama: 'Marketing BD', profil: 'marketing', kepala: [] } },
  dj_email: { e1: { kelompokId: 'k1', customer: 'PT Maju', subjek: 'Pengiriman selesai · DO-1', ke: 'a@maju.id', status: 'gagal', dibuat: 3, kirimPada: 3 }, e2: { kelompokId: 'k1', customer: 'PT Sinar', subjek: 'Order diterima · DO-2', ke: 'b@sinar.id', status: 'terkirim', dibuat: 2, kirimPada: 2 }, e3: { kelompokId: 'k1', customer: 'PT Lima', subjek: 'Order diterima · DO-3', ke: '', status: 'tanpa-email', dibuat: 1, kirimPada: 1 } } })));
const buka = async (b, vp, email, doc, mobile) => {
  const c = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile }), p = await c.newPage(), galat = []; p.on('pageerror', (e) => galat.push(e.message.slice(0, 120)));
  await pasang(p, PUBLIK, { email, awal: DATA(doc) }); await p.addInitScript(() => { globalThis.__FN = { kirimUjiNotif: { ke: 'master@isl.test' }, laporanUji: { header: ['No. DO', 'Rute'], rows: [['DO-1', 'A → B'], ['DO-2', 'C → D']], total: 2, dari: '2026-11-16', sampai: '2026-11-22', ke: 'master@isl.test' } }; });
  await p.goto('http://isl.test/app.html#pengaturan', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('.ip-lapis').forEach((x) => x.remove())); return { p, galat };
};
(async () => {
  const b = await chromium.launch(), ML = 'codcodan1@gmail.com';
  for (const [nama, vp, mobile] of [['HP', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 800 }, false]]) {
    const { p, galat } = await buka(b, vp, ML, {}, mobile);
    cek(`${nama}: bagian Notifikasi ada di menu Pengaturan`, await p.locator('[data-st="bag"][data-v="notifikasi"]').count() === 1);
    await p.click('[data-st="bag"][data-v="notifikasi"]'); await p.waitForSelector('#nt-root .ak-kepala'); await p.waitForTimeout(600);
    cek(`${nama}: kelompok Tracking terpilih, dua chip kelompok`, await p.locator('.nt-kel .mr-chip').count() === 2 && await p.locator('.nt-kel .mr-chip.is-aktif').innerText() === 'Tracking');
    if (mobile) {
      cek('HP: lima kartu (2 kejadian + Penerima + Laporan + Riwayat), belum ada yang terbuka', await p.locator('.nt-kartu').count() === 5 && await p.locator('.nt-editor').count() === 0);
      await p.click('.nt-kh[data-v="terkirim"]'); await p.waitForSelector('.nt-editor');
    } else {
      cek('desktop: daftar kiri 5 item dan editor kejadian pertama terbuka', await p.locator('.nt-list .nt-item').count() === 5 && await p.locator('.nt-editor[data-t="diterima"]').count() === 1);
      await p.click('.nt-item[data-v="terkirim"]'); await p.waitForSelector('.nt-editor[data-t="terkirim"]');
    }
    cek(`${nama}: subjek bawaan dan pratinjau memakai data contoh`, (await p.inputValue('#nt-subjek')).startsWith('Pengiriman selesai') && /DO-2026-0001/.test(await p.locator('#nt-pv').innerText()) && /PT Contoh Jaya/.test(await p.locator('#nt-pv').innerText()));
    await p.fill('#nt-subjek', 'Selesai! {referensi}'); cek(`${nama}: pratinjau mengikuti ketikan`, /Selesai! DO-2026-0001/.test(await p.locator('#nt-pv').innerText()));
    await p.click('[data-nt="var"][data-v="rute"]'); cek(`${nama}: variabel disisipkan ke isi`, /\{rute\}/.test(await p.inputValue('#nt-isi')));
    await p.click('.nt-seg [data-nt="bhs"][data-v="en"]'); cek(`${nama}: tab English memuat template English`, /Shipment completed/.test(await p.inputValue('#nt-subjek')));
    await p.click('.nt-seg [data-nt="bhs"][data-v="id"]');
    await p.click('[data-nt="mode"][data-v="tunda"]'); await p.fill('#nt-menit', '0'); await p.click('[data-nt="simpan"]'); await p.waitForTimeout(300);
    cek(`${nama}: menit tunda 0 ditolak`, /1 sampai 1440/.test(await p.locator('.toast, .mr-toast, [role="alert"], [role="status"]').allInnerTexts().then((x) => x.join(' '))));
    await p.fill('#nt-menit', '15'); await p.click('[data-nt="simpan"]'); await p.waitForTimeout(500);
    cek(`${nama}: tersimpan, daftar menampilkan "Tunda 15 menit"`, /Tunda 15 menit/.test(await p.locator('.nt-kh, .nt-item').allInnerTexts().then((x) => x.join(' '))));
    await p.click('[data-nt="uji"]'); await p.waitForTimeout(400);
    cek(`${nama}: kirim uji memberi tahu alamat tujuan`, /master@isl\.test/.test(await p.evaluate(() => document.body.innerText)));
    await p.click('[data-nt="aktif"][data-t="terkirim"]'); await p.waitForTimeout(400);
    cek(`${nama}: sakelar mematikan kejadian`, /Mati/.test(await p.locator('.nt-kh, .nt-item').allInnerTexts().then((x) => x.join(' '))));
    await p.click(mobile ? '.nt-kh[data-v="riwayat"]' : '.nt-item[data-v="riwayat"]'); await p.waitForSelector('.nt-rw');
    cek(`${nama}: riwayat 3 baris, kirim ulang untuk yang gagal`, await p.locator('.nt-rw').count() === 3 && await p.locator('[data-nt="ulang"]').count() === 1);
    await p.click('[data-nt="ulang"]'); await p.waitForTimeout(400); cek(`${nama}: kirim ulang jadi Menunggu dan bisa dibatalkan`, await p.locator('[data-nt="batal"]').count() === 1);
    const teks = () => p.evaluate(() => document.body.innerText), item = (id) => (mobile ? `.nt-kh[data-v="${id}"]` : `.nt-item[data-v="${id}"]`);
    // Penerima per customer
    await p.click(item('penerima')); await p.waitForSelector('#nt-cari');
    await p.fill('#nt-cari', 'PT Tidak Ada'); await p.click('[data-nt="p-cust-tambah"]'); await p.waitForTimeout(200);
    cek(`${nama}: customer tak dikenal ditolak`, /Pilih customer dari daftar/.test(await teks()) && await p.locator('.nt-pc').count() === 0);
    await p.fill('#nt-cari', 'PT Sinar Makmur Abadi'); await p.click('[data-nt="p-cust-tambah"]'); await p.waitForSelector('.nt-pc');
    await p.fill('.nt-emin', 'bukan-email'); await p.click('[data-nt="p-email-tambah"]'); await p.waitForTimeout(200);
    cek(`${nama}: email tidak valid ditolak`, /tidak valid/.test(await teks()) && await p.locator('.nt-emc').count() === 0);
    await p.fill('.nt-emin', 'Staf@Sinar.test'); await p.click('[data-nt="p-email-tambah"]'); await p.waitForSelector('.nt-emc');
    await p.fill('.nt-emin', 'staf@sinar.test'); await p.click('[data-nt="p-email-tambah"]'); await p.waitForTimeout(200);
    cek(`${nama}: email disimpan huruf kecil, duplikat ditolak`, await p.locator('.nt-emc').count() === 1 && /staf@sinar\.test/.test(await p.locator('.nt-emc').innerText()) && /sudah ada/.test(await teks()));
    // Laporan berkala
    await p.click(item('laporan')); await p.waitForSelector('[data-nt="l-baru"]'); await p.click('[data-nt="l-baru"]'); await p.waitForSelector('#nl-nama');
    cek(`${nama}: kolom keuangan terkunci untuk Tracking (3 kolom, tidak bisa dicentang)`, await p.locator('[data-nt="l-kolom"][disabled]').count() === 3 && /tidak pernah dikirim ke customer/.test(await teks()));
    cek(`${nama}: PDF tampil sebagai menyusul (tidak bisa dipilih)`, await p.locator('.mr-chip.is-mati').count() === 1);
    await p.click('[data-nt="l-simpan"]'); await p.waitForTimeout(200); cek(`${nama}: laporan tanpa nama ditolak`, /Beri nama laporan/.test(await teks()));
    await p.fill('#nl-nama', 'Rekap mingguan'); await p.click('[data-nt="l-set"][data-v="periode:bulanan"]'); await p.waitForSelector('#nl-tgl'); await p.fill('#nl-tgl', '5');
    await p.click('[data-nt="l-set"][data-v="periode:mingguan"]'); await p.click('[data-nt="l-set"][data-v="hari:5"]');
    cek(`${nama}: nama tetap terisi setelah ganti jadwal`, await p.inputValue('#nl-nama') === 'Rekap mingguan');
    await p.fill('#nl-cust', 'PT Sinar Makmur Abadi'); await p.click('[data-nt="l-pv"]'); await p.waitForSelector('.nt-tbl');
    cek(`${nama}: pratinjau menampilkan tabel dan jumlah`, await p.locator('.nt-tbl tbody tr').count() === 2 && /2 pengiriman/.test(await teks()));
    await p.click('[data-nt="l-uji"]'); await p.waitForTimeout(300); cek(`${nama}: kirim uji laporan memberi tahu alamat`, /Laporan uji dikirim ke master@isl\.test/.test(await teks()));
    await p.click('[data-nt="l-simpan"]'); await p.waitForTimeout(400);
    cek(`${nama}: laporan tersimpan dan tampil di daftar dengan jadwalnya`, /Rekap mingguan/.test(await teks()) && /Mingguan, Jumat 08:00 · XLSX/.test(await teks()));
    await p.click(item('penerima')); await p.waitForSelector('.nt-lang input'); await p.click('.nt-lang input'); await p.waitForTimeout(400);
    cek(`${nama}: berlangganan laporan tersimpan`, await p.locator('.nt-lang input:checked').count() === 1);
    await p.click(item('laporan')); await p.waitForSelector('[data-nt="l-buka"]'); await p.click('[data-nt="l-buka"]'); await p.waitForSelector('#nl-nama'); await p.click('[data-nt="l-hapus"]'); await p.waitForSelector('.mr-konfirm'); await p.click('.mr-konfirm .mr-btn--bahaya, .mr-konfirm .mr-btn--utama'); await p.waitForTimeout(500);
    cek(`${nama}: hapus laporan menghapus juga langganannya`, await p.locator('[data-nt="l-buka"]').count() === 0);
    await p.click(item('penerima')); await p.waitForSelector('.nt-pc'); cek(`${nama}: langganan ikut hilang`, await p.locator('.nt-lang').count() === 0);
    await p.click('.nt-kel .mr-chip:not(.is-aktif)'); await p.waitForTimeout(300);
    cek(`${nama}: kelompok non-Tracking menampilkan keterangan kosong`, await p.locator('.nt-kosong').count() === 1);
    cek(`${nama}: tanpa overflow horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    cek(`${nama}: tanpa galat halaman`, galat.length === 0, galat.join(' | '));
    await p.context().close();
  }
  const s = await buka(b, { width: 390, height: 844 }, 'sari@isl.test', { 'u-sari': { email: 'sari@isl.test', nama: 'Sari', peran: 'sales', status: 'aktif', kodeSales: 'SLS-01' } }, true);
  cek('sales: bagian Notifikasi tidak ada', await s.p.locator('[data-st="bag"][data-v="notifikasi"]').count() === 0);
  await b.close(); process.exit(gagal ? 1 : 0);
})();
