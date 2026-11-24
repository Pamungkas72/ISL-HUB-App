// Jalankan: node tests/unit/daily-job-pic.test.mjs
import { namaAkun, cocokPic, tentukanPic } from "../../public/js/daily-job-pic.js";
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
eq("nama akun: profil, username, tampilan, email", [namaAkun({ nama: "Dede" }, {}), namaAkun({ username: "ega" }, {}), namaAkun(null, { displayName: "Ega Mulya" }), namaAkun(null, { email: "budi@mail.com" }), namaAkun(null, null)], ["Dede", "ega", "Ega Mulya", "budi", ""]);
const tim = ["Dede", "Rina Putri", "Yoga"];
eq("cocok tanpa beda huruf, nama baku dikembalikan", [cocokPic("rina  putri", tim), cocokPic("YOGA", tim), cocokPic("Budi", tim), cocokPic("", tim)], ["Rina Putri", "Yoga", "", ""]);
eq("nama sendiri selalu sah (master di luar kelompok)", cocokPic("ega mulya", tim, "Ega Mulya"), "Ega Mulya");
eq("kosong menjadi nama sendiri", tentukanPic("  ", "", tim, "Dede"), { ok: true, pic: "Dede" });
eq("anggota lain diterima dan dibakukan", tentukanPic("rina putri", "Dede", tim, "Dede"), { ok: true, pic: "Rina Putri" });
eq("bukan anggota ditolak", tentukanPic("Budi", "Dede", tim, "Dede"), { ok: false, pic: "Budi" });
eq("PIC lama (impor) yang tidak diubah tetap sah", tentukanPic("Ega", "Ega", tim, "Dede"), { ok: true, pic: "Ega" });
eq("daftar belum termuat: tidak memblokir", tentukanPic("Budi", "", null, "Dede"), { ok: true, pic: "Budi" });
process.exit(gagal ? 1 : 0);
