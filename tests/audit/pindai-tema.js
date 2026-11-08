// Pemindai konsistensi tema (dijalankan DI DALAM halaman lewat page.evaluate).
// Tema gelap: melaporkan area berlatar TERANG yang tidak sengaja. Tema terang: area berlatar GELAP yang tidak sengaja.
// Selain itu melaporkan teks yang hampir tidak terbaca (kontras rendah terhadap latar efektifnya).
// Dikecualikan: pratinjau dokumen (kertas A4 memang putih), gambar, tombol utama, bilah navigasi, dan elemen yang sengaja diberi data-tema-tetap.
module.exports = function pindai({ tema, ketat }) {
  const gelap = tema === 'gelap';
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  /* latar efektif; bila ada gradasi/gambar di rantai induk, warna latar tidak bisa dipastikan (null) dan kontras tidak diperiksa */
  const efektif = el => { const rantai = []; for (let e = el; e; e = e.parentElement) rantai.push(e); let bg = { r: gelap ? 14 : 243, g: gelap ? 22 : 247, b: gelap ? 34 : 251, a: 1 }; for (let i = rantai.length - 1; i >= 0; i--) { const cs = getComputedStyle(rantai[i]); if (cs.backgroundImage !== 'none') return null; const c = parse(cs.backgroundColor); if (c && c.a > 0) bg = over(c, bg); } return bg; };
  const KECUALI = '.app-nav,.nav-lain,.isl-page,.isl-host,.qt-pv-hal,.cu-lembar,.cu-prev__pdf,img,svg,canvas,video,iframe,[data-tema-tetap],.qt-aset__p,.pf-ttd,.mr-vbadge i';
  const nama = el => { const p = []; for (let e = el; e && p.length < 4 && e !== document.body; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return p.join(' > '); };
  const hasil = [], lihat = new Set();
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest(KECUALI) || el.matches('.login-screen,.portal')) return; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
    const c = parse(cs.backgroundColor);
    if (c && c.a >= 0.85 && r.width * r.height >= (ketat ? 300 : 600)) {
      const L = lum(c);
      const sat = (() => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; })();
      /* ketat: latar terang menengah yang netral/pastel (bukan warna aksen pekat seperti tombol oranye/biru) juga dilaporkan */
      const terangSalah = gelap ? (L > 0.55 || (ketat && L > 0.30 && sat < 0.45)) : (L < 0.04 || (ketat && L < 0.09 && sat < 0.45));
      if (terangSalah) { const k = nama(el); if (!lihat.has('B' + k)) { lihat.add('B' + k); hasil.push({ jenis: gelap ? 'latar-terang' : 'latar-gelap', el: k, warna: cs.backgroundColor, ukuran: Math.round(r.width) + 'x' + Math.round(r.height), teks: (el.innerText || '').trim().slice(0, 40) }); } }
    }
    // kontras teks: hanya elemen yang memuat teks langsung
    const adaTeks = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (adaTeks) {
      const f = parse(cs.color); if (!f) return; const bg = efektif(el); if (!bg) return; const fg = over(f, bg), L1 = lum(fg), L2 = lum(bg), rasio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (rasio < (ketat ? 3 : 2.2)) { const k = nama(el); if (!lihat.has('T' + k)) { lihat.add('T' + k); hasil.push({ jenis: 'kontras-rendah', el: k, rasio: +rasio.toFixed(2), warna: cs.color, latar: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, teks: (el.innerText || '').trim().slice(0, 40) }); } }
    }
  });
  return hasil;
};
