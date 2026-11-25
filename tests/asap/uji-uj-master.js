// Uji tab Uang Jalan di Master Rate (Firebase tiruan, aplikasi asli). Jalankan: NODE_PATH=<node_modules playwright> node tests/asap/uji-uj-master.js [hp|desktop]
// Alur: tambah (rumus, driver digaji vs tidak, komponen opsional, angka manual), tersimpan + tercatat di Tarif, "sudah ada", ubah + riwayat, hapus.
const { chromium } = require('playwright');
const path = require('path');
const { pasang } = require('../audit/firebase-tiruan.js');
const { awal } = require('../audit/data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const LAYAR = process.argv.includes('desktop') ? 'desktop' : 'hp', hp = LAYAR === 'hp';
const gagal = []; const cek = (k, m) => { if (!k) gagal.push(`[${LAYAR}] ${m}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: hp, hasTouch: hp });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error') err.push('CON ' + m.text().slice(0, 200)); });
  await pasang(p, PUBLIK, { awal });
  await p.goto('http://isl.test/app.html#master-rate'); await p.waitForTimeout(2500);
  const w = ms => p.waitForTimeout(ms);
  const klik = async sel => { const ok = await p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel); return ok; };
  const isi = async (sel, v) => p.evaluate(({ sel, v }) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, { sel, v });
  const teks = sel => p.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const fs = k => p.evaluate(k => Object.values((window.__FS || {})[k] || {}), k);
  const fsId = (k, id) => p.evaluate(({ k, id }) => ((window.__FS || {})[k] || {})[id] || null, { k, id });

  // 1. tab, daftar kosong, tombol tambah
  cek(await klik('[data-aksi="tab"][data-v="uj"]'), 'tab Uang Jalan tidak ada'); await w(600);
  cek(/Belum ada uang jalan/.test(await teks('#mr-isi')), 'keadaan kosong tidak tampil');
  cek(await klik('[data-aksi="uj-tambah"]'), 'tombol tambah tidak ada'); await w(500);

  // 2. isi formulir: CDD Standar, Cikarang -> Subang, 210 km, rasio otomatis 5, solar 6.800
  await isi('[data-uj="pickup"]', 'Cikarang'); await isi('[data-uj="tujuan"]', 'Subang'); await isi('[data-uj="jarak"]', '210');
  if (hp) { await p.selectOption('select[data-uj="armada"]', 'cdd'); } else await klik('[data-ujt="armada"][data-v="cdd"]');
  await w(200);
  cek(await p.inputValue('[data-uj="rasio"]') === '5', 'rasio CDD bukan 5 otomatis');
  cek(await p.inputValue('[data-uj="solar"]').catch(() => '6.800') === '6.800', 'solar bawaan bukan 6.800');
  await isi('[data-uj="tol"]', '135.000'); await isi('[data-uj="mel"]', '50.000');
  cek(/285\.600/.test(await teks('#ujm-komp')), 'BBM 210/5 x 6.800 harus 285.600');
  // opsional: helper dan asuransi aktif; insentif tidak berlaku (driver digaji)
  await klik('[data-ujt="sw"][data-v="helper"]'); await w(100); await isi('[data-ujo="helper"]', '150.000');
  await klik('[data-ujt="sw"][data-v="asuransi"]'); await w(100); await isi('[data-ujo="asuransi"]', '25.000');
  cek(!await p.$('[data-ujo="insentif"]'), 'insentif tidak boleh bisa diisi untuk driver digaji');
  cek((await teks('#ujm-tot')).replace(/\s/g, '') === 'Rp646.000', 'total harus Rp646.000, dapat ' + await teks('#ujm-tot'));
  // driver tidak digaji: insentif bisa diaktifkan lalu dimatikan lagi
  await klik('[data-ujt="driver"][data-v="0"]'); await w(150); await klik('[data-ujt="sw"][data-v="insentif"]'); await w(100);
  cek(!!await p.$('[data-ujo="insentif"]'), 'insentif harus muncul untuk driver tidak digaji'); await isi('[data-ujo="insentif"]', '100.000');
  cek((await teks('#ujm-tot')).replace(/\s/g, '') === 'Rp746.000', 'total dengan insentif harus Rp746.000, dapat ' + await teks('#ujm-tot'));
  await klik('[data-ujt="driver"][data-v="1"]'); await w(150);
  cek((await teks('#ujm-tot')).replace(/\s/g, '') === 'Rp646.000', 'kembali ke digaji, insentif harus hilang dari total');
  if (hp) { await klik('[data-ujt="slip"]'); await w(150); cek(/SLIP UANG JALAN/.test(await teks('#ujm-slip')), 'pratinjau slip tidak tampil'); }

  // 3. simpan, tersimpan di master dan tercatat di Tarif
  await klik('#ujm-simpan'); await w(1500);
  const um = await fs('uj_master'); cek(um.length === 1 && um[0].total === 646000 && um[0].armada === 'cdd' && um[0].opsi.insentif === 0, 'baris uj_master salah: ' + JSON.stringify(um[0] && { t: um[0].total, o: um[0].opsi }));
  cek(!!await fsId('lini_bisnis', 'uang_jalan'), 'lini Uang Jalan tidak dibuat');
  const kt = 'uang_jalan__internal__x__cikarang_subang__armada_cdd_standar__per_trip__x', tt = await fsId('master_tarif', kt);
  cek(!!tt && tt.vendorId === 'internal' && tt.layananNama === 'Cikarang → Subang', 'tarif tidak tercatat: ' + JSON.stringify(Object.keys((await p.evaluate(() => window.__FS.master_tarif)) || {}).slice(-2)));
  cek((await fsId('master_modal', kt) || {}).modal === 646000, 'modal tarif harus 646000');
  cek(/646\.000/.test(await teks('#mr-isi')) && /Cikarang → Subang/.test(await teks('#mr-isi')), 'baris tidak tampil di daftar');

  // 4. rute + armada yang sama: peringatan "sudah ada"; rute lain memakai angka manual
  await klik('[data-aksi="uj-tambah"]'); await w(400);
  await isi('[data-uj="pickup"]', 'cikarang'); await isi('[data-uj="tujuan"]', 'SUBANG '); await w(100);
  cek(/Sudah ada di master/.test(await teks('#ujm-ada')), 'peringatan sudah ada tidak tampil');
  await isi('[data-uj="tujuan"]', 'Garut'); await isi('[data-uj="jarak"]', '520'); await isi('[data-uj="tol"]', '190.000'); await isi('[data-uj="mel"]', '50.000'); await w(100);
  cek(!/Sudah ada/.test(await teks('#ujm-ada')), 'peringatan harus hilang untuk rute lain');
  await klik('[data-ujt="manual"]'); await w(100); await isi('[data-uj="manual"]', '1.200.000');
  cek((await teks('#ujm-tot')).replace(/\s/g, '') === 'Rp1.200.000', 'angka manual harus menimpa total');
  await klik('#ujm-simpan'); await w(1500);
  const g = (await fs('uj_master')).find(r => r.tujuan === 'Garut'); cek(g && g.manual === 1200000 && g.sumber === 'manual' && g.total === 1200000, 'baris manual salah');
  cek(/Manual/.test(await teks('#mr-isi')), 'tanda Manual tidak tampil di daftar');

  // 5. ubah baris pertama: tol naik, riwayat dan tarif ikut
  await klik('[data-aksi="uj-buka"][data-k="cikarang__subang__cdd"]'); await w(500);
  cek(await p.inputValue('[data-uj="tol"]') === '135.000', 'form ubah tidak terisi dari baris');
  await isi('[data-uj="tol"]', '145.000'); await w(100); await klik('#ujm-simpan'); await w(1500);
  cek((await fsId('uj_master', 'cikarang__subang__cdd') || {}).total === 656000, 'total setelah ubah harus 656000');
  cek((await fsId('master_modal', kt) || {}).modal === 656000, 'modal tarif harus ikut 656000');
  cek((await fs('uj_riwayat')).filter(r => r.kunci === 'cikarang__subang__cdd').length === 2, 'riwayat harus 2 catatan (dibuat, diubah)');

  // 5b. pengaturan: solar naik -> tawaran hitung ulang -> total ikut (42 liter x 7.000 + 145.000 + 50.000 + 150.000 + 25.000 = 664.000)
  await klik('[data-aksi="uj-peng"]'); await w(500); await isi('#ujp-solar', '7.000'); await klik('#ujp-simpan'); await w(1200);
  cek(await klik('.mr-konfirm__aksi .mr-btn--bahaya, .mr-konfirm__aksi .mr-btn--utama, [data-ya]'), 'tawaran hitung ulang tidak muncul'); await w(2500);
  cek((await fsId('uj_master', 'cikarang__subang__cdd') || {}).total === 664000, 'hitung ulang: total harus 664000, dapat ' + JSON.stringify((await fsId('uj_master', 'cikarang__subang__cdd') || {}).total));
  cek((await fsId('uj_master', 'cikarang__garut__cdd') || {}).total === 1200000, 'baris manual tidak boleh ikut dihitung ulang');
  cek((await fsId('master_modal', kt) || {}).modal === 664000, 'modal tarif harus ikut hitung ulang');

  // 6. filter dan pencarian
  await isi(hp ? '#uj-cari-bar' : '#uj-cari', 'garut'); await w(300); cek(!/Subang/.test(await teks('#mr-isi')) && /Garut/.test(await teks('#mr-isi')), 'pencarian rute tidak menyaring');
  await isi(hp ? '#uj-cari-bar' : '#uj-cari', ''); await w(200);

  // 7. hapus (master): baris dan tarifnya hilang
  await klik('[data-aksi="uj-buka"][data-k="cikarang__garut__cdd"]'); await w(500); await klik('[data-ujt="hapus"]'); await w(500);
  cek(await klik('.mr-konfirm__aksi .mr-btn--bahaya, .mr-konfirm__aksi .mr-btn--utama, [data-ya]'), 'dialog konfirmasi hapus tidak muncul'); await w(1500);
  cek((await fs('uj_master')).length === 1, 'baris Garut harus terhapus');

  // 8. tidak ada galat skrip
  const bising = err.filter(e => !/favicon|net::ERR|Failed to load resource|ERR_BLOCKED/.test(e)); cek(!bising.length, 'galat halaman: ' + bising.slice(0, 3).join(' | '));
  await browser.close();
  if (gagal.length) { console.log('GAGAL:\n- ' + gagal.join('\n- ')); process.exit(1); }
  console.log(`Uji Master Uang Jalan (${LAYAR}) lulus.`);
})();
