// Audit konsistensi tema (terang/gelap) pada aplikasi ASLI dengan Firebase tiruan, di layar HP dan desktop.
// Menjalankan banyak tampilan (halaman, panel, formulir, dialog) lalu memindai area yang warnanya tidak mengikuti tema.
// Jalankan: NODE_PATH=<folder node_modules berisi playwright> node tests/audit/audit-tema.js [gelap|terang] [hp|desktop] [--gambar]
// Keluaran: daftar temuan per tampilan. Kode keluar 1 bila ada temuan (jadi bisa dipakai di CI).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pasang } = require('./firebase-tiruan.js');
const { awal } = require('./data-contoh.js');
const pindai = require('./pindai-tema.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const argv = process.argv.slice(2), TEMA = argv.find(a => /^(gelap|terang)$/.test(a)) || 'gelap', LAYAR = argv.find(a => /^(hp|desktop)$/.test(a)) || 'hp', GAMBAR = argv.includes('--gambar'), KETAT = argv.includes('--ketat');
const OUT = process.env.AUDIT_OUT || '/tmp/audit/'; if (GAMBAR) fs.mkdirSync(OUT, { recursive: true });

const tunggu = (p, ms = 350) => p.waitForTimeout(ms);
const klikSel = async (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (e) { e.click(); return true; } return false; }, sel);
const klikTeks = async (p, teks, sel = 'button,a,[role=button],summary') => p.evaluate(({ teks, sel }) => { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent !== null && (x.textContent || x.getAttribute('aria-label') || '').trim().toLowerCase().includes(teks.toLowerCase())); if (e) { e.click(); return true; } return false; }, { teks, sel });
const tutupLapisan = async p => { await p.evaluate(() => { if (window.__qt) { window.__qt._Q.edit = null; window.__qt._Q.kotor = false; window.__qt._Q.view = 'list'; } document.querySelectorAll('[data-aksi="tutup-layer"]').forEach(b => b.click()); document.querySelectorAll('.mr-konfirm,.mr-toast,#qt-sheet').forEach(b => b.remove()); document.body.classList.remove('mr-kunci-scroll'); }); await tunggu(p, 200); };
/* pindah halaman lewat hash, persis seperti pengguna menekan menu (app-boot.js memasang rute dari location.hash) */
const pindah = async (p, id) => { await p.evaluate(i => { location.hash = '#' + i; }, id); await tunggu(p, 800); };
/* Pengaturan dokumen dibuka lewat menu titik tiga (HP) atau tombolnya (desktop), supaya draf pengaturan (Q.pd) ikut disiapkan */
const bukaPengaturan = async p => { await klikSel(p, '[data-qt="m-menu"]'); await tunggu(p, 300); if (!(await klikSel(p, '[data-qt="pengaturan"]'))) await klikTeks(p, 'pengaturan dokumen'); await tunggu(p, 500); };
const fab = p => klikSel(p, '[class*="fab"]');
const bukaDraf = async (p, lini) => { await p.evaluate(l => { window.__qt._Q.edit = null; window.__qt.baru('c1'); if (l) window.ISLFL.terapkanAwal(window.__qt._Q.edit, l); window.__qt.gambar(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }, lini); await tunggu(p, 450); };

/* membuat satu quotation Terkirim lewat repositori aplikasi (untuk mode baca, dokumen terbit, dan dialog keputusan) */
const buatTerkirim = p => p.evaluate(async () => {
  const Q = window.__qt._Q, Repo = window.__qt._Repo; window.__qt.baru('c1'); const e = Q.edit; window.ISLFL.terapkanAwal(e, 'depo');
  e.formLini.s.rows[0][0].h20 = 45000; e.formLini.s.rows[0][0].h40 = 60000; e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.picNama = 'Budi'; e.judul = 'Penawaran Tarif Depo (audit)'; e.berlakuSampai = '2026-12-30'; window.ISLFL.sinkron(e);
  await Repo.simpanDraf(e); const x = await Repo.kirim(Repo.baca(e.id)); Q.edit = null; Q.kotor = false; return x.id;
});
const ADEGAN = [
  ['beranda', async p => { await pindah(p, 'beranda'); }],
  ['quotation: daftar', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { window.__qt._Q.view = 'list'; window.__qt.gambar(); }); }],
  ['quotation: ringkasan', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const q = window.__qt._Q; q.view = 'list'; q.sub = 'ringkasan'; window.__qt.gambar(); }); }],
  ['quotation: follow up', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const q = window.__qt._Q; q.view = 'list'; q.sub = 'follow'; window.__qt.gambar(); }); }],
  ['quotation: pilih format baru', async p => { await pindah(p, 'quotation'); await fab(p); await tunggu(p, 500); }],
  ['quotation: formulir bebas', async p => { await pindah(p, 'quotation'); await bukaDraf(p, ''); }],
  ['quotation: formulir Depo', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); }],
  ['quotation: formulir Depo (isi, kelompok B terbuka)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await p.evaluate(() => { const i = document.querySelector('[data-fla="grup-buka"][data-flx="1"]'); if (i) i.click(); }); await tunggu(p, 250); await p.evaluate(() => { const e = document.querySelector('[data-fl="rows.0.0.h20"]'); if (e) { e.value = '20000'; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await tunggu(p, 250); }],
  ['quotation: formulir Depo (panel atur tarif minimum)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await p.evaluate(() => { const e = document.querySelector('[data-fl="rows.0.0.h20"]'); if (e) { e.value = '20000'; e.dispatchEvent(new Event('input', { bubbles: true })); } const b = document.querySelector('.fl-min__ed'); if (b) b.click(); }); await tunggu(p, 300); }],
  ['quotation: formulir Customs Clearance', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'customs_clearance'); }],
  ['quotation: formulir Trailer', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'trucking_trailer'); }],
  ['quotation: formulir Distribusi', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'distribusi_kecil'); }],
  ['quotation: pop-up pengingat biaya diatur lewat teks (Distribusi, sebelum terbit)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'distribusi_kecil'); await p.evaluate(() => { const e = window.__qt._Q.edit; e.customerNama = 'PT Sinar Makmur Abadi'; e.customerId = 'c1'; e.judul = 'Uji'; e.picNama = 'Budi'; e.formLini.s.bodies.boxdry.rows = [{ asal: 'Jakarta', tujuan: 'Cikarang', service: 'Reguler', tkbm: '', asuransi: '', h: { CDE: 450000 }, ket: '' }]; window.ISLFL.sinkron(e); window.__qt.gambar(); }); await tunggu(p, 400); await klikSel(p, '[data-qt="tandai-kirim"]'); await tunggu(p, 600); }],
  ['quotation: formulir Distribusi (grid terisi, kolom aktif, panel baris dan pengaturan unit)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'distribusi_kecil'); await p.evaluate(() => { const e = window.__qt._Q.edit, st = e.formLini.s, mk = (t, s, i, tk) => ({ asal: 'Jakarta (Gudang Marunda)', tujuan: t, service: s, tkbm: tk, asuransi: '', h: { CDE: 450000 + i * 50000, CDD: i === 2 ? '' : 650000 + i * 50000, 'Blind Van': 380000 + i * 40000 }, ket: '' }); st.bodies.boxdry = { on: true, skema: 'tetap', rows: [mk('Cikarang', 'Reguler', 0, 'Termasuk'), mk('Karawang', 'Reguler', 1, ''), mk('Bogor', 'Express', 2, '')] }; window.ISLFL.sinkron(e); window.__qt.gambar(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }); await tunggu(p, 400); await klikSel(p, '.fl-dsb__hc:nth-child(5)'); await tunggu(p, 300); await klikSel(p, '[data-fla="min-buka"]'); await tunggu(p, 300); await klikSel(p, '[data-fla="dsbPanel"][data-flx="ubah"]'); await tunggu(p, 200); await klikSel(p, '[data-fla="dsbPanel"][data-flx="unit"]'); await tunggu(p, 300); }],
  ['quotation: Distribusi blok A, B, C (tab huruf, ringkasan terbuka, panel + Blok)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'distribusi_kecil'); await p.evaluate(() => { const e = window.__qt._Q.edit, st = e.formLini.s; st.bodies.boxdry = { on: true, skema: 'tetap', rows: [{ asal: 'Cikarang', tujuan: 'Bekasi', service: 'Reguler', tkbm: '', asuransi: '', h: { CDE: 500000 }, ket: '' }] }; st.bodies.reefer = { on: true, urut: 1, skema: 'pasangan', judul: 'Reefer antar kota', rows: [{ asal: 'Jakarta', tujuan: 'Bandung', service: 'Express', tkbm: '', asuransi: '', h: { CDD: 1250000 }, ket: '' }] }; window.ISLFL.sinkron(e); window.__qt.gambar(); document.querySelectorAll('details').forEach(d => { d.open = true; }); }); await tunggu(p, 400); await klikSel(p, '[data-fla="dsbPanel"][data-flx="ubah"]'); await tunggu(p, 300); await klikSel(p, '[data-fla="blokBuka"]'); await tunggu(p, 300); }],
  ['quotation: formulir Sewa Unit', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'sewa_unit'); }],
  ['quotation: formulir Gudang PLB', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'gudang_plb'); }],
  ['quotation: formulir Open Yard', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'open_yard'); }],
  ['quotation: formulir Sewa Container', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'sewa_container_empty'); }],
  ['quotation: formulir Freight Forwarding', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'freight_forwarding'); }],
  ['quotation: dok aksi terbuka (HP)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await klikSel(p, '#qt-bar [data-bar="toggle"]'); await tunggu(p, 250); }],
  ['quotation: pratinjau dokumen', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await p.evaluate(() => { const e = document.querySelector('[data-fl="rows.0.0.h20"]'); if (e) { e.value = '45000'; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await klikSel(p, '[data-qt="pratinjau"]'); await tunggu(p, 2500); }],
  ['quotation: dialog terbit (periksa S&K)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await p.evaluate(() => { const s = (i, v) => { const e = document.getElementById(i); if (e) e.value = v; }; s('qt-nama', 'PT Sinar Makmur Abadi'); s('qt-judul', 'Uji'); s('qt-pic', 'Budi'); const e = document.querySelector('[data-fl="rows.0.0.h20"]'); if (e) { e.value = '45000'; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await klikSel(p, '[data-qt="tandai-kirim"]'); await tunggu(p, 600); }],
  ['quotation: pengaturan dokumen', async p => { await pindah(p, 'quotation'); await bukaPengaturan(p); }],
  ['quotation: panel template lini (Depo, S&K)', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'tnc'; document.body.appendChild(b); b.click(); b.remove(); }); await tunggu(p, 500); }],
  ['quotation: panel template lini (CC, layanan)', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'customs_clearance'; b.dataset.tab = 'layanan'; document.body.appendChild(b); b.click(); b.remove(); }); await tunggu(p, 500); }],
  ['quotation: panel template lini (Depo, harga rekomendasi)', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'rek'; document.body.appendChild(b); b.click(); b.remove(); }); await tunggu(p, 500); }],
  ['quotation: panel template lini (Depo, tarif minimum)', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'depo'; b.dataset.tab = 'min'; document.body.appendChild(b); b.click(); b.remove(); }); await tunggu(p, 500); }],
  ['quotation: dialog terbit (tarif Depo belum diisi)', async p => { await pindah(p, 'quotation'); await bukaDraf(p, 'depo'); await p.evaluate(() => { window.ISLFL.konfirmasiKosong(window.__qt._Q.edit); }); await tunggu(p, 400); }],
  ['quotation: panel template lini (Trailer, saklar tarif minimum)', async p => { await pindah(p, 'quotation'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.qt = 'atur-template'; b.dataset.lini = 'trucking_trailer'; b.dataset.tab = 'layanan'; document.body.appendChild(b); b.click(); b.remove(); }); await tunggu(p, 500); }],
  ['customer: daftar', async p => { await pindah(p, 'customer'); }],
  ['customer: profil', async p => { await pindah(p, 'customer'); await klikSel(p, '[data-cu="buka"]'); await tunggu(p, 600); }],
  ['customer: form tambah', async p => { await pindah(p, 'customer'); await fab(p); await tunggu(p, 600); }],
  ['master rate', async p => { await pindah(p, 'master-rate'); await tunggu(p, 800); }],
  ['master rate: form tambah tarif', async p => { await pindah(p, 'master-rate'); await tunggu(p, 600); await klikTeks(p, 'tambah'); await tunggu(p, 700); }],
  ['lembar rekap', async p => { await pindah(p, 'rekap'); await tunggu(p, 600); }],
  ['laporan order dan laba', async p => { await pindah(p, 'laporan'); await tunggu(p, 600); }],
  ['dashboard performa', async p => { await pindah(p, 'performa'); await tunggu(p, 600); }],
  ['notifikasi', async p => { await pindah(p, 'beranda'); await klikSel(p, '[aria-label*="otif"], .nf-lonceng, #nf-btn'); await tunggu(p, 400); }],

  ['quotation: semua bagian pengaturan dokumen', async (p, periksa) => {
    await pindah(p, 'quotation'); await bukaPengaturan(p);
    const seksi = await p.evaluate(() => [...document.querySelectorAll('[data-qt="pg-buka"]')].map(b => b.dataset.seksi));
    for (const k of seksi) { await p.evaluate(kk => { const b = document.querySelector(`[data-qt="pg-buka"][data-seksi="${kk}"]`); if (b) b.click(); }, k); await tunggu(p, 300); await periksa('pengaturan dokumen: ' + k); await klikSel(p, '[data-qt="pg-daftar-bagian"]'); await tunggu(p, 150); }
    return 'sudah';
  }],
  ['quotation: mode baca (Terkirim) dan dokumen terbit', async (p, periksa) => {
    await pindah(p, 'quotation'); const id = await buatTerkirim(p); await p.evaluate(i => { window.__qt._Q.view = 'list'; window.__qt.gambar(); window.__qt.buka(i); }, id); await tunggu(p, 700); await periksa('quotation: mode baca (Terkirim)');
    await klikSel(p, '.qt-kepala-menu'); await tunggu(p, 500); await periksa('quotation: menu tindakan detail'); await tutupLapisan(p); await p.evaluate(i => { window.__qt.buka(i); }, id); await tunggu(p, 400);
    await klikSel(p, '[data-qt="lihat-dokumen"]'); await tunggu(p, 2500); await periksa('quotation: dokumen terbit (panel)'); await tutupLapisan(p);
    await p.evaluate(i => { window.__qt.buka(i); }, id); await tunggu(p, 500);
    for (const t of ['setuju', 'tolak', 'tidak dipakai', 'revisi', 'duplikat']) { if (await klikTeks(p, t, '[data-qt]')) { await tunggu(p, 500); await periksa('quotation: aksi ' + t); await tutupLapisan(p); await p.evaluate(i => { window.__qt.buka(i); }, id); await tunggu(p, 400); } }
    return 'sudah';
  }],
  ['quotation: isi modal (disetujui)', async (p, periksa) => {
    await pindah(p, 'quotation'); const id = await buatTerkirim(p);
    await p.evaluate(async i => { const Q = window.__qt._Q; await window.__qt._Repo.setujui(i, { appr: window.__ISL.hariIni(), sampai: null, bentuk: 'terpisah', dokNama: 'ttd.pdf', dokData: 'data:application/pdf;base64,JVBERi0xLjQK', koreksi: null }); Q.view = 'list'; window.__qt.gambar(); window.__qt.buka(i); }, id); await tunggu(p, 700); await periksa('quotation: disetujui (modal kosong)');
    await klikSel(p, '[data-qt="isi-modal"]'); await tunggu(p, 600); await periksa('quotation: formulir isi modal');
    await p.evaluate(() => { const v = document.querySelector('#im-vendor'); v.value = '__baru'; v.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#im-vb').value = 'CV Uji Vendor'; document.querySelector('[data-qt="im-simpan"]:not([data-lanjut])').click(); }); await tunggu(p, 1500); await periksa('quotation: setelah modal disimpan');
    await p.evaluate(() => { const q = window.__qt._Q; q.view = 'list'; q.sub = 'daftar'; window.__qt.gambar(); }); await tunggu(p, 500); await periksa('quotation: daftar dengan lencana modal'); return 'sudah';
  }],
  ['quotation: daftar dengan data, filter, menu', async (p, periksa) => {
    await pindah(p, 'quotation'); await buatTerkirim(p); await p.evaluate(() => { window.__qt._Q.view = 'list'; window.__qt.gambar(); }); await tunggu(p, 500); await periksa('quotation: daftar berisi');
    for (const a of ['m-ringkas', 'm-filter', 'm-menu']) { if (await klikSel(p, `[data-qt="${a}"]`)) { await tunggu(p, 400); await periksa('quotation: ' + a); await tutupLapisan(p); } }
    return 'sudah';
  }],
  ['quotation: panel format baru, dari template, dari rate', async (p, periksa) => {
    await pindah(p, 'quotation'); await fab(p); await tunggu(p, 400);
    if (await klikSel(p, '[data-qt="format-baru"]')) { await tunggu(p, 500); await periksa('quotation: tambah format lini baru'); await tutupLapisan(p); }
    for (const a of ['baru-dari-tmpl', 'baru-dari-rate', 'buka-template-lini']) { await pindah(p, 'quotation'); if (await klikSel(p, `[data-qt="${a}"]`)) { await tunggu(p, 500); await periksa('quotation: ' + a); await tutupLapisan(p); } }
    return 'sudah';
  }],
  ['toast semua jenis', async (p, periksa) => { await pindah(p, 'beranda'); await p.evaluate(() => { const t = window.__islCU && window.__islCU.toast; if (t) { t('Tersimpan dan terverifikasi.'); t('Peringatan contoh yang cukup panjang untuk dibaca di layar kecil.', 'peringatan'); t('Gagal menyimpan contoh.', 'bahaya'); } }); await tunggu(p, 400); }],
  ['customer: semua tab profil', async (p, periksa) => {
    await pindah(p, 'customer'); await klikSel(p, '[data-cu="buka"]'); await tunggu(p, 600);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-cu="tab"]')].map(b => b.dataset.tab || b.textContent.trim()));
    for (let i = 0; i < tabs.length; i++) { await p.evaluate(n => { const b = [...document.querySelectorAll('[data-cu="tab"]')][n]; if (b) b.click(); }, i); await tunggu(p, 400); await periksa('customer: tab ' + tabs[i]); }
    if (await klikSel(p, '[data-cu="tambah-rate"]')) { await tunggu(p, 600); await periksa('customer: panel tambah rate'); await tutupLapisan(p); }
    return 'sudah';
  }],
  ['customer: semua tahap form', async (p, periksa) => {
    await pindah(p, 'customer'); await fab(p); await tunggu(p, 600);
    const n = await p.evaluate(() => document.querySelectorAll('[data-cu="cf-tahap"]').length);
    for (let i = 0; i < n; i++) { await p.evaluate(k => { const b = [...document.querySelectorAll('[data-cu="cf-tahap"]')][k]; if (b) b.click(); }, i); await tunggu(p, 350); await periksa('customer: form tahap ' + (i + 1)); }
    return 'sudah';
  }],
  ['master rate: semua tab dan form', async (p, periksa) => {
    await pindah(p, 'master-rate'); await tunggu(p, 800);
    const n = await p.evaluate(() => document.querySelectorAll('[data-aksi="tab"]').length);
    for (let i = 0; i < n; i++) { await p.evaluate(k => { const b = [...document.querySelectorAll('[data-aksi="tab"]')][k]; if (b) b.click(); }, i); await tunggu(p, 700); await periksa('master rate: tab ' + (i + 1)); if (await fab(p)) { await tunggu(p, 600); await periksa('master rate: form tambah tab ' + (i + 1)); await tutupLapisan(p); } }
    await p.evaluate(() => { const b = document.querySelector('[data-aksi="tab"]'); if (b) b.click(); }); await tunggu(p, 500);
    for (const a of ['m-ringkas', 'm-filter', 'm-menu', 'm-pilih-mode', 'edit', 'riwayat']) { if (await klikSel(p, `[data-aksi="${a}"]`)) { await tunggu(p, 500); await periksa('master rate: ' + a); await tutupLapisan(p); } }
    return 'sudah';
  }],
  ['laporan: semua tab', async (p, periksa) => { await pindah(p, 'laporan'); const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-tab]')].map(b => b.dataset.tab)); for (const t of tabs) { await klikSel(p, `[data-tab="${t}"]`); await tunggu(p, 500); await periksa('laporan: tab ' + t); } for (const i of [0, 1]) { await p.evaluate(k => { const b = [...document.querySelectorAll('[data-qt="menu-tambah"]')][k]; if (b) b.click(); }, i); await tunggu(p, 300); await periksa('laporan: menu ' + i); } return 'sudah'; }],
  ['rekap: menu', async (p, periksa) => { await pindah(p, 'rekap'); await tunggu(p, 500); await periksa('rekap'); for (const i of [0, 1]) { await p.evaluate(k => { const b = [...document.querySelectorAll('[data-qt="menu-tambah"]')][k]; if (b) b.click(); }, i); await tunggu(p, 300); await periksa('rekap: menu ' + i); } return 'sudah'; }],
  ['uang jalan: kalkulator, master rute, master driver, riwayat', async (p, periksa) => {
    await pindah(p, 'uang-jalan'); await tunggu(p, 900); await periksa('uang jalan: kalkulator kosong');
    const isi = (f, v) => p.evaluate(({ f, v }) => { const i = document.querySelector(`[data-uj="${f}"]`); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } }, { f, v });
    await klikSel(p, '[data-ujt="jenis"][data-x="mitra"]'); await tunggu(p, 250); await isi('ruteNama', 'Jakarta – Cikarang'); await isi('jarak', '120'); await isi('rasio', '5'); await isi('tol', '85.000'); await isi('ops', '50.000'); await isi('insentif', '75.000'); await tunggu(p, 250);
    await periksa('uang jalan: kalkulator terisi (mitra)');
    await klikSel(p, '[data-ujt="simpan"]'); await tunggu(p, 500); await klikSel(p, '[data-ujt="tab"][data-x="riwayat"]'); await tunggu(p, 300); await periksa('uang jalan: riwayat');
    await klikSel(p, '[data-ujt="tab"][data-x="rute"]'); await tunggu(p, 250); await klikSel(p, '[data-ujt="mtambah"][data-x="rute"]'); await tunggu(p, 300); await periksa('uang jalan: master rute (form)');
    await klikSel(p, '[data-ujt="tab"][data-x="driver"]'); await tunggu(p, 250); await klikSel(p, '[data-ujt="mtambah"][data-x="driver"]'); await tunggu(p, 250); await klikSel(p, '[data-ujt="mjenis"][data-x="mitra"]'); await tunggu(p, 300); await periksa('uang jalan: master driver (form mitra)');
    await klikSel(p, '[data-ujt="tab"][data-x="komp"]'); await tunggu(p, 250); await klikSel(p, '[data-ujt="mtambah"][data-x="komp"]'); await tunggu(p, 300); await periksa('uang jalan: komponen biaya (form)');
    return 'sudah';
  }],
  ['pengaturan (akun)', async p => { await pindah(p, 'pengaturan'); await tunggu(p, 700); }],
  ['menu lainnya (HP)', async p => { await pindah(p, 'beranda'); await klikTeks(p, 'lainnya', '.app-nav a,.app-nav button'); await tunggu(p, 400); }],
];

(async () => {
  const browser = await chromium.launch();
  const hp = LAYAR === 'hp';
  const ctx = await browser.newContext({ viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: hp, hasTouch: hp, colorScheme: TEMA === 'gelap' ? 'dark' : 'light' });
  const p = await ctx.newPage(), galat = [];
  p.on('pageerror', e => galat.push('PAGE ' + e.message.slice(0, 140)));
  await pasang(p, PUBLIK, { awal });
  await p.addInitScript(t => { try { localStorage.setItem('isl-tema', t); } catch (e) {} }, TEMA === 'gelap' ? 'gelap' : 'terang');
  await p.goto('http://isl.test/app.html#beranda'); await tunggu(p, 2500);
  const temaAktif = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const semua = [];
  let jmlAdegan = 0;
  const periksa = async label => { jmlAdegan++; const temuan = await p.evaluate(pindai, { tema: TEMA, ketat: KETAT }); temuan.forEach(t => semua.push({ adegan: label, ...t })); if (GAMBAR) await p.screenshot({ path: `${OUT}${TEMA}-${LAYAR}-${label.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: false }); };
  for (const [nama, fn] of ADEGAN) {
    let r; try { await tutupLapisan(p); r = await fn(p, periksa); } catch (e) { semua.push({ adegan: nama, jenis: 'adegan-gagal', el: String(e.message).slice(0, 100) }); continue; }
    if (r !== 'sudah') await periksa(nama);
  }
  console.log(`Tema ${TEMA}, layar ${LAYAR} (data-theme=${temaAktif}); adegan dipindai: ${jmlAdegan}; galat halaman: ${galat.length}`);
  galat.slice(0, 5).forEach(g => console.log('  !', g));
  const peta = new Map();
  semua.forEach(t => { const k = t.jenis + ' | ' + t.el; if (!peta.has(k)) peta.set(k, { ...t, adegan: [t.adegan] }); else peta.get(k).adegan.push(t.adegan); });
  [...peta.values()].forEach(t => console.log(`- [${t.jenis}] ${t.el}${t.warna ? ' ' + t.warna : ''}${t.latar ? ' di ' + t.latar : ''}${t.ukuran ? ' ' + t.ukuran : ''}${t.rasio ? ' rasio ' + t.rasio : ''} "${t.teks || ''}"  <- ${t.adegan.slice(0, 3).join('; ')}${t.adegan.length > 3 ? ' +' + (t.adegan.length - 3) : ''}`));
  console.log(`Total temuan unik: ${peta.size}`);
  await browser.close();
  process.exit(peta.size ? 1 : 0);
})();
