// Pemuat logika penomoran quotation dari public/js/app-core.js untuk uji tanpa browser.
// Mengambil potongan kode asli (AQ, uraiNomor, penghitung, unggahan PDF) dan menjalankannya dengan data tiruan.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '../../public/js/app-core.js'), 'utf8').split('\n');
const ambil = (a, b) => src.slice(a - 1, b).join('\n');
// bagian: seriBawaan..AQ (1384-1396), R.nomorResmi (1414-1419 dibungkus), Repo parsial, uraiNomor..bentrokNomor
const find = (re, from = 0) => src.findIndex((l, i) => i >= from && re.test(l)) + 1;
const aStart = find(/^const seriBawaan/), aEnd = find(/^  markupBawaan/);
const nStart = find(/^function uraiNomor/), nEnd = find(/^const htmlBentrok/);
const fStart = find(/^function nomorDariNamaFile/), fEnd = find(/^function panelUnggahRiwayat/);
const cStart = find(/^const LOMPAT_NOMOR/), cEnd = find(/^async function simpanRiwayat/);
let kode = ambil(aStart, aEnd + 20).split('\n'); // sampai penutup AQ kasar
// ambil AQ sampai baris '};' pertama setelah aEnd
let i = aEnd; while (!/^};/.test(src[i - 1])) i++;
const blokAQ = ambil(aStart, i);
const blokNomor = ambil(nStart, nEnd - 1) + '\n' + ambil(fStart, fEnd - 1) + '\n' + ambil(cStart, cEnd - 1);
const ctx = `
const norm = s => String(s || '').trim().toLowerCase().replace(/\\s+/g, ' ');
let HARI = '2026-11-03'; const HARI_INI = () => HARI;
let PENG = { nomor: { reset: 'bulanan', digit: 3, prefix: 'ISL', format: '{prefix}/{jenis}/{YY}{MM}/{seq}', seri: [{ kode: 'QL-ISL', jenis: 'QL', nama: 'Umum', awal: 0 }] } };
const esc = x => String(x);
const DB = { list: [], riwayat: [], urutTahun: {} };
const namaCust = q => q.customerNama || '';
let SALES = false; const akunSales = () => SALES;
${blokAQ}
const Repo = {
  kunciUrut: (tgl, kode, reset) => (kode || AQ.kodeNomor) + '|' + (((reset || (PENG.nomor && PENG.nomor.reset)) === 'tahunan') ? tgl.slice(0, 4) : tgl.slice(0, 7)),
  awalSeri: kode => { const s = (PENG.nomor.seri || []).find(x => x.kode === kode); if (!s || !s.awal) return 0; if (s.periode && s.periode !== Repo.kunciUrut(HARI_INI(), kode)) return 0; return s.awal; },
  urutBebas(kode, tgl) { const k = Repo.kunciUrut(tgl, kode); let n = Math.max(DB.urutTahun[k] || 0, Repo.awalSeri(kode)) + 1; for (let i = 0; i < 1000 && urutTerpakai(k, n); i++) n++; return n; },
  nomorBerikut(kode, manual = false) { return R.nomorResmi(Repo.urutBebas(kode, HARI_INI()), HARI_INI(), kode, manual); }
};
const R = { nomorResmi(urut, tanggal, kode, manual = false) {
    const d = new Date(tanggal + 'T00:00:00'), N = PENG.nomor || {}, k = kode || AQ.kodeNomor, s = (N.seri || []).find(x => x.kode === k) || {};
    const mm = String(d.getMonth() + 1).padStart(2, '0'), yy = String(d.getFullYear());
    const hasil = String(N.format || '{seq}/{seri}/{RM}/{YYYY}').replace(/\\{(\\w+)\\}/g, (m, t) => ({ seq: String(urut).padStart(N.digit || AQ.digitUrut, '0'), seri: k + (manual ? '-M' : ''), jenis: (s.jenis || k) + (manual ? '-M' : ''), prefix: N.prefix || 'ISL', YYYY: yy, YY: yy.slice(2), MM: mm, RM: AQ.romawi[d.getMonth()] })[t] ?? m);
    return manual && !hasil.includes('-M') ? hasil + '-M' : hasil; } };
${blokNomor}
return { nomorDariNamaFile, catatanNomorUnggah, uraiNomor, naikkanPenghitung, bentrokNomor, Repo, R, DB, PENG: () => PENG, setPENG: p => { PENG = p; }, setHari: h => { HARI = h; }, setSales: v => { SALES = v; } };
`;
module.exports = new Function(ctx)();
