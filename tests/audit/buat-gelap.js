// Pembuat daftar override tema gelap untuk aturan CSS yang menulis warna LATAR TERANG secara langsung (bukan variabel tema).
// Membaca aturan CSS asli lewat CSSOM, lalu mencetak CSS siap tempel (stdout) atau menulis ke berkas: node tests/audit/buat-gelap.js [berkas-keluaran]
// Hasilnya diperiksa manual lalu disimpan sebagai public/css/tema-gelap.css. Aturan kertas dokumen (pratinjau PDF, tanda tangan) tidak disentuh.
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const { pasang } = require('./firebase-tiruan.js'); const { awal } = require('./data-contoh.js');
const PUBLIK = path.join(__dirname, '..', '..', 'public') + path.sep;
const KECUALI = /(\.isl-|\.qt-pv|\.cu-lembar|\.cu-prev|\.pf-ttd|\.qt-aset__p|\.lp[\s.:,>#\[{-]|\.lp$|\.login|\.portal|:root|html|\.qt-switch|\.qt-sw\b)/;
(async () => {
  const browser = await chromium.launch(); const p = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  await pasang(p, PUBLIK, { awal }); await p.goto('http://isl.test/app.html#beranda'); await p.waitForTimeout(1500);
  const hasil = await p.evaluate((kec) => {
    const KEC = new RegExp(kec);
    const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const a = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const hsl = c => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s: s * 100, l: l * 100 }; };
    const dariLatar = c => { const x = hsl(c); if (x.s < 14) return 'var(--surface)'; return `hsl(${Math.round(x.h)}, ${Math.round(Math.min(x.s * 0.55, 38))}%, ${x.l > 93 ? 15 : 18}%)`; };
    const dariTeks = c => { const x = hsl(c); return `hsl(${Math.round(x.h)}, ${Math.round(Math.min(x.s, 45))}%, 82%)`; };
    const sudah = new Set(); const out = [];
    const semua = []; const jalan = (rs, media) => { for (const r of rs) { if (r.type === 1) semua.push([r, media]); else if (r.type === 4) jalan(r.cssRules, r.conditionText); else if (r.cssRules && r.type !== 3) jalan(r.cssRules, media); } };
    for (const sh of document.styleSheets) { if (!/\/css\/(style|master-rate|app|tambahan)\.css/.test(sh.href || '')) continue; let rs; try { rs = sh.cssRules; } catch (e) { continue; } jalan(rs, ''); }
    semua.forEach(([r]) => { if (/data-theme="dark"/.test(r.selectorText)) r.selectorText.split(',').forEach(s => sudah.add(s.replace(/:root(:not\(\[data-theme="light"\]\)|\[data-theme="dark"\])\s*/g, '').trim())); });
    semua.forEach(([r, media]) => {
      const sel = r.selectorText; if (!sel || /data-theme|prefers-color/.test(sel) || KEC.test(sel) || /prefers-color-scheme/.test(media || '')) return;
      if (sel.split(',').every(s => sudah.has(s.trim()))) return;
      const st = r.style, d = [];
      const bg = parse(st.backgroundColor); let adaBg = false;
      if (bg && bg.a >= 0.9 && lum(bg) > 0.78) { d.push(`background: ${dariLatar(bg)}`); adaBg = true; }
      const tc = parse(st.color);
      if (adaBg && tc && lum(tc) < 0.35) d.push(`color: ${dariTeks(tc)}`);
      else if (adaBg && !st.color) { /* teks mewarisi: tema gelap sudah terang */ }
      const bc = ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'].map(k => parse(st[k])).find(Boolean);
      if (bc && bc.a >= 0.9 && lum(bc) > 0.7) d.push('border-color: var(--border)');
      if (d.length) out.push({ sel, media: media || '', d, asli: st.cssText.slice(0, 140) });
    });
    return out;
  }, KECUALI.source);
  await browser.close();
  const per = (sel, pre) => sel.split(',').map(s => pre + ' ' + s.trim()).join(',\n');
  let css = `/* ISL HUB — tema gelap untuk komponen yang menulis warna latar terang secara langsung.\n   Dibuat dengan tests/audit/buat-gelap.js dari aturan CSS asli, lalu diperiksa. Tema terang tidak terpengaruh.\n   Kertas dokumen (pratinjau PDF, tanda tangan) sengaja tetap putih. */\n`;
  const blok = (pre) => hasil.map(h => { const isi = `${per(h.sel, pre)} { ${h.d.join('; ')}; }`; return h.media ? `@media ${h.media} {\n${isi}\n}` : isi; }).join('\n');
  css += `@media (prefers-color-scheme: dark) {\n${hasil.filter(h => !h.media).map(h => `${per(h.sel, ':root:not([data-theme="light"])')} { ${h.d.join('; ')}; }`).join('\n')}\n}\n`;
  css += `${hasil.filter(h => !h.media).map(h => `${per(h.sel, ':root[data-theme="dark"]')} { ${h.d.join('; ')}; }`).join('\n')}\n`;
  const bermedia = hasil.filter(h => h.media);
  bermedia.forEach(h => { css += `@media ${h.media} { @media (prefers-color-scheme: dark) { ${per(h.sel, ':root:not([data-theme="light"])')} { ${h.d.join('; ')}; } } }\n@media ${h.media} { ${per(h.sel, ':root[data-theme="dark"]')} { ${h.d.join('; ')}; } }\n`; });
  const out = process.argv[2]; if (out) { fs.writeFileSync(out, css); console.error(`ditulis ${out}: ${hasil.length} aturan`); }
  hasil.forEach(h => console.error(`${h.media ? '[' + h.media + '] ' : ''}${h.sel.slice(0, 80)}  =>  ${h.d.join('; ')}   (asli: ${h.asli.slice(0, 70)})`));
})();
