// Uji impor/ekspor Excel Master Uang Jalan (Firebase tiruan, aplikasi asli). Jalankan: NODE_PATH=<node_modules playwright> node tests/asap/uji-uj-impor.js [hp|desktop]
// Alur: template diunduh, file berisi total saja + rincian + selisih + armada salah + dobel, pratinjau (baru/error/kembar), lepas satu baris, simpan,
// tampilan Impor/nominal langsung, ekspor lalu impor ulang = semua Sama, ubah satu angka = Ubah.
const { chromium } = require('playwright');
const path = require('path');
const { pasang } = require('../audit/firebase-tiruan.js');
const { awal } = require('../audit/data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const LAYAR = process.argv.includes('desktop') ? 'desktop' : 'hp', hp = LAYAR === 'hp';
const gagal = []; const cek = (k, m) => { if (!k) gagal.push(`[${LAYAR}] ${m}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: hp, hasTouch: hp, acceptDownloads: true });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') err.push('CON ' + m.text().slice(0, 200)); });
  await pasang(p, PUBLIK, { awal });
  await p.goto('http://isl.test/app.html#master-rate'); await p.waitForTimeout(2500);
  const w = ms => p.waitForTimeout(ms);
  const klik = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const teks = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const fs = k => p.evaluate(k => Object.values((window.__FS || {})[k] || {}), k);
  const fsId = (k, id) => p.evaluate(({ k, id }) => ((window.__FS || {})[k] || {})[id] || null, { k, id });
  const cacah = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.mr-ringkas__item')].map(b => [b.dataset.s, +b.querySelector('b').textContent])));
  // membuat berkas .xlsx di browser (pustaka Excel aplikasi), dikembalikan sebagai buffer
  const buatXlsx = async rows => Buffer.from(await p.evaluate(r => { const X = window.XLSX, wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(r), 'Uang Jalan'); return Array.from(new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' }))); }, rows));
  const unggah = async buf => { await p.setInputFiles('#ujx-file', typeof buf === 'string' ? buf : { name: 'uj.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf }); await w(900); };
  const konfirm = async () => { cek(await klik('.mr-konfirm__aksi .mr-btn--bahaya, .mr-konfirm__aksi .mr-btn--utama, [data-ya]'), 'dialog konfirmasi tidak muncul'); await w(2500); };

  await klik('[data-aksi="tab"][data-v="uj"]'); await w(600);
  cek(await klik('[data-aksi="uj-impor"]'), 'tombol Impor / ekspor tidak ada'); await w(500);

  // 1. template diunduh
  const [dl] = await Promise.all([p.waitForEvent('download'), klik('#ujx-templat')]); cek(dl.suggestedFilename() === 'template-uang-jalan.xlsx', 'nama template salah: ' + dl.suggestedFilename());

  // 2. berkas: total saja, rincian saja (driver kosong + insentif), selisih, armada salah, dobel
  const buf = await buatXlsx([
    { 'Pick up': 'Cikarang', Tujuan: 'Subang', Armada: 'CDD Standar', 'Uang jalan': 200000 },
    { 'Pick up': 'Jakarta', Tujuan: 'Cikarang', Armada: 'Fuso', 'BBM / Solar': 204000, Tol: 135000, Mel: 75000, TKBM: 120000, 'Insentif driver': 100000 },
    { 'Pick up': 'Cikarang', Tujuan: 'Garut', Armada: 'Tronton', 'Uang jalan': 1500000, Tol: 380000 },
    { 'Pick up': 'Cikarang', Tujuan: 'Bogor', Armada: 'Becak', 'Uang jalan': 100000 },
    { 'Pick up': 'Cikarang', Tujuan: 'Subang', Armada: 'cdd', 'Uang jalan': 210000 },
  ]);
  await unggah(buf);
  let c = await cacah(); cek(c.baru === 3 && c.error === 1 && c.kembar === 1 && c.ubah === 0, 'pratinjau salah: ' + JSON.stringify(c));
  cek(/berbeda Rp1\.120\.000/.test(await teks('#ujx-isi')), 'peringatan selisih rincian tidak tampil');
  cek(/tidak dikenal/.test(await teks('#ujx-isi')), 'pesan armada tidak dikenal tidak tampil');
  cek(/Simpan 3 terpilih/.test(await teks('#ujx-terapkan')), 'tombol simpan harus 3 terpilih: ' + await teks('#ujx-terapkan'));
  // lepas baris Garut (selisih)
  await p.evaluate(() => { const c = document.querySelector('[data-ujx-k="cikarang__garut__tr"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  cek(/Simpan 2 terpilih/.test(await teks('#ujx-terapkan')), 'melepas baris harus mengurangi pilihan');
  await klik('#ujx-terapkan'); await w(600); await konfirm();

  // 3. tersimpan sebagai impor
  const um = await fs('uj_master'); cek(um.length === 2, 'harus 2 baris tersimpan, dapat ' + um.length);
  const A = await fsId('uj_master', 'cikarang__subang__cdd'), B = await fsId('uj_master', 'jakarta__cikarang__fu');
  cek(A && A.total === 200000 && A.sumber === 'impor' && A.rincian === false && A.manual === 200000, 'baris total-saja salah: ' + JSON.stringify(A && { t: A.total, s: A.sumber, r: A.rincian }));
  cek(B && B.total === 634000 && B.digaji === false && B.opsi.insentif === 100000 && B.bbmNominal === 204000 && B.rincian === true, 'baris rincian salah: ' + JSON.stringify(B && { t: B.total, d: B.digaji, o: B.opsi }));
  cek(!await fsId('uj_master', 'cikarang__garut__tr'), 'baris yang dilepas tidak boleh tersimpan');
  cek((await fsId('master_modal', 'uang_jalan__internal__x__cikarang_subang__armada_cdd_standar__per_trip__x') || {}).modal === 200000, 'tarif impor tidak tersinkron');
  await klik('[data-aksi="tutup-layer"]'); await w(300);
  const daftar = await teks('#mr-isi'); cek(/Impor/.test(daftar) && /Nominal langsung/.test(daftar), 'tag Impor / Nominal langsung tidak tampil di daftar');

  // 4. formulir baris impor: total-saja = angka manual; rincian = BBM nominal yang bisa dihitung dari jarak
  await klik('[data-aksi="uj-buka"][data-k="cikarang__subang__cdd"]'); await w(500);
  cek(await p.inputValue('[data-uj="manual"]') === '200.000', 'baris total-saja harus membuka angka manual 200.000');
  await klik('[data-aksi="tutup-layer"]'); await w(300);
  await klik('[data-aksi="uj-buka"][data-k="jakarta__cikarang__fu"]'); await w(500);
  cek(await p.inputValue('[data-uj="bbmNominal"]') === '204.000' && !!await p.$('[data-ujt="bbm-hitung"]'), 'BBM nominal tidak tampil di formulir baris rincian');
  cek(!!await p.$('[data-ujo="insentif"]'), 'insentif driver tidak digaji harus tampil');
  await klik('[data-aksi="tutup-layer"]'); await w(300);

  // 5. ekspor lalu impor ulang = semua Sama
  await klik('[data-aksi="uj-impor"]'); await w(400);
  const [ek] = await Promise.all([p.waitForEvent('download'), klik('#ujx-ekspor')]); const file = await ek.path();
  cek(/^uang-jalan_\d{4}-\d{2}-\d{2}\.xlsx$/.test(ek.suggestedFilename()), 'nama ekspor salah');
  await unggah(file); c = await cacah(); cek(c.sama === 2 && c.baru === 0 && c.ubah === 0 && c.error === 0, 'ekspor lalu impor ulang harus semua Sama: ' + JSON.stringify(c));

  // 6. angka diubah di Excel = Ubah dengan angka lama -> baru; tersimpan + riwayat
  cek(await klik('#ujx-ulang'), 'tombol Pilih file lain tidak ada'); await w(400);
  await unggah(await buatXlsx([{ 'Pick up': 'Cikarang', Tujuan: 'Subang', Armada: 'CDD Standar', 'Uang jalan': 250000 }]));
  c = await cacah(); cek(c.ubah === 1, 'harus 1 Ubah: ' + JSON.stringify(c)); cek(/200\.000.*250\.000/.test((await teks('#ujx-isi')).replace(/\s+/g, ' ')), 'angka lama -> baru tidak tampil');
  await klik('#ujx-terapkan'); await w(600); await konfirm();
  cek((await fsId('uj_master', 'cikarang__subang__cdd') || {}).total === 250000, 'total hasil impor ubah harus 250000');
  cek((await fsId('master_modal', 'uang_jalan__internal__x__cikarang_subang__armada_cdd_standar__per_trip__x') || {}).modal === 250000, 'modal tarif harus ikut 250000');
  cek((await fs('uj_riwayat')).filter(r => r.kunci === 'cikarang__subang__cdd' && r.jenis === 'impor').length === 2, 'riwayat impor harus 2 catatan');

  const bising = err.filter(e => !/favicon|net::ERR|Failed to load resource|ERR_BLOCKED/.test(e)); cek(!bising.length, 'galat halaman: ' + bising.slice(0, 3).join(' | '));
  await browser.close();
  if (gagal.length) { console.log('GAGAL:\n- ' + gagal.join('\n- ')); process.exit(1); }
  console.log(`Uji impor Uang Jalan (${LAYAR}) lulus.`);
})();
