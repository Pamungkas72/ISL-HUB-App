/* ==========================================================================
   PARSER S&K VENDOR (disepakati Ega, 19 Okt 2026)
   - S&K vendor ditempel dalam satu kotak, lalu dipecah otomatis (hibrida):
     1. per baris;
     2. jika satu baris berisi beberapa kalimat, per kalimat;
     3. angka seperti 1.1, 4.500, dan "Rp." tidak dianggap batas kalimat.
   - Tiap klausul ditebak jenis ceknya lewat POLA. Pola bawaan ada di sini; pola global
     bisa diubah di Master Rate (disimpan di Firestore sk_pola/global), dan tiap vendor
     bisa punya pola tambahan sendiri (field vendor.skPola).
   - Hasil yang dipecah per kalimat atau terlalu panjang ditandai "Perlu dicek".
   - Cek quotation: nilai vendor dibandingkan dengan S&K quotation -> sesuai / tidak sesuai / belum diisi.
   File ini skrip biasa (bukan modul) supaya dipakai Master Rate dan Quotation: window.ISLSK.
   ========================================================================== */
(function () {
  'use strict';
  const TIPE = { angka: 'Cek angka', pilihan: 'Cek pilihan', ada_tidak: 'Cek ada/tidak', info: 'Info saja' };
  const AMBIL = { angka: 'Angka', jam: 'Jam (17:00)', teks: 'Teks', ada: 'Ada (ya)', pihak: 'Pihak (customer / ISL)' };
  /* pola bawaan. key unik, pola = regex (huruf besar kecil diabaikan), grup pertama = nilai */
  const POLA_AWAL = [
    { key: 'ppn_persen', label: 'PPN (%)', pola: 'PPN\\s*([\\d.,]+)\\s*%', tipe: 'angka', ambil: 'angka', kategori: 'pajak' },
    { key: 'nbd_jam', label: 'Jam batas NBD', pola: 'NBD.*?(\\d{1,2}[:.]\\d{2})', tipe: 'pilihan', ambil: 'jam', kategori: 'order' },
    { key: 'faktor_volume_udara', label: 'Faktor volume udara', pola: 'volume\\s+udara.*?:\\s*([\\d.]+)', tipe: 'angka', ambil: 'angka', kategori: 'operasional' },
    { key: 'faktor_volume_darat', label: 'Faktor volume darat', pola: 'volume\\s+darat.*?:\\s*([\\d.]+)', tipe: 'angka', ambil: 'angka', kategori: 'operasional' },
    { key: 'biaya_packing_kayu_per_kg', label: 'Packing kayu (Rp/kg)', pola: 'packing\\s+kayu.*?Rp\\.?\\s*([\\d.,]+)', tipe: 'angka', ambil: 'angka', kategori: 'biaya_tambahan' },
    { key: 'biaya_shipdec_per_dok', label: 'Shipdec (Rp/dokumen)', pola: 'shipdec.*?Rp\\.?\\s*([\\d.,]+)', tipe: 'angka', ambil: 'angka', kategori: 'biaya_tambahan' },
    { key: 'surat_jalan', label: 'Surat jalan (DO, POD)', pola: 'surat\\s+jalan', tipe: 'ada_tidak', ambil: 'ada', kategori: 'fasilitas' },
    { key: 'asuransi_ditanggung', label: 'Asuransi ditanggung', pola: 'asuransi', tipe: 'pilihan', ambil: 'pihak', kategori: 'asuransi' },
    { key: 'termin_hari', label: 'Termin (hari)', pola: '(\\d+)\\s*hari', syarat: 'termin|TOP|bayar|pembayaran', tipe: 'pilihan', ambil: 'angka', kategori: 'pembayaran' },
    { key: 'waktu_tunggu_jam', label: 'Batas waktu tunggu (jam)', pola: '(?:waktu\\s+tunggu|waiting\\s+time).*?(\\d+)\\s*jam', tipe: 'angka', ambil: 'angka', kategori: 'toleransi' },
    { key: 'overtime', label: 'Biaya overtime', pola: '(?:overtime|lembur).*?Rp\\.?\\s*([\\d.,]+)', tipe: 'angka', ambil: 'angka', kategori: 'overtime' }
  ];
  function parseIdNumber(s) {
    let t = String(s == null ? '' : s).trim().replace(/[,.]$/, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return Number(t);
  }
  const rx = (p) => { try { return new RegExp(p, 'i'); } catch (e) { return null; } };
  /* gabung pola: pola vendor (prioritas) + pola global (atau bawaan). key sama -> pola vendor menang */
  function gabungPola(global, vendor) {
    const g = Array.isArray(global) && global.length ? global : POLA_AWAL, v = Array.isArray(vendor) ? vendor : [];
    const keyV = new Set(v.map((x) => x.key));
    return [...v, ...g.filter((x) => !keyV.has(x.key))].filter((x) => x && x.key && x.pola);
  }
  function nilaiDari(r, m, teks) {
    const raw = m[1] !== undefined ? m[1] : '';
    switch (r.ambil) {
      case 'jam': return String(raw).replace('.', ':');
      case 'ada': return 'ya';
      case 'pihak': return /customer|pelanggan|penerima|consignee|shipper/i.test(teks) ? 'customer' : 'isl';
      case 'angka': return String(raw).replace(/[,.]$/, '');
      default: return String(raw || '').trim();
    }
  }
  function parseKlausul(raw, i, pola) {
    const teks = String(raw).replace(/^\s*\d+[.)]\s*/, '').trim();
    for (const r of pola) {
      if (r.syarat) { const s = rx(r.syarat); if (s && !s.test(teks)) continue; }
      const re = rx(r.pola); if (!re) continue;
      const m = teks.match(re);
      if (m) return { id: 'k' + (i + 1), teks, tipe: r.tipe || 'info', key: r.key, label: r.label || r.key, kategori: r.kategori || 'lainnya', nilai: nilaiDari(r, m, teks), cek: false };
    }
    return { id: 'k' + (i + 1), teks, tipe: 'info', key: null, label: '', kategori: 'lainnya', nilai: '', cek: false };
  }
  /* pecah hibrida: per baris, lalu per kalimat. Batas kalimat hanya titik/tanya/seru yang diikuti spasi lalu huruf kapital atau kurung. */
  function pecahBlok(txt, pola) {
    const P = pola || gabungPola(); const hasil = [];
    String(txt || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((baris) => {
      const bersih = baris.replace(/^\s*\d+[.)]\s+/, '').replace(/^[-•*]\s+/, '');
      const lindung = bersih.replace(/\bRp\.\s*/gi, 'Rp⁠').replace(/(\d)\.(\d)/g, '$1․$2');
      const potongan = lindung.split(/(?<=[.!?])\s+(?=[A-Z(])/).map((s) => s.replace(/⁠/g, '. ').replace(/Rp\. /g, 'Rp. ').replace(/․/g, '.').trim()).filter(Boolean);
      potongan.forEach((p) => { const c = parseKlausul(p, hasil.length, P); c.cek = potongan.length > 1 || (c.tipe === 'info' && p.length > 160); hasil.push(c); });
    });
    return hasil;
  }
  /* bandingkan satu klausul vendor dengan nilai dari quotation */
  function cek(c, q) {
    if (q === undefined || q === null || String(q).trim() === '') return { s: 'kosong', msg: 'Belum ada di S&K penawaran.' };
    if (c.tipe === 'ada_tidak') return q === 'ya' ? { s: 'ok' } : { s: 'salah', msg: 'Vendor mensyaratkan ini, penawaran tidak mencantumkannya.' };
    if (c.key === 'asuransi_ditanggung') return q === c.nilai ? { s: 'ok' } : { s: 'salah', msg: `Vendor: asuransi ${c.nilai === 'customer' ? 'ditanggung customer' : 'ditanggung ISL'}. Penawaran berbeda.` };
    if (c.tipe === 'angka') {
      const a = parseIdNumber(c.nilai), b = parseIdNumber(q);
      if (isNaN(b)) return { s: 'salah', msg: 'Nilai di penawaran bukan angka.' };
      return a === b ? { s: 'ok' } : { s: 'salah', msg: `Vendor ${a.toLocaleString('id-ID')}, penawaran ${b.toLocaleString('id-ID')}.` };
    }
    return String(c.nilai).trim().toLowerCase() === String(q).trim().toLowerCase() ? { s: 'ok' } : { s: 'salah', msg: `Vendor ${c.nilai}, penawaran ${q}.` };
  }
  /* periksa S&K vendor terhadap daftar teks S&K quotation (teks quotation ikut dipecah dengan pola yang sama) */
  function periksa(klausulVendor, teksQuotation, pola) {
    const P = pola || gabungPola(), nilaiQ = {};
    (teksQuotation || []).forEach((t, i) => { const k = parseKlausul(t, i, P); if (k.key && nilaiQ[k.key] === undefined) nilaiQ[k.key] = k.nilai; });
    return (klausulVendor || []).filter((c) => c.key && c.tipe && c.tipe !== 'info').map((c) => ({ c, ...cek(c, nilaiQ[c.key]) }));
  }
  window.ISLSK = { TIPE, AMBIL, POLA_AWAL, parseIdNumber, gabungPola, parseKlausul, pecahBlok, cek, periksa };
})();
