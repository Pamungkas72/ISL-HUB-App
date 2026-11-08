// Audit tema untuk halaman di luar alur akun pemilik: halaman login (termasuk daftar dan lupa sandi), layar "menunggu persetujuan",
// dan aplikasi untuk akun berperan sales dan admin. Pemindai dan Firebase tiruan sama dengan audit-tema.js.
// Jalankan: NODE_PATH=<folder node_modules berisi playwright> node tests/audit/audit-halaman-lain.js [gelap|terang] [hp|desktop] [--gambar]
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const { pasang } = require('./firebase-tiruan.js'); const { awal } = require('./data-contoh.js'); const pindai = require('./pindai-tema.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const argv = process.argv.slice(2), TEMA = argv.find(a => /^(gelap|terang)$/.test(a)) || 'gelap', LAYAR = argv.find(a => /^(hp|desktop)$/.test(a)) || 'hp', GAMBAR = argv.includes('--gambar'), KETAT = argv.includes('--ketat');
const OUT = process.env.AUDIT_OUT || '/tmp/audit/'; if (GAMBAR) fs.mkdirSync(OUT, { recursive: true });
const tunggu = (p, ms = 400) => p.waitForTimeout(ms);
const klikTeks = (p, teks, sel = 'button,a,[role=button],summary,label') => p.evaluate(({ teks, sel }) => { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent !== null && (x.textContent || '').trim().toLowerCase().includes(teks.toLowerCase())); if (e) { e.click(); return true; } return false; }, { teks, sel });

async function konteks(browser, { email, awalData, mulai }) {
  const hp = LAYAR === 'hp';
  const ctx = await browser.newContext({ viewport: hp ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: hp, hasTouch: hp, colorScheme: TEMA === 'gelap' ? 'dark' : 'light' });
  const p = await ctx.newPage(), galat = [];
  p.on('pageerror', e => galat.push(e.message.slice(0, 120)));
  await pasang(p, PUBLIK, { email, awal: awalData || awal });
  if (!email) await p.addInitScript(() => { window.__USER = null; });
  await p.addInitScript(t => { try { localStorage.setItem('isl-tema', t); } catch (e) {} }, TEMA);
  await p.goto('http://isl.test/' + mulai); await tunggu(p, 2200);
  return { p, galat };
}

(async () => {
  const browser = await chromium.launch(); const semua = []; let n = 0;
  const periksa = async (p, label) => { n++; (await p.evaluate(pindai, { tema: TEMA, ketat: KETAT })).forEach(t => semua.push({ adegan: label, ...t })); if (GAMBAR) await p.screenshot({ path: `${OUT}lain-${TEMA}-${LAYAR}-${label.replace(/[^a-z0-9]+/gi, '_')}.png` }); };

  // 1. halaman login
  { const { p } = await konteks(browser, { email: null, mulai: 'index.html' });
    await periksa(p, 'login');
    if (LAYAR === 'desktop') { await klikTeks(p, 'masuk ke isl hub'); await tunggu(p, 600); await periksa(p, 'login: form masuk (pop-up)'); }
    for (const t of ['daftar', 'lupa']) { if (await klikTeks(p, t)) { await tunggu(p, 400); await periksa(p, 'login: ' + t); } }
    await p.close(); }

  // 2. akun baru, belum disetujui (layar gerbang)
  { const { p } = await konteks(browser, { email: 'baru@isl.test', mulai: 'app.html#quotation' }); await periksa(p, 'gerbang: menunggu persetujuan'); await p.close(); }

  // 3. akun sales dan admin aktif
  for (const peran of ['sales', 'admin']) {
    const data = JSON.parse(JSON.stringify(awal)); data.pengguna['u-' + peran + '1'] = { email: peran + '1@isl.test', nama: peran === 'sales' ? 'Sari Sales' : 'Adi Admin', peran, status: 'aktif' };
    const { p, galat } = await konteks(browser, { email: peran + '1@isl.test', awalData: data, mulai: 'app.html#quotation' });
    await periksa(p, peran + ': quotation daftar');
    await p.evaluate(() => { window.__qt.baru('c1'); window.ISLFL.terapkanAwal(window.__qt._Q.edit, 'depo'); window.__qt.gambar(); }); await tunggu(p, 500); await periksa(p, peran + ': formulir Depo');
    await p.evaluate(() => { const i = document.querySelector('[data-fl="rows.1.0.h20"]'); i && (i.value = '90000') && i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.evaluate(() => { location.hash = '#performa'; }); await tunggu(p, 900); await periksa(p, peran + ': dashboard performa');
    await p.evaluate(() => { location.hash = '#customer'; }); await tunggu(p, 900); await periksa(p, peran + ': customer');
    if (galat.length) semua.push({ adegan: peran, jenis: 'galat-halaman', el: galat[0] });
    await p.close();
  }
  await browser.close();
  console.log(`Tema ${TEMA}, layar ${LAYAR}: ${n} tampilan lain dipindai`);
  const peta = new Map(); semua.forEach(t => { const k = t.jenis + ' | ' + t.el; if (!peta.has(k)) peta.set(k, { ...t, adegan: [t.adegan] }); else peta.get(k).adegan.push(t.adegan); });
  [...peta.values()].forEach(t => console.log(`- [${t.jenis}] ${t.el}${t.warna ? ' ' + t.warna : ''}${t.latar ? ' di ' + t.latar : ''}${t.rasio ? ' rasio ' + t.rasio : ''} "${t.teks || ''}"  <- ${t.adegan.slice(0, 3).join('; ')}`));
  console.log(`Total temuan unik: ${peta.size}`);
  process.exit(peta.size ? 1 : 0);
})();
