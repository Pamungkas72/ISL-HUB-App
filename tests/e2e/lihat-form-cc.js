// Tes HANYA-LIHAT form Customs Clearance di produksi: membuka editor quotation baru di memori, TIDAK menyimpan apa pun.
// Mencetak struktur blok dan item, status template, kolom batas, lalu mengambil screenshot.
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
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const galat = [];
  p.on('pageerror', e => galat.push('PAGE ' + e.message));
  try {
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.click('#portal-masuk');
    await p.fill('#email', email);
    await p.fill('#password', pass);
    await p.click('#btn-submit');
    await p.waitForURL(/app\.html/, { timeout: 45000 });
    await p.goto(BASE + '/app.html#quotation', { waitUntil: 'load' });
    await p.setViewportSize({ width: 430, height: 1000 });
    let siap = false;
    for (let i = 0; i < 60 && !siap; i++) {
      siap = await p.evaluate(() => !!(window.__qt && window.__qt.baru && window.ISLFL && window.ISLTemplate));
      if (!siap) await p.waitForTimeout(1000);
    }
    if (!siap) throw new Error('Modul quotation tidak siap setelah 60 detik');
    await p.waitForTimeout(3000);

    const info = await p.evaluate(() => {
      const T = window.ISLTemplate;
      return { templateAktif: T.tersimpan('customs_clearance'), barisTemplate: T.baris('customs_clearance').map(x => x.layananNama), versi: document.querySelector('script[src*="formulir-lini"]') ? 'ada' : '-' };
    });
    console.log('TEMPLATE_AKTIF', info.templateAktif);
    console.log('BARIS_TEMPLATE', JSON.stringify(info.barisTemplate));

    await p.evaluate(() => { window.__qt.baru(''); });
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const q = window.__qt; window.ISLFL.terapkanAwal(q._Q.edit, 'customs_clearance'); q.gambar(); });
    await p.waitForTimeout(2000);

    const hasil = await p.evaluate(() => {
      const root = document.getElementById('fl-root'); if (!root) return { ada: false };
      const baris = []; let blok = '';
      root.querySelectorAll('.fl-bagian--h, .fl-item').forEach(el => {
        if (el.classList.contains('fl-bagian--h')) { blok = el.textContent.trim(); baris.push('## ' + blok); }
        else baris.push((el.classList.contains('fl-item--baku') ? '   [BAKU] ' : '   ') + ((el.querySelector('b') || {}).textContent || '').trim());
      });
      const label = [...root.querySelectorAll('label.fl-f > span')].map(s => s.textContent.trim()).filter(t => /Batas|Port/.test(t));
      return { ada: true, baris, label };
    });
    console.log('FORM_CC_ADA', hasil.ada);
    if (hasil.ada) {
      console.log(hasil.baris.join('\n'));
      console.log('KOLOM_BATAS', JSON.stringify(hasil.label));
      const kg = await p.$$('#fl-root input[data-fl="info.batasKg"]');
      if (kg.length >= 2) {
        await kg[0].fill('70');
        const nilai = await p.evaluate(() => [...document.querySelectorAll('#fl-root input[data-fl="info.batasKg"]')].map(i => i.value));
        console.log('SINKRON_BATAS_KG', JSON.stringify(nilai));
      }
      const el = await p.$('#fl-root');
      await p.screenshot({ path: out + '/form-cc-atas.png' });
      await el.screenshot({ path: out + '/form-cc-penuh.png' });
    } else {
      await p.screenshot({ path: out + '/galat.png' });
    }
  } catch (e) {
    console.log('GAGAL', String(e.message).split('\n')[0]);
    await p.screenshot({ path: out + '/galat.png' }).catch(() => {});
  }
  console.log('GALAT_HALAMAN', JSON.stringify(galat.slice(0, 5)));
  await b.close();
})();
