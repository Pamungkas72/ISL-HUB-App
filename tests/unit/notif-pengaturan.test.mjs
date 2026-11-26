// Jalankan: node tests/unit/notif-pengaturan.test.mjs
import { createRequire } from "node:module";
import * as K from "../../public/js/notif-isi.js";
const require = createRequire(import.meta.url), S = require("../../functions/notif-pengaturan.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
const wib = (s) => Date.parse(s + "+07:00");
eq("bawaan klien = bawaan server", K.BAWAAN, S.BAWAAN);
const t = "Yth. {nama},\nRef: {referensi}\nRute: {rute}\n\nSalam";
const v = { nama: "PT A", referensi: "", rute: "A → B" };
eq("render: baris variabel kosong dibuang", S.render(t, v), "Yth. PT A,\nRute: A → B\n\nSalam");
eq("klien dan server merender sama", [K.render(t, v), K.rapikanSubjek(K.render("X · {referensi}", v, false)), S.rapikanSubjek(S.render("X · {referensi}", v, false))], [S.render(t, v), "X", "X"]);
eq("efektif: bawaan bila dokumen kosong", S.efektif(null, "terkirim"), K.efektif(null, "terkirim"));
const dok = { kejadian: { terkirim: { aktif: false, kirim: { mode: "tunda", menit: 15 }, tpl: { id: { subjek: "Halo {nama}", isi: "" } } } } };
const e = S.efektif(dok, "terkirim");
eq("efektif: mati, tunda, subjek kustom, isi bawaan", [e.aktif, e.kirim.mode, e.kirim.menit, e.tpl.id.subjek, e.tpl.id.isi === S.BAWAAN.terkirim.id.isi, e.tpl.en.subjek], [false, "tunda", 15, "Halo {nama}", true, S.BAWAAN.terkirim.en.subjek]);
const sen = wib("2026-11-23T10:00:00"); // Senin
eq("langsung", S.hitungKirimPada({ mode: "langsung" }, sen), sen);
eq("tunda 10 menit", S.hitungKirimPada({ mode: "tunda", menit: 10 }, sen), sen + 600000);
eq("jam: slot berikutnya hari ini", S.hitungKirimPada({ mode: "jam", jam: ["09:00", "16:00"] }, sen), wib("2026-11-23T16:00:00"));
eq("jam: lewat semua slot, besok", S.hitungKirimPada({ mode: "jam", jam: ["09:00", "16:00"] }, wib("2026-11-23T17:00:00")), wib("2026-11-24T09:00:00"));
eq("jam: Jumat sore ke Senin (hari kerja)", S.hitungKirimPada({ mode: "jam", jam: ["09:00"] }, wib("2026-11-27T10:00:00")), wib("2026-11-30T09:00:00"));
eq("jam: akhir pekan boleh bila hariKerja false", S.hitungKirimPada({ mode: "jam", jam: ["09:00"], hariKerja: false }, wib("2026-11-28T08:00:00")), wib("2026-11-28T09:00:00"));
eq("jam kosong atau salah: langsung", S.hitungKirimPada({ mode: "jam", jam: ["9pagi"] }, sen), sen);
const EC = require("../../functions/dailyjob-email-customer.js"), job = { customer: "PT A", judul: "DO-1", kelompokId: "k", rinci: { jenis: "distribusi", noDo: "DO-1" } }, c = { nama: "PT A", kontak: [{ email: "a@x.id", utama: true }] };
eq("antrean: kejadian dimatikan = tidak ada", EC.antrean("terkirim", "j", job, c, dok), null);
const a = EC.antrean("diterima", "j", job, c, { kejadian: { diterima: { kirim: { mode: "tunda", menit: 10 } } } }, sen);
eq("antrean: tunda memakai kirimPada", [a.doc.status, a.doc.kirimPada], ["antre", sen + 600000]);
eq("antrean: customer mematikan email", EC.antrean("diterima", "j", job, { ...c, emailNotif: false }).doc.status, "dimatikan");
process.exit(gagal ? 1 : 0);
