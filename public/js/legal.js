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
const S = { u: null, profil: null, staf: false, tab: "", kontrak: [], mom: [], pers: [], muat: true, galat: "", fJenis: "", cari: "", edit: null, ver: 0 };
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
const barisKontrak = (k) => baris("file", k.pihak || "Tanpa nama", [JENIS[k.jenis] || "Dokumen", k.nomor, k.lini].filter(Boolean).join(" · "), `<span class="lg-tgl">${k.berakhir && !k.draf ? "s/d " + fmtTgl(k.berakhir) : ""}</span>${lencana(k)}`, `data-lg-kontrak="${e(k.id)}"`);
const barisMom = (m) => baris("edit", m.judul || "MOM tanpa judul", [fmtTgl(m.tanggal), m.nomor || "Draf", S.staf ? m.pemilikNama : "", m.customerNama].filter(Boolean).join(" · "), `<span class="lg-badge lg-badge--${m.status === "final" ? "ok" : "gr"}">${m.status === "final" ? "Final" : "Draf"}</span>`, `data-lg-mom="${e(m.id)}"`);
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
  const tampil = nonPt.filter((k) => f(k) && cocok([k.pihak, k.nomor, k.lini].join(" "))).sort(urut), c = (v, l, fn, warn) => chipL(v, S.fJenis === v, l, v === "" ? null : n(fn), warn);
  return `<div class="cu-chips">${chipL("", !S.fJenis, "Semua", null)}${c("customer", "Customer", F.customer)}${c("vendor", "Vendor", F.vendor)}${c("lain", "MOU", F.lain)}${c("segera", ikon("peringatan", 14) + " Segera habis", F.segera, true)}${c("draf", "Draf", F.draf)}${c("berakhir", "Berakhir", F.berakhir)}</div>
    <div class="mr-kartu lg-daftar">${tampil.map(barisKontrak).join("") || kosong("Belum ada kontrak. Ketuk tombol + untuk mengunggah kontrak yang sedang berjalan atau menyimpan draf.")}</div>`;
}
function tabMom() {
  const f = { "": () => true, draf: (m) => m.status !== "final", final: (m) => m.status === "final" }[S.fJenis] || (() => true);
  const tampil = S.mom.filter((m) => f(m) && cocok([m.judul, m.nomor, m.customerNama, m.pemilikNama].join(" "))).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  let bln = "", isi = "";
  tampil.forEach((m) => { const b = m.tanggal ? new Date(m.tanggal + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase() : "TANPA TANGGAL"; if (b !== bln) { bln = b; isi += `<div class="lg-bln">${e(b)}</div>`; } isi += barisMom(m); });
  return `<div class="cu-chips">${[["", "Semua"], ["draf", "Draf"], ["final", "Final"]].map(([v, l]) => chipL(v, S.fJenis === v, l, v === "draf" ? S.mom.filter((m) => m.status !== "final").length : v === "final" ? S.mom.filter((m) => m.status === "final").length : null)).join("")}</div><div class="mr-kartu lg-daftar">${isi || kosong("Belum ada MOM. Ketuk tombol + untuk mencatat rapat pertama.")}</div>`;
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
    <button type="button" class="mr-fab fab-d fab--legal" data-lg="fab" aria-label="${lab}" title="${lab}">${ikon(ik, 24)}<span class="fab-teks">${lab}</span></button></div>`;
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
function pasang(r) {
  r.addEventListener("click", (ev) => {
    if (S.edit) return;
    const t = ev.target.closest("[data-lg-tab],[data-lg-kontrak],[data-lg-mom],[data-lg],[data-lg-fj],[data-lg-pt]"); if (!t) return;
    if (t.dataset.lgTab) { S.tab = t.dataset.lgTab; S.fJenis = ""; gambar(); }
    else if (t.dataset.lgPt) { const pt = S.pers.find((x) => x.id === t.dataset.lgPt); if (pt) detailPt(pt); }
    else if (t.dataset.lgFj !== undefined) { S.fJenis = t.dataset.lgFj; gambar(); }
    else if (t.dataset.lgKontrak) { const k = S.kontrak.find((x) => x.id === t.dataset.lgKontrak); if (k) detailKontrak(k); }
    else if (t.dataset.lgMom) { const m = S.mom.find((x) => x.id === t.dataset.lgMom); if (m) bukaMom(m); }
    else if (t.dataset.lg === "fab") aksiFab();
    else if (t.dataset.lg === "pt-baru") formPt({});
  });
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
  S.edit = null; muat();
}
