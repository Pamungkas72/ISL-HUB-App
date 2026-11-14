// Tes aturan Firestore per peran (master, admin, sales, lihat saja) di emulator.
// Dijalankan dari repo: firebase emulators:exec --only firestore "npm --prefix tests/rules test"
// Setiap tes menulis ke emulator lokal saja; tidak menyentuh proyek Firebase sungguhan.
import { describe, it, before, after } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const RULES = process.env.ISL_RULES || new URL("../../firestore.rules", import.meta.url);
const MASTER = "codcodan1@gmail.com";
const sekarang = () => Math.floor(Date.now() / 1000);

let env;
// auth_time dipakai aturan sesi (24 jam 10 menit); default = waktu sekarang.
const ctx = (uid, email, authTime = sekarang()) => env.authenticatedContext(uid, { email, auth_time: authTime }).firestore();
const master = () => ctx("uid-master", MASTER);
const admin = () => ctx("uid-admin", "admin@isl.test");
const sales = () => ctx("uid-sales", "sales@isl.test");
const lihat = () => ctx("uid-lihat", "lihat@isl.test");
const dj1 = () => ctx("uid-dj1", "dj1@isl.test");
const sales2 = () => ctx("uid-sales2", "sales2@isl.test");

const kegiatan = (quotationId, pemilikUid, oleh) => ({ quotationId, pemilikUid, tanggal: "2026-10-30", jenis: "kunjungan", omzet: 0, catatan: "uji", oleh, dibuat: "2026-10-30" });
const volume = (quotationId, pemilikUid, oleh) => ({ quotationId, barisId: "b1", pemilikUid, customerId: "c1", customerNama: "PT Uji", liniKey: "depo", liniNama: "Depo", item: "Stripping", satuan: "per kontainer 20ft", jual: 100000, volume: 2, tanggal: "2026-10-30", catatan: "", oleh, dibuat: "2026-10-30" });

before(async () => {
  env = await initializeTestEnvironment({ projectId: "isl-uji-aturan", firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const isi = (path, data) => setDoc(doc(db, path), data);
    await isi("pengguna/uid-admin", { email: "admin@isl.test", nama: "Admin", peran: "admin", status: "aktif" });
    await isi("pengguna/uid-sales", { email: "sales@isl.test", nama: "Sales", peran: "sales", status: "aktif", kodeSales: "BD" });
    await isi("pengguna/uid-lihat", { email: "lihat@isl.test", nama: "Lihat", peran: "lihat", status: "aktif" });
    await isi("pengguna/uid-dj1", { email: "dj1@isl.test", nama: "DJ1", peran: "sales", status: "aktif", kelompokDJ: "k1" });
    await isi("pengguna/uid-sales2", { email: "sales2@isl.test", nama: "S2", peran: "sales", status: "aktif", kelompokDJ: "k1" });
    await isi("pengguna/uid-anggota", { email: "anggota@dj.isl-hub.app", nama: "Anggota", peran: "dj", status: "aktif", kelompokDJ: "k1", username: "anggota" });
    await isi("dj_login/u_anggota", { email: "anggota@dj.isl-hub.app", uid: "uid-anggota" });
    await isi("pengguna/uid-dj2", { email: "dj2@isl.test", nama: "DJ2", peran: "lihat", status: "aktif", kelompokDJ: "k2" });
    await isi("dj_job/j-k1", { kelompokId: "k1", judul: "Job k1", status: "baru" });
    await isi("dj_job/j-k2", { kelompokId: "k2", judul: "Job k2", status: "baru" });
    await isi("dj_kelompok/k1", { nama: "Marketing", kepala: ["uid-dj1"] });
    await isi("dj_job/j-akt", { kelompokId: "k1", judul: "Job akt", status: "baru" });
    await isi("dj_bagikan/tokenAktif00000000000001", { jobId: "j-k1", kelompokId: "k1", dibuatOleh: "uid-dj1", aktif: true, berlakuSampai: Date.now() + 864e5, unduh: true, snapshot: { judul: "x" } });
    await isi("dj_bagikan/tokenKedaluwarsa000000001", { jobId: "j-k1", kelompokId: "k1", dibuatOleh: "uid-dj1", aktif: true, berlakuSampai: Date.now() - 1000, unduh: true, snapshot: { judul: "x" } });
    await isi("dj_bagikan/tokenDicabut00000000000001", { jobId: "j-k1", kelompokId: "k1", dibuatOleh: "uid-dj1", aktif: false, berlakuSampai: Date.now() + 864e5, unduh: true, snapshot: { judul: "x" } });
    await isi("pengguna/uid-pending", { email: "pending@isl.test", nama: "Pendaftar", peranDiminta: "sales", peran: null, status: "menunggu" });
    await isi("qt_quotations/q-sales", { pemilikUid: "uid-sales", status: "disetujui", nomor: "001/QL", customerId: "c1", baris: [] });
    await isi("qt_quotations/q-draf-sales", { pemilikUid: "uid-sales", status: "draf", customerId: "c1", baris: [] });
    await isi("qt_quotations/q-admin", { pemilikUid: "uid-admin", status: "disetujui", nomor: "002/QL", customerId: "c1", baris: [] });
    await isi("qt_templates/t-sales", { pemilikUid: "uid-sales", nama: "Template sales" });
    await isi("qt_templates/t-admin", { pemilikUid: "uid-admin", nama: "Template admin" });
    // fixture khusus uji penghapusan (admin tidak boleh menghapus; 3 Nov 2026)
    await isi("qt_quotations/h-draf-admin", { pemilikUid: "uid-admin", status: "draf", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-draf-sales-a", { pemilikUid: "uid-sales", status: "draf", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-draf-sales-b", { pemilikUid: "uid-sales", status: "draf", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-ditolak", { pemilikUid: "uid-sales", status: "ditolak", nomor: "003/QL", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-tdk-dipakai", { pemilikUid: "uid-sales", status: "tidak_dipakai", nomor: "004/QL", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-ditolak-master", { pemilikUid: "uid-sales", status: "ditolak", nomor: "005/QL", customerId: "c1", baris: [] });
    await isi("qt_quotations/h-terkirim-sales", { pemilikUid: "uid-sales", status: "terkirim", nomor: "006/QL", customerId: "c1", baris: [] });
    await isi("qt_templates/h-tpl-admin", { pemilikUid: "uid-admin", nama: "Template admin hapus" });
    await isi("qt_templates/h-tpl-sales", { pemilikUid: "uid-sales", nama: "Template sales hapus" });
    await isi("qt_riwayat/h-rw-admin", { pemilikUid: "uid-admin", nomor: "R1", customerNama: "PT Uji" });
    await isi("qt_riwayat/h-rw-sales", { pemilikUid: "uid-sales", nomor: "R2", customerNama: "PT Uji" });
    await isi("qt_riwayat/h-rw-master", { pemilikUid: "uid-sales", nomor: "R3", customerNama: "PT Uji" });
    await isi("satuan_baku/h-sat-admin", { nama: "per uji admin" });
    await isi("satuan_baku/h-sat-master", { nama: "per uji master" });
    await isi("qt_kegiatan/h-k-sales", kegiatan("q-sales", "uid-sales", "sales@isl.test"));
    await isi("cu_customers/c1", { nama: "PT Uji", status: "aktif" });
    await isi("cu_customers/c2", { nama: "PT Hapus", status: "aktif" });
    await isi("cu_rates/r1", { cid: "c1", quotationId: "q-sales", jual: 1000, pemilikUid: "uid-sales" });
    await isi("cu_rates/r-admin", { cid: "c1", quotationId: "q-admin", jual: 900, pemilikUid: "uid-admin" });
    await isi("cu_customers/c-prospek", { nama: "PT Prospek", status: "prospek", persetujuan: "disetujui" });
    await isi("cu_customers/c-draf-sales", { nama: "PT Baru", status: "prospek", persetujuan: "menunggu", diajukanUid: "uid-sales" });
    await isi("cu_customers/c-draf-lain", { nama: "PT Lain", status: "prospek", persetujuan: "menunggu", diajukanUid: "uid-admin" });
    await isi("qt_kegiatan/k-admin", kegiatan("q-sales", "uid-sales", "admin@isl.test"));
    await isi("qt_kegiatan/k-sales", kegiatan("q-sales", "uid-sales", "sales@isl.test"));
  });
});
after(async () => { await env.cleanup(); });

describe("Template: admin membaca semua untuk memeriksa modal; sales hanya miliknya", () => {
  it("admin membaca template milik sales", () => assertSucceeds(getDoc(doc(admin(), "qt_templates/t-sales"))));
  it("sales tidak membaca template milik admin", () => assertFails(getDoc(doc(sales(), "qt_templates/t-admin"))));
  it("sales membaca template miliknya", () => assertSucceeds(getDoc(doc(sales(), "qt_templates/t-sales"))));
});

describe("Hapus customer: hanya master", () => {
  it("admin tidak bisa menghapus customer", () => assertFails(deleteDoc(doc(admin(), "cu_customers/c2"))));
  it("sales tidak bisa menghapus customer", () => assertFails(deleteDoc(doc(sales(), "cu_customers/c2"))));
  it("master bisa menghapus customer", () => assertSucceeds(deleteDoc(doc(master(), "cu_customers/c2"))));
});

describe("Sales: draf customer sendiri boleh dihapus; rate hanya miliknya", () => {
  it("sales menghapus draf customer miliknya", () => assertSucceeds(deleteDoc(doc(sales(), "cu_customers/c-draf-sales"))));
  it("sales tidak menghapus draf customer orang lain", () => assertFails(deleteDoc(doc(sales(), "cu_customers/c-draf-lain"))));
  it("sales membaca rate miliknya", () => assertSucceeds(getDoc(doc(sales(), "cu_rates/r1"))));
  it("sales tidak membaca rate milik admin", () => assertFails(getDoc(doc(sales(), "cu_rates/r-admin"))));
  it("admin membaca semua rate", () => assertSucceeds(getDoc(doc(admin(), "cu_rates/r1"))));
});

describe("Sales: customer disetujui hanya boleh naik prospek ke aktif", () => {
  it("sales menaikkan prospek menjadi aktif", () => assertSucceeds(updateDoc(doc(sales(), "cu_customers/c-prospek"), { status: "aktif" })));
  it("sales tidak menonaktifkan customer aktif", () => assertFails(updateDoc(doc(sales(), "cu_customers/c1"), { status: "nonaktif" })));
  it("sales tidak mengubah nama customer disetujui", () => assertFails(updateDoc(doc(sales(), "cu_customers/c1"), { nama: "PT Lain" })));
});

describe("Koreksi rate: sales tidak bisa mengubah isi rate", () => {
  it("sales tidak bisa mengubah harga rate miliknya", () => assertFails(updateDoc(doc(sales(), "cu_rates/r1"), { jual: 2000 })));
});

describe("Catat kegiatan: admin dan sales pada quotation disetujui", () => {
  it("admin mencatat di quotation disetujui milik sales", () => assertSucceeds(setDoc(doc(admin(), "qt_kegiatan/ka1"), kegiatan("q-sales", "uid-sales", "admin@isl.test"))));
  it("admin tidak mencatat di quotation yang belum disetujui", () => assertFails(setDoc(doc(admin(), "qt_kegiatan/ka2"), kegiatan("q-draf-sales", "uid-sales", "admin@isl.test"))));
  it("sales mencatat di quotation miliknya yang disetujui", () => assertSucceeds(setDoc(doc(sales(), "qt_kegiatan/ks1"), kegiatan("q-sales", "uid-sales", "sales@isl.test"))));
  it("sales tidak mencatat di quotation admin", () => assertFails(setDoc(doc(sales(), "qt_kegiatan/ks2"), kegiatan("q-admin", "uid-admin", "sales@isl.test"))));
  it("lihat saja tidak mencatat", () => assertFails(setDoc(doc(lihat(), "qt_kegiatan/kl1"), kegiatan("q-sales", "uid-sales", "lihat@isl.test"))));
  it("admin tidak menghapus catatan yang dicatatnya sendiri (hapus hanya master)", () => assertFails(deleteDoc(doc(admin(), "qt_kegiatan/k-admin"))));
  it("admin tidak menghapus catatan yang dicatat sales", () => assertFails(deleteDoc(doc(admin(), "qt_kegiatan/k-sales"))));
  it("master menghapus catatan sales", () => assertSucceeds(deleteDoc(doc(master(), "qt_kegiatan/k-sales"))));
});

describe("Catat volume: admin pada quotation disetujui", () => {
  it("admin mencatat volume di quotation disetujui milik sales", () => assertSucceeds(setDoc(doc(admin(), "qt_volume/v1"), volume("q-sales", "uid-sales", "admin@isl.test"))));
  it("admin tidak menghapus volume yang dicatatnya (hapus hanya master)", () => assertFails(deleteDoc(doc(admin(), "qt_volume/v1"))));
});

describe("Log perubahan akun: hanya ditambah oleh staf", () => {
  const log = { uid: "uid-pending", email: "pending@isl.test", aksi: "setujui", dari: { peran: null, status: "menunggu" }, ke: { peran: "sales", status: "aktif" }, oleh: "admin@isl.test", waktu: serverTimestamp() };
  it("admin mencatat log akun", () => assertSucceeds(setDoc(doc(admin(), "pengguna_log/l1"), log)));
  it("log dengan kolom tambahan ditolak", () => assertFails(setDoc(doc(admin(), "pengguna_log/l2"), { ...log, extra: 1 })));
  it("log tidak bisa diubah, bahkan oleh master", () => assertFails(updateDoc(doc(master(), "pengguna_log/l1"), { aksi: "x" })));
  it("log tidak bisa dihapus", () => assertFails(deleteDoc(doc(master(), "pengguna_log/l1"))));
  it("sales tidak membaca log", () => assertFails(getDoc(doc(sales(), "pengguna_log/l1"))));
  it("master membaca log", () => assertSucceeds(getDoc(doc(master(), "pengguna_log/l1"))));
});

describe("Persetujuan akun oleh admin", () => {
  it("admin menyetujui pendaftar sebagai sales tanpa target", () => assertSucceeds(updateDoc(doc(admin(), "pengguna/uid-pending"), { peran: "sales", kodeSales: "CD", status: "aktif", disetujuiPada: serverTimestamp() })));
  it("admin tidak bisa mengisi target bulanan", () => assertFails(updateDoc(doc(admin(), "pengguna/uid-sales"), { targetBulanan: 5000000 })));
});

describe("Batas sesi di server (24 jam 10 menit)", () => {
  it("token login tiga hari lalu ditolak meski akun master", () => assertFails(getDocs(collection(ctx("uid-master", MASTER, sekarang() - 3 * 86400), "cu_customers"))));
  it("token segar diterima", () => assertSucceeds(getDocs(collection(master(), "cu_customers"))));
});

describe("Penghapusan hanya master: admin boleh mengedit, tidak boleh menghapus (3 Nov 2026)", () => {
  it("admin tidak menghapus draf miliknya sendiri", () => assertFails(deleteDoc(doc(admin(), "qt_quotations/h-draf-admin"))));
  it("admin tidak menghapus draf milik sales", () => assertFails(deleteDoc(doc(admin(), "qt_quotations/h-draf-sales-a"))));
  it("admin tidak menghapus quotation ditolak", () => assertFails(deleteDoc(doc(admin(), "qt_quotations/h-ditolak"))));
  it("admin tidak menghapus quotation tidak dipakai", () => assertFails(deleteDoc(doc(admin(), "qt_quotations/h-tdk-dipakai"))));
  it("admin tetap boleh mengubah draf (mengedit)", () => assertSucceeds(updateDoc(doc(admin(), "qt_quotations/h-draf-admin"), { judul: "Diubah admin" })));
  it("master menghapus draf", () => assertSucceeds(deleteDoc(doc(master(), "qt_quotations/h-draf-admin"))));
  it("master menghapus quotation ditolak", () => assertSucceeds(deleteDoc(doc(master(), "qt_quotations/h-ditolak-master"))));
  it("sales tetap boleh menghapus draf miliknya (tidak berubah)", () => assertSucceeds(deleteDoc(doc(sales(), "qt_quotations/h-draf-sales-b"))));
  it("sales tidak menghapus quotation terkirim miliknya", () => assertFails(deleteDoc(doc(sales(), "qt_quotations/h-terkirim-sales"))));

  it("admin tidak menghapus template miliknya", () => assertFails(deleteDoc(doc(admin(), "qt_templates/h-tpl-admin"))));
  it("admin tetap boleh mengubah template miliknya", () => assertSucceeds(updateDoc(doc(admin(), "qt_templates/h-tpl-admin"), { nama: "Template admin diubah" })));
  it("sales tetap boleh menghapus template miliknya (tidak berubah)", () => assertSucceeds(deleteDoc(doc(sales(), "qt_templates/h-tpl-sales"))));
  it("master menghapus template admin", () => assertSucceeds(deleteDoc(doc(master(), "qt_templates/h-tpl-admin"))));

  it("admin tidak menghapus riwayat", () => assertFails(deleteDoc(doc(admin(), "qt_riwayat/h-rw-admin"))));
  it("admin tidak menghapus riwayat milik sales", () => assertFails(deleteDoc(doc(admin(), "qt_riwayat/h-rw-sales"))));
  it("admin tetap boleh mengubah riwayat", () => assertSucceeds(updateDoc(doc(admin(), "qt_riwayat/h-rw-admin"), { nomor: "R1-ubah" })));
  it("sales tetap boleh menghapus riwayat miliknya (tidak berubah)", () => assertSucceeds(deleteDoc(doc(sales(), "qt_riwayat/h-rw-sales"))));
  it("master menghapus riwayat", () => assertSucceeds(deleteDoc(doc(master(), "qt_riwayat/h-rw-master"))));

  it("admin menambah dan mengubah satuan", async () => {
    await assertSucceeds(setDoc(doc(admin(), "satuan_baku/h-sat-baru"), { nama: "per baru" }));
    await assertSucceeds(updateDoc(doc(admin(), "satuan_baku/h-sat-baru"), { nama: "per baru diubah" }));
  });
  it("admin tidak menghapus satuan", () => assertFails(deleteDoc(doc(admin(), "satuan_baku/h-sat-admin"))));
  it("master menghapus satuan", () => assertSucceeds(deleteDoc(doc(master(), "satuan_baku/h-sat-master"))));

  it("sales tetap boleh menghapus catatan kegiatan miliknya (tidak berubah)", () => assertSucceeds(deleteDoc(doc(sales(), "qt_kegiatan/h-k-sales"))));
});

describe("Sembunyikan dari tampilan akun (admin dan sales), disimpan di profil sendiri", () => {
  const ref = (uid) => `pengguna/${uid}`;
  it("admin menyimpan daftar sembunyi di profilnya sendiri", () => assertSucceeds(updateDoc(doc(admin(), ref("uid-admin")), { sembunyi: { quotation: ["q1", "q2"], template: ["t1"] } })));
  it("sales menyimpan daftar sembunyi di profilnya sendiri", () => assertSucceeds(updateDoc(doc(sales(), ref("uid-sales")), { sembunyi: { riwayat: ["r1"], preset: ["p1"], satuan: ["pertitik"] } })));
  it("admin tidak mengubah daftar sembunyi akun lain", () => assertFails(updateDoc(doc(admin(), ref("uid-sales")), { sembunyi: { quotation: ["x"] } })));
  it("jenis di luar daftar ditolak", () => assertFails(updateDoc(doc(admin(), ref("uid-admin")), { sembunyi: { rahasia: ["x"] } })));
  it("sembunyi harus berupa peta, bukan teks", () => assertFails(updateDoc(doc(admin(), ref("uid-admin")), { sembunyi: "semua" })));
  it("lebih dari 500 item per jenis ditolak", () => assertFails(updateDoc(doc(admin(), ref("uid-admin")), { sembunyi: { quotation: Array.from({ length: 501 }, (_, i) => "q" + i) } })));
  it("sembunyi tidak bisa dipakai untuk menyelipkan peran", () => assertFails(updateDoc(doc(admin(), ref("uid-admin")), { sembunyi: { quotation: [] }, peran: "sales" })));
  it("akun lihat saja tidak menyimpan daftar sembunyi", () => assertFails(updateDoc(doc(lihat(), ref("uid-lihat")), { sembunyi: { quotation: ["q1"] } })));
  it("menyembunyikan tidak menghapus quotation (dokumen tetap terbaca master)", () => assertSucceeds(getDoc(doc(master(), "qt_quotations/q-admin"))));
});

describe("Pendaftaran akun: hanya sales, dengan nomor WhatsApp", () => {
  const baru = (uid, extra = {}) => ({ email: uid + "@isl.test", nama: "Baru", peranDiminta: "sales", peran: null, status: "menunggu", dibuat: serverTimestamp(), ...extra });
  it("sales baru mendaftar dengan telepon", () => assertSucceeds(setDoc(doc(ctx("u-d1", "u-d1@isl.test"), "pengguna/u-d1"), baru("u-d1", { telepon: "6281234567890" }))));
  it("pendaftaran tanpa telepon tetap boleh (akun lama)", () => assertSucceeds(setDoc(doc(ctx("u-d2", "u-d2@isl.test"), "pengguna/u-d2"), baru("u-d2"))));
  it("meminta peran CS ditolak", () => assertFails(setDoc(doc(ctx("u-d3", "u-d3@isl.test"), "pengguna/u-d3"), baru("u-d3", { peranDiminta: "cs" }))));
  it("meminta peran admin ditolak", () => assertFails(setDoc(doc(ctx("u-d4", "u-d4@isl.test"), "pengguna/u-d4"), baru("u-d4", { peranDiminta: "admin" }))));
  it("telepon lebih dari 15 karakter ditolak", () => assertFails(setDoc(doc(ctx("u-d5", "u-d5@isl.test"), "pengguna/u-d5"), baru("u-d5", { telepon: "1".repeat(16) }))));
  it("master membuat akun manual dengan telepon", () => assertSucceeds(setDoc(doc(master(), "pengguna/u-m1"), { email: "m1@isl.test", nama: "Manual", peranDiminta: "sales", peran: "sales", status: "aktif", dibuat: serverTimestamp(), disetujuiPada: serverTimestamp(), kodeSales: "MAN", targetBulanan: null, dibuatOleh: "manual", telepon: "6281200000000" })));
});

describe("Daily Job: akses per kelompok", () => {
  const dj1 = () => ctx("uid-dj1", "dj1@isl.test"), dj2 = () => ctx("uid-dj2", "dj2@isl.test"), job = (k, judul = "Baru") => ({ kelompokId: k, judul, status: "baru" });
  it("anggota membaca job kelompoknya", () => assertSucceeds(getDoc(doc(dj1(), "dj_job/j-k1"))));
  it("anggota tidak membaca job kelompok lain", () => assertFails(getDoc(doc(dj1(), "dj_job/j-k2"))));
  it("anggota menyaring daftar job kelompoknya", async () => { const { query, where } = await import("firebase/firestore"); await assertSucceeds(getDocs(query(collection(dj1(), "dj_job"), where("kelompokId", "==", "k1")))); });
  it("anggota membaca semua job tanpa saringan ditolak", () => assertFails(getDocs(collection(dj1(), "dj_job"))));
  it("anggota membuat job di kelompoknya", () => assertSucceeds(setDoc(doc(dj1(), "dj_job/n1"), job("k1"))));
  it("anggota tidak membuat job di kelompok lain", () => assertFails(setDoc(doc(dj1(), "dj_job/n2"), job("k2"))));
  it("anggota tidak memindahkan job ke kelompok lain", () => assertFails(updateDoc(doc(dj1(), "dj_job/j-k1"), { kelompokId: "k2" })));
  it("anggota mengubah job kelompoknya", () => assertSucceeds(updateDoc(doc(dj1(), "dj_job/j-k1"), { status: "selesai" })));
  it("anggota kelompok lain tidak mengubah job k1", () => assertFails(updateDoc(doc(dj2(), "dj_job/j-k1"), { status: "selesai" })));
  it("judul kosong ditolak", () => assertFails(setDoc(doc(dj1(), "dj_job/n3"), job("k1", ""))));
  it("akun tanpa kelompok tidak membaca job", () => assertFails(getDoc(doc(sales(), "dj_job/j-k1"))));
  it("master membaca semua kelompok", () => assertSucceeds(getDoc(doc(master(), "dj_job/j-k2"))));
  it("admin mengubah job kelompok mana pun", () => assertSucceeds(updateDoc(doc(admin(), "dj_job/j-k2"), { status: "proses" })));
  it("anggota tidak membuat kelompok", () => assertFails(setDoc(doc(dj1(), "dj_kelompok/x"), { nama: "X", dibuat: "2026-11-13" })));
  it("akun aktif membaca daftar kelompok", () => assertSucceeds(getDoc(doc(sales(), "dj_kelompok/k1"))));
  it("admin membuat kelompok", () => assertSucceeds(setDoc(doc(admin(), "dj_kelompok/k3"), { nama: "BD", dibuat: "2026-11-13" })));
  it("admin menetapkan kelompok akun sales", () => assertSucceeds(updateDoc(doc(admin(), "pengguna/uid-sales"), { kelompokDJ: "k1" })));
  it("anggota tidak mengganti kelompoknya sendiri", () => assertFails(updateDoc(doc(dj1(), "pengguna/uid-dj1"), { kelompokDJ: "k2" })));
});

describe("Daily Job: token notifikasi push", () => {
  const dj1 = () => ctx("uid-dj1", "dj1@isl.test"), tok = (uid, t = "tok-123") => ({ uid, token: t, agen: "uji", diubah: serverTimestamp() });
  it("akun mendaftarkan token perangkatnya", () => assertSucceeds(setDoc(doc(dj1(), "dj_token/uid-dj1_abc"), tok("uid-dj1"))));
  it("akun tidak mendaftarkan token atas nama akun lain", () => assertFails(setDoc(doc(dj1(), "dj_token/uid-dj2_abc"), tok("uid-dj2"))));
  it("id token harus berawalan uid sendiri", () => assertFails(setDoc(doc(dj1(), "dj_token/xyz"), tok("uid-dj1"))));
  it("token terlalu panjang ditolak", () => assertFails(setDoc(doc(dj1(), "dj_token/uid-dj1_long"), tok("uid-dj1", "x".repeat(401)))));
  it("akun membaca dan menghapus tokennya sendiri", async () => { await assertSucceeds(getDoc(doc(dj1(), "dj_token/uid-dj1_abc"))); await assertSucceeds(deleteDoc(doc(dj1(), "dj_token/uid-dj1_abc"))); });
  it("akun lain tidak membaca token orang", async () => { await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "dj_token/uid-dj1_x"), tok("uid-dj1"))); await assertFails(getDoc(doc(sales(), "dj_token/uid-dj1_x"))); });
  it("akun yang menunggu persetujuan tidak mendaftarkan token", async () => { await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), "pengguna/uid-tunggu-dj"), { email: "t@isl.test", nama: "T", peranDiminta: "sales", peran: null, status: "menunggu" })); await assertFails(setDoc(doc(ctx("uid-tunggu-dj", "t@isl.test"), "dj_token/uid-tunggu-dj_a"), tok("uid-tunggu-dj"))); });
});

describe("Daily Job: komentar, penilaian kepala divisi, tautan bagikan", () => {
  const dj1 = () => ctx("uid-dj1", "dj1@isl.test"), dj2 = () => ctx("uid-dj2", "dj2@isl.test"), anon = () => env.unauthenticatedContext().firestore();
  const akt = (uid, extra = {}) => ({ uid, oleh: "Uji", peran: "anggota", jenis: "komentar", teks: "Halo", nilai: "", waktu: Date.now(), ...extra });
  it("anggota kelompok mengomentari job", () => assertSucceeds(setDoc(doc(sales2(), "dj_job/j-akt/aktivitas/a1"), akt("uid-sales2"))));
  it("anggota biasa tidak boleh menilai", () => assertFails(setDoc(doc(sales2(), "dj_job/j-akt/aktivitas/a2"), akt("uid-sales2", { nilai: "revisi" }))));
  it("kepala divisi (ditetapkan) boleh menilai", () => assertSucceeds(setDoc(doc(dj1(), "dj_job/j-akt/aktivitas/a3"), akt("uid-dj1", { peran: "kepala", nilai: "revisi" }))));
  it("master boleh menilai", () => assertSucceeds(setDoc(doc(master(), "dj_job/j-akt/aktivitas/a4"), akt("uid-master", { peran: "kepala", nilai: "setuju" }))));
  it("komentar atas nama orang lain ditolak", () => assertFails(setDoc(doc(dj1(), "dj_job/j-akt/aktivitas/a5"), akt("uid-lain"))));
  it("kelompok lain tidak membaca atau mengomentari", async () => { await assertFails(getDoc(doc(dj2(), "dj_job/j-akt/aktivitas/a1"))); await assertFails(setDoc(doc(dj2(), "dj_job/j-akt/aktivitas/a6"), akt("uid-dj2"))); });
  it("aktivitas tidak bisa diubah", () => assertFails(updateDoc(doc(dj1(), "dj_job/j-akt/aktivitas/a3"), { teks: "ubah" })));
  it("hanya kepala yang mengisi review pada job", async () => { await assertFails(updateDoc(doc(sales2(), "dj_job/j-akt"), { review: { nilai: "setuju" } })); await assertSucceeds(updateDoc(doc(dj1(), "dj_job/j-akt"), { review: { nilai: "setuju" } })); });
  it("tautan aktif bisa dibuka tanpa login", () => assertSucceeds(getDoc(doc(anon(), "dj_bagikan/tokenAktif00000000000001"))));
  it("tautan kedaluwarsa ditolak", () => assertFails(getDoc(doc(anon(), "dj_bagikan/tokenKedaluwarsa000000001"))));
  it("tautan dicabut ditolak", () => assertFails(getDoc(doc(anon(), "dj_bagikan/tokenDicabut00000000000001"))));
  it("daftar tautan tidak bisa dibaca tanpa login", () => assertFails(getDocs(collection(anon(), "dj_bagikan"))));
  it("anggota kelompok membuat tautan", () => assertSucceeds(setDoc(doc(dj1(), "dj_bagikan/tokenBaru0000000000000001"), { jobId: "j-k1", kelompokId: "k1", dibuatOleh: "uid-dj1", aktif: true, berlakuSampai: Date.now() + 864e5, unduh: false, snapshot: { judul: "x" }, diubah: Date.now() })));
  it("kelompok lain tidak membuat tautan untuk job k1", () => assertFails(setDoc(doc(dj2(), "dj_bagikan/tokenBaru0000000000000002"), { jobId: "j-k1", kelompokId: "k1", dibuatOleh: "uid-dj2", aktif: true, berlakuSampai: Date.now() + 864e5, unduh: false, snapshot: { judul: "x" } })));
  it("anggota mencabut tautan kelompoknya", () => assertSucceeds(updateDoc(doc(dj1(), "dj_bagikan/tokenAktif00000000000001"), { aktif: false })));
  it("admin menetapkan kepala divisi", () => assertSucceeds(setDoc(doc(admin(), "dj_kelompok/k4"), { nama: "X", dibuat: "2026-11-14", kepala: ["uid-dj1"] })));
});

describe("Daily Job: akun anggota tim (peran dj) hanya Daily Job", () => {
  const ang = () => ctx("uid-anggota", "anggota@dj.isl-hub.app"), anon = () => env.unauthenticatedContext().firestore();
  it("anggota membaca job kelompoknya", () => assertSucceeds(getDoc(doc(ang(), "dj_job/j-k1"))));
  it("anggota membuat dan menilai: komentar boleh, penilaian tidak", async () => { await assertSucceeds(setDoc(doc(ang(), "dj_job/j-akt/aktivitas/ag1"), { uid: "uid-anggota", oleh: "Anggota", peran: "anggota", jenis: "komentar", teks: "ok", nilai: "", waktu: 1 })); await assertFails(setDoc(doc(ang(), "dj_job/j-akt/aktivitas/ag2"), { uid: "uid-anggota", oleh: "Anggota", peran: "anggota", jenis: "komentar", teks: "ok", nilai: "setuju", waktu: 1 })); });
  it("anggota membaca daftar kelompok", () => assertSucceeds(getDoc(doc(ang(), "dj_kelompok/k1"))));
  it("anggota tidak membaca tarif", () => assertFails(getDoc(doc(ang(), "master_tarif/apa-saja"))));
  it("anggota tidak membaca customer", () => assertFails(getDocs(collection(ang(), "cu_customers"))));
  it("anggota tidak membaca quotation", () => assertFails(getDoc(doc(ang(), "qt_quotations/q-sales"))));
  it("anggota tidak membaca akun orang lain", () => assertFails(getDoc(doc(ang(), "pengguna/uid-sales"))));
  it("anggota membaca profilnya sendiri", () => assertSucceeds(getDoc(doc(ang(), "pengguna/uid-anggota"))));
  it("anggota tidak mengubah peran atau kelompoknya", async () => { await assertFails(updateDoc(doc(ang(), "pengguna/uid-anggota"), { peran: "sales" })); await assertFails(updateDoc(doc(ang(), "pengguna/uid-anggota"), { kelompokDJ: "k2" })); });
  it("anggota mendaftarkan token notifikasi", () => assertSucceeds(setDoc(doc(ang(), "dj_token/uid-anggota_t1"), { uid: "uid-anggota", token: "tk", agen: "uji", diubah: 1 })));
  it("alias login dibaca per kunci tanpa login", () => assertSucceeds(getDoc(doc(anon(), "dj_login/u_anggota"))));
  it("alias login tidak bisa didaftar atau ditulis", async () => { await assertFails(getDocs(collection(anon(), "dj_login"))); await assertFails(setDoc(doc(dj1(), "dj_login/u_palsu"), { email: "x@y.z" })); });
  it("kelompok lain tidak membaca job anggota", () => assertFails(getDoc(doc(ctx("uid-dj2", "dj2@isl.test"), "dj_job/j-k1"))));
});
