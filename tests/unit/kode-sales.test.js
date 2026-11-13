// Jalankan: node tests/unit/kode-sales.test.js
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../../public/js/akses.js', 'utf8').match(/export function kodeSalesOtomatis[\s\S]*?\n}\n/)[0].replace('export ', '');
const kode = new Function(src + ';return kodeSalesOtomatis')();
let gagal = 0; const eq = (n, a, b) => { const ok = a === b; if (!ok) gagal++; console.log(ok ? 'LULUS' : 'GAGAL', n, ok ? '' : `dapat ${a}, harus ${b}`); };
eq('3 huruf nama depan', kode('Budi Darmawan'), 'BUD');
eq('bentrok tambah huruf', kode('Budi Darmawan', ['BUD']), 'BUDI');
eq('bentrok berlapis', kode('Budi Darmawan', ['BUD', 'BUDI']), 'BUDID');
eq('nama depan pendek', kode('Al Fatah'), 'ALF');
eq('aksen dibuang', kode('Éka Putra'), 'EKA');
eq('nama terlalu pendek', kode('X'), '');
process.exit(gagal ? 1 : 0);
