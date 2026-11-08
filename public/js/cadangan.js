// ===========================================================
// CADANGAN — hemat Firebase.
//  - Cadangan OTOMATIS disimpan di browser (IndexedDB) dari data yang SUDAH ada di layar.
//    Nol baca tambahan ke Firestore, nol tulis ke Firestore, nol pemakaian Storage.
//  - Dibuat 45 detik setelah perubahan terakhir (digabung, bukan tiap simpan), dilewati kalau isinya
//    sama dengan sebelumnya, dikompres (gzip), dan hanya 8 terakhir per bagian yang disimpan.
//  - Cadangan LENGKAP dari server (baca semua koleksi sekali) hanya jalan saat tombol ditekan.
//  - File cadangan bisa diunduh ke PC dan dipakai untuk memulihkan data.
// ===========================================================
import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, getDocFromServer, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { KOL_RAHASIA, pisahModalDokumen } from "./app-store.js";

export const KOLEKSI_SEMUA = [
  "master_tarif", "master_tarif_riwayat", "vendor", "lini_bisnis", "satuan_baku",
  "trucking_trailer_zona", "distribusi_kecil_lokasi", "open_yard_lokasi", "depo_lokasi", "warehouse_fasilitas",
  "cu_customers", "cu_rates", "cu_paket", "qt_quotations", "qt_orders", "qt_templates", "qt_pengaturan", "qt_counters",
  "vendor_rahasia", "master_modal",
  "layanan_tambahan", "qt_riwayat", "format_lini", "sk_pola",
  "cu_rates_modal", "cu_paket_modal", "qt_quotations_modal", "qt_templates_modal", "layanan_tambahan_modal",
  "pengguna", "sales_publik", "performa", "sistem", "qt_ajuan_hapus",
];
const TIDAK_DIPULIHKAN = new Set(["master_tarif_riwayat"]); // hanya bisa ditambah (aturan server)
const JEDA_MS = 45000, SIMPAN_MAKS = 8, K_UNDUH = "isl-cadangan-unduh-terakhir", K_AUTO = "isl-cadangan-auto-mati";
const sumber = {}, timer = {}, hashTerakhir = {};

// ---------- IndexedDB ----------
let _db = null;
function buka() {
  if (_db) return _db;
  _db = new Promise((ok, gagal) => {
    try {
      const r = indexedDB.open("isl-cadangan", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("snap", { keyPath: "id" });
      r.onsuccess = () => ok(r.result); r.onerror = () => gagal(r.error);
    } catch (e) { gagal(e); }
  });
  return _db;
}
const tx = async (mode, fn) => { const d = await buka(); return new Promise((ok, gagal) => { const t = d.transaction("snap", mode), s = t.objectStore("snap"); let out; Promise.resolve(fn(s)).then((v) => { out = v; }, gagal); t.oncomplete = () => ok(out); t.onerror = () => gagal(t.error); t.onabort = () => gagal(t.error); }); };
const req = (r) => new Promise((ok, gagal) => { r.onsuccess = () => ok(r.result); r.onerror = () => gagal(r.error); });

// ---------- serialisasi ----------
const bersih = (v) => {
  if (v === undefined || typeof v === "function") return undefined;
  if (typeof v === "string") return v.startsWith("data:") ? MARKER : v;
  if (v && typeof v.toDate === "function") return { __ts: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map((x) => { const b = bersih(x); return b === undefined ? null : b; });
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) { const b = bersih(v[k]); if (b !== undefined) o[k] = b; } return o; }
  return v;
};
const MARKER = "[berkas-tidak-disertakan]";
// Nilai penanda (berkas tidak ikut cadangan) diganti isi yang sama di server, supaya gambar tanda tangan/cap tidak tertimpa.
const isiMarker = (l, srv) => {
  if (l === MARKER) return srv;
  if (Array.isArray(l)) return l.map((x, i) => { const r = isiMarker(x, Array.isArray(srv) ? srv[i] : undefined); return r === undefined ? null : r; });
  if (l && typeof l === "object") { const o = {}; for (const k of Object.keys(l)) { const r = isiMarker(l[k], srv && typeof srv === "object" ? srv[k] : undefined); if (r !== undefined) o[k] = r; } return o; }
  return l;
};
const urut = (v) => Array.isArray(v) ? v.map(urut) : (v && typeof v === "object") ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, urut(v[k])])) : v;
const stabil = (v) => JSON.stringify(urut(v));
const hidupkan = (v) => Array.isArray(v) ? v.map(hidupkan) : (v && typeof v === "object") ? (v.__ts ? Timestamp.fromDate(new Date(v.__ts)) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, hidupkan(x)]))) : v;

async function gzip(teks) {
  if (typeof CompressionStream === "undefined") return { gz: false, data: new Blob([teks]) };
  const s = new Blob([teks]).stream().pipeThrough(new CompressionStream("gzip"));
  return { gz: true, data: await new Response(s).blob() };
}
async function gunzip(blob, gz) {
  if (!gz) return blob.text();
  return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
async function sidik(teks) {
  try { const b = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(teks)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  catch (e) { return String(teks.length); }
}

// ---------- cadangan otomatis ----------
export function daftarSumber(nama, fn) { sumber[nama] = fn; }
export const otomatisAktif = () => { try { return localStorage.getItem(K_AUTO) !== "1"; } catch (e) { return true; } };
export function aturOtomatis(aktif) { try { if (aktif) localStorage.removeItem(K_AUTO); else localStorage.setItem(K_AUTO, "1"); } catch (e) { /* abaikan */ } }

export function tandai(nama) {
  if (!sumber[nama] || !otomatisAktif()) return;
  clearTimeout(timer[nama]); timer[nama] = setTimeout(() => simpanSekarang(nama).catch(() => {}), JEDA_MS);
}
export async function simpanSekarang(nama) {
  clearTimeout(timer[nama]); delete timer[nama];
  const fn = sumber[nama]; if (!fn) return { dilewati: true };
  const isi = bersih(fn()); if (!isi) return { dilewati: true };
  const teks = JSON.stringify(isi), h = await sidik(teks);
  if (hashTerakhir[nama] === h) return { dilewati: true };
  const daftar = await daftarLokal(); const terakhir = daftar.find((x) => x.bagian === nama);
  if (terakhir && terakhir.hash === h) { hashTerakhir[nama] = h; return { dilewati: true }; }
  const { gz, data } = await gzip(teks), waktu = Date.now();
  const ringkas = Object.fromEntries(Object.entries(isi).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
  await tx("readwrite", (s) => req(s.put({ id: `${nama}-${waktu}`, bagian: nama, waktu, hash: h, gz, ukuranAsli: teks.length, ukuran: data.size, ringkas, data })));
  hashTerakhir[nama] = h;
  const lama = (await daftarLokal()).filter((x) => x.bagian === nama).slice(SIMPAN_MAKS);
  if (lama.length) await tx("readwrite", (s) => Promise.all(lama.map((x) => req(s.delete(x.id)))));
  return { disimpan: true, ukuran: data.size };
}
export async function simpanSemuaSekarang() { for (const n of Object.keys(sumber)) { try { await simpanSekarang(n); } catch (e) { /* abaikan */ } } }
export async function daftarLokal() {
  try {
    const semua = await tx("readonly", (s) => req(s.getAll()));
    return semua.map(({ data, ...meta }) => meta).sort((a, b) => b.waktu - a.waktu);
  } catch (e) { return []; }
}
async function ambilBagian(id) {
  const r = await tx("readonly", (s) => req(s.get(id))); if (!r) return null;
  return JSON.parse(await gunzip(r.data, r.gz));
}
export async function hapusLokal() { await tx("readwrite", (s) => req(s.clear())); Object.keys(hashTerakhir).forEach((k) => delete hashTerakhir[k]); }

// Gabungan bagian terbaru (master + fase2) menjadi satu berkas cadangan
export async function gabungTerbaru() {
  const daftar = await daftarLokal(), koleksi = {}, bagian = [];
  for (const nama of ["master", "fase2"]) {
    const e = daftar.find((x) => x.bagian === nama); if (!e) continue;
    const isi = await ambilBagian(e.id); if (!isi) continue;
    Object.entries(isi).forEach(([k, v]) => { if (Array.isArray(v)) koleksi[k] = v; });
    bagian.push({ bagian: nama, waktu: new Date(e.waktu).toISOString() });
  }
  return { format: "isl-hub-cadangan", versi: 1, sumber: "lokal", dibuat: new Date().toISOString(), bagian, koleksi: normalKoleksi(koleksi) };
}
// nama properti di memori -> nama koleksi Firestore
const PETA = { customers: "cu_customers", rates: "cu_rates", paket: "cu_paket", quotations: "qt_quotations", orders: "qt_orders", templates: "qt_templates", counters: "qt_counters", tarif: "master_tarif", lini: "lini_bisnis", satuan: "satuan_baku" };
function normalKoleksi(k) {
  const o = {};
  Object.entries(k).forEach(([nama, arr]) => { const n = PETA[nama] || nama; o[n] = (arr || []).filter((d) => d && d.id).map((d) => { const c = { ...d }; Object.keys(c).forEach((x) => { if (x.startsWith("_")) delete c[x]; }); return c; }); });
  if (o.qt_pengaturan === undefined && k.pengaturan) o.qt_pengaturan = [k.pengaturan].filter((d) => d && d.id);
  return o;
}

// ---------- cadangan lengkap dari server (hanya saat diminta) ----------
export async function bacaPenuh(onProgress) {
  const koleksi = {}, lewat = [], total = KOLEKSI_SEMUA.length; let i = 0, baca = 0;
  for (const nama of KOLEKSI_SEMUA) {
    onProgress && onProgress(i, total, nama);
    try {
      const snap = await getDocs(collection(db, nama));
      koleksi[nama] = snap.docs.map((d) => ({ id: d.id, ...bersih(d.data()) })); baca += snap.size;
    } catch (e) { lewat.push({ koleksi: nama, alasan: e.code || e.message }); }
    i++;
  }
  onProgress && onProgress(total, total, "");
  const u = auth.currentUser;
  return { format: "isl-hub-cadangan", versi: 1, sumber: "server", dibuat: new Date().toISOString(), oleh: u ? u.email : "", dibaca: baca, dilewati: lewat, koleksi };
}

// ---------- unduh ----------
export function namaBerkas(obj) { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `ISL-HUB-cadangan-${obj.sumber === "server" ? "penuh" : "lokal"}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`; }
export function unduh(obj) {
  const blob = new Blob([JSON.stringify(obj)], { type: "application/json" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = namaBerkas(obj); document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  try { localStorage.setItem(K_UNDUH, String(Date.now())); } catch (e) { /* abaikan */ }
}
export function umurUnduhHari() { try { const t = +localStorage.getItem(K_UNDUH); return t ? Math.floor((Date.now() - t) / 86400000) : null; } catch (e) { return null; } }

// ---------- pemulihan ----------
export function periksaBerkas(obj) {
  if (!obj || obj.format !== "isl-hub-cadangan" || !obj.koleksi || typeof obj.koleksi !== "object") throw new Error("Ini bukan berkas cadangan ISL HUB.");
  if (obj.versi !== 1) throw new Error("Versi berkas cadangan tidak dikenal.");
  return obj;
}
// Bandingkan isi berkas dengan server. Tidak menulis apa pun.
/* Berkas lama (sebelum modal dipisah) menyimpan modal di dalam dokumen. Dipisah dulu supaya pemulihan tidak membuka modal ke akun sales. */
function pisahModalBerkas(obj) {
  const k = { ...obj.koleksi };
  for (const nama of KOL_RAHASIA) {
    const ada = k[nama]; if (!Array.isArray(ada)) continue; const tambahan = [];
    k[nama] = ada.map((d) => { if (!d || !d.id) return d; const { id, ...isi } = d; const h = pisahModalDokumen(isi); if (h.modal) tambahan.push({ id, nilai: h.modal }); return { id, ...h.data }; });
    if (tambahan.length) { const m = nama + "_modal", sudah = new Set((k[m] || []).map((x) => x && x.id)); k[m] = [...(k[m] || []), ...tambahan.filter((x) => !sudah.has(x.id))]; }
  }
  if (Array.isArray(k.master_tarif)) {
    const tambahan = []; k.master_tarif = k.master_tarif.map((d) => { if (!d || !d.id || d.modal === undefined) return d; const { modal, ...sisa } = d; tambahan.push({ id: d.id, modal }); return sisa; });
    if (tambahan.length) { const sudah = new Set((k.master_modal || []).map((x) => x && x.id)); k.master_modal = [...(k.master_modal || []), ...tambahan.filter((x) => !sudah.has(x.id))]; }
  }
  return { ...obj, koleksi: k };
}
export async function analisaPemulihan(obj, onProgress) {
  periksaBerkas(obj); obj = pisahModalBerkas(obj); const rencana = [], ringkas = [];
  const nama = Object.keys(obj.koleksi).filter((k) => KOLEKSI_SEMUA.includes(k) && !TIDAK_DIPULIHKAN.has(k)); let i = 0;
  for (const k of nama) {
    onProgress && onProgress(i++, nama.length, k);
    let server = {};
    try { (await getDocs(collection(db, k))).docs.forEach((d) => { server[d.id] = bersih(d.data()); }); } catch (e) { ringkas.push({ koleksi: k, galat: e.code || e.message }); continue; }
    const r = { koleksi: k, baru: 0, beda: 0, sama: 0, lewat: 0, catatan: [] };
    for (const d of obj.koleksi[k] || []) {
      if (!d || !d.id) continue; const { id, ...isi } = d; let lokal = bersih(isi); Object.keys(lokal).forEach((x) => { if (x.startsWith("_")) delete lokal[x]; });
      const s = server[id]; lokal = isiMarker(lokal, s);
      if (!s) { rencana.push({ k, id, data: lokal, jenis: "baru" }); r.baru++; continue; }
      if (stabil(s) === stabil(lokal)) { r.sama++; continue; }
      if (k === "qt_counters" && !(Number(lokal.nilai) > Number(s.nilai))) { r.lewat++; continue; }
      if (k === "qt_quotations" && s.status !== "draf" && (s.nomor !== lokal.nomor || stabil(s.dokumenModel || null) !== stabil(lokal.dokumenModel || null))) { r.lewat++; r.catatan.push(`${s.nomor || id}: sudah terbit, nomor/isi dokumen dikunci server`); continue; }
      rencana.push({ k, id, data: lokal, jenis: "beda" }); r.beda++;
    }
    ringkas.push(r);
  }
  onProgress && onProgress(nama.length, nama.length, "");
  return { rencana, ringkas };
}
export async function terapkanPemulihan(rencana, onProgress) {
  const gagal = [], ok = []; const UKURAN = 300;
  for (let a = 0; a < rencana.length; a += UKURAN) {
    const potong = rencana.slice(a, a + UKURAN), b = writeBatch(db);
    potong.forEach((x) => b.set(doc(db, x.k, x.id), hidupkan(x.data)));
    try { await b.commit(); }
    catch (e) { potong.forEach((x) => gagal.push({ ...x, alasan: e.code || e.message })); onProgress && onProgress(Math.min(a + UKURAN, rencana.length), rencana.length); continue; }
    for (let j = 0; j < potong.length; j += 10) {
      await Promise.all(potong.slice(j, j + 10).map(async (x) => {
        try { const s = await getDocFromServer(doc(db, x.k, x.id)); if (!s.exists() || stabil(bersih(s.data())) !== stabil(x.data)) gagal.push({ ...x, alasan: "isi di server berbeda setelah ditulis" }); else ok.push(x); }
        catch (e) { gagal.push({ ...x, alasan: e.message }); }
      }));
    }
    onProgress && onProgress(Math.min(a + UKURAN, rencana.length), rencana.length);
  }
  return { berhasil: ok.length, gagal };
}

// ---------- pemasangan ----------
const api = { daftarSumber, tandai, simpanSekarang, simpanSemuaSekarang, daftarLokal, hapusLokal, gabungTerbaru, bacaPenuh, unduh, umurUnduhHari, analisaPemulihan, terapkanPemulihan, periksaBerkas, otomatisAktif, aturOtomatis, namaBerkas };
window.ISLCadangan = api;
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Object.keys(timer).forEach((n) => simpanSekarang(n).catch(() => {})); });
window.addEventListener("pagehide", () => { Object.keys(timer).forEach((n) => simpanSekarang(n).catch(() => {})); });
export default api;
