// Jalankan: node tests/unit/nomor-quotation.test.js
const T = require('./muat-nomor.js');
const { uraiNomor, naikkanPenghitung, bentrokNomor, Repo, DB, nomorDariNamaFile, catatanNomorUnggah } = T;
let gagal = 0; const eq = (nama, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', nama, ok ? '' : `\n   dapat ${JSON.stringify(a)}\n   harus ${JSON.stringify(b)}`); };
// B6: nama file
eq('nama file modern ISL-QL-M-2611-061', nomorDariNamaFile('ISL-QL-M-2611-061'), 'ISL/QL-M/2611/061');
eq('nama file modern ISL_QL_2611_061', nomorDariNamaFile('ISL_QL_2611_061'), 'ISL/QL/2611/061');
eq('nama file lain tetap utuh', nomorDariNamaFile('Penawaran Customer ABC'), 'Penawaran Customer ABC');
// B3: catatan
eq('nomor terbaca & wajar', catatanNomorUnggah('ISL/QL-M/2611/005', '2026-11-03'), '');
eq('nomor format klasik -> peringatan tak terbaca', /tidak sesuai pola/.test(catatanNomorUnggah('019/QL-ISL-M/XI/2026', '2026-11-03')), true);
eq('lompatan besar', /melompat 500/.test(catatanNomorUnggah('ISL/QL-M/2611/500', '2026-11-03')), true);
// B7: periode lain tidak memakai isian awal periode berjalan
T.PENG().nomor.seri[0].awal = 62; T.PENG().nomor.seri[0].periode = 'QL-ISL|2026-11';
eq('Nov: seq 40 <= awal 62 bentrok (sales)', (T.setSales(true), bentrokNomor('ISL/QL-M/2611/040', '2026-11-03').length), 1);
eq('Okt: seq 40 TIDAK bentrok palsu', bentrokNomor('ISL/QL-M/2610/040', '2026-10-20').length, 0);
// reset tahunan: kunci
eq('kunciUrut tahunan', Repo.kunciUrut('2026-11-03', 'QL-ISL', 'tahunan'), 'QL-ISL|2026');
eq('kunciUrut bulanan default', Repo.kunciUrut('2026-11-03', 'QL-ISL'), 'QL-ISL|2026-11');
// Alur inti: PDF manual diunggah -> nomor sistem berikutnya selalu di atasnya, per bulan
T.PENG().nomor.seri[0].awal = 0; T.PENG().nomor.seri[0].periode = ''; T.setSales(false); Object.keys(DB.urutTahun).forEach(k => delete DB.urutTahun[k]);
naikkanPenghitung('ISL/QL-M/2611/061', '2026-11-03');
eq('unggah 061 -> berikutnya 062', Repo.nomorBerikut('QL-ISL'), 'ISL/QL/2611/062');
naikkanPenghitung('ISL/QL-M/2611/010', '2026-11-03');
eq('unggah 010 (lebih kecil) tidak menurunkan', Repo.nomorBerikut('QL-ISL'), 'ISL/QL/2611/062');
naikkanPenghitung('ISL/QL-M/2610/090', '2026-10-30');
eq('unggah nomor Oktober tidak mengganggu Nov', Repo.nomorBerikut('QL-ISL'), 'ISL/QL/2611/062');
T.setHari('2026-12-01');
eq('bulan baru kembali ke 001', Repo.nomorBerikut('QL-ISL'), 'ISL/QL/2612/001');
console.log(gagal ? `\n${gagal} GAGAL` : '\nsemua lulus'); process.exit(gagal ? 1 : 0);
