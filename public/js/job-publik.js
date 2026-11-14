// Halaman tautan bagikan Daily Job (job.html?t=TOKEN): lihat saja, tanpa login. Membaca satu dokumen dj_bagikan/{token} (aturan server:
// hanya bila aktif dan belum kedaluwarsa). Berisi ringkasan job dan berkas; komentar internal tidak ikut. Pratinjau berkas tanpa mengunduh.
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { tampilkanPratinjau, tipeBerkas, labelTipe, ukuranTeks, temaGelap } from "./daily-job-viewer.js";
import * as H from "./daily-job-hitung.js";

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const aman = (u) => (/^https?:\/\//i.test(String(u || "")) ? e(u) : "#");
const fmt = (s) => (s ? new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const root = document.getElementById("jp-root");
let pilih = 0, kertas = "ikut", T = null;

function pesan(judul, isi) { root.innerHTML = `<section class="mr-kartu jp__pesan"><h2>${e(judul)}</h2><p class="mr-sub">${e(isi)}</p></section>`; }

function tampil() {
  const j = T.snapshot, berkas = (j.file || []).map((f, i) => ({ ...f, i, tp: tipeBerkas(f.nama, f.tipe) })), b = berkas[pilih], now = H.hariIni(), lab = H.labelTarget(j, now);
  const kv = (k, v) => `<div><span>${k}</span><b>${v || "–"}</b></div>`;
  root.innerHTML = `<div class="dj-dt jp__dt"><div class="dj-dt__kop"><h1 class="jp__judul">${e(j.judul)}</h1><div class="dj-dk__s"><span class="dj-chip dj-chip--${j.status === "selesai" ? "ok" : "info"}">${e(H.STATUS[j.status] || "")}</span><span class="dj-chip dj-chip--${lab.k || "info"}">${j.tglTarget ? "Target " + e(fmt(j.tglTarget)) + " · " : ""}${e(lab.t)}</span><span class="dj-chip">${e(j.kategori || "")}</span></div></div>
    <div class="dj-dt__tengah"><div class="dj-dt__f"><div class="dj-cap"><span>Berkas (${berkas.length})</span></div>${berkas.map((f) => `<button type="button" class="dj-fcard${f.i === pilih ? " is-aktif" : ""}" data-i="${f.i}"><span class="dj-ft dj-ft--${f.tp}">${labelTipe(f.tp)}</span><span class="dj-fcard__n"><b>${e(f.nama)}</b><small>${e(ukuranTeks(f.ukuran))}</small></span></button>`).join("") || '<p class="mr-sub">Tidak ada berkas.</p>'}
      ${(j.tautan || []).map((x) => `<a class="dj-fcard" href="${aman(x.url)}" target="_blank" rel="noopener noreferrer"><span class="dj-ft dj-ft--lain">URL</span><span class="dj-fcard__n"><b>${e(x.nama || x.url)}</b><small>Tautan luar</small></span></a>`).join("")}</div>
      <div class="dj-vw${kertas === "putih" ? " dj-vw--putih" : ""}" data-gelap="${temaGelap() ? 1 : 0}"><div class="dj-vw__bar"><span class="dj-vw__n">${b ? e(b.nama) : "Pratinjau"}</span><span class="mr-ruang"></span>${b ? `<button type="button" class="mr-btn dj-ib" id="jp-kertas" title="Kertas: ikut tema atau putih" aria-label="Kertas ikut tema atau putih">◐</button>` : ""}${b && T.unduh ? `<a class="mr-btn dj-ib" href="${aman(b.url)}" target="_blank" rel="noopener noreferrer" download title="Unduh berkas" aria-label="Unduh berkas">⬇</a>` : ""}</div><div id="dj-vw" class="dj-vw__isi">${b ? "" : '<div class="dj-pv__kosong"><p class="mr-sub">Tidak ada berkas untuk ditampilkan.</p></div>'}</div></div></div>
    <div class="dj-dt__kanan"><div class="mr-kartu dj-kartu dj-info"><div class="dj-kv">${kv("PIC", e(j.pic))}${kv("Customer", e(j.customer))}${kv("Masuk", e(fmt(j.tglMasuk)))}${kv(j.status === "selesai" ? "Selesai" : "Mulai", e(fmt(j.status === "selesai" ? j.tglSelesai : j.tglMulai)))}</div>${j.deskripsi ? `<p class="dj-desk">${e(j.deskripsi)}</p>` : ""}</div>
      <p class="mr-sub">Halaman ini hanya untuk dilihat. Komentar dan catatan internal tidak ditampilkan.</p></div></div>`;
  root.querySelectorAll(".dj-fcard[data-i]").forEach((x) => (x.onclick = () => { pilih = +x.dataset.i; tampil(); }));
  const k = document.getElementById("jp-kertas"); if (k) k.onclick = () => { kertas = kertas === "putih" ? "ikut" : "putih"; root.querySelector(".dj-vw").classList.toggle("dj-vw--putih", kertas === "putih"); };
  if (b) tampilkanPratinjau(document.getElementById("dj-vw"), { url: b.url, nama: b.nama, mime: b.tipe, unduh: !!T.unduh });
}

(async () => {
  const token = new URLSearchParams(location.search).get("t") || "";
  if (!/^[a-z0-9]{20,40}$/i.test(token)) return pesan("Tautan tidak valid", "Periksa kembali tautan yang Anda terima.");
  try {
    const s = await getDoc(doc(db, "dj_bagikan", token));
    if (!s.exists()) return pesan("Tautan tidak berlaku", "Tautan ini sudah kedaluwarsa atau dicabut. Minta pengirim membagikan tautan yang baru.");
    T = s.data(); document.title = (T.snapshot.judul || "Job") + " — ISL HUB";
    document.getElementById("jp-info").textContent = "Lihat saja · berlaku sampai " + new Date(T.berlakuSampai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    tampil();
  } catch (err) { console.warn(err); pesan("Tautan tidak berlaku", "Tautan ini sudah kedaluwarsa atau dicabut. Minta pengirim membagikan tautan yang baru."); }
})();
