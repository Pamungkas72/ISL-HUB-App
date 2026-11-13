// ===========================================================
// APP-STORE — penyimpanan Firestore + Storage untuk Customer, Rate Disetujui,
// Quotation, Order, Template, Pengaturan dokumen, dan penomoran.
//
// ATURAN UTAMA (sama dengan db-firebase.js Master Rate): tidak ada simpan yang diam-diam.
//  1. Perubahan dijalankan di memori, lalu perubahannya dihitung dan DITULIS ke server.
//  2. Server dibaca ulang dan dibandingkan dengan yang dimaksud. Beda = GAGAL.
//  3. Gagal di langkah mana pun = memori dikembalikan seperti semula dan pesan galat ditampilkan.
//  4. Nomor quotation dan semua dokumen yang ikut berubah ditulis dalam SATU transaksi (atomik).
// Tampilan (app-core.js) hanya memanggil tulis(); tidak ada kode Firebase di sana.
// ===========================================================
import { db, app, auth } from "./firebase-config.js";
import { kecilkanBerkas } from "./gambar.js";
import {
  collection, doc, getDocs, getDocFromServer, setDoc, writeBatch, runTransaction, query, where, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadString, uploadBytes, getDownloadURL, getBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

/* Pemisahan modal: nilai modal/markup di koleksi ini tidak ditulis ke dokumennya, tetapi ke dokumen kembar "<koleksi>_modal" yang hanya bisa dibaca akun master (firestore.rules).
   Akun sales tidak pernah memuat atau menulis dokumen kembar itu. */
export const KOL_RAHASIA = ["cu_rates", "cu_paket", "qt_quotations", "qt_templates", "layanan_tambahan"];
const namaModal = (k) => k + "_modal";
const KUNCI_RAHASIA = new Set(["modal", "modal2", "modalMR", "modalAsli", "modalSat", "modalF", "mk", "totalModal", "marginRp", "marginPersen", "targetTertimbang"]);
const angkaRahasia = (v) => (typeof v === "number" && Number.isFinite(v)) || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()));
function pisahRahasia(node, jalur, simpan) {
  if (Array.isArray(node)) return node.map((x, i) => pisahRahasia(x, jalur.concat(i), simpan));
  if (node && typeof node === "object") {
    const o = {};
    for (const k of Object.keys(node)) {
      if (KUNCI_RAHASIA.has(k) && angkaRahasia(node[k])) { simpan[jalur.concat(k).join("|")] = node[k]; continue; }
      o[k] = pisahRahasia(node[k], jalur.concat(k), simpan);
    }
    return o;
  }
  return node;
}
/* Dipakai pemulihan cadangan: memisahkan modal dari dokumen berkas cadangan lama (modal masih di dalam dokumen) sebelum ditulis ke server. */
export function pisahModalDokumen(data) { const sim = {}; const rep = pisahRahasia(JSON.parse(JSON.stringify(data)), [], sim); return { data: rep, modal: Object.keys(sim).length ? sim : null }; }
function suntikRahasia(d, nilai) {
  Object.entries(nilai || {}).forEach(([jalur, v]) => {
    const p = jalur.split("|"); let n = d;
    for (let i = 0; i < p.length - 1; i++) { n = n && n[p[i]]; if (n === undefined || n === null) return; }
    if (n && typeof n === "object") n[p[p.length - 1]] = v;
  });
}
export const KOLEKSI = ["cu_customers", "cu_rates", "cu_paket", "qt_quotations", "qt_orders", "qt_templates", "qt_pengaturan", "qt_counters", "layanan_tambahan", "qt_riwayat", "format_lini", ...KOL_RAHASIA.map(namaModal)];
// Koleksi baru (Okt 2026): kalau aturan Firestore belum dipasang, halaman tetap terbuka (dibaca kosong) dan simpan ke koleksi ini memberi pesan jelas.
const KOLEKSI_BARU = new Set(["layanan_tambahan", "qt_riwayat", "format_lini", ...KOL_RAHASIA.map(namaModal)]);
let MODE = { master: false, uid: "", sales: false, admin: false }; // diisi saat muatSemua
// Admin hanya menulis koleksi yang diizinkan firestore.rules untuknya (customer baru dan ubah; hapus tetap master).
// Juga boleh: pengaturan dokumen (qt_pengaturan), penghitung nomor (qt_counters), katalog layanan tambahan dan format lini,
// quotation (termasuk jalur Word manual), template, tarif dan paket (cu_rates, cu_paket), dan order. Hapus tetap master (aturan Firestore).
const ADMIN_TULIS = new Set(["cu_customers", "cu_rates", "cu_paket", "qt_quotations", "qt_orders", "qt_templates", "qt_pengaturan", "qt_counters", "layanan_tambahan", "qt_riwayat", "format_lini"]); // admin setara master, kecuali hapus permanen (tetap master)
const belumAdaAturan = new Set();
window.__islGagalBaca = belumAdaAturan; // dibaca daftar quotation untuk memberi tahu bila riwayat PDF tidak terbaca
const BATAS_MS = 25000, UKURAN_BATCH = 400, MAKS_TRANSAKSI = 480;
const RAHASIA = new Set(["qt_pengaturan"]); // file di dokumen ini hanya bisa dibaca master (folder rahasia/)

const klon = (x) => JSON.parse(JSON.stringify(x));
const urutkan = (v) => Array.isArray(v) ? v.map(urutkan) : (v && typeof v === "object") ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, urutkan(v[k])])) : (v === undefined ? null : v);
const stabil = (v) => JSON.stringify(urutkan(v));

function dengBatas(p, label) {
  let t; const b = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label}: server tidak mengonfirmasi dalam ${BATAS_MS / 1000} detik (cek koneksi). Perubahan BELUM dianggap tersimpan.`)), BATAS_MS); });
  return Promise.race([p, b]).then((v) => { if (/^Simpan/.test(label) && window.ISLCadangan) window.ISLCadangan.tandai("fase2"); return v; }).finally(() => clearTimeout(t));
}
function pesanGalat(e) {
  const k = e && e.code;
  let siapa = ""; try { const u = auth.currentUser; siapa = u ? ` Akun masuk: ${u.email}.` : " Belum ada akun yang login."; } catch (_) {}
  if (k === "permission-denied" || k === "storage/unauthorized") return new Error(`Ditolak server (${k}).${siapa} Penyebab umum: akun bukan master, atau aturan Firestore/Storage terbaru belum dipasang di proyek ini. Buka Pengaturan > "Cek koneksi dan aturan Firebase" untuk melihat bagian mana yang ditolak. Perubahan dibatalkan.`);
  if (k === "unavailable") return new Error("Server tidak terjangkau (koneksi terputus). Perubahan dibatalkan.");
  return e instanceof Error ? e : new Error(String(e));
}

// ---------- keadaan ----------
let terakhir = {};            // koleksi -> { id: json stabil terakhir yang terkonfirmasi di server }
const cacheRahasia = new Map(); // dataURL -> { __rahasia, tipe } (file rahasia yang sudah ada di Storage)
let antre = Promise.resolve();
let perluMuat = false;
let batchSelesai = 0;   // jumlah batch yang sudah dikonfirmasi server dalam satu simpan  // true = ada tulisan yang mungkin sebagian masuk server; blokir simpan sampai halaman dimuat ulang
const adalahData = (s) => typeof s === "string" && s.startsWith("data:");
const urlFile = (s) => typeof s === "string" && /^https?:\/\//.test(s);

// ---------- baca ----------
function bersihkanDokumen(d) { const o = { ...d.data() }; o.id = d.id; return o; }
/* akun sales hanya boleh membaca dokumennya sendiri di koleksi ini (aturan Firestore mensyaratkan filter pemilikUid) */
const SALES_PEMILIK = new Set(["qt_quotations", "qt_riwayat", "cu_rates", "cu_paket"]);
const SALES_KOSONG = new Set(["qt_orders"]);
const SALES_TULIS = new Set(["cu_customers", "cu_rates", "cu_paket", "qt_quotations", "qt_counters", "qt_riwayat", "qt_templates"]);
const PEMILIK_BUKAN_MASTER = new Set(["qt_templates"]); // template: akun selain master hanya memuat miliknya
/* Koleksi yang ditolak aturan server dicatat (dan dibaca sebagai kosong), supaya halaman lain tetap bisa dibuka. */
export function catatTidakTerbaca(nama, e) {
  if (!(e && (e.code === "permission-denied" || /permission|insufficient/i.test(String(e.message || ""))))) return false;
  (window.__islTidakTerbaca = window.__islTidakTerbaca || new Set()).add(nama);
  console.warn("Koleksi ditolak aturan:", nama);
  return true;
}
async function bacaKoleksiPemilik(nama, uid) {
  try {
    const snap = await dengBatas(getDocs(query(collection(db, nama), where("pemilikUid", "==", uid))), "Baca " + nama);
    return snap.docs.map(bersihkanDokumen);
  } catch (e) { if (catatTidakTerbaca(nama, e)) return []; throw e; }
}
async function bacaKoleksi(nama) {
  try {
    const snap = await dengBatas(getDocs(collection(db, nama)), "Baca " + nama);
    return snap.docs.map(bersihkanDokumen);
  } catch (e) { if (catatTidakTerbaca(nama, e)) return []; throw e; }
}
function dataUrlDariBytes(bytes, tipe) { let s = ""; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return `data:${tipe};base64,${btoa(s)}`; }
async function bukaRahasia(node, master) {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) node[i] = await bukaRahasia(node[i], master); return node; }
  if (node && typeof node === "object") {
    if (typeof node.__rahasia === "string") {
      /* Format lama (v7): gambar ada di Storage folder rahasia/. Kalau gagal dibaca (mis. CORS bucket), jangan biarkan objek sisa masuk ke dokumen:
         kembalikan null dan catat, supaya tampilan memberi tahu pengguna untuk mengunggah ulang. */
      try {
        const bytes = await dengBatas(getBytes(sRef(getStorage(app), node.__rahasia)), "Baca file rahasia");
        const url = dataUrlDariBytes(bytes, node.tipe || "image/png"); return url;
      } catch (e) {
        console.warn("Gambar lama tidak terbaca dari Storage:", node.__rahasia, e && (e.code || e.message));
        (window.__islAsetGagal = window.__islAsetGagal || []).push(node.__rahasia);
        return null;
      }
    }
    for (const k of Object.keys(node)) node[k] = await bukaRahasia(node[k], master);
  }
  return node;
}
export async function muatSemua({ master, sales = false, admin = false, uid = "", hanyaBaca = false }) {
  if (!hanyaBaca) MODE = { master: !!master, sales: !!sales, admin: !!admin, uid };
  // Semua koleksi dibaca BERSAMAAN (bukan satu per satu), supaya waktu muat ≈ koleksi terlambat, bukan jumlah semuanya.
  const hasil = {};
  await Promise.all(KOLEKSI.map(async (k) => {
    if (k.endsWith("_modal") && !master && !admin) { hasil[k] = []; return; } // modal hanya dibaca master dan admin
    if (!master && !admin && SALES_KOSONG.has(k)) { hasil[k] = []; return; } // order dan laba: master dan admin
    const milikSaja = (!master && PEMILIK_BUKAN_MASTER.has(k)) || (sales && SALES_PEMILIK.has(k));
    const bagi = milikSaja ? () => bacaKoleksiPemilik(k, uid) : () => bacaKoleksi(k);
    if (KOLEKSI_BARU.has(k)) { try { hasil[k] = await bagi(); belumAdaAturan.delete(k); } catch (e) { hasil[k] = []; belumAdaAturan.add(k); console.warn(`Koleksi ${k} belum bisa dibaca (aturan Firestore terbaru belum dipasang?):`, e && e.code); } }
    else hasil[k] = await bagi();
  }));
  if (!hanyaBaca) { terakhir = {}; KOLEKSI.forEach((k) => { terakhir[k] = {}; hasil[k].forEach((d) => { const { id, ...isi } = d; terakhir[k][d.id] = stabil(isi); }); }); }
  if (master || admin) KOL_RAHASIA.forEach((k) => { const peta = new Map(hasil[namaModal(k)].map((x) => [x.id, x.nilai])); hasil[k].forEach((d) => suntikRahasia(d, peta.get(d.id))); });
  /* data lama tanpa pemilikUid: isi dari pemilik quotation-nya (hanya di memori; tersimpan pada penyimpanan berikutnya), supaya sales melihat rate miliknya */
  if (master || admin) { const pq = new Map(hasil.qt_quotations.map((q) => [q.id, q.pemilikUid])); ["cu_rates", "cu_paket"].forEach((k) => hasil[k].forEach((d) => { if (!d.pemilikUid && pq.get(d.quotationId)) d.pemilikUid = pq.get(d.quotationId); })); }
  const peng = hasil.qt_pengaturan[0] || null;
  if (peng) {
    const asetLama = !!(peng.aset && ["ttd", "cap"].some((k) => peng.aset[k] && typeof peng.aset[k].__rahasia === "string"));
    try { await bukaRahasia(peng, master); } catch (e) { console.warn("File rahasia tidak terbaca:", e); }
    if (asetLama && master) window.__islAsetMigrasi = true; // TTD/cap versi lama ada di Storage rahasia/: disimpan ulang ke dokumen supaya terbaca akun sales
    /* nilai gambar hanya boleh teks data:image atau tautan https; selain itu dianggap kosong (tidak pernah jadi sumber gambar rusak) */
    if (peng.aset) ["ttd", "cap"].forEach((k) => { const v = peng.aset[k]; if (v && !(typeof v === "string" && /^(data:image\/|https?:\/\/)/.test(v))) peng.aset[k] = null; });
  }
  return { customers: hasil.cu_customers, rates: hasil.cu_rates, paket: hasil.cu_paket, quotations: hasil.qt_quotations, orders: hasil.qt_orders,
    templates: hasil.qt_templates, pengaturan: peng, counters: hasil.qt_counters, layanan: hasil.layanan_tambahan, riwayat: hasil.qt_riwayat, formatLini: hasil.format_lini };
}

// ---------- file ----------
const ekstensi = (tipe) => ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[tipe] || "bin");
function tipeDariData(s) { const m = /^data:([^;,]+)/.exec(s); return m ? m[1] : "application/octet-stream"; }
async function unggahData(path, dataUrl) {
  const r = sRef(getStorage(app), path);
  await dengBatas(uploadString(r, dataUrl, "data_url"), "Unggah file");
  return dengBatas(getDownloadURL(r), "Ambil tautan file");
}
/* Diagnosa: coba tulis dan hapus dokumen uji di tiap koleksi, plus unggah kecil ke Storage. Hasil per langkah, tidak melempar galat. */
export async function diagnosa() {
  const u = auth.currentUser, hasil = [];
  hasil.push({ nama: "Akun login", ok: !!u, info: u ? u.email : "Belum login" });
  const uji = async (nama, fn) => { try { await fn(); hasil.push({ nama, ok: true, info: "Berhasil" }); } catch (e) { hasil.push({ nama, ok: false, info: (e && (e.code || e.message)) || String(e) }); } };
  for (const k of ["layanan_tambahan", "qt_riwayat", "format_lini", "diagnostik"]) {
    const r = doc(db, k, "_uji_" + Date.now());
    await uji(`Firestore: baca ${k}`, () => getDocs(collection(db, k)));
    await uji(`Firestore: tulis ${k}`, async () => { const b = writeBatch(db); b.set(r, { uji: true, oleh: u ? u.email : null }); await b.commit(); });
    await uji(`Firestore: hapus ${k}`, async () => { const b = writeBatch(db); b.delete(r); await b.commit(); });
  }
  const sr = sRef(getStorage(app), "diagnostik/uji_" + Date.now() + ".png");
  await uji("Storage: unggah gambar kecil", () => uploadString(sr, "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64", { contentType: "image/png" }));
  await uji("Storage: hapus gambar uji", () => deleteObject(sr));
  return hasil;
}
export async function unggahBlob(path, blob, tipe) {
  const r = sRef(getStorage(app), path);
  blob = await kecilkanBerkas(blob); // batas 4 MB berlaku di semua jalur unggah
  await dengBatas(uploadBytes(r, blob, { contentType: blob.type || tipe }), "Unggah file");
  return dengBatas(getDownloadURL(r), "Ambil tautan file");
}

// ---------- representasi tersimpan ----------
// Mengubah dokumen di memori menjadi bentuk yang ditulis ke Firestore. File data URL diunggah ke Storage.
async function representasi(kol, d, penggantian) {
  const idDok = d.id, rah = RAHASIA.has(kol);
  const jalan = async (node, jalur) => {
    if (adalahData(node)) {
      /* Tanda tangan dan cap disimpan langsung di dokumen pengaturan (sudah diperkecil di layar unggah), tidak lagi lewat Storage:
         tidak bergantung pada CORS bucket, dan bisa dibaca semua akun yang login supaya PDF akun sales ikut memuat cap. */
      if (kol === "qt_pengaturan" && jalur[0] === "aset") return node;
      if (rah) {
        if (!cacheRahasia.has(node)) {
          const tipe = tipeDariData(node), path = `rahasia/${kol}/${jalur.join("-")}-${Date.now()}.${ekstensi(tipe)}`;
          await dengBatas(uploadString(sRef(getStorage(app), path), node, "data_url"), "Unggah file rahasia");
          cacheRahasia.set(node, { __rahasia: path, tipe });
        }
        return cacheRahasia.get(node);
      }
      const tipe = tipeDariData(node), path = `dokumen/${kol}/${idDok}/${jalur.join("-")}-${Date.now()}.${ekstensi(tipe)}`;
      const url = await unggahData(path, node); penggantian.push({ kol, id: idDok, jalur, url }); return url;
    }
    if (Array.isArray(node)) { const o = []; for (let i = 0; i < node.length; i++) o.push(await jalan(node[i], jalur.concat(i))); return o; }
    if (node && typeof node === "object") { const o = {}; for (const k of Object.keys(node)) { const v = await jalan(node[k], jalur.concat(k)); if (v !== undefined) o[k] = v; } return o; }
    return node === undefined ? undefined : node;
  };
  const hasil = await jalan(klon(d), []); delete hasil.id; return hasil;
}
function cekUkuran(kol, id, data) {
  const n = JSON.stringify(data).length;
  if (n > 950000) throw new Error(`Dokumen ${kol}/${id} terlalu besar (${Math.round(n / 1024)} KB, batas Firestore sekitar 1 MB). Kalau ini tanda tangan atau cap, unggah gambar yang lebih kecil.`);
}
function cekBentuk(kol, id, node, jalur = "") {
  // Firestore menolak array di dalam array dan nilai undefined/NaN
  if (Array.isArray(node)) node.forEach((x, i) => { if (Array.isArray(x)) throw new Error(`Data ${kol}/${id} berisi array di dalam array (${jalur}[${i}]); tidak bisa disimpan.`); cekBentuk(kol, id, x, `${jalur}[${i}]`); });
  else if (node && typeof node === "object") Object.keys(node).forEach((k) => cekBentuk(kol, id, node[k], jalur + "." + k));
  else if (typeof node === "number" && !Number.isFinite(node)) throw new Error(`Data ${kol}/${id} berisi angka tidak valid di ${jalur}.`);
}

// ---------- hitung perubahan ----------
async function hitungPerubahan(reg) {
  const sekarang = reg.ambil(), tulis = [], hapus = [], penggantian = [];
  for (const kol of KOLEKSI) {
    if (kol.endsWith("_modal")) continue;
    if (!MODE.master && !MODE.sales && !MODE.admin) continue; // akun lihat saja tidak pernah menulis
    if (MODE.sales && !SALES_TULIS.has(kol)) continue; // akun sales tidak pernah menulis koleksi lain (aturan Firestore menolaknya)
    if (MODE.admin && !MODE.master && !MODE.sales && !ADMIN_TULIS.has(kol)) continue;
    const ada = new Set(), adaModal = new Set(), pisah = KOL_RAHASIA.includes(kol), kolM = namaModal(kol);
    for (const d of (sekarang[kol] || [])) {
      if (!d.id) throw new Error(`Dokumen di ${kol} tidak punya id.`);
      ada.add(d.id);
      let rep = await representasi(kol, d, penggantian), nilaiModal = null;
      if (pisah) { const sim = {}; rep = pisahRahasia(rep, [], sim); if (Object.keys(sim).length) nilaiModal = sim; }
      const js = stabil(rep);
      if (terakhir[kol][d.id] !== js) { cekBentuk(kol, d.id, rep); cekUkuran(kol, d.id, rep); tulis.push({ kol, id: d.id, data: rep, js }); }
      if (pisah && (MODE.master || MODE.admin)) {
        if (nilaiModal) { adaModal.add(d.id); const dm = { nilai: nilaiModal }, jm = stabil(dm); if (terakhir[kolM][d.id] !== jm) tulis.push({ kol: kolM, id: d.id, data: dm, js: jm }); }
      }
    }
    for (const id of Object.keys(terakhir[kol] || {})) if (!ada.has(id)) hapus.push({ kol, id });
    if (pisah && (MODE.master || MODE.admin)) for (const id of Object.keys(terakhir[kolM] || {})) if (!adaModal.has(id)) hapus.push({ kol: kolM, id });
  }
  return { tulis, hapus, penggantian };
}

// ---------- tulis + verifikasi ----------
async function terapkanKeServer(p) {
  const punyaCounter = p.tulis.some((t) => t.kol === "qt_counters") || p.hapus.some((t) => t.kol === "qt_counters");
  const total = p.tulis.length + p.hapus.length;
  if (punyaCounter) {
    if (total > MAKS_TRANSAKSI) throw new Error("Terlalu banyak perubahan sekaligus untuk satu transaksi penomoran.");
    await dengBatas(runTransaction(db, async (tx) => {
      for (const t of p.tulis.filter((x) => x.kol === "qt_counters")) {
        const s = await tx.get(doc(db, t.kol, t.id));
        /* master dan admin boleh menurunkan penghitung untuk memperbaiki kesalahan; kenaikan tetap dicek agar nomor tidak kembar */
        const koreksi = (MODE.master || MODE.admin) && Number(t.data.nilai) < Number(s.data()?.nilai);
        if (s.exists() && Number(s.data().nilai) >= Number(t.data.nilai) && t.id !== "urut_draf" && !koreksi) throw new Error(`Nomor ${t.id} urutan ${t.data.nilai} sudah dipakai di sesi lain. Muat ulang halaman, lalu ulangi.`);
      }
      p.tulis.forEach((t) => tx.set(doc(db, t.kol, t.id), t.data));
      p.hapus.forEach((t) => tx.delete(doc(db, t.kol, t.id)));
    }), "Simpan (transaksi)");
    return;
  }
  batchSelesai = 0;
  const semua = [...p.tulis.map((t) => ({ op: "set", ...t })), ...p.hapus.map((t) => ({ op: "del", ...t }))];
  for (let i = 0; i < semua.length; i += UKURAN_BATCH) {
    const b = writeBatch(db);
    semua.slice(i, i + UKURAN_BATCH).forEach((x) => (x.op === "set" ? b.set(doc(db, x.kol, x.id), x.data) : b.delete(doc(db, x.kol, x.id))));
    await dengBatas(b.commit(), "Simpan"); batchSelesai++;
  }
}
function normalisasi(d) { const o = {}; Object.entries(d).forEach(([k, v]) => { o[k] = v && typeof v.toDate === "function" ? v.toDate().toISOString() : v; }); return o; }
async function verifikasiServer(p) {
  const cek = async (t) => { const s = await dengBatas(getDocFromServer(doc(db, t.kol, t.id)), "Baca ulang"); if (!s.exists()) throw new Error(`Setelah disimpan, ${t.kol}/${t.id} tidak ditemukan saat dibaca ulang dari server.`); if (stabil(normalisasi(s.data())) !== t.js) throw new Error(`Isi ${t.kol}/${t.id} di server berbeda dari yang dimaksud. Dianggap GAGAL.`); };
  const ada = async (t) => { const s = await dengBatas(getDocFromServer(doc(db, t.kol, t.id)), "Baca ulang"); if (s.exists()) throw new Error(`${t.kol}/${t.id} masih ada di server setelah dihapus.`); };
  for (let i = 0; i < p.tulis.length; i += 10) await Promise.all(p.tulis.slice(i, i + 10).map(cek));
  for (let i = 0; i < p.hapus.length; i += 10) await Promise.all(p.hapus.slice(i, i + 10).map(ada));
}

export function tulis(komit, verifikasi) {
  if (window.__islSegar === false) return Promise.reject(new Error("Data di layar masih dari salinan lokal. Tunggu sampai muncul \"Data terbaru\", lalu simpan lagi."));
  const reg = window.__ISL_REG; if (!reg) return Promise.reject(new Error("Modul belum siap. Muat ulang halaman."));
  const kerja = antre.then(async () => {
    if (perluMuat) throw new Error("Ada penyimpanan yang tidak tuntas sebelumnya. Muat ulang halaman supaya data sama dengan server, lalu ulangi.");
    const sebelum = klon(reg.ambil()); let menulis = false, fase = ""; batchSelesai = 0;
    try {
      komit();
      const p = await hitungPerubahan(reg);
      if (p.tulis.length || p.hapus.length) { menulis = true; fase = "tulis"; await terapkanKeServer(p); fase = "verifikasi"; await verifikasiServer(p); menulis = false; }
      p.tulis.forEach((t) => { terakhir[t.kol][t.id] = t.js; }); p.hapus.forEach((t) => { delete terakhir[t.kol][t.id]; });
      p.penggantian.forEach((x) => reg.terapkanUrl(x.kol, x.id, x.jalur, x.url));
      if (!verifikasi()) throw new Error("Data tidak ditemukan saat dibaca ulang. Anggap belum tersimpan.");
    } catch (e) { reg.pulihkan(sebelum); const g = pesanGalat(e);
      // Ditolak server sebelum ada yang masuk (hak akses, data tidak valid, koneksi putus) = aman dilanjutkan. Batas waktu atau gagal baca ulang = hasilnya tidak pasti.
      const pasti = menulis && fase === "tulis" && batchSelesai === 0 && e && ["permission-denied", "invalid-argument", "failed-precondition", "unavailable", "aborted", "storage/unauthorized"].includes(e.code);
      if (menulis && !pasti) { perluMuat = true; throw new Error(g.message + " Sebagian perubahan mungkin sudah masuk server: MUAT ULANG halaman sebelum melanjutkan."); } throw g; }
  });
  antre = kerja.catch(() => {});
  return kerja;
}


// ---------- pemisahan modal untuk data lama (sekali jalan, hanya master) ----------
const adaRahasiaMentah = (node) => { if (Array.isArray(node)) return node.some(adaRahasiaMentah); if (node && typeof node === "object") return Object.keys(node).some((k) => (KUNCI_RAHASIA.has(k) && angkaRahasia(node[k])) || adaRahasiaMentah(node[k])); return false; };
/* Koleksi yang tidak bisa dibaca akun ini (mis. admin tidak bisa membaca template milik orang lain) masuk "gagal", bukan dihitung nol:
   pemeriksaan yang tidak lengkap tidak boleh membuka gerbang persetujuan sales. */
export async function hitungModalFase2() {
  const per = {}, gagal = []; let total = 0;
  for (const k of KOL_RAHASIA) {
    try { const snap = await dengBatas(getDocs(collection(db, k)), "Baca " + k); per[k] = snap.docs.map(bersihkanDokumen).filter((d) => adaRahasiaMentah(d)).length; }
    catch (e) { per[k] = 0; gagal.push(k); }
    total += per[k];
  }
  let tandai = false; try { tandai = (await getDocFromServer(doc(db, "sistem", "modal"))).exists(); } catch (_) {}
  return { per, total, tandai, gagal };
}
export async function pisahkanModalFase2({ oleh, onProgress }) {
  const kerja = [];
  for (const k of KOL_RAHASIA) {
    const [docs, md] = await Promise.all([bacaKoleksi(k), bacaKoleksi(namaModal(k)).catch(() => [])]), lama = new Map(md.map((x) => [x.id, x.nilai || {}]));
    docs.filter((d) => adaRahasiaMentah(d)).forEach((d) => { const { id, ...isi } = d, sim = {}, bersih = pisahRahasia(isi, [], sim); kerja.push({ k, id, bersih, nilai: { ...(lama.get(id) || {}), ...sim } }); });
  }
  let selesai = 0;
  for (let i = 0; i < kerja.length; i += 150) {
    const potong = kerja.slice(i, i + 150), b = writeBatch(db);
    potong.forEach((x) => { b.set(doc(db, namaModal(x.k), x.id), { nilai: x.nilai }); b.set(doc(db, x.k, x.id), x.bersih); });
    await dengBatas(b.commit(), "Simpan pemisahan modal"); selesai += potong.length; onProgress && onProgress(selesai, kerja.length);
  }
  const sisa = await hitungModalFase2(); if (sisa.total) throw new Error(`Masih ada ${sisa.total} dokumen yang menyimpan modal setelah dipisahkan.`);
  await setDoc(doc(db, "sistem", "modal"), { terpisah: true, pada: serverTimestamp(), oleh: oleh || "" });
  return { diproses: kerja.length };
}
