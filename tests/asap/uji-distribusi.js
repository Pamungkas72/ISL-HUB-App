// Uji formulir Trucking Distribusi (UI spreadsheet, desain B): tab tipe body, grid, panel baris, pengaturan unit, isi cepat, tarif minimum.
// Berjalan lokal: NODE_PATH=<folder node_modules berisi playwright> node tests/asap/uji-distribusi.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', '..', 'public') + path.sep;
const gagal = [];
const cek = (k, m) => { if (!k) gagal.push(m); };

async function siapkan(browser) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.setContent(`<!doctype html><meta charset=utf-8><style>${['style', 'master-rate', 'app', 'tambahan'].map(f => fs.readFileSync(R + 'css/' + f + '.css', 'utf8')).join('')}</style><div id="sinkron-banner"></div><nav id="app-nav"></nav><div id="cu-root" class="hidden"></div><div id="qt-root"></div><div id="mr-layer"></div><div id="lp-root" class="hidden"></div><div id="lr-root" class="hidden"></div><div id="toasts"></div>`);
  await p.evaluate(() => {
    const profil = { uid: 'u', email: 'm@isl.test', peran: 'master', status: 'aktif', sembunyi: {} };
    window.__ISL_PROFIL = profil; window.__islSimpanProfil = async () => {};
    window.__ISL = { email: profil.email, master: true, kelola: true, admin: false, sales: false, uid: 'u', peran: 'master', nama: 'master', hariIni: () => '2026-11-05', tulis: async (k, v) => { k(); }, unggahBlob: async () => '', diagnosa: async () => [], buatLini: async () => {}, simpanMarkupLini: async () => {}, tarifTambah: async () => ({}), navAktif: () => {} };
    const t = (v, m, k) => ({ liniBisnisId: 'distribusi_kecil', vendorId: v, layananNama: 'Distribusi', dimensi: { tujuan: 'z-cik', kendaraan: k }, modal: m, aktif: true });
    window.__islMR = { tarif: [t('v1', 500000, 'CDE'), t('v2', 520000, 'CDE')], vendor: [{ id: 'v1', nama: 'Vendor Satu' }, { id: 'v2', nama: 'Vendor Dua' }], lini: [{ id: 'distribusi_kecil', nama: 'Trucking Distribusi' }], satuan: [], ref: { zona: [{ id: 'z-cik', nama: 'Cikarang' }] }, user: { email: profil.email } };
    window.__ISL_DATA = { customers: [{ id: 'c1', nama: 'PT Sinar Makmur Abadi', status: 'aktif', kontak: [], legalitas: [], alamat: 'Jakarta' }], rates: [], paket: [], orders: [], counters: [], layanan: [], quotations: [], templates: [], riwayat: [], pengaturan: null };
  });
  for (const f of ['js/logo.js', 'js/formulir-lini.js', 'js/sales.js', 'js/app-core.js']) await p.addScriptTag({ content: fs.readFileSync(R + f, 'utf8') });
  await p.waitForTimeout(400);
  return { p, err };
}

(async () => {
  const browser = await chromium.launch();
  const { p, err } = await siapkan(browser);
  const buka = () => p.evaluate(() => { window.__qt._Q.edit = null; window.__qt.baru('c1'); const e = window.__qt._Q.edit; window.ISLFL.terapkanAwal(e, 'distribusi_kecil'); e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.judul = 'Uji'; window.__qt.gambar(); });
  const st = () => p.evaluate(() => window.__qt._Q.edit.formLini.s);
  const klik = async sel => { if (/dsbPanel"\]\[data-flx="(unit|skema|pick)"/.test(sel) && !(await p.evaluate(s => !!document.querySelector(s), sel))) { await p.evaluate(() => document.querySelector('[data-fla="dsbPanel"][data-flx="ubah"]').click()); await p.waitForTimeout(200); } return p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel); };
  const tunggu = () => p.waitForTimeout(250);
  const ketik = (path, v) => p.evaluate(({ path, v }) => { const i = document.querySelector(`[data-fl="${CSS.escape(path)}"]`); if (!i) return false; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return true; }, { path, v });
  const kepala = () => p.evaluate(() => [...document.querySelectorAll('.fl-dsb__hc:not(.fl-dsb__f)')].map(x => x.firstChild.textContent));

  await buka(); await tunggu();
  // 1. tampilan awal
  const awal = await p.evaluate(() => ({ tab: [...document.querySelectorAll('.fl-dsb__tab')].map(x => x.textContent), aktif: (document.querySelector('.fl-dsb__tab[aria-pressed="true"]') || {}).textContent, baris: document.querySelectorAll('.fl-dsb__r').length, panel: !!document.querySelector('.fl-dsb__ins'), chip: [...document.querySelectorAll('.fl-dsb__chip')].map(x => x.textContent.trim()), ring: (document.querySelector('.fl-dsb__ring') || {}).textContent || '' }));
  cek(awal.tab.length === 3 && /^ABox Dry/.test(awal.aktif) && /\+ Blok/.test(awal.tab.join('|')) && /\+ Tipe/.test(awal.tab.join('|')), 'tab awal: hanya blok A Box Dry (aktif), + Blok, dan + Tipe: ' + JSON.stringify(awal.tab));
  cek(awal.baris === 1 && awal.panel && /Satu pick up/.test(awal.ring) && /Unit 5/.test(awal.ring) && awal.chip.every(c => /Isi cepat|Blok/.test(c)), 'awal: satu baris, panel baris, ringkasan pengaturan satu baris (chip tersembunyi sampai Ubah): ' + JSON.stringify(awal));
  cek((await kepala()).join() === 'Blind Van,CDE,CDD,FUSO,Tronton', 'awal: kolom kelas bawaan (varian long mati): ' + (await kepala()).join());

  // 2. tambah baris dan isi
  await klik('[data-fla="tujuan-tambah"]'); await tunggu();
  let s1 = await st();
  cek(s1.bodies.boxdry.rows.length === 2, 'tambah baris: harus ada 2 baris');
  await ketik('bodies.boxdry.rows.0.tujuan', 'Cikarang'); await ketik('bodies.boxdry.rows.0.h.CDE', '450.000'); await ketik('bodies.boxdry.rows.1.tujuan', 'Bogor'); await ketik('bodies.boxdry.rows.1.h.CDE', '500000'); await tunggu();
  s1 = await st();
  cek(s1.bodies.boxdry.rows[0].tujuan === 'Cikarang' && s1.bodies.boxdry.rows[0].h.CDE === 450000 && s1.bodies.boxdry.rows[1].h.CDE === 500000, 'isi grid: tujuan dan harga tersimpan di state: ' + JSON.stringify(s1.bodies.boxdry.rows.map(r => [r.tujuan, r.h.CDE])));
  // 3. baris dipilih: ketuk label baris 1, TKBM, Express
  await klik('[data-fla="dsbBaris"][data-flx="boxdry.1"]'); await tunggu();
  await klik('[data-fla="dstTg"][data-flx="bodies.boxdry.rows.1.tkbm"]'); await tunggu(); await klik('[data-fla="dstSvc"][data-flx="bodies.boxdry.rows.1|Express"]'); await tunggu();
  s1 = await st();
  cek(s1.bodies.boxdry.rows[1].tkbm === 'Termasuk' && s1.bodies.boxdry.rows[1].service === 'Express' && s1.bodies.boxdry.rows[0].tkbm === '', 'panel baris: TKBM dan Express pada baris 2 saja: ' + JSON.stringify(s1.bodies.boxdry.rows.map(r => [r.tkbm, r.service])));
  const sel = await p.evaluate(() => [...document.querySelectorAll('.fl-dsb__r')].map(r => r.classList.contains('sel')));
  cek(sel.join() === 'false,true', 'baris yang dipilih harus tersorot: ' + sel.join());
  // 4. tarif minimum: Cikarang CDE = vendor tertinggi 520.000 + markup; 450.000 harus merah
  const rendah = await p.evaluate(() => [...document.querySelectorAll('.fl-dsb__c input')].map(i => [i.dataset.fl, i.hasAttribute('data-rendah'), i.title]).filter(x => /rows\.0\.h\.CDE$/.test(x[0]))[0]);
  cek(rendah && rendah[1] === true && /Min Rp/.test(rendah[2]), 'tarif minimum: harga di bawah minimum merah dan ber-title Min: ' + JSON.stringify(rendah));
  await klik('[data-fla="dstKelas"][data-flx="CDE"]'); await tunggu(); await klik('[data-fla="dsbPanel"][data-flx="cepat"]'); await tunggu();
  await ketik('bodies.boxdry.rows.0.h.CDE', ''); await tunggu(); await klik('[data-fla="dsbPanel"][data-flx="cepat"]'); await tunggu(); if (!(await p.evaluate(() => !!document.querySelector('[data-fla="dstMin"]')))) { await klik('[data-fla="dsbPanel"][data-flx="cepat"]'); await tunggu(); }
  await klik('[data-fla="dstMin"]'); await tunggu(); s1 = await st();
  cek(s1.bodies.boxdry.rows[0].h.CDE >= 520000 && s1.bodies.boxdry.rows[1].h.CDE === 500000, 'Isi tarif minimum hanya mengisi sel kosong (tidak menimpa harga yang sudah ada): ' + JSON.stringify(s1.bodies.boxdry.rows.map(r => r.h.CDE)));
  // 5. isi cepat: salin ke bawah di kolom CDD
  await ketik('bodies.boxdry.rows.0.h.CDD', '650000'); await klik('[data-fla="dstKelas"][data-flx="CDD"]'); await tunggu(); await klik('[data-fla="dsbPanel"][data-flx="cepat"]'); await tunggu();
  if (!(await p.evaluate(() => !!document.querySelector('[data-fla="dstSalin"]')))) await klik('[data-fla="dsbPanel"][data-flx="cepat"]'); await tunggu();
  await klik('[data-fla="dstSalin"]'); await tunggu(); s1 = await st();
  cek(s1.bodies.boxdry.rows[1].h.CDD === 650000, 'Salin ke bawah mengisi sel kosong dengan harga di atasnya: ' + JSON.stringify(s1.bodies.boxdry.rows.map(r => r.h.CDD)));
  // 6. pengaturan unit: CDE Long dicentang menjadi kolom
  await klik('[data-fla="dsbPanel"][data-flx="unit"]'); await tunggu(); if (!(await p.evaluate(() => !!document.querySelector('.fl-dsb__pn [data-fla="tipeKelas"]')))) { await klik('[data-fla="dsbPanel"][data-flx="unit"]'); await tunggu(); }
  await klik('.fl-dsb__pn [data-fla="tipeKelas"][data-flx="CDE Long"]'); await tunggu();
  cek((await kepala()).join() === 'Blind Van,CDE,CDE Long,CDD,FUSO,Tronton', 'unit: CDE Long dicentang menjadi kolom grid: ' + (await kepala()).join());
  const kap = await p.evaluate(() => (document.querySelector('[data-fl="kap.CDE Long"]') || {}).value);
  cek(kap === '2,5 ton · 14 cbm', 'unit: kapasitas bawaan CDE Long dapat diubah di panel unit: ' + kap);
  await klik('.fl-dsb__pn [data-fla="tipeKelas"][data-flx="CDE Long"]'); await tunggu();
  cek(!(await kepala()).includes('CDE Long'), 'unit: CDE Long dilepas hilang dari grid');
  // 7. skema berpasangan: kolom Asal muncul di panel baris
  await klik('[data-fla="dsbPanel"][data-flx="skema"]'); await tunggu(); if (!(await p.evaluate(() => !!document.querySelector('[data-fla="dsbSkema"]')))) { await klik('[data-fla="dsbPanel"][data-flx="skema"]'); await tunggu(); }
  await klik('[data-fla="dsbSkema"][data-flx="pasangan"]'); await tunggu(); s1 = await st();
  cek(s1.bodies.boxdry.skema === 'pasangan' && await p.evaluate(() => !!document.querySelector('.fl-dsb__ins [data-fl$=".asal"]')), 'skema berpasangan: panel baris memuat isian Asal');
  // 8. Enter pindah ke baris berikutnya pada kolom yang sama
  const fokus = await p.evaluate(() => { const a = document.querySelector('[data-fl="bodies.boxdry.rows.0.h.CDE"]'); a.focus(); a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return document.activeElement.dataset.fl; });
  cek(fokus === 'bodies.boxdry.rows.1.h.CDE', 'Enter pindah ke baris berikutnya di kolom yang sama: ' + fokus);
  // 9. blok baru (+ Blok): isinya sama dengan blok pertama (tipe body, skema, pick up), huruf berurutan, judul bebas
  cek(await p.evaluate(() => !document.querySelector('.fl-dsb__tab.is-off') && !document.querySelector('[data-fla="body"]')), 'tab: hanya blok yang ditawarkan, tidak ada tab mati atau tombol Tawarkan');
  await klik('[data-fla="blokBuka"]'); await tunggu();
  cek(await p.evaluate(() => !!document.querySelector('.fl-dsb__nb [data-fla="bbTipe"]') && !!document.querySelector('.fl-dsb__nb [data-fla="bbSkema"][data-flx="pasangan"]') && /Blok baru \(B\)/.test(document.querySelector('.fl-dsb__nb').textContent)), 'blok baru: panel memuat tipe body dan skema pick up, bernama Blok B');
  await klik('[data-fla="bbTipe"][data-flx="bak"]'); await tunggu();
  await p.evaluate(() => { const i = document.querySelector('[data-fli="bb-pick"]'); i.value = 'Bekasi (Gudang Cikarang)'; const j = document.querySelector('[data-fli="bb-judul"]'); j.value = 'Bak Bekasi'; });
  await klik('[data-fla="bbSkema"][data-flx="tetap"]'); await tunggu();
  cek(await p.evaluate(() => document.querySelector('[data-fli="bb-pick"]').value === 'Bekasi (Gudang Cikarang)' && document.querySelector('[data-fli="bb-judul"]').value === 'Bak Bekasi'), 'blok baru: isian pick up dan judul tidak hilang saat memilih opsi lain');
  await klik('[data-fla="blokBuat"]'); await tunggu(); s1 = await st();
  cek(s1.bodies.bak && s1.bodies.bak.on && s1.bodies.bak.skema === 'tetap' && s1.bodies.bak.judul === 'Bak Bekasi' && s1.bodies.bak.rows[0].asal === 'Bekasi (Gudang Cikarang)' && s1.bodies.bak.urut > 0 && await p.evaluate(() => !!document.querySelector('.fl-dsb__g')), 'blok B dibuat: tipe Bak, skema satu pick up, pick up terisi di baris pertama, judul bebas: ' + JSON.stringify(s1.bodies.bak));
  // 9b. tab huruf berurutan; blok bertipe sama boleh dibuat lagi (kunci tipe@n)
  await klik('[data-fla="blokBuka"]'); await tunggu(); await klik('[data-fla="bbTipe"][data-flx="boxdry"]'); await tunggu(); await klik('[data-fla="bbSkema"][data-flx="pasangan"]'); await tunggu(); await klik('[data-fla="blokBuat"]'); await tunggu(); s1 = await st();
  const urut = await p.evaluate(() => [...document.querySelectorAll('.fl-dsb__tab[data-fla="dsbBody"]')].map(x => x.querySelector('.fl-dsb__let').textContent + ':' + x.textContent.slice(1)));
  cek(urut.length === 3 && urut[0].startsWith('A:Box Dry') && urut[1].startsWith('B:Bak Bekasi') && urut[2].startsWith('C:Box Dry (2)') && s1.bodies['boxdry@2'] && s1.bodies['boxdry@2'].skema === 'pasangan', 'tab huruf A, B, C berurutan; Box Dry kedua memakai kunci boxdry@2: ' + JSON.stringify(urut));
  const pdfB = await p.evaluate(() => { const e = window.__qt._Q.edit, st = e.formLini.s; st.bodies.bak.rows[0].tujuan = 'Bogor'; st.bodies.bak.rows[0].h = { CDE: 400000 }; const r2 = st.bodies['boxdry@2'].rows[0]; r2.asal = 'Jakarta'; r2.tujuan = 'Bandung'; r2.h = { CDE: 1250000 }; window.ISLFL.sinkron(e); const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]); return m.fl.blok.map(x => [x.huruf, x.cap, x.kolom[0].h]); });
  cek(JSON.stringify(pdfB.slice(-2)) === JSON.stringify([['B', 'Bak Bekasi', 'Tujuan'], ['C', 'Tipe Box Dry (2)', 'Rute']]), 'PDF: blok A, B, C berurutan, judul bebas dan "Tipe Box Dry (2)" untuk blok kembar, kolom Rute untuk skema berpasangan: ' + JSON.stringify(pdfB));
  await klik('[data-fla="dsbBody"][data-flx="boxdry@2"]'); await tunggu();
  await klik('[data-fla="dsbPanel"][data-flx="blok"]'); await tunggu(); await klik('[data-fla="blokHapus"]'); await tunggu();
  cek(await p.evaluate(() => !!document.querySelector('.mr-konfirm') && /Hapus blok/.test(document.querySelector('.mr-konfirm h3').textContent)) && !!(await st()).bodies['boxdry@2'], 'hapus blok berisi: dikonfirmasi dulu, belum terhapus sebelum disetujui');
  await klik('.mr-konfirm [data-x="ok"]'); await tunggu();
  s1 = await st();
  cek(!s1.bodies['boxdry@2'] && s1.bodies.bak && s1.bodies.boxdry, 'hapus blok C setelah konfirmasi: terhapus dan blok lain utuh');
  await klik('[data-fla="dsbBody"][data-flx="bak"]'); await tunggu();
  // 9c. deskripsi lini ada di ikon i, tersembunyi sampai ditunjuk
  const inf = await p.evaluate(() => { const pop = document.querySelector('.fl-kepala .qt-info__pop'); return { ada: !!pop, teks: pop ? pop.textContent : '', sembunyi: pop ? getComputedStyle(pop).visibility === 'hidden' : null, terbuka: !!document.querySelector('.fl-kepala > div > .fl-mut, .fl-kepala > .fl-mut') }; });
  cek(inf.ada && /Satu modul untuk semua tipe body/.test(inf.teks) && inf.sembunyi && !inf.terbuka, 'deskripsi: ada di ikon i dan tidak tampil terus: ' + JSON.stringify(inf));
  await p.hover('.fl-kepala .qt-info__ikon'); await p.waitForTimeout(250);
  cek(await p.evaluate(() => getComputedStyle(document.querySelector('.fl-kepala .qt-info__pop')).visibility === 'visible'), 'deskripsi: muncul saat ikon i ditunjuk kursor');
  // 10. PDF mengikuti isian (Box Dry: CDE dan CDD)
  const th = await p.evaluate(async () => { const e = window.__qt._Q.edit; window.ISLFL.sinkron(e); const m = window.__qt._R.bangunModel(e, window.__islCU.S.customers[0]); const h = await window.__qt._renderDok(m, window.__qt._aset(), { watermark: '', densitas: 0 }); await window.__qt._tungguGambar(h.host); const t = [...h.host.querySelector('table.isl-t.isl-fl').querySelectorAll('thead th')].map(x => x.firstChild.textContent); h.host.remove(); return t; });
  cek(th.join('|') === 'Rute|Layanan|CDE|CDD', 'PDF mengikuti isian grid (skema berpasangan, kolom CDE dan CDD): ' + th.join('|'));
  // 10b. hapus baris: tombol × di tiap baris, baris kosong langsung terhapus, baris berisi dikonfirmasi, "Hapus n baris kosong"
  await klik('[data-fla="dsbBody"][data-flx="boxdry"]'); await tunggu();
  const jmlBaris = () => p.evaluate(() => document.querySelectorAll('.fl-dsb__r').length), jmlX = () => p.evaluate(() => document.querySelectorAll('.fl-dsb__r .fl-dsb__x').length);
  const b0 = await jmlBaris(); await klik('[data-fla="tujuan-tambah"]'); await tunggu(); await klik('[data-fla="tujuan-tambah"]'); await tunggu();
  cek((await jmlBaris()) === b0 + 2 && (await jmlX()) === b0 + 2, 'hapus: tiap baris grid punya tombol × (baris ' + (await jmlBaris()) + ', tombol ' + (await jmlX()) + ')');
  const kosongLabel = await p.evaluate(() => (document.querySelector('[data-fla="dsbKosong"]') || {}).textContent || '');
  cek(/Hapus 2 baris kosong/.test(kosongLabel), 'hapus: tombol "Hapus n baris kosong" menyebut 2 baris: ' + kosongLabel);
  await klik(`.fl-dsb__r:nth-of-type(${b0 + 2}) .fl-dsb__x`); await tunggu();
  cek((await jmlBaris()) === b0 + 1 && !(await p.evaluate(() => !!document.querySelector('.mr-konfirm'))), 'hapus: baris kosong langsung terhapus tanpa konfirmasi');
  await klik('[data-fla="dsbKosong"]'); await tunggu();
  cek((await jmlBaris()) === b0 && !(await p.evaluate(() => !!document.querySelector('[data-fla="dsbKosong"]'))), 'hapus: "Hapus baris kosong" membersihkan semua baris kosong dan tombolnya hilang');
  const sebelum = (await st()).bodies.boxdry.rows.map(r => r.tujuan);
  await klik('.fl-dsb__r .fl-dsb__x'); await p.waitForSelector('.mr-konfirm', { timeout: 3000 });
  cek(/Hapus baris\?/.test(await p.evaluate(() => document.querySelector('.mr-konfirm h3').textContent)), 'hapus: baris berisi harus dikonfirmasi');
  await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="batal"]').click()); await tunggu();
  cek((await st()).bodies.boxdry.rows.length === sebelum.length, 'hapus: Batal tidak menghapus baris');
  await klik('.fl-dsb__r .fl-dsb__x'); await p.waitForSelector('.mr-konfirm', { timeout: 3000 }); await p.evaluate(() => document.querySelector('.mr-konfirm [data-x="ok"]').click()); await tunggu(); await tunggu();
  cek((await st()).bodies.boxdry.rows.length === sebelum.length - 1 && (await st()).bodies.boxdry.rows.every(r => r.tujuan !== sebelum[0]), 'hapus: setelah konfirmasi baris pertama terhapus: ' + JSON.stringify((await st()).bodies.boxdry.rows.map(r => r.tujuan)));

  // 11. tidak ada galat
  cek(err.length === 0, 'galat halaman: ' + err.join(' | '));
  await browser.close();
  console.log(gagal.length ? 'GAGAL formulir Distribusi:\n- ' + gagal.join('\n- ') : 'Formulir Distribusi (grid spreadsheet) lolos: tab tipe body, isi grid, panel baris, tarif minimum, isi cepat, pengaturan unit, skema, dan PDF.');
  process.exit(gagal.length ? 1 : 0);
})();
