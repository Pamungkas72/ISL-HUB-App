// ===========================================================
// LEGAL — kontrak berjalan (upload PDF, masa berlaku, pengingat 60 dan 30 hari) dan MOM (legal-mom.js).
// Data: lg_kontrak (master dan admin), lg_mom (pemilik; master dan admin melihat semua). PDF kontrak di Storage legal/.
// Tiga tab: Perusahaan (kartu kelengkapan per perusahaan grup), Kontrak, MOM. Pencarian di atas, tombol tambah berupa FAB seperti Master Rate (desain 19 Nov 2026).
// ===========================================================
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { db } from "./firebase-config.js";
import { unggahBlob } from "./app-store.js";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as M from "./legal-mom.js";
export const JENIS_DOK = [["Akta Pendirian", "Akta"], ["SK Kemenkumham", "SK"], ["NIB", "NIB"], ["NPWP", "NPWP"], ["Izin Usaha", "Izin"], ["Surat Domisili", "Domisili"], ["Akta Perubahan", "Perubahan"], ["Sertifikat (ISO dll)", "Sertifikat"]]; // dokumen legalitas standar per perusahaan

import { BATAS_HARI, statusKontrak as hitungStatus } from "./legal-hitung.js";
export { BATAS_HARI };
export const JENIS = { customer: "Kontrak Customer", vendor: "Kontrak Vendor", mou: "MOU", addendum: "Addendum", perusahaan: "Dokumen Perusahaan" };
const S = { u: null, profil: null, staf: false, tab: "", kontrak: [], mom: [], pers: [], muat: true, galat: "", fJenis: "", cari: "", edit: null, ver: 0, pilih: new Set(), modePilih: false, terbuka: "", sisi: "", urut: "", ids: [] };
const hp = () => window.matchMedia("(max-width: 760px)").matches;
const hariIni = () => window.__ISL.hariIni();
const uid = () => "lg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTgl = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const ms = (t) => (t && t.toMillis ? t.toMillis() : t ? Date.parse(t) || 0 : 0); // Timestamp Firestore atau teks ISO
const rp = (n) => (n || n === 0 ? "Rp " + Number(n).toLocaleString("id-ID") : "–");

export const statusKontrak = (k, now = hariIni()) => hitungStatus(k, now);
const WARNA = { aktif: "ok", segera: "wn", mendesak: "bd", berakhir: "gr", draf: "gr" };
const lencana = (k) => { const st = statusKontrak(k); return `<span class="lg-badge lg-badge--${WARNA[st.kode]}">${e(st.label)}</span>`; };

/* ---------- data ---------- */
async function muat() {
  S.muat = true; S.galat = ""; gambar();
  try {
    const mq = S.staf ? collection(db, "lg_mom") : query(collection(db, "lg_mom"), where("pemilikUid", "==", S.u.uid));
    const [m, k, pr] = await Promise.all([getDocs(mq), S.staf ? getDocs(collection(db, "lg_kontrak")) : Promise.resolve(null), S.staf ? getDocs(collection(db, "lg_perusahaan")) : Promise.resolve(null)]);
    S.pers = pr ? pr.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.tipe === "induk" ? 0 : 1) - (b.tipe === "induk" ? 0 : 1) || String(a.nama).localeCompare(String(b.nama), "id")) : [];
    S.mom = m.docs.map((d) => ({ id: d.id, ...d.data() }));
    S.kontrak = k ? k.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
      } catch (err) { console.error(err); S.galat = "Data Legal belum bisa dibaca. Pemilik perlu memasang aturan Firestore dan Storage terbaru (firebase deploy --only firestore:rules,storage)."; }
  S.muat = false; gambar();
}
const urut = (a, b) => (statusKontrak(a).sisa ?? 99999) - (statusKontrak(b).sisa ?? 99999);
const akanBerakhir = () => S.kontrak.filter((k) => ["segera", "mendesak"].includes(statusKontrak(k).kode)).sort(urut);
const sudahBerakhir = () => S.kontrak.filter((k) => statusKontrak(k).kode === "berakhir");
const cocok = (teks) => !S.cari || teks.toLowerCase().includes(S.cari.toLowerCase());

/* ---------- tampilan ---------- */
const TAB = () => (S.staf ? [["perusahaan", "Perusahaan"], ["kontrak", "Kontrak"], ["mom", "MOM"]] : [["mom", "MOM"]]);
const WARNA_PT = ["#0A3D66", "#9A4F00", "#1F7A55", "#6B3FC0", "#0B6E70"]; // kontras putih minimal 4,5:1
function baris(ikn, judul, sub, kanan, data) {
  return `<button type="button" class="lg-baris" ${data}><i class="lg-ikon">${ikon(ikn, 18)}</i><span class="lg-baris__t"><b>${e(judul)}</b><small>${e(sub)}</small></span><span class="lg-baris__k">${kanan}</span></button>`;
}
const pilihAktif = () => S.modePilih || S.pilih.size > 0;
/** Satu baris daftar: geser kanan = aksi, geser kiri = Hapus, tekan lama = pilih banyak (sama dengan Daily Job). */
function rw(kunci, id, ikn, judul, sub, kanan, aksi, bisaHapus) {
  const ada = pilihAktif(), akt = ada ? [] : aksi, wa = akt.length * 62, wh = ada || !bisaHapus ? 0 : 80, buka = S.terbuka === id ? ` is-geser-${S.sisi}` : "";
  const btn = ([a, i, t, w]) => `<button type="button" class="dj-sw__${w}" data-lg-a="${a}" data-id="${e(id)}">${ikon(i, 18)}<span>${t}</span></button>`;
  return `<div class="dj-rw${S.terbuka === id ? " is-buka" : ""}" data-wa="${wa}" data-wh="${wh}" style="--dj-wa:${wa}px">${ada ? "" : `<div class="dj-sw dj-sw--kiri">${akt.map(btn).join("")}</div>${wh ? `<div class="dj-sw dj-sw--kanan">${btn(["hapus", "tong", "Hapus", "bahaya"])}</div>` : ""}`}
    <div class="dj-job2${S.pilih.has(id) ? " is-pilih" : ""}${buka}" data-lg-${kunci}="${e(id)}" data-id="${e(id)}" tabindex="0" role="button">${ada ? `<input type="checkbox" class="lg-cb" ${S.pilih.has(id) ? "checked" : ""} aria-label="Pilih">` : `<i class="dj-ik">${ikon(ikn, 18)}</i>`}<div class="dj-job__isi"><b>${e(judul)}</b><small>${e(sub)}</small></div><div class="dj-job__t">${kanan}</div></div></div>`;
}
const barisKontrak = (k) => rw("kontrak", k.id, k.jenis === "perusahaan" ? "tameng" : "file", k.pihak || "Tanpa nama", [JENIS[k.jenis] || "Dokumen", k.nomor, k.lini].filter(Boolean).join(" · "), `${k.berakhir && !k.draf ? `<b>s/d ${fmtTgl(k.berakhir)}</b>` : ""}${lencana(k)}`,
  [["ubah", "edit", "Ubah", "sky"], ...(k.draf ? [] : [["perpanjang", "riwayat", "Perpanjang", "ok"]]), ...(k.file ? [["file", "file", "File", "info"]] : []), ["bagikan", "salin", "Bagikan", "info"]], S.staf);
const barisMom = (m) => rw("mom", m.id, "edit", m.judul || "MOM tanpa judul", [m.nomor || "Draf", S.staf ? m.pemilikNama : "", m.customerNama].filter(Boolean).join(" · "), `<b>${fmtTgl(m.tanggal)}</b><span class="lg-badge lg-badge--${m.status === "final" ? "ok" : "gr"}">${m.status === "final" ? "Final" : "Draf"}</span>`,
  [[m.status === "final" ? "buka" : "ubah", "edit", m.status === "final" ? "Buka" : "Ubah", "sky"], ["pdf", "download", "PDF", "ok"], ["bagikan", "salin", "Bagikan", "info"], ["salinmom", "papan-plus", "Salin", "info"]], S.staf || m.status !== "final");
/** Bilah alat di atas daftar: urutkan dan Pilih; saat mode pilih berganti menjadi bilah aksi massal (pola Daily Job). */
function alat(opsiUrut) {
  const n = S.pilih.size, kont = S.tab === "kontrak", bs = (a, i, t, k = "") => `<button type="button" class="mr-btn dj-bp${k ? " " + k : ""}" data-lg-m="${a}" title="${t}" aria-label="${t}">${ikon(i, 16)}<span class="dj-bp__t"> ${t}</span></button>`;
  if (pilihAktif()) return `<div class="dj-kepala dj-kepala--d dj-kepala--pilih lg-alat"><button type="button" class="mr-ikonbtn" data-lg-m="batal" title="Batal pilih" aria-label="Batal pilih">${ikon("tutup", 16)}</button><b class="dj-bp__n">${n} dipilih</b><button type="button" class="mr-link" data-lg-m="semua">${n && n === S.ids.length ? "Batal semua" : "Pilih semua"}</button><span class="mr-ruang"></span>${n ? `${kont ? bs("status", "cek", "Ubah status") : bs("pdf", "download", "PDF gabungan")}${bs("hapus", "tong", "Hapus", "dj-bp--hapus")}` : ""}</div>`;
  return `<div class="lg-alat"><label class="lg-urut">Urutkan <select data-lg-urut aria-label="Urutkan">${opsiUrut.map(([v, l]) => `<option value="${v}"${(S.urut || opsiUrut[0][0]) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label><button type="button" class="mr-link" data-lg-m="pilih">Pilih</button></div>`;
}
const kosong = (t) => `<div class="lg-kosong"><p>${e(t)}</p></div>`;
const docsPt = (p) => S.kontrak.filter((k) => k.jenis === "perusahaan" && k.perusahaanId === p.id);
const inisial = (n) => String(n || "?").replace(/^(PT|CV)\.?\s+/i, "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 3).toUpperCase();
/** Status satu jenis dokumen pada satu perusahaan: yang terburuk menang; tidak ada berkas = kosong. */
function chipDok(p, jenis) {
  const ds = docsPt(p).filter((k) => k.jenisDok === jenis); if (!ds.length) return "no";
  const k = ds.map((x) => statusKontrak(x).kode); return k.includes("berakhir") || k.includes("mendesak") ? "bd" : k.includes("segera") ? "wn" : "ok";
}
function kartuPt(p, i) {
  const st = JENIS_DOK.map(([j, s]) => [s, chipDok(p, j)]), ada = st.filter(([, c]) => c !== "no").length, pct = Math.round((ada / JENIS_DOK.length) * 100), masalah = st.filter(([, c]) => c === "bd" || c === "wn").length;
  return `<button type="button" class="lg-pt" data-lg-pt="${e(p.id)}"><span class="lg-pt__h"><i class="lg-logo" style="background:${WARNA_PT[i % WARNA_PT.length]}">${e(p.inisial || inisial(p.nama))}</i><span class="lg-pt__n"><b>${e(p.nama)}</b><small>${p.tipe === "induk" ? "Induk" : "Anak perusahaan"}${masalah ? ` · ${masalah} perlu perhatian` : ""}</small></span><span class="lg-ring" style="--p:${pct}%"><i>${ada}/${JENIS_DOK.length}</i></span></span>
    <span class="lg-pt__c">${st.map(([s, c]) => `<span class="lg-pill lg-pill--${c}">${e(s)}</span>`).join("")}</span></button>`;
}
function tabPerusahaan() {
  const ps = S.pers.filter((p) => cocok([p.nama, ...docsPt(p).map((k) => [k.pihak, k.nomor, k.jenisDok].join(" "))].join(" ")));
  return `<div class="lg-grid">${ps.map(kartuPt).join("")}${S.cari ? "" : `<button type="button" class="lg-pt lg-pt--baru" data-lg="pt-baru">${ikon("plus", 16)} Tambah perusahaan</button>`}</div>${!ps.length && S.cari ? kosong("Tidak ada perusahaan atau dokumen yang cocok.") : ""}`;
}
const chipL = (v, on, label, n, warn) => `<button type="button" class="cu-chip${on ? " is-on" : ""}${warn && n ? " is-warn" : ""}" data-lg-fj="${v}">${label}${n != null ? ` <em>${n}</em>` : ""}</button>`; // sama dengan chip cepat halaman Customer
function tabKontrak() {
  const nonPt = S.kontrak.filter((k) => k.jenis !== "perusahaan"), kode = (k) => statusKontrak(k).kode, n = (fn) => nonPt.filter(fn).length;
  const F = { "": () => true, customer: (k) => k.jenis === "customer", vendor: (k) => k.jenis === "vendor", lain: (k) => ["mou", "addendum"].includes(k.jenis), draf: (k) => k.draf, segera: (k) => ["segera", "mendesak"].includes(kode(k)), berakhir: (k) => kode(k) === "berakhir" }, f = F[S.fJenis] || (() => true);
  const u = S.urut || "jatuh", tampil = nonPt.filter((k) => f(k) && cocok([k.pihak, k.nomor, k.lini].join(" "))).sort(u === "nama" ? (x, y) => String(x.pihak).localeCompare(String(y.pihak), "id") : u === "baru" ? (x, y) => ms(y.dibuat) - ms(x.dibuat) : urut), c = (v, l, fn, warn) => chipL(v, S.fJenis === v, l, v === "" ? null : n(fn), warn);
  return `<div class="cu-chips">${chipL("", !S.fJenis, "Semua", null)}${c("customer", "Customer", F.customer)}${c("vendor", "Vendor", F.vendor)}${c("lain", "MOU", F.lain)}${c("segera", ikon("peringatan", 14) + " Segera habis", F.segera, true)}${c("draf", "Draf", F.draf)}${c("berakhir", "Berakhir", F.berakhir)}</div>
    ${(S.ids = tampil.map((k) => k.id), "")}${alat([["jatuh", "Jatuh tempo terdekat"], ["nama", "Nama A–Z"], ["baru", "Terbaru ditambahkan"]])}
    <div class="dj-lst lg-daftar">${tampil.map(barisKontrak).join("") || kosong("Belum ada kontrak. Ketuk tombol + untuk mengunggah kontrak yang sedang berjalan atau menyimpan draf.")}</div>`;
}
function tabMom() {
  const f = { "": () => true, draf: (m) => m.status !== "final", final: (m) => m.status === "final" }[S.fJenis] || (() => true);
  const tampil = S.mom.filter((m) => f(m) && cocok([m.judul, m.nomor, m.customerNama, m.pemilikNama].join(" "))).sort(S.urut === "nama" ? (a, b) => String(a.judul).localeCompare(String(b.judul), "id") : S.urut === "nomor" ? (a, b) => String(b.nomor).localeCompare(String(a.nomor)) : (a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  let bln = "", isi = ""; const perBulan = !S.urut || S.urut === "tanggal"; S.ids = tampil.map((m) => m.id);
  tampil.forEach((m) => { const b = m.tanggal ? new Date(m.tanggal + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase() : "TANPA TANGGAL"; if (perBulan && b !== bln) { bln = b; isi += `<div class="lg-bln">${e(b)}</div>`; } isi += barisMom(m); });
  return `<div class="cu-chips">${[["", "Semua"], ["draf", "Draf"], ["final", "Final"]].map(([v, l]) => chipL(v, S.fJenis === v, l, v === "draf" ? S.mom.filter((m) => m.status !== "final").length : v === "final" ? S.mom.filter((m) => m.status === "final").length : null)).join("")}</div>${alat([["tanggal", "Tanggal terbaru"], ["nama", "Judul A–Z"], ["nomor", "Nomor"]])}<div class="dj-lst lg-daftar">${isi || kosong("Belum ada MOM. Ketuk tombol + untuk mencatat rapat pertama.")}</div>`;
}
const FAB = { perusahaan: ["tameng-plus", "Tambah perusahaan atau dokumen"], kontrak: ["berkas-plus", "Tambah kontrak"], mom: ["papan-plus", "Buat MOM"] };
function gambar() {
  const r = $("#lg-root"); if (!r) return;
  if (S.edit) { r.innerHTML = M.tampilEditor(); M.pasangEditor(r); return; }
  const [ik, lab] = FAB[S.tab] || FAB.mom, tab = TAB();
  r.innerHTML = `<div class="lg">
    <div class="lg-cari-w"><i>${ikon("cari", 18)}</i><input class="lg-cari" type="search" placeholder="${S.tab === "perusahaan" ? "Cari perusahaan, dokumen, atau nomor" : S.tab === "kontrak" ? "Cari pihak, nomor, atau lini" : "Cari judul, nomor, atau customer"}" value="${e(S.cari)}" data-lg-cari aria-label="Cari"></div>
    ${S.galat ? `<div class="mr-banner mr-banner--bahaya">${e(S.galat)}</div>` : ""}
    ${tab.length > 1 ? `<div class="lg-tabs" role="tablist">${tab.map(([k, l]) => { const n = k === "perusahaan" ? S.pers.length : k === "kontrak" ? S.kontrak.filter((x) => x.jenis !== "perusahaan").length : S.mom.length; return `<button type="button" role="tab" class="${S.tab === k ? "is-aktif" : ""}" data-lg-tab="${k}">${l}${n ? `<em>${n}</em>` : ""}</button>`; }).join("")}</div>` : ""}
    ${S.muat ? `<p class="mr-sub">Memuat…</p>` : S.tab === "perusahaan" ? tabPerusahaan() : S.tab === "kontrak" ? tabKontrak() : tabMom()}
    ${pilihAktif() ? "" : `<button type="button" class="mr-fab fab-d fab--legal" data-lg="fab" aria-label="${lab}" title="${lab}">${ikon(ik, 24)}<span class="fab-teks">${lab}</span></button>`}</div>`;
}

/* ---------- kontrak: form, detail, perpanjang ---------- */
const opsiLini = () => ((window.__islMR && window.__islMR.lini) || []).map((l) => l.nama || l.id);
const namaPihak = (jenis) => (jenis === "vendor" ? ((window.__islMR && window.__islMR.vendor) || []).map((v) => v.nama) : ((window.__ISL_DATA && window.__ISL_DATA.customers) || []).map((c) => c.nama)).filter(Boolean);
function formKontrak(k) {
  const baru = !k.id, d = { jenis: "customer", perusahaanId: "", jenisDok: "", draf: false, pihak: "", nomor: "", lini: "", mulai: "", berakhir: "", nilai: "", pic: "", autoRenew: false, catatan: "", ...k };
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>${baru ? "Tambah dokumen legal" : "Ubah dokumen"}</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi"><div class="mr-form">
      <label class="mr-f"><span>Jenis</span><select id="lk-jenis">${Object.entries(JENIS).map(([v, l]) => `<option value="${v}"${d.jenis === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="mr-f lk-pt"><span>Perusahaan</span><select id="lk-pt">${S.pers.map((x) => `<option value="${e(x.id)}"${d.perusahaanId === x.id ? " selected" : ""}>${e(x.nama)}</option>`).join("")}</select></label>
      <label class="mr-f lk-pt"><span>Jenis dokumen</span><select id="lk-jd">${JENIS_DOK.map(([j]) => `<option${d.jenisDok === j ? " selected" : ""}>${e(j)}</option>`).join("")}<option${d.jenisDok === "Lainnya" ? " selected" : ""}>Lainnya</option></select></label>
      <label class="mr-f"><span id="lk-pl">Pihak</span><input id="lk-pihak" list="lk-dl" value="${e(d.pihak)}" maxlength="120"><datalist id="lk-dl"></datalist></label>
      <label class="mr-f"><span>Nomor dokumen</span><input id="lk-nomor" value="${e(d.nomor)}" maxlength="60"></label>
      <label class="mr-f"><span>Lini bisnis</span><input id="lk-lini" list="lk-dll" value="${e(d.lini)}" maxlength="60"><datalist id="lk-dll">${opsiLini().map((l) => `<option value="${e(l)}">`).join("")}</datalist></label>
      <label class="mr-f"><span>Tanggal mulai</span><input type="date" id="lk-mulai" value="${e(d.mulai)}"></label>
      <label class="mr-f"><span>Tanggal berakhir <small>(kosong = tanpa batas)</small></span><input type="date" id="lk-akhir" value="${e(d.berakhir)}"></label>
      <label class="mr-f"><span>Nilai (Rp) <small>opsional</small></span><input id="lk-nilai" inputmode="numeric" value="${d.nilai === "" ? "" : e(Number(d.nilai).toLocaleString("id-ID"))}"></label>
      <label class="mr-f"><span>PIC internal</span><input id="lk-pic" value="${e(d.pic)}" maxlength="80"></label>
      <label class="mr-f mr-f--lebar"><span><input type="checkbox" id="lk-auto" ${d.autoRenew ? "checked" : ""}> Diperpanjang otomatis (auto-renew)</span></label>
      <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="lk-cat" rows="3" maxlength="600">${e(d.catatan)}</textarea></label>
      <label class="mr-f mr-f--lebar"><span>File PDF kontrak ${d.file ? `<small>(sudah ada: <a href="${e(d.file.url)}" target="_blank" rel="noopener">${e(d.file.nama)}</a>; pilih file baru untuk mengganti)</small>` : ""}</span><input type="file" id="lk-file" accept="application/pdf,image/*"></label>
    </div></div><div class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><span class="mr-ruang"></span><button class="mr-btn" id="lk-draf">Simpan draf</button><button class="mr-btn mr-btn--utama" id="lk-simpan">Simpan</button></div>`, { lebar: "drawer" });
  const segar = () => { const j = $("#lk-jenis", p).value, pt = j === "perusahaan"; p.querySelectorAll(".lk-pt").forEach((x) => (x.hidden = !pt)); $("#lk-draf", p).hidden = pt; $("#lk-pl", p).textContent = pt ? "Nama dokumen" : j === "vendor" ? "Vendor" : j === "customer" ? "Customer" : "Pihak"; $("#lk-dl", p).innerHTML = namaPihak(j).map((n) => `<option value="${e(n)}">`).join(""); };
  $("#lk-jenis", p).onchange = segar; segar();
  $("#lk-jd", p).onchange = () => { if (!$("#lk-pihak", p).value.trim() || JENIS_DOK.some(([j]) => j === $("#lk-pihak", p).value)) $("#lk-pihak", p).value = $("#lk-jd", p).value; };
  if (d.jenis === "perusahaan" && !d.pihak) $("#lk-pihak", p).value = $("#lk-jd", p).value;
  const simpan = (draf) => async () => {
    const v = (i) => $(i, p).value.trim(), pihak = v("#lk-pihak"), mulai = v("#lk-mulai"), akhir = v("#lk-akhir"), pt = v("#lk-jenis") === "perusahaan";
    if (!pihak) return toast("Isi nama pihak atau dokumen.", "bahaya");
    if (pt && !v("#lk-pt")) return toast("Tambahkan perusahaan dulu, lalu unggah dokumennya.", "bahaya");
    if (mulai && akhir && akhir < mulai) return toast("Tanggal berakhir tidak boleh sebelum tanggal mulai.", "bahaya");
    const tb = $(draf ? "#lk-draf" : "#lk-simpan", p); tb.disabled = true; tb.textContent = "Menyimpan…";
    try {
      const id = d.id || uid(), f = $("#lk-file", p).files[0];
      const data = { jenis: v("#lk-jenis"), draf: !!draf, perusahaanId: pt ? v("#lk-pt") : "", jenisDok: pt ? v("#lk-jd") : "", pihak, nomor: v("#lk-nomor"), lini: v("#lk-lini"), mulai, berakhir: akhir, nilai: Number(v("#lk-nilai").replace(/\D/g, "")) || "", pic: v("#lk-pic"), autoRenew: $("#lk-auto", p).checked, catatan: v("#lk-cat"), riwayat: d.riwayat || [], file: d.file || null, diubah: serverTimestamp(), ...(baru ? { dibuat: serverTimestamp(), dibuatOleh: S.u.email } : {}) };
      if (f) { const nm = f.name.replace(/[^\w.\-]+/g, "_"); data.file = { nama: f.name, path: `legal/${id}/${Date.now()}_${nm}`, url: "" }; data.file.url = await unggahBlob(data.file.path, f, f.type || "application/pdf"); }
      await setDoc(doc(db, "lg_kontrak", id), data, { merge: true });
      tutupLayer(); toast(draf ? "Draf tersimpan." : "Dokumen tersimpan."); await muat();
    } catch (err) { console.error(err); toast("Gagal menyimpan: " + e(err.message || err), "bahaya"); tb.disabled = false; tb.textContent = draf ? "Simpan draf" : "Simpan"; }
  };
  $("#lk-simpan", p).onclick = simpan(false); $("#lk-draf", p).onclick = simpan(true);
}
function detailKontrak(k) {
  const st = statusKontrak(k);
  const p = bukaLayer(`<div class="mr-panel__kepala"><div><h2>${e(k.pihak)}</h2><p class="mr-sub">${e(JENIS[k.jenis] || "")}${k.nomor ? " · " + e(k.nomor) : ""}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi"><div class="lg-rinci">
      <div><small>Status</small>${lencana(k)}</div><div><small>Lini bisnis</small>${e(k.lini || "–")}</div>
      <div><small>Mulai</small>${fmtTgl(k.mulai)}</div><div><small>Berakhir</small>${k.berakhir ? fmtTgl(k.berakhir) : "Tanpa batas"}</div>
      <div><small>Nilai</small>${rp(k.nilai)}</div><div><small>PIC internal</small>${e(k.pic || "–")}</div>
      <div><small>Perpanjangan otomatis</small>${k.autoRenew ? "Ya" : "Tidak"}</div><div><small>Pengingat</small>${k.berakhir ? "60 dan 30 hari sebelum berakhir" : "–"}</div></div>
      ${k.catatan ? `<p class="lg-cat">${e(k.catatan)}</p>` : ""}
      ${k.file ? `<a class="mr-btn lg-file" href="${e(k.file.url)}" target="_blank" rel="noopener">${ikon("file", 16)} ${e(k.file.nama)}</a>` : `<p class="mr-sub">Belum ada file terlampir.</p>`}
      ${(k.riwayat || []).length ? `<h3 class="lg-h3">Riwayat perpanjangan</h3>${k.riwayat.slice().reverse().map((r) => `<div class="lg-akt"><span>${fmtTgl(r.dari)} → <b>${fmtTgl(r.ke)}</b>${r.catatan ? " · " + e(r.catatan) : ""}${r.file ? ` · <a href="${e(r.file.url)}" target="_blank" rel="noopener">${e(r.file.nama)}</a>` : ""}</span><small>${fmtTgl(r.tgl)}</small></div>`).join("")}` : ""}
    </div><div class="mr-panel__kaki"><button class="mr-btn mr-btn--bahaya" id="dk-hapus">Hapus</button><span class="mr-ruang"></span><button class="mr-btn" id="dk-ubah">Ubah</button><button class="mr-btn mr-btn--utama" id="dk-perpanjang">Perpanjang</button></div>`, { lebar: "drawer" });
  $("#dk-ubah", p).onclick = () => formKontrak(k);
  $("#dk-perpanjang", p).onclick = () => formPerpanjang(k, st);
  $("#dk-hapus", p).onclick = async () => { if (!(await konfirmasi("Hapus dokumen?", `<b>${e(k.pihak)}</b> dihapus dari daftar. File di penyimpanan tidak ikut dihapus otomatis.`, "Hapus"))) return; try { await deleteDoc(doc(db, "lg_kontrak", k.id)); tutupLayer(); toast("Dokumen dihapus."); await muat(); } catch (err) { toast("Gagal menghapus: " + e(err.message || err), "bahaya"); } };
}
function formPerpanjang(k) {
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>Perpanjang kontrak</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi"><div class="mr-form"><p class="mr-sub mr-f--lebar">${e(k.pihak)} · berakhir ${k.berakhir ? fmtTgl(k.berakhir) : "tanpa batas"}</p>
      <label class="mr-f"><span>Berakhir yang baru</span><input type="date" id="pp-ke" value="${e(k.berakhir || "")}"></label>
      <label class="mr-f mr-f--lebar"><span>Catatan</span><input id="pp-cat" maxlength="200"></label>
      <label class="mr-f mr-f--lebar"><span>File addendum atau kontrak baru <small>opsional</small></span><input type="file" id="pp-file" accept="application/pdf,image/*"></label></div></div>
    <div class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="pp-simpan">Simpan perpanjangan</button></div>`, { lebar: "drawer" });
  $("#pp-simpan", p).onclick = async () => {
    const ke = $("#pp-ke", p).value; if (!ke || (k.berakhir && ke <= k.berakhir)) return toast("Tanggal baru harus setelah tanggal berakhir saat ini.", "bahaya");
    const tb = $("#pp-simpan", p); tb.disabled = true;
    try {
      const f = $("#pp-file", p).files[0], r = { tgl: hariIni(), dari: k.berakhir || "", ke, catatan: $("#pp-cat", p).value.trim() };
      if (f) { const path = `legal/${k.id}/${Date.now()}_${f.name.replace(/[^\w.\-]+/g, "_")}`; r.file = { nama: f.name, path, url: await unggahBlob(path, f, f.type || "application/pdf") }; }
      await setDoc(doc(db, "lg_kontrak", k.id), { berakhir: ke, riwayat: [...(k.riwayat || []), r], diubah: serverTimestamp() }, { merge: true });
      tutupLayer(); toast("Perpanjangan tersimpan."); await muat();
    } catch (err) { toast("Gagal menyimpan: " + e(err.message || err), "bahaya"); tb.disabled = false; }
  };
}


/* ---------- perusahaan grup ---------- */
function formPt(pt) {
  const baru = !pt.id, d = { nama: "", tipe: S.pers.length ? "anak" : "induk", inisial: "", ...pt };
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>${baru ? "Tambah perusahaan" : "Ubah perusahaan"}</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi"><div class="mr-form"><label class="mr-f mr-f--lebar"><span>Nama perusahaan</span><input id="pt-nama" value="${e(d.nama)}" maxlength="120" placeholder="PT Indo Sukses Logistik"></label>
    <label class="mr-f"><span>Jenis</span><select id="pt-tipe"><option value="induk"${d.tipe === "induk" ? " selected" : ""}>Induk</option><option value="anak"${d.tipe === "anak" ? " selected" : ""}>Anak perusahaan</option></select></label>
    <label class="mr-f"><span>Singkatan <small>2 sampai 3 huruf</small></span><input id="pt-ini" value="${e(d.inisial)}" maxlength="3"></label></div></div>
    <div class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="pt-simpan">Simpan</button></div>`, { lebar: "drawer" });
  $("#pt-simpan", p).onclick = async () => {
    const nama = $("#pt-nama", p).value.trim(); if (!nama) return toast("Isi nama perusahaan.", "bahaya");
    try { await setDoc(doc(db, "lg_perusahaan", d.id || uid()), { nama, tipe: $("#pt-tipe", p).value, inisial: ($("#pt-ini", p).value.trim() || inisial(nama)).toUpperCase(), diubah: serverTimestamp() }, { merge: true }); tutupLayer(); toast("Perusahaan tersimpan."); await muat(); } catch (err) { toast("Gagal menyimpan: " + e(err.message || err), "bahaya"); }
  };
}
function detailPt(pt) {
  const ds = docsPt(pt), st = JENIS_DOK.map(([j]) => ({ j, d: ds.filter((k) => k.jenisDok === j) }));
  const p = bukaLayer(`<div class="mr-panel__kepala"><div><h2>${e(pt.nama)}</h2><p class="mr-sub">${pt.tipe === "induk" ? "Induk" : "Anak perusahaan"} · ${ds.length} dokumen</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi">${st.map(({ j, d }) => d.length ? d.map((k) => `<button type="button" class="lg-baris" data-dp="${e(k.id)}"><span class="lg-baris__t"><b>${e(k.pihak || j)}</b><small>${e(j)}${k.nomor ? " · " + e(k.nomor) : ""}${k.berakhir ? " · s/d " + fmtTgl(k.berakhir) : ""}</small></span><span class="lg-baris__k">${lencana(k)}</span></button>`).join("") : `<button type="button" class="lg-baris" data-dj="${e(j)}"><span class="lg-baris__t"><b>${e(j)}</b><small>Belum diunggah</small></span><span class="lg-baris__k"><span class="lg-pill lg-pill--no">Belum ada</span></span></button>`).join("")}</div>
    <div class="mr-panel__kaki"><button class="mr-btn mr-btn--bahaya" id="dp-hapus">Hapus</button><span class="mr-ruang"></span><button class="mr-btn" id="dp-ubah">Ubah</button><button class="mr-btn mr-btn--utama" id="dp-tambah">Tambah dokumen</button></div>`, { lebar: "drawer" });
  p.onclick = (ev) => { const b = ev.target.closest("[data-dp],[data-dj]"); if (!b) return; if (b.dataset.dp) detailKontrak(S.kontrak.find((k) => k.id === b.dataset.dp)); else formKontrak({ jenis: "perusahaan", perusahaanId: pt.id, jenisDok: b.dataset.dj }); };
  $("#dp-tambah", p).onclick = () => formKontrak({ jenis: "perusahaan", perusahaanId: pt.id });
  $("#dp-ubah", p).onclick = () => formPt(pt);
  $("#dp-hapus", p).onclick = async () => { if (ds.length) return toast("Hapus atau pindahkan dokumennya dulu.", "bahaya"); if (!(await konfirmasi("Hapus perusahaan?", `<b>${e(pt.nama)}</b> dihapus dari daftar.`, "Hapus"))) return; try { await deleteDoc(doc(db, "lg_perusahaan", pt.id)); tutupLayer(); await muat(); } catch (err) { toast("Gagal menghapus: " + e(err.message || err), "bahaya"); } };
}
function aksiFab() {
  if (S.tab === "mom") return bukaMom(null);
  if (S.tab === "kontrak") return formKontrak({});
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>Tambah</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div><div class="mr-panel__isi"><button type="button" class="lg-baris" data-fa="pt"><i class="lg-ikon">${ikon("tameng-plus", 18)}</i><span class="lg-baris__t"><b>Perusahaan</b><small>Induk atau anak perusahaan baru</small></span></button><button type="button" class="lg-baris" data-fa="dok"><i class="lg-ikon">${ikon("berkas-plus", 18)}</i><span class="lg-baris__t"><b>Dokumen legalitas</b><small>Akta, NIB, NPWP, izin, sertifikat</small></span></button></div>`, { lebar: "drawer" });
  p.onclick = (ev) => { const b = ev.target.closest("[data-fa]"); if (!b) return; b.dataset.fa === "pt" ? formPt({}) : S.pers.length ? formKontrak({ jenis: "perusahaan", perusahaanId: S.pers[0].id }) : (toast("Tambahkan perusahaan dulu."), formPt({})); };
}

/* ---------- aksi ---------- */
/* ---------- aksi baris, pilih banyak, geser (HP) ---------- */
const cari_ = (id) => (S.tab === "kontrak" ? S.kontrak : S.mom).find((x) => x.id === id);
async function bagikanTeks(judul, teks, url) {
  try { if (navigator.share) return await navigator.share({ title: judul, text: teks, ...(url ? { url } : {}) }); await navigator.clipboard.writeText(teks + (url ? "\n" + url : "")); toast("Ringkasan disalin."); } catch (er) { if (er && er.name !== "AbortError") toast("Gagal membagikan: " + e(er.message || er), "bahaya"); }
}
const tutupGeser = () => { S.terbuka = ""; document.querySelectorAll("#lg-root .dj-job2.is-geser-aksi, #lg-root .dj-job2.is-geser-hapus").forEach((el) => { el.classList.remove("is-geser-aksi", "is-geser-hapus"); el.style.transform = ""; }); };
const keluarPilih = () => { S.pilih.clear(); S.modePilih = false; };
async function hapusItems(ids) {
  const kont = S.tab === "kontrak", dok = ids.map(cari_).filter(Boolean), boleh = kont || S.staf ? dok : dok.filter((m) => m.status !== "final"), lewat = dok.length - boleh.length;
  if (!boleh.length) return toast("MOM final hanya bisa dihapus master atau admin.", "bahaya");
  const nama = boleh.length === 1 ? `<b>${e(boleh[0].pihak || boleh[0].judul || "item ini")}</b>` : `<b>${boleh.length} ${kont ? "kontrak" : "MOM"}</b>`;
  if (!(await konfirmasi("Hapus?", `${nama} dihapus permanen.${lewat ? ` ${lewat} MOM final dilewati.` : ""}${kont ? " File di penyimpanan tidak ikut dihapus otomatis." : ""}`, "Hapus"))) return;
  try { await Promise.all(boleh.map((x) => deleteDoc(doc(db, kont ? "lg_kontrak" : "lg_mom", x.id)))); keluarPilih(); tutupGeser(); toast(boleh.length + " dihapus."); await muat(); } catch (er) { toast("Gagal menghapus: " + e(er.message || er), "bahaya"); }
}
function ubahStatusMassal() {
  const ids = [...S.pilih], p = bukaLayer(`<div class="mr-panel__kepala"><h2>Ubah status ${ids.length} kontrak</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div><div class="mr-panel__isi">${[["aktif", "cek", "Jadikan aktif", "Lepas status draf"], ["auto", "riwayat", "Aktifkan perpanjangan otomatis", "Tandai kontrak diperpanjang otomatis"], ["manual", "tutup", "Matikan perpanjangan otomatis", "Perpanjangan dilakukan manual"]].map(([v, i, t, k]) => `<button type="button" class="lg-baris" data-st="${v}"><i class="lg-ikon">${ikon(i, 18)}</i><span class="lg-baris__t"><b>${t}</b><small>${k}</small></span></button>`).join("")}</div>`, { lebar: "drawer" });
  p.onclick = async (ev) => { const b = ev.target.closest("[data-st]"); if (!b) return; const d = { aktif: { draf: false }, auto: { autoRenew: true }, manual: { autoRenew: false } }[b.dataset.st]; try { await Promise.all(ids.map((id) => setDoc(doc(db, "lg_kontrak", id), { ...d, diubah: serverTimestamp() }, { merge: true }))); tutupLayer(); keluarPilih(); toast("Status diperbarui."); await muat(); } catch (er) { toast("Gagal: " + e(er.message || er), "bahaya"); } };
}
async function aksiBaris(a, id) {
  const x = cari_(id); if (!x) return; tutupGeser();
  if (S.tab === "kontrak") {
    if (a === "ubah") return formKontrak(x);
    if (a === "perpanjang") return formPerpanjang(x);
    if (a === "file") return window.open(x.file.url, "_blank", "noopener");
    if (a === "bagikan") return bagikanTeks(x.pihak || "Kontrak", `${x.pihak} · ${JENIS[x.jenis] || ""}${x.nomor ? " · " + x.nomor : ""}${x.berakhir ? " · berakhir " + fmtTgl(x.berakhir) : ""}`, x.file && x.file.url);
    if (a === "hapus") return hapusItems([id]);
  } else {
    if (a === "ubah" || a === "buka") return bukaMom(x);
    if (a === "pdf") return M.unduhMom(x);
    if (a === "bagikan") return M.bagikanMom(x);
    if (a === "salinmom") return M.bukaSalinan(x, { S, db, kembali: async (u) => { S.edit = null; if (u) await muat(); else gambar(); window.scrollTo(0, 0); }, segar: gambar });
    if (a === "hapus") return hapusItems([id]);
  }
}
async function aksiMassal(a) {
  if (a === "pilih") { S.modePilih = true; return gambar(); }
  if (a === "batal") { keluarPilih(); return gambar(); }
  if (a === "semua") { const semua = S.ids.length && S.ids.every((i) => S.pilih.has(i)); S.pilih.clear(); if (!semua) S.ids.forEach((i) => S.pilih.add(i)); return gambar(); }
  if (a === "hapus") return hapusItems([...S.pilih]);
  if (a === "status") return ubahStatusMassal();
  if (a === "pdf") {
    const dok = [...S.pilih].map(cari_).filter((m) => m && m.status === "final"); if (!dok.length) return toast("Pilih MOM yang sudah final untuk digabung.", "bahaya");
    toast("Membuat PDF gabungan…"); try { await M.pdfGabungan(dok.sort((x, y) => String(x.tanggal).localeCompare(String(y.tanggal)))); toast(dok.length + " MOM digabung."); } catch (er) { toast("PDF gagal dibuat. " + e(er.message || er), "bahaya"); }
  }
}
let sw = null, blokKlik = 0;
const lgAktif = () => window.__rute === "legal" && !S.edit;
document.addEventListener("touchstart", (ev) => {
  if (!lgAktif()) return;
  const el = ev.target.closest("#lg-root .dj-job2");
  if (S.terbuka && (!el || el.dataset.id !== S.terbuka) && !ev.target.closest(".dj-sw")) tutupGeser();
  if (!el || ev.target.closest("input")) { sw = null; return; }
  const t = ev.touches[0], id = el.dataset.id, rwEl = el.parentElement, wa = +rwEl.dataset.wa || 0, wh = +rwEl.dataset.wh || 0;
  sw = { el, id, x: t.clientX, y: t.clientY, dx: 0, mode: "", wa, wh, dasar: S.terbuka === id ? (S.sisi === "aksi" ? wa : -wh) : 0 };
  sw.lama = setTimeout(() => { if (sw && !sw.mode) { sw.mode = "tekan"; blokKlik = Date.now(); if (navigator.vibrate) navigator.vibrate(15); if (pilihAktif()) S.pilih.has(sw.id) ? S.pilih.delete(sw.id) : S.pilih.add(sw.id); else { S.modePilih = true; S.pilih.add(sw.id); } gambar(); } }, 480);
}, { passive: true });
document.addEventListener("touchmove", (ev) => {
  if (!sw) return; const t = ev.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  if (!sw.mode) { if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(sw.lama); sw = null; return; } if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3 && !pilihAktif()) { clearTimeout(sw.lama); sw.mode = "geser"; sw.el.style.transition = "none"; sw.el.parentElement.classList.add("is-buka"); } else return; }
  if (sw.mode !== "geser") return; ev.preventDefault(); sw.dx = dx;
  sw.el.style.transform = `translateX(${Math.max(-sw.wh, Math.min(sw.wa, sw.dasar + dx))}px)`;
}, { passive: false });
document.addEventListener("touchend", () => {
  if (!sw) return; clearTimeout(sw.lama); const { el, id, dasar, dx, mode, wa, wh } = sw; sw = null; if (mode !== "geser") return;
  blokKlik = Date.now(); el.style.transition = ""; const akhir = dasar + dx; el.style.transform = "";
  if (wa && akhir > wa * 0.4) { tutupGeser(); S.terbuka = id; S.sisi = "aksi"; el.classList.add("is-geser-aksi"); el.parentElement.classList.add("is-buka"); }
  else if (wh && akhir < -wh * 0.4) { tutupGeser(); S.terbuka = id; S.sisi = "hapus"; el.classList.add("is-geser-hapus"); el.parentElement.classList.add("is-buka"); }
  else { if (S.terbuka === id) { S.terbuka = ""; el.classList.remove("is-geser-aksi", "is-geser-hapus"); } setTimeout(() => el.parentElement && !el.parentElement.querySelector(".is-geser-aksi, .is-geser-hapus") && el.parentElement.classList.remove("is-buka"), 260); }
});
document.addEventListener("contextmenu", (ev) => { if (lgAktif() && ev.target.closest("#lg-root .dj-job2")) ev.preventDefault(); });

function pasang(r) {
  r.addEventListener("click", (ev) => {
    if (S.edit || Date.now() - blokKlik < 400) return;
    const sa = ev.target.closest("[data-lg-a]"); if (sa) return aksiBaris(sa.dataset.lgA, sa.dataset.id);
    const m = ev.target.closest("[data-lg-m]"); if (m) return aksiMassal(m.dataset.lgM);
    if (S.terbuka && !ev.target.closest(".dj-sw")) { tutupGeser(); return; } // ketuk di luar baris yang terbuka: tutup saja
    const t = ev.target.closest("[data-lg-tab],[data-lg-kontrak],[data-lg-mom],[data-lg],[data-lg-fj],[data-lg-pt]"); if (!t) return;
    if (t.dataset.lgTab) { S.tab = t.dataset.lgTab; S.fJenis = ""; S.urut = ""; keluarPilih(); gambar(); }
    else if (t.dataset.lgPt) { const pt = S.pers.find((x) => x.id === t.dataset.lgPt); if (pt) detailPt(pt); }
    else if (t.dataset.lgFj !== undefined) { S.fJenis = t.dataset.lgFj; gambar(); }
    else if (t.dataset.lgKontrak || t.dataset.lgMom) {
      const id = t.dataset.lgKontrak || t.dataset.lgMom;
      if (pilihAktif()) { S.pilih.has(id) ? S.pilih.delete(id) : S.pilih.add(id); if (!S.pilih.size && hp()) S.modePilih = false; return gambar(); }
      const x = t.dataset.lgKontrak ? S.kontrak.find((k) => k.id === id) : S.mom.find((k) => k.id === id); if (x) t.dataset.lgKontrak ? detailKontrak(x) : bukaMom(x);
    }
    else if (t.dataset.lg === "fab") aksiFab();
    else if (t.dataset.lg === "pt-baru") formPt({});
  });
  r.addEventListener("change", (ev) => { if (ev.target.matches("[data-lg-urut]")) { S.urut = ev.target.value; gambar(); } });
  r.addEventListener("input", (ev) => { if (ev.target.matches("[data-lg-cari]")) { S.cari = ev.target.value; const p = ev.target.selectionStart; gambar(); const i = $("[data-lg-cari]", r); if (i) { i.focus(); i.setSelectionRange(p, p); } } });
}
function bukaMom(m) {
  M.buka(m, { S, db, kembali: async (muatUlang) => { S.edit = null; if (muatUlang) await muat(); else gambar(); window.scrollTo(0, 0); }, segar: gambar });
}
let terpasang = false;
export function mulaiLegal(user, profil) {
  S.u = user; S.profil = profil || {}; const p = (window.__ISL || {}); S.staf = !!(p.master || p.admin);
  S.tab = S.staf ? "perusahaan" : "mom";
  const r = $("#lg-root"); if (!r) return;
  if (!terpasang) { terpasang = true; pasang(r); }
  S.edit = null; S.urut = ""; keluarPilih(); S.terbuka = ""; muat();
}
