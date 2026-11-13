// ===========================================================
// PUSAT PEMBERITAHUAN — satu tempat untuk semua peringatan (ikon lonceng di bilah atas).
// Aturan peringatan ada di pengingat.js; file ini hanya mengumpulkan, menampilkan, menyembunyikan
// sementara (sessionStorage: kembali muncul saat login ulang / tab baru), dan mengarahkan ke sumber masalah.
// Untuk menambah jenis peringatan baru: tambahkan satu fungsi di KUMPULKAN.
// ===========================================================
import { quotationGantung, tarifPerluVerifikasi, riwayatPerluTindak, labelUmur, pembaruanTerakhir, hariIni } from "./pengingat.js";
import { muatSemua as muatMaster, muatReferensi } from "./db.js";
import { muatSemua as muatApp } from "./app-store.js";
import { adalahMaster } from "./config-akses.js";
import { auth, db } from "./firebase-config.js";
import { bukaPendaftarAksi } from "./pendaftar-aksi.js";
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Aturan tampilan: peringatan di layar (Beranda, banner) hanya muncul paling lama LAMA_LAYAR_MS sejak login, atau
// sampai ditutup dengan X. Setelahnya tetap ada di lonceng, yang menyimpan semua pemberitahuan yang masih perlu perhatian.
export const LAMA_LAYAR_MS = 10 * 1000;
const K_TUTUP = "islhub-tutup", K_CACHE = "islhub-notif-cache", K_BUKA = "islhub-buka", K_LOGIN = "islhub-login", UMUR_CACHE_MS = 60 * 1000;
const baca = (k, d) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const tulis = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export const mulaiLayar = () => { let t = Number(baca(K_LOGIN, 0)); if (!t) { t = Date.now(); tulis(K_LOGIN, t); } return t; };
export const sisaLayarMs = () => Math.max(0, LAMA_LAYAR_MS - (Date.now() - mulaiLayar()));
export const ditutup = () => new Set(baca(K_TUTUP, []));
export const tutupSementara = (id) => { const s = ditutup(); s.add(id); tulis(K_TUTUP, [...s]); };
export const resetTutup = () => { try { sessionStorage.removeItem(K_TUTUP); sessionStorage.removeItem(K_CACHE); sessionStorage.removeItem(K_LOGIN); } catch (e) {} };

const initial = (t) => String(t || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hariDari = (tgl) => { const d = String(tgl || "").slice(0, 10); return d ? Math.round((new Date(new Date().toDateString()) - new Date(d + "T00:00:00")) / 864e5) : null; };

// ---------- pengumpul: tiap fungsi mengembalikan daftar item { id, level, judul, ket, tujuan:{jenis, ...} } ----------
// Perihal (judul) quotation ditampilkan di keterangan agar pengguna langsung tahu penawaran mana yang perlu ditindaklanjuti.
const perihalTeks = (judul) => (String(judul || "").trim() ? `Perihal: ${String(judul).trim()} · ` : "");
function dariQuotation(quotations) {
  const out = [], gantung = quotationGantung(quotations), idGantung = new Set(gantung.map((x) => x.q.id));
  gantung.forEach((x) => out.push({ id: "gantung:" + x.q.id, jenis: "quotation", level: x.hari >= 14 ? "bahaya" : "warn",
    judul: `${x.q.nomor || x.q.labelDraf || "Draf"} menggantung ${x.hari} hari`, ket: `${perihalTeks(x.q.judul)}${x.q.customerNama || "Tanpa customer"} · perbarui status atau catat tindak lanjut`,
    tujuan: { jenis: "quotation", id: x.q.id } }));
  // terkirim 3-6 hari tanpa kabar (di atas 7 hari sudah masuk "menggantung")
  (quotations || []).filter((q) => q.status === "terkirim" && !q.digantikanOleh && !q.arsip && !idGantung.has(q.id)).forEach((q) => {
    const tl = (q.tindakLanjut || []).slice(-1)[0], h = hariDari(tl ? tl.tanggal : q.dikirim);
    if (h !== null && h >= 3) out.push({ id: "tl:" + q.id, jenis: "quotation", level: "info", judul: `${q.nomor || "Quotation"} belum ada kabar ${h} hari`, ket: `${perihalTeks(q.judul)}${q.customerNama || "Tanpa customer"} · saatnya tindak lanjut`, tujuan: { jenis: "quotation", id: q.id } });
  });
  return out;
}
function dariRiwayat(riwayat, quotations) {
  const perNomor = new Map((quotations || []).map((q) => [q.nomor, q]));
  return riwayatPerluTindak(riwayat).map(({ x, hari }) => ({ id: "rw:" + x.id + ":" + Math.floor(hari / 3), jenis: "riwayat", level: hari >= 9 ? "bahaya" : "warn",
    judul: `${x.nomor || "Quotation"} belum ada respons ${hari} hari`, ket: `${perihalTeks(x.judul || (perNomor.get(x.nomor) || {}).judul)}${x.customerNama || "Tanpa customer"} · riwayat PDF, tindak lanjuti lalu perbarui status`, tujuan: { jenis: "riwayat", id: x.id } }));
}
// Satu pemberitahuan per vendor dan per lini bisnis (satu vendor bisa punya beberapa lini). Verifikasinya dilakukan dengan menghubungi vendor. Hanya untuk master.
function dariTarif(tarif, vendor, lini = []) {
  const u = auth.currentUser; if (!u || !(window.__ISL_KELOLA ?? adalahMaster(u.email))) return [];
  const namaLiniDari = (id) => (lini.find((l) => l.id === id) || {}).nama || id;
  const per = new Map();
  tarifPerluVerifikasi(tarif, vendor).forEach((x) => {
    const kunci = x.t.vendorId + "|" + x.t.liniBisnisId;
    const v = per.get(kunci) || { nama: x.vendor, lini: namaLiniDari(x.t.liniBisnisId), n: 0, umur: 0, lewat: false };
    v.n++; v.umur = Math.max(v.umur, x.umur); v.lewat = v.lewat || x.tingkat === "lewat"; per.set(kunci, v);
  });
  return [...per].map(([id, v]) => ({ id: "verif:" + id, jenis: "tarif", level: v.lewat ? "bahaya" : "warn",
    judul: `${v.n} tarif ${v.nama} · ${v.lini} perlu verifikasi ulang`, ket: `Terakhir dicek ${labelUmur(v.umur)} lalu · hubungi vendor, lalu tandai valid atau tidak valid`,
    tujuan: { jenis: "tarif", verifikasi: id } }));
}
// ---------- kelengkapan Master Rate dan quotation (hanya master/admin) ----------
const kelola = () => { const u = auth.currentUser; return !!u && !!(window.__ISL_KELOLA ?? adalahMaster(u.email)); };
// Tarif lengkap tidak dihitung; harga jual saran kosong = otomatis (modal + markup lini), jadi bukan masalah.
async function dariMaster(m, ref) {
  if (!kelola()) return [];
  const out = [], aktif = (m.tarif || []).filter((t) => t.aktif !== false);
  const tarif = (id, level, n, teks, ket) => n && out.push({ id: "mr:" + id, jenis: "tarif", grup: "tarif", level, judul: `${n} tarif ${teks}`, ket, tujuan: { jenis: "tarif", filter: id } });
  tarif("tanpalini", "warn", aktif.filter((t) => !t.liniBisnisId).length, "belum punya lini bisnis", "Tarif tetap bisa dipakai · buat lini bisnis lalu lengkapi lewat Edit tarif");
  tarif("tanpavendor", "warn", aktif.filter((t) => !t.vendorId).length, "belum ditentukan vendornya", "Pilih vendor atau Internal lewat Edit tarif");
  tarif("kosong", "warn", aktif.filter((t) => t.modal === null || t.modal === undefined).length, "belum ada modal", "Isi modal agar margin dan harga jual saran bisa dihitung");
  const { kurangVendor } = await import("./form-vendor.js");
  (m.vendor || []).forEach((v) => {
    const k = kurangVendor(v); if (!k.length) return;
    out.push({ id: "vd:" + v.id, jenis: "vendor", grup: "vendor", level: k.some((x) => x === "Legalitas berakhir") ? "bahaya" : k.includes("Draf") ? "warn" : "info", judul: `${v.nama || v.id} belum lengkap`, ket: `Kurang: ${k.join(", ")}`, kurang: k, tujuan: { jenis: "vendor", id: v.id } });
  });
  const { skor, butirKelengkapan } = await import("./profil-fasilitas.js");
  ((ref && ref.profil) || []).filter((p) => p.status !== "tersedia" && p.status !== "tidak_tersedia" && p.status !== "nonaktif").forEach((p) => {
    const k = butirKelengkapan(p).filter(([, ok]) => !ok).map(([n]) => n);
    out.push({ id: "lk:" + p.id, jenis: "lokasi", grup: "lokasi", level: "warn", judul: `${p.nama || p.id} masih Draf · ${skor(p)}% lengkap`, ket: `Kurang: ${k.slice(0, 4).join(", ")}${k.length > 4 ? ` dan ${k.length - 4} lainnya` : ""}`, kurang: k, tujuan: { jenis: "lokasi", id: p.id } });
  });
  return out;
}
// Draf quotation yang sudah lewat sehari tapi belum punya customer atau perihal
function dariQuotationLengkap(quotations) {
  if (!kelola()) return [];
  return (quotations || []).filter((q) => q.status === "draf" && !q.arsip && !q.digantikanOleh).flatMap((q) => {
    const k = [!q.customerId && !q.customerNama && "Customer", !String(q.judul || "").trim() && "Perihal"].filter(Boolean), p = pembaruanTerakhir(q);
    if (!k.length || !p || hariDari(p) < 1) return [];
    return [{ id: "ql:" + q.id, jenis: "quotation", grup: "quotation", level: "info", judul: `${q.nomor || q.labelDraf || "Draf"} belum lengkap`, ket: `Kurang: ${k.join(", ")} · lengkapi lalu terbitkan atau hapus`, kurang: k, tujuan: { jenis: "quotation", id: q.id } }];
  });
}
function dariCadangan() {
  try {
    const u = window.ISLCadangan ? window.ISLCadangan.umurUnduhHari() : undefined;
    const u0 = auth.currentUser; if (!u0 || !adalahMaster(u0.email) || u === undefined) return [];
    if (u === null || u >= 7) return [{ id: "cadangan", jenis: "cadangan", level: "warn", judul: u === null ? "Belum pernah mengunduh cadangan" : `Cadangan terakhir ${u} hari lalu`, ket: "Unduh cadangan data ke perangkat", tujuan: { jenis: "cadangan" } }];
  } catch (e) {}
  return [];
}

/* Master: akun baru yang mendaftar langsung masuk lonceng (dan pop-up di desktop) tanpa perlu memuat ulang halaman.
   Hanya membaca akun yang berstatus menunggu. Dicoba ulang sampai status login dan peran master siap. */
let pantauSudah = false;
function pantauPendaftar(n = 0) {
  if (pantauSudah) return;
  const u = auth.currentUser;
  if (!u) { if (n < 60) setTimeout(() => pantauPendaftar(n + 1), 500); return; }
  if (!(window.__ISL_KELOLA ?? adalahMaster(u.email))) { if (window.__ISL_KELOLA === undefined && !adalahMaster(u.email) && n < 60) setTimeout(() => pantauPendaftar(n + 1), 500); return; }
  pantauSudah = true;
  onSnapshot(query(collection(db, "pengguna"), where("status", "==", "menunggu")), () => muat(true), (e) => console.warn("Pantau pendaftar:", e && e.code));
}

/* Sales yang baru mendaftar dan belum disetujui. Hanya akun master yang boleh membaca daftar ini (aturan Firestore). */
async function pendaftarMenunggu() {
  const u = auth.currentUser; if (!u || !(window.__ISL_KELOLA ?? adalahMaster(u.email))) return [];
  try {
    const snap = await getDocs(query(collection(db, "pengguna"), where("status", "==", "menunggu")));
    const daftar = snap.docs.map((d) => ({ uid: d.id, nama: d.data().nama || "", email: d.data().email || "" }));
    if (!daftar.length) return [];
    const n = daftar.length, nama = daftar.slice(0, 3).map((x) => x.nama || x.email).join(", ") + (n > 3 ? " dan lainnya" : "");
    return [{ id: "pendaftar", jenis: "pendaftar", level: "bahaya", judul: `${n} sales baru harus segera ditindaklanjuti`,
      ket: `${nama} · setujui atau tolak di Pengaturan > Akun`, tujuan: { jenis: "pendaftar" }, daftar }];
  } catch (e) { console.warn("Pendaftar sales tidak termuat:", e && e.code); return []; }
}

export async function kumpulkan({ paksa = false } = {}) {
  const c = baca(K_CACHE, null);
  let semua = c && !paksa && Date.now() - c.t < UMUR_CACHE_MS ? c.items : null;
  if (!semua) {
    semua = [];
    try { const pr = window.__ISL_PROFIL || {}; const a = await muatApp({ master: false, hanyaBaca: true, sales: pr.peran === "sales", uid: pr.uid }); semua.push(...dariQuotation(a.quotations), ...dariRiwayat(a.riwayat, a.quotations), ...dariQuotationLengkap(a.quotations)); } catch (e) { console.warn("Pemberitahuan quotation tidak termuat:", e); }
    try { const m = await muatMaster(); semua.push(...dariTarif(m.tarif, m.vendor, m.lini)); semua.push(...(await dariMaster(m, await muatReferensi().catch(() => ({ profil: [] }))))); } catch (e) { console.warn("Pemberitahuan tarif tidak termuat:", e); }
    tulis(K_CACHE, { t: Date.now(), items: semua });
  }
  const urut = { bahaya: 0, warn: 1, info: 2 }, t = ditutup();
  const items = semua.filter((i) => true).sort((a, b) => urut[a.level] - urut[b.level]);
  return { semua: [...items, ...dariCadangan(), ...(await pendaftarMenunggu()), ...pwTerkumpul()], t };
}

// ---------- tujuan: buka sumber masalahnya ----------
const HALAMAN = { riwayat: "app.html#quotation", quotation: "app.html#quotation", tarif: "app.html#master-rate", vendor: "app.html#master-rate", lokasi: "app.html#master-rate", cadangan: "app.html#pengaturan", pendaftar: "pengaturan.html" };
export function bukaTujuan(tujuan) {
  const hal = location.pathname.split("/").pop() || "index.html";
  if ((tujuan.jenis === "quotation" || tujuan.jenis === "riwayat") && hal === "app.html" && window.__islBuka) { window.__islBuka(tujuan); return; }
  if (["tarif", "vendor", "lokasi"].includes(tujuan.jenis) && hal === "app.html" && location.hash === "#master-rate" && window.__islBukaMR) { window.__islBukaMR(tujuan); return; }
  if (tujuan.jenis === "halaman") { const dasar = hal === "app.html" ? "" : "app.html"; if (dasar) location.href = dasar + (tujuan.hash || ""); else location.hash = tujuan.hash || ""; return; }
  if (tujuan.jenis === "pendaftar") { bukaPendaftarAksi({ onSelesai: () => muat(true) }); return; } // setujui atau tolak langsung di sini
  tulis(K_BUKA, tujuan);
  location.href = HALAMAN[tujuan.jenis] || "app.html#beranda";
}
export const ambilTujuan = () => { const t = baca(K_BUKA, null); try { sessionStorage.removeItem(K_BUKA); } catch (e) {} return t; };

// ---------- tampilan ----------
const IKON = { bahaya: '<path d="M12 9v4M12 17h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>', warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>' };
const svg = (d, n = 18) => `<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const baris = (i, bisaTutup) => `<div class="nf-i nf-i--${i.level}" data-nf-id="${esc(i.id)}"><button type="button" class="nf-i__b" data-nf-buka="${esc(i.id)}">${svg(IKON[i.level])}<span><b>${esc(i.judul)}</b><small>${esc(i.ket)}</small></span></button>${!bisaTutup ? "" : `<button type="button" class="nf-i__x" data-nf-tutup="${esc(i.id)}" aria-label="Tutup, tetap tersimpan di lonceng" title="Tutup (tetap tersimpan di lonceng)">${svg('<path d="M6 6l12 12M18 6 6 18"/>', 16)}</button>`}</div>`;
// ---------- tunda / tandai selesai (per akun master/admin: Firestore pemberitahuan_tunda/{uid}, cadangan lokal) ----------
// tunda: hilang sampai tanggal tertentu. selesai: hilang sampai judulnya berubah (mis. jumlahnya bertambah).
const K_TUNDA = "islhub-tunda";
let tunda = (() => { try { return JSON.parse(localStorage.getItem(K_TUNDA) || "{}"); } catch (e) { return {}; } })();
let tundaDimuat = false;
const sembunyi = (i) => { const t = tunda[i.id]; return !!t && (t.s === "tunda" ? t.sampai > hariIni() : t.sig === i.judul); };
async function simpanTunda() {
  const hariIniStr = hariIni();
  Object.keys(tunda).forEach((k) => { if (tunda[k].s === "tunda" && tunda[k].sampai <= hariIniStr) delete tunda[k]; }); // kedaluwarsa dibersihkan
  try { localStorage.setItem(K_TUNDA, JSON.stringify(tunda)); } catch (e) {}
  const u = auth.currentUser;
  if (u && kelola()) { try { await setDoc(doc(db, "pemberitahuan_tunda", u.uid), { map: tunda, diubah: Date.now() }); } catch (e) { console.warn("Tunda pemberitahuan tidak tersimpan di server:", e && e.code); } }
}
async function muatTunda() {
  const u = auth.currentUser; if (!u || !kelola()) return;
  try {
    const d = await getDoc(doc(db, "pemberitahuan_tunda", u.uid));
    if (d.exists()) tunda = { ...(d.data().map || {}), ...tunda }; // yang baru diubah di perangkat ini menang
    try { localStorage.setItem(K_TUNDA, JSON.stringify(tunda)); } catch (e) {}
  } catch (e) { console.warn("Tunda pemberitahuan belum bisa dibaca:", e && e.code); }
}
const tambahHari = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// mode: "tunda" (hari hari) | "selesai" | "kembali"
export async function aturItem(ids, mode, hari = 7) {
  const per = new Map(terakhir.semua.map((i) => [i.id, i]));
  ids.forEach((id) => { const it = per.get(id); if (!it) return; if (mode === "kembali") delete tunda[id]; else tunda[id] = mode === "tunda" ? { s: "tunda", sampai: tambahHari(hari) } : { s: "selesai", sig: it.judul }; });
  await simpanTunda();
  perbaruiLencana(); gambarPanel(); document.dispatchEvent(new CustomEvent("islhub:notif"));
  return mode === "tunda" ? tambahHari(hari) : null;
}
export const tersembunyi = () => terakhir.semua.filter(sembunyi);

let terakhir = { semua: [], t: new Set() };
// Kategori tampilan (halaman Pemberitahuan). Item boleh membawa `grup` sendiri.
export const GRUP = [["tarif", "Master Rate · Tarif"], ["vendor", "Master Rate · Vendor"], ["lokasi", "Master Rate · Lokasi"], ["quotation", "Quotation"], ["sistem", "Sistem"]];
const GRUP_JENIS = { quotation: "quotation", riwayat: "quotation", tarif: "tarif", vendor: "vendor", lokasi: "lokasi" };
export const grupDari = (i) => i.grup || GRUP_JENIS[i.jenis] || "sistem";
export const semuaItem = () => terlihat();
export const muatUlang = (paksa) => muat(paksa);
export const bisaKelola = kelola;
const terlihat = () => terakhir.semua.filter((i) => !sembunyi(i));                       // lonceng: semua yang masih perlu perhatian
const dilayar = () => (sisaLayarMs() > 0 ? terakhir.semua.filter((i) => !ditutup().has(i.id) && !sembunyi(i)) : []);  // di layar: 10 detik pertama, belum ditutup

// Pemberitahuan per modul: tampil di halaman modulnya saja (bukan di Beranda), 3 contoh + tautan ke lonceng.
// hanyaLayar: tampil hanya selama LAMA_LAYAR_MS sejak login; setelahnya tinggal di lonceng.
export function htmlPerModul(jenis, judul, maks = 3, hanyaLayar = false) {
  const items = (hanyaLayar ? dilayar() : terlihat()).filter((i) => jenis.includes(i.jenis));
  if (!items.length) return "";
  return `<section class="nf-modul"><div class="nf-modul__h"><b>${esc(judul)} · ${items.length}</b><button type="button" class="nf-link" data-nf-panel>Lihat semua</button></div><div class="nf-modul__daftar">${htmlDaftar(items, maks)}</div></section>`;
}
if (typeof window !== "undefined") window.ISLNotif = { htmlPerModul };
document.addEventListener("click", (ev) => { if (ev.target.closest("[data-nf-panel]")) document.getElementById("btn-lonceng")?.click(); });

export function htmlDaftar(items, maks = 99, bisaTutup = false) {
  return items.length ? items.slice(0, maks).map((i) => baris(i, bisaTutup)).join("") : '<p class="nf-kosong">Tidak ada pemberitahuan. Semua beres.</p>';
}

function perbaruiLencana() {
  const b = document.getElementById("nf-lencana"), n = terlihat().length; if (!b) return;
  b.textContent = n > 99 ? "99+" : String(n); b.hidden = n === 0;
  const btn = document.getElementById("btn-lonceng"); if (btn) btn.setAttribute("aria-label", n ? `Pemberitahuan, ${n} belum ditangani` : "Pemberitahuan");
}
function gambarPanel() {
  const p = document.getElementById("nf-panel"); if (!p) return;
  const lihat = terlihat();
  p.innerHTML = `<div class="nf-h"><b>Pemberitahuan${lihat.length ? ` (${lihat.length})` : ""}</b><button type="button" class="nf-link" data-nf-segar>Segarkan</button><button type="button" class="nf-tutup" data-nf-panel-tutup aria-label="Tutup">${svg('<path d="M6 6l12 12M18 6 6 18"/>', 18)}</button></div>
    <div class="nf-daftar">${htmlDaftar(lihat)}</div>
    <div class="nf-f">${kelola() ? '<button type="button" class="nf-semua" data-nf-semua>Lihat semua pemberitahuan</button>' : ""}<small>Semua yang masih perlu ditangani. Hilang otomatis setelah masalahnya selesai.</small></div>`;
}
const K_POPUP_PENDAFTAR = "islhub-popup-pendaftar";
/* Pop-up untuk master: ada sales baru yang harus segera ditindaklanjuti. Muncul sekali per sesi; muncul lagi kalau jumlahnya bertambah. */
function popupPendaftar() {
  if (window.matchMedia("(max-width: 760px)").matches) return; // HP: tidak ditampilkan, cukup lonceng
  const it = terakhir.semua.find((i) => i.jenis === "pendaftar"); if (!it) return;
  const sudah = Number(baca(K_POPUP_PENDAFTAR, 0)) || 0;
  if (it.daftar.length <= sudah) return;
  tulis(K_POPUP_PENDAFTAR, it.daftar.length);
  const kotak = document.createElement("div");
  kotak.className = "ip-lapis"; kotak.setAttribute("role", "alertdialog"); kotak.setAttribute("aria-modal", "true"); kotak.setAttribute("aria-label", "Sales baru harus ditindaklanjuti");
  const n = it.daftar.length, lihat = it.daftar.slice(0, 4);
  const daftarHtml = lihat.map((x) => `<div class="ip-orang"><span class="ip-avatar" aria-hidden="true">${esc(initial(x.nama || x.email))}</span><div style="min-width:0"><div class="ip-nama">${esc(x.nama || "(tanpa nama)")}</div><div class="ip-mail">${esc(x.email)}</div></div></div>`).join("")
    + (n > lihat.length ? `<p class="ip-sisa">dan ${n - lihat.length} lainnya</p>` : "");
  kotak.innerHTML = `<div class="ip-kartu">
    <div class="ip-grip"></div>
    <div class="ip-head">
      <span class="ip-ikon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8v6M14 11h6"/></svg></span>
      <div class="ip-head-teks"><div class="ip-judul">Sales baru harus ditindaklanjuti</div><div class="ip-sub">${n} akun menunggu persetujuan Anda</div></div>
    </div>
    <div class="ip-kotak" style="padding:4px 14px">${daftarHtml}</div>
    <div class="ip-aksi ip-aksi--baris" style="margin-top:14px">
      <button type="button" class="ip-btn ip-btn--sunyi" id="pp-nanti">Nanti</button>
      <button type="button" class="ip-btn ip-btn--utama" id="pp-buka">Tinjau dan setujui</button>
    </div>
  </div>`;
  document.body.appendChild(kotak);
  kotak.querySelector("#pp-nanti").addEventListener("click", () => kotak.remove());
  kotak.querySelector("#pp-buka").addEventListener("click", () => { kotak.remove(); bukaPendaftarAksi({ onSelesai: () => muat(true) }); });
}
async function muat(paksa) { if (!tundaDimuat) { tundaDimuat = true; await muatTunda(); } const sebelum = terlihat().length; try { terakhir = await kumpulkan({ paksa }); if (terlihat().length > sebelum) goyang(); } catch (e) { console.warn(e); } perbaruiLencana(); gambarPanel(); document.dispatchEvent(new CustomEvent("islhub:notif")); popupPendaftar(); }

// lonceng bergoyang sebentar saat peringatan di layar pindah ke lonceng
export function goyang() { const b = document.getElementById("btn-lonceng"); if (!b) return; b.classList.remove("nf-goyang"); void b.offsetWidth; b.classList.add("nf-goyang"); }
let pewaktu = null;
function jadwalkanHabis() {
  clearTimeout(pewaktu); const sisa = sisaLayarMs();
  if (sisa > 0) pewaktu = setTimeout(() => { goyang(); document.dispatchEvent(new CustomEvent("islhub:notif")); document.dispatchEvent(new CustomEvent("islhub:layar-habis")); }, sisa + 50);
}
// ---------- peringatan banner di halaman: 30 detik di layar, lalu pindah ke lonceng ----------
// Berlaku untuk semua banner peringatan/bahaya di halaman (kecuali di dalam panel atau dialog, yang sedang diisi).
const K_PW = "islhub-pw-lonceng", K_PW_MULAI = "islhub-pw-mulai";
const SEL_PW = '[class*="mr-banner--peringatan"], [class*="mr-banner--bahaya"]';
const dalamLayar = (el) => el.closest(".mr-panel, .mr-konfirm, #mr-layer, #nf-panel");
const pwTerkumpul = () => baca(K_PW, []);
// Kunci peringatan: halaman + teksnya tanpa angka, supaya "2 tarif…" dan "3 tarif…" dianggap sama.
function kunciTeks(teks, hash) {
  const t = String(teks).toLowerCase().replace(/[0-9.,]+/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  let x = 0; for (const c of hash + "|" + t) x = (x * 31 + c.charCodeAt(0)) | 0;
  return "pw" + (x >>> 0).toString(36);
}
const absenSejak = {}; // kunci -> waktu sejak peringatan tidak tampil lagi (saat halaman sumbernya dibuka)
function pwCek() {
  const mulai = baca(K_PW_MULAI, {}), now = Date.now(), hash = location.hash;
  const hadir = new Set();
  let ubah = false;
  document.querySelectorAll(SEL_PW).forEach((el) => {
    if (dalamLayar(el)) return;
    const teks = el.innerText.replace(/\s+/g, " ").trim();
    const id = kunciTeks(teks, hash); hadir.add(id);
    delete absenSejak[id];
    if (mulai[id] === -1) { el.style.display = "none"; return; } // sudah pindah ke lonceng
    if (!mulai[id]) { mulai[id] = now; ubah = true; }
    if (now - mulai[id] < LAMA_LAYAR_MS) return;
    const l = pwTerkumpul().filter((i) => i.id !== "pw:" + id);
    l.push({ id: "pw:" + id, jenis: "halaman", level: /bahaya/.test(el.className) ? "bahaya" : "warn", judul: teks.slice(0, 120), ket: "Peringatan dari halaman ini", tujuan: { jenis: "halaman", hash } });
    tulis(K_PW, l);
    mulai[id] = -1; ubah = true;
    el.style.display = "none";
    goyang(); muat(false);
  });
  // item lonceng dari halaman yang sedang dibuka: hapus bila peringatannya sudah tidak tampil (kondisi beres)
  const daftar = pwTerkumpul();
  let dihapus = false;
  const sisa = daftar.filter((i) => {
    if (i.tujuan.hash !== hash) return true;
    const kunci = i.id.slice(3);
    if (hadir.has(kunci)) { delete absenSejak[kunci]; return true; }
    absenSejak[kunci] = absenSejak[kunci] || now;
    if (now - absenSejak[kunci] < 8000) return true; // beri waktu saat halaman masih memuat
    delete mulai[kunci]; delete absenSejak[kunci]; dihapus = true; return false;
  });
  if (dihapus) { tulis(K_PW, sisa); ubah = true; muat(false); }
  // peringatan yang sudah tidak ada di halaman mana pun (belum pindah ke lonceng) dibersihkan dari pencatat waktu
  for (const k of Object.keys(mulai)) if (!hadir.has(k) && mulai[k] !== -1 && mulai[k] && hash) { delete mulai[k]; ubah = true; }
  if (ubah) tulis(K_PW_MULAI, mulai);
}
export function pasangLonceng(kanan) {
  if (!kanan || document.getElementById("btn-lonceng")) return;
  kanan.insertAdjacentHTML("afterbegin", `<button type="button" class="tb-btn tb-btn--lonceng" id="btn-lonceng" aria-label="Pemberitahuan" aria-expanded="false" title="Pemberitahuan">${svg('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>', 20)}<i class="nf-lencana" id="nf-lencana" hidden></i></button>`);
  if (!document.getElementById("nf-panel")) document.body.insertAdjacentHTML("beforeend", '<div id="nf-panel" class="nf-panel" role="dialog" aria-label="Pemberitahuan" hidden></div>');
  const panel = document.getElementById("nf-panel"), tutupPanel = () => { panel.hidden = true; document.getElementById("btn-lonceng").setAttribute("aria-expanded", "false"); };
  document.getElementById("btn-lonceng").addEventListener("click", () => { const buka = panel.hidden; panel.hidden = !buka; document.getElementById("btn-lonceng").setAttribute("aria-expanded", String(buka)); if (buka) { gambarPanel(); muat(false); } });
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!panel.hidden && !t.closest("#nf-panel") && !t.closest("#btn-lonceng")) tutupPanel();
    const x = t.closest("[data-nf-tutup]"), b = t.closest("[data-nf-buka]");
    if (x) { tutupSementara(x.dataset.nfTutup); goyang(); document.dispatchEvent(new CustomEvent("islhub:notif")); }
    else if (b) { const it = terakhir.semua.find((i) => i.id === b.dataset.nfBuka); if (it) { tutupPanel(); bukaTujuan(it.tujuan); } }
    else if (t.closest("[data-nf-semua]")) { tutupPanel(); if ((location.pathname.split("/").pop() || "index.html") === "app.html") location.hash = "#pemberitahuan"; else location.href = "app.html#pemberitahuan"; }
    else if (t.closest("[data-nf-panel-tutup]")) tutupPanel();
    else if (t.closest("[data-nf-segar]")) muat(true);
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !panel.hidden) tutupPanel(); });
  // tunggu status login siap, lalu muat
  const coba = (n = 0) => { if (auth.currentUser) muat(false); else if (n < 20) setTimeout(() => coba(n + 1), 250); };
  mulaiLayar(); jadwalkanHabis(); coba(); pantauPendaftar();
  setInterval(pwCek, 1000);
}
export const dapatItem = () => ({ semua: terlihat(), terlihat: dilayar() });
