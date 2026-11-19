// ===========================================================
// LEGAL — kontrak berjalan (upload PDF, masa berlaku, pengingat 60 dan 30 hari) dan MOM (legal-mom.js).
// Data: lg_kontrak (master dan admin), lg_mom (pemilik; master dan admin melihat semua). PDF kontrak di Storage legal/.
// Desktop: ringkasan berupa kartu bagian; HP: daftar tunggal dengan tab dan chip (desain dipilih 19 Nov 2026).
// ===========================================================
import { e, $, toast, konfirmasi, bukaLayer, tutupLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { db } from "./firebase-config.js";
import { unggahBlob } from "./app-store.js";
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import * as M from "./legal-mom.js";

import { BATAS_HARI, statusKontrak as hitungStatus } from "./legal-hitung.js";
export { BATAS_HARI };
export const JENIS = { customer: "Kontrak Customer", vendor: "Kontrak Vendor", mou: "MOU", addendum: "Addendum", perusahaan: "Dokumen Perusahaan" };
const S = { u: null, profil: null, staf: false, tab: "", kontrak: [], mom: [], muat: true, galat: "", fJenis: "", cari: "", edit: null, ver: 0 };
const hp = () => window.matchMedia("(max-width: 760px)").matches;
const hariIni = () => window.__ISL.hariIni();
const uid = () => "lg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtTgl = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const ms = (t) => (t && t.toMillis ? t.toMillis() : t ? Date.parse(t) || 0 : 0); // Timestamp Firestore atau teks ISO
const rp = (n) => (n || n === 0 ? "Rp " + Number(n).toLocaleString("id-ID") : "–");

export const statusKontrak = (k, now = hariIni()) => hitungStatus(k, now);
const WARNA = { aktif: "ok", segera: "wn", mendesak: "bd", berakhir: "gr" };
const lencana = (k) => { const st = statusKontrak(k); return `<span class="lg-badge lg-badge--${WARNA[st.kode]}">${e(st.label)}</span>`; };

/* ---------- data ---------- */
async function muat() {
  S.muat = true; S.galat = ""; gambar();
  try {
    const mq = S.staf ? collection(db, "lg_mom") : query(collection(db, "lg_mom"), where("pemilikUid", "==", S.u.uid));
    const [m, k] = await Promise.all([getDocs(mq), S.staf ? getDocs(collection(db, "lg_kontrak")) : Promise.resolve(null)]);
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
const TAB = () => (S.staf ? [["ringkas", "Ringkasan", "lg-desk"], ["semua", "Semua", "lg-hp"], ["kontrak", "Kontrak", ""], ["perusahaan", "Perusahaan", ""], ["mom", "MOM", ""]] : [["mom", "MOM", ""]]);
function baris(ikn, judul, sub, kanan, data) {
  return `<button type="button" class="lg-baris" ${data}><i class="lg-ikon">${ikon(ikn, 18)}</i><span class="lg-baris__t"><b>${e(judul)}</b><small>${e(sub)}</small></span><span class="lg-baris__k">${kanan}</span></button>`;
}
const barisKontrak = (k) => baris(k.jenis === "perusahaan" ? "tameng" : "file", k.pihak || k.nama || "Tanpa nama", [JENIS[k.jenis] || "Dokumen", k.nomor, k.lini].filter(Boolean).join(" · "), `<span class="lg-tgl">${k.berakhir ? "s/d " + fmtTgl(k.berakhir) : ""}</span>${lencana(k)}`, `data-lg-kontrak="${e(k.id)}"`);
const barisMom = (m) => baris("edit", m.judul || "MOM tanpa judul", [fmtTgl(m.tanggal), m.nomor || "Draf", S.staf ? m.pemilikNama : "", m.customerNama].filter(Boolean).join(" · "), `<span class="lg-badge lg-badge--${m.status === "final" ? "ok" : "gr"}">${m.status === "final" ? "Final" : "Draf"}</span>`, `data-lg-mom="${e(m.id)}"`);
const kosong = (t, aksi) => `<div class="lg-kosong"><p>${e(t)}</p>${aksi || ""}</div>`;

function ringkas() {
  const ab = akanBerakhir(), ak = S.kontrak.filter((k) => statusKontrak(k).kode !== "berakhir");
  const n = (j) => ak.filter((k) => k.jenis === j).length, nb = (j) => ab.filter((k) => k.jenis === j).length;
  const kartu = (ikn, judul, sub, tab, jenis) => `<button type="button" class="lg-kartu" data-lg-tab="${tab}" data-lg-jenis="${jenis || ""}"><i class="lg-ikon lg-ikon--b">${ikon(ikn, 22)}</i><span><b>${e(judul)}</b><small>${e(sub)}</small></span></button>`;
  const sub = (j) => `${n(j)} aktif${nb(j) ? " · " + nb(j) + " segera habis" : ""}`;
  const aktiv = [...S.kontrak.map((k) => ({ t: k.diubah, x: `${k.pihak || "Dokumen"} (${(JENIS[k.jenis] || "").toLowerCase()}) diperbarui` })), ...S.mom.map((m) => ({ t: m.diubah, x: `MOM ${m.judul || ""} ${m.status === "final" ? "difinalkan" : "disimpan"}` }))]
    .filter((a) => ms(a.t)).sort((a, b) => ms(b.t) - ms(a.t)).slice(0, 5);
  return `<div class="lg-hub">${kartu("file", "Kontrak Customer", sub("customer"), "kontrak", "customer")}${kartu("file", "Kontrak Vendor", sub("vendor"), "kontrak", "vendor")}${kartu("tameng", "Dokumen Perusahaan", n("perusahaan") + " berkas", "perusahaan")}${kartu("edit", "MOM", `${S.mom.length} notulen`, "mom")}${kartu("file", "MOU dan Addendum", `${n("mou") + n("addendum")} dokumen`, "kontrak", "mou")}${kartu("peringatan", "Perlu tindakan", `${ab.length} segera habis · ${sudahBerakhir().length} berakhir`, "kontrak", "segera")}</div>
    <div class="lg-dua"><section class="mr-kartu lg-box"><h3>Akan berakhir</h3>${ab.length ? ab.slice(0, 6).map((k) => { const st = statusKontrak(k); return `<button type="button" class="lg-baris lg-baris--s" data-lg-kontrak="${e(k.id)}"><span class="lg-baris__t"><b>${e(k.pihak)}</b><small>${e(k.nomor || JENIS[k.jenis])} · ${fmtTgl(k.berakhir)}</small><span class="lg-bar"><i style="width:${Math.max(6, 100 - (st.sisa / BATAS_HARI.segera) * 100)}%"></i></span></span><span class="lg-baris__k">${lencana(k)}</span></button>`; }).join("") : `<p class="mr-sub">Tidak ada kontrak yang berakhir dalam ${BATAS_HARI.segera} hari.</p>`}</section>
    <section class="mr-kartu lg-box"><h3>Aktivitas terbaru</h3>${aktiv.length ? aktiv.map((a) => `<div class="lg-akt"><span>${e(a.x)}</span><small>${new Date(ms(a.t)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</small></div>`).join("") : `<p class="mr-sub">Belum ada aktivitas.</p>`}</section></div>`;
}
function daftar() {
  const t = S.tab;
  const filterJ = { kontrak: (k) => k.jenis !== "perusahaan", perusahaan: (k) => k.jenis === "perusahaan", semua: () => true }[t] || (() => false);
  const kontrakTampil = S.kontrak.filter((k) => filterJ(k) && (!S.fJenis || (S.fJenis === "segera" ? ["segera", "mendesak"].includes(statusKontrak(k).kode) : k.jenis === S.fJenis)) && cocok([k.pihak, k.nomor, k.lini].join(" "))).sort(urut);
  const momTampil = S.mom.filter((m) => (t === "mom" || t === "semua") && cocok([m.judul, m.nomor, m.customerNama, m.pemilikNama].join(" "))).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  const chips = t === "kontrak" ? [["", "Semua"], ["customer", "Customer"], ["vendor", "Vendor"], ["mou", "MOU"], ["addendum", "Addendum"], ["segera", "Segera habis"]] : [];
  const isi = (t === "mom" ? "" : kontrakTampil.map(barisKontrak).join("")) + (t === "kontrak" || t === "perusahaan" ? "" : momTampil.map(barisMom).join(""));
  const vazio = t === "mom" ? kosong("Belum ada MOM. Catat rapat pertama Anda.", `<button class="mr-btn mr-btn--utama" data-lg="mom-baru">Buat MOM</button>`)
    : kosong(t === "perusahaan" ? "Belum ada dokumen perusahaan (akta, NIB, NPWP)." : "Belum ada kontrak. Unggah kontrak yang sedang berjalan.", S.staf ? `<button class="mr-btn mr-btn--utama" data-lg="tambah">Tambah dokumen</button>` : "");
  return `<div class="lg-bar2"><input class="lg-cari" type="search" placeholder="Cari nama, nomor, atau customer" value="${e(S.cari)}" data-lg-cari aria-label="Cari">${chips.length ? `<div class="mr-chips lg-chips">${chips.map(([v, l]) => `<button type="button" class="mr-chip${S.fJenis === v ? " is-aktif" : ""}" data-lg-fj="${v}">${l}</button>`).join("")}</div>` : ""}</div>
    <div class="mr-kartu lg-daftar">${isi || vazio}</div>`;
}
function gambar() {
  const r = $("#lg-root"); if (!r) return;
  if (S.edit) { r.innerHTML = M.tampilEditor(); M.pasangEditor(r); return; }
  const ab = S.staf ? akanBerakhir() : [], ber = S.staf ? sudahBerakhir() : [];
  r.innerHTML = `<div class="lg">
    <div class="lg-kepala"><p class="mr-sub">${S.staf ? "Kontrak, dokumen perusahaan, dan notulen rapat (MOM)." : "Catat notulen rapat (MOM) dan buat PDF-nya."}</p><div class="lg-aksi"><button type="button" class="mr-btn" data-lg="mom-baru">${ikon("edit", 16)} Buat MOM</button>${S.staf ? `<button type="button" class="mr-btn mr-btn--utama" data-lg="tambah">${ikon("plus", 16)} Tambah dokumen</button>` : ""}</div></div>
    ${S.galat ? `<div class="mr-banner mr-banner--bahaya">${e(S.galat)}</div>` : ""}
    ${ab.length || ber.length ? `<button type="button" class="lg-alert" data-lg-tab="kontrak" data-lg-jenis="segera"><b>${ikon("peringatan", 16)} ${ab.length} kontrak habis dalam ${BATAS_HARI.segera} hari${ber.length ? " · " + ber.length + " sudah berakhir" : ""}</b><span>Lihat</span></button>` : ""}
    <div class="lg-tabs" role="tablist">${TAB().map(([k, l, c]) => `<button type="button" role="tab" class="${c}${S.tab === k ? " is-aktif" : ""}" data-lg-tab="${k}">${l}${k === "kontrak" && S.kontrak.length ? `<em>${S.kontrak.filter((x) => x.jenis !== "perusahaan").length}</em>` : k === "mom" && S.mom.length ? `<em>${S.mom.length}</em>` : ""}</button>`).join("")}</div>
    ${S.muat ? `<p class="mr-sub">Memuat…</p>` : S.tab === "ringkas" ? ringkas() : daftar()}</div>`;
}

/* ---------- kontrak: form, detail, perpanjang ---------- */
const opsiLini = () => ((window.__islMR && window.__islMR.lini) || []).map((l) => l.nama || l.id);
const namaPihak = (jenis) => (jenis === "vendor" ? ((window.__islMR && window.__islMR.vendor) || []).map((v) => v.nama) : ((window.__ISL_DATA && window.__ISL_DATA.customers) || []).map((c) => c.nama)).filter(Boolean);
function formKontrak(k) {
  const baru = !k.id, d = { jenis: "customer", pihak: "", nomor: "", lini: "", mulai: "", berakhir: "", nilai: "", pic: "", autoRenew: false, catatan: "", ...k };
  const p = bukaLayer(`<div class="mr-panel__kepala"><h2>${baru ? "Tambah dokumen legal" : "Ubah dokumen"}</h2><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup", 18)}</button></div>
    <div class="mr-panel__isi"><div class="mr-form">
      <label class="mr-f"><span>Jenis</span><select id="lk-jenis">${Object.entries(JENIS).map(([v, l]) => `<option value="${v}"${d.jenis === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
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
    </div></div><div class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="lk-simpan">Simpan</button></div>`, { lebar: "drawer" });
  const segar = () => { const j = $("#lk-jenis", p).value; $("#lk-pl", p).textContent = j === "perusahaan" ? "Nama dokumen (akta, NIB, NPWP)" : j === "vendor" ? "Vendor" : j === "customer" ? "Customer" : "Pihak"; $("#lk-dl", p).innerHTML = namaPihak(j).map((n) => `<option value="${e(n)}">`).join(""); };
  $("#lk-jenis", p).onchange = segar; segar();
  $("#lk-simpan", p).onclick = async () => {
    const v = (i) => $(i, p).value.trim(), pihak = v("#lk-pihak"), mulai = v("#lk-mulai"), akhir = v("#lk-akhir");
    if (!pihak) return toast("Isi nama pihak atau dokumen.", "bahaya");
    if (mulai && akhir && akhir < mulai) return toast("Tanggal berakhir tidak boleh sebelum tanggal mulai.", "bahaya");
    const tb = $("#lk-simpan", p); tb.disabled = true; tb.textContent = "Menyimpan…";
    try {
      const id = d.id || uid(), f = $("#lk-file", p).files[0];
      const data = { jenis: v("#lk-jenis"), pihak, nomor: v("#lk-nomor"), lini: v("#lk-lini"), mulai, berakhir: akhir, nilai: Number(v("#lk-nilai").replace(/\D/g, "")) || "", pic: v("#lk-pic"), autoRenew: $("#lk-auto", p).checked, catatan: v("#lk-cat"), riwayat: d.riwayat || [], file: d.file || null, diubah: serverTimestamp(), ...(baru ? { dibuat: serverTimestamp(), dibuatOleh: S.u.email } : {}) };
      if (f) { const nm = f.name.replace(/[^\w.\-]+/g, "_"); data.file = { nama: f.name, path: `legal/${id}/${Date.now()}_${nm}`, url: "" }; data.file.url = await unggahBlob(data.file.path, f, f.type || "application/pdf"); }
      await setDoc(doc(db, "lg_kontrak", id), data, { merge: true });
      tutupLayer(); toast("Dokumen tersimpan."); await muat();
    } catch (err) { console.error(err); toast("Gagal menyimpan: " + e(err.message || err), "bahaya"); tb.disabled = false; tb.textContent = "Simpan"; }
  };
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

/* ---------- aksi ---------- */
function pasang(r) {
  r.addEventListener("click", (ev) => {
    if (S.edit) return;
    const t = ev.target.closest("[data-lg-tab],[data-lg-kontrak],[data-lg-mom],[data-lg],[data-lg-fj]"); if (!t) return;
    if (t.dataset.lgTab) { S.tab = t.dataset.lgTab; S.fJenis = t.dataset.lgJenis || ""; S.cari = ""; gambar(); }
    else if (t.dataset.lgFj !== undefined) { S.fJenis = t.dataset.lgFj; gambar(); }
    else if (t.dataset.lgKontrak) { const k = S.kontrak.find((x) => x.id === t.dataset.lgKontrak); if (k) detailKontrak(k); }
    else if (t.dataset.lgMom) { const m = S.mom.find((x) => x.id === t.dataset.lgMom); if (m) bukaMom(m); }
    else if (t.dataset.lg === "tambah") formKontrak({});
    else if (t.dataset.lg === "mom-baru") bukaMom(null);
  });
  r.addEventListener("input", (ev) => { if (ev.target.matches("[data-lg-cari]")) { S.cari = ev.target.value; const p = ev.target.selectionStart; gambar(); const i = $("[data-lg-cari]", r); if (i) { i.focus(); i.setSelectionRange(p, p); } } });
}
function bukaMom(m) {
  M.buka(m, { S, db, kembali: async (muatUlang) => { S.edit = null; if (muatUlang) await muat(); else gambar(); window.scrollTo(0, 0); }, segar: gambar });
}
let terpasang = false;
export function mulaiLegal(user, profil) {
  S.u = user; S.profil = profil || {}; const p = (window.__ISL || {}); S.staf = !!(p.master || p.admin);
  S.tab = S.staf ? (hp() ? "semua" : "ringkas") : "mom";
  const r = $("#lg-root"); if (!r) return;
  if (!terpasang) { terpasang = true; pasang(r); }
  S.edit = null; muat();
}
