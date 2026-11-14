// Audit tema (terang/gelap) Daily Job di HP dan desktop: dashboard, daftar, filter, detail, form, panel, dan halaman publik.
// Data job diisi di sini saja (tidak menambah ke data-contoh.js). Jalankan: node tests/audit/audit-daily-job.js [gelap|terang] [hp|desktop] [--ketat] [--gambar]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const { pasang } = require('./firebase-tiruan.js'); const { awal } = require('./data-contoh.js'); const pindai = require('./pindai-tema.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const argv = process.argv.slice(2), TEMA = argv.find(a => /^(gelap|terang)$/.test(a)) || 'gelap', LAYAR = argv.find(a => /^(hp|desktop)$/.test(a)) || 'hp', GAMBAR = argv.includes('--gambar'), KETAT = argv.includes('--ketat');
const OUT = process.env.AUDIT_OUT || '/tmp/audit/'; if (GAMBAR) fs.mkdirSync(OUT, { recursive: true });
const tunggu = (p, ms = 350) => p.waitForTimeout(ms);
const klikSel = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (e) { e.click(); return true; } return false; }, sel);
const hari = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* data uji: delapan job dengan PIC, kategori, dan posisi yang beragam; satu bagikan aktif untuk halaman publik */
const J = (id, k, pic, st, m, t, s) => [id, { kelompokId: 'k1', judul: 'Job ' + id + ' ' + k, kategori: k, pic, customer: 'PT X', status: st, tglMasuk: hari(m), tglTarget: t == null ? null : hari(t), tglSelesai: s == null ? null : hari(s), bobot: 2, file: [], tautan: [], catatan: [] }];
const DJ = Object.fromEntries([J('a', 'Quotation', 'Ega', 'selesai', -5, -2, -2), J('c', 'DSR Projek', 'Dede', 'proses', -3, -1), J('d', 'Monitoring Kasus', 'Ega', 'proses', -2, 0), J('e', 'RFQ', 'Fathur', 'baru', -1, 3), J('f', 'Quotation', 'Ega', 'tunggu', -9, 6), J('g', 'Dokumen Kontrak', 'Dede', 'proses', -12, -8), J('h', 'Dokumen Kontrak', 'Dede', 'baru', -6, null), J('i', 'Quotation', 'Dede', 'proses', -2, -3)]);
const DATA = () => ({ ...JSON.parse(JSON.stringify(awal)), dj_kelompok: { k1: { nama: 'Marketing dan BD' } }, dj_job: DJ, dj_bagikan: { tokenAudit0000000000000000: { jobId: 'a', kelompokId: 'k1', aktif: true, berlakuSampai: Date.now() + 6 * 864e5, unduh: false, snapshot: { judul: 'Job a Quotation', kategori: 'Quotation', pic: 'Ega', status: 'selesai', tglMasuk: hari(-5), tglTarget: hari(-2), tglSelesai: hari(-2), file: [], tautan: [], catatan: [] } } } });

/* adegan: tiap entri mengubah tampilan lalu memanggil periksa(label) */
const ADEGAN = [
  ['dj: dashboard performa', async (p) => { await tunggu(p, 500); }],
  ['dj: filter (panel)', async (p) => { await klikSel(p, '[data-dj="filter"]'); await tunggu(p, 400); }],
  ['dj: daftar job (perlu tindakan)', async (p) => { await klikSel(p, '[data-dj="tab"][data-v="job"]'); await tunggu(p, 400); }],
  ['dj: daftar, kelompok status (panel filter)', async (p) => { await klikSel(p, '[data-dj="filter"]'); await tunggu(p, 300); await klikSel(p, '#mr-layer [data-dj="kel-mode"][data-v="status"]'); await tunggu(p, 300); }],
  ['dj: daftar, pilih semua (bilah aksi)', async (p) => { await klikSel(p, '[data-dj="cb-semua"]'); await tunggu(p, 300); }],
  ['dj: detail job', async (p) => { await klikSel(p, '[data-dj="buka"]'); await tunggu(p, 600); }],
  ['dj: detail, panel ubah target', async (p) => { await klikSel(p, '[data-dj="d-target"]'); await tunggu(p, 400); }],
  ['dj: detail, panel bagikan', async (p) => { await klikSel(p, '[data-dj="a-bagikan"]'); await tunggu(p, 400); }],
  ['dj: form catat job baru', async (p) => { await klikSel(p, '[data-dj="baru"]'); await tunggu(p, 500); }],
  ['dj: form catat, status tertunda (alasan)', async (p) => { await p.evaluate(() => { const s = document.getElementById('djf-status'); if (s) { s.value = 'tunggu'; s.dispatchEvent(new Event('change', { bubbles: true })); } }); await tunggu(p, 300); }],
  ['dj: panel impor Excel', async (p) => { await klikSel(p, '[data-aksi="impor"]'); await tunggu(p, 500); }],
  ['dj: tab kelompok', async (p) => { await klikSel(p, '[data-dj="tab"][data-v="kelompok"]'); await tunggu(p, 500); }],
];

(async () => {
  const browser = await chromium.launch();
  const hp = LAYAR === 'hp';
  const ctx = await browser.newContext({ viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: hp, hasTouch: hp, colorScheme: TEMA === 'gelap' ? 'dark' : 'light' });
  const p = await ctx.newPage(), galat = [];
  let adegan = 'awal'; p.on('pageerror', e => galat.push(adegan + ' | ' + e.message.slice(0, 140) + ' | ' + ((e.stack || '').split('\n')[1] || '').trim().slice(0, 160)));
  await pasang(p, PUBLIK, { awal: DATA() });
  await p.addInitScript(t => { try { localStorage.setItem('isl-tema', t); } catch (e) {} }, TEMA === 'gelap' ? 'gelap' : 'terang');
  await p.goto('http://isl.test/app.html#dailyjob'); await p.waitForSelector('#dj-dash', { timeout: 10000 }); await p.evaluate(() => document.getElementById('dj-ingat')?.remove()); await tunggu(p, 800);
  const semua = []; let n = 0;
  const periksa = async label => { n++; const temuan = await p.evaluate(pindai, { tema: TEMA, ketat: KETAT }); temuan.forEach(t => semua.push({ adegan: label, ...t })); if (GAMBAR) await p.screenshot({ path: `${OUT}dj-${TEMA}-${LAYAR}-${label.replace(/[^a-z0-9]+/gi, '_')}.png` }); };
  await periksa('dj: dashboard performa');
  for (const [nama, fn] of ADEGAN.slice(1)) {
    adegan = nama;
    try { await fn(p); } catch (e) { semua.push({ adegan: nama, jenis: 'adegan-gagal', el: String(e.message).slice(0, 100) }); continue; }
    await periksa(nama);
    await p.evaluate(() => { document.querySelectorAll('[data-aksi="tutup-layer"]').forEach(b => b.click()); document.querySelectorAll('.mr-konfirm [data-x="batal"]').forEach(b => b.click()); }); await tunggu(p, 250);
  }
  // halaman publik (tanpa login) untuk tautan bagikan
  const c2 = await browser.newContext({ viewport: ctx._options?.viewport || { width: 390, height: 844 }, colorScheme: TEMA === 'gelap' ? 'dark' : 'light', isMobile: hp, hasTouch: hp });
  const q = await c2.newPage(); await pasang(q, PUBLIK, { awal: DATA(), email: 'anon@x.test' });
  await q.addInitScript(t => { try { localStorage.setItem('isl-tema', t); } catch (e) {} }, TEMA === 'gelap' ? 'gelap' : 'terang');
  await q.goto('http://isl.test/job.html?t=tokenAudit0000000000000000'); await q.waitForSelector('.dj-dt, .jp__pesan', { timeout: 8000 }).catch(() => {}); await tunggu(q, 500);
  n++; const tp = await q.evaluate(pindai, { tema: TEMA, ketat: KETAT }); tp.forEach(t => semua.push({ adegan: 'dj: halaman publik (tautan bagikan)', ...t }));
  await c2.close();
  console.log(`Daily Job, tema ${TEMA}, layar ${LAYAR}: ${n} tampilan dipindai; galat halaman: ${galat.length}`);
  galat.slice(0, 5).forEach(g => console.log('  !', g));
  const peta = new Map();
  semua.forEach(t => { const k = t.jenis + ' | ' + t.el; if (!peta.has(k)) peta.set(k, { ...t, adegan: [t.adegan] }); else peta.get(k).adegan.push(t.adegan); });
  [...peta.values()].forEach(t => console.log(`- [${t.jenis}] ${t.el}${t.warna ? ' ' + t.warna : ''}${t.latar ? ' di ' + t.latar : ''}${t.ukuran ? ' ' + t.ukuran : ''}${t.rasio ? ' rasio ' + t.rasio : ''} "${t.teks || ''}"  <- ${t.adegan.slice(0, 3).join('; ')}`));
  console.log(`Total temuan unik: ${peta.size}`);
  await browser.close();
  process.exit(peta.size ? 1 : 0);
})();
