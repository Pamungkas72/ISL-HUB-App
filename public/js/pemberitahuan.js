// ===========================================================
// HALAMAN PEMBERITAHUAN — versi penuh dari daftar di lonceng, untuk master dan admin.
// Desktop: kotak masuk (kategori kiri, daftar tengah, detail dan aksi kanan).
// HP: ringkasan kartu per kategori, daftar per kategori dengan "lainnya".
// Sumber data: notifikasi.js (satu daftar yang sama dengan lonceng).
// ===========================================================
import { semuaItem, muatUlang, grupDari, GRUP, bukaTujuan, bisaKelola } from "./notifikasi.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NAMA_LEVEL = { bahaya: "Mendesak", warn: "Perlu aksi", info: "Info" };
const AKSI = { tarif: "Lihat tarif", vendor: "Lengkapi vendor", lokasi: "Lengkapi fasilitas", quotation: "Buka quotation", riwayat: "Buka riwayat", cadangan: "Unduh cadangan", pendaftar: "Tinjau akun", halaman: "Buka halaman" };
const St = { grup: "semua", level: "semua", pilih: null, buka: new Set() };
let root = null;
const hp = () => window.matchMedia("(max-width: 760px)").matches;

const urutan = (a, b) => ({ bahaya: 0, warn: 1, info: 2 }[a.level] - { bahaya: 0, warn: 1, info: 2 }[b.level]);
const hitung = (items) => Object.fromEntries(GRUP.map(([k]) => [k, items.filter((i) => grupDari(i) === k)]));
const baris = (i, aktif) => `<button type="button" class="nfp-i nfp-i--${i.level} ${aktif ? "is-aktif" : ""}" data-nfp-pilih="${esc(i.id)}"><i class="nfp-i__lv" aria-hidden="true"></i><span><b>${esc(i.judul)}</b><small>${esc(i.ket)}</small></span></button>`;

function detail(i) {
  if (!i) return `<div class="nfp-kosong"><p>Pilih satu pemberitahuan untuk melihat rinciannya.</p></div>`;
  const g = GRUP.find(([k]) => k === grupDari(i));
  return `<span class="nfp-lencana nfp-lencana--${i.level}">${NAMA_LEVEL[i.level]}</span><small class="nfp-kat-nama">${esc(g ? g[1] : "")}</small>
    <h3>${esc(i.judul)}</h3><p class="mr-sub">${esc(i.ket)}</p>
    ${i.kurang && i.kurang.length ? `<ul class="nfp-kurang">${i.kurang.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
    <button type="button" class="mr-btn mr-btn--utama" data-nfp-buka="${esc(i.id)}">${esc(AKSI[i.jenis] || "Buka")}</button>`;
}

function gambarDesktop(semua) {
  const per = hitung(semua);
  const aktifGrup = St.grup === "semua" ? semua : per[St.grup] || [];
  const daftar = aktifGrup.filter((i) => St.level === "semua" || (St.level === "aksi" ? i.level !== "info" : i.level === "info")).sort(urutan);
  const pilih = daftar.find((i) => i.id === St.pilih) || daftar[0] || null;
  const kat = [["semua", "Semua", semua.length], ...GRUP.map(([k, n]) => [k, n, per[k].length])].filter(([k, , n]) => k === "semua" || n)
    .map(([k, n, c]) => `<button type="button" class="nfp-kat__b ${St.grup === k ? "is-aktif" : ""}" data-nfp-grup="${k}">${esc(n)}<em>${c}</em></button>`).join("");
  const lv = [["semua", "Semua"], ["aksi", "Perlu aksi"], ["info", "Info"]].map(([k, n]) => `<button type="button" class="mr-chip ${St.level === k ? "is-aktif" : ""}" data-nfp-level="${k}">${n}</button>`).join("");
  return `<div class="nfp-grid"><nav class="nfp-kat" aria-label="Kategori">${kat}</nav>
    <section class="nfp-daftar"><div class="nfp-lv">${lv}</div>${daftar.length ? daftar.map((i) => baris(i, pilih && i.id === pilih.id)).join("") : `<p class="nfp-kosong">Tidak ada pemberitahuan di sini. Semua beres.</p>`}</section>
    <aside class="nfp-detail">${detail(pilih)}</aside></div>`;
}

function gambarHP(semua) {
  const per = hitung(semua);
  const kartu = GRUP.filter(([k]) => per[k].length).map(([k, n]) => `<button type="button" class="nfp-kartu ${per[k].some((i) => i.level === "bahaya") ? "is-bahaya" : ""} ${St.grup === k ? "is-aktif" : ""}" data-nfp-grup="${St.grup === k ? "semua" : k}"><big>${per[k].length}</big><span>${esc(n.replace("Master Rate · ", ""))}</span></button>`).join("");
  const bagian = GRUP.filter(([k]) => per[k].length && (St.grup === "semua" || St.grup === k)).map(([k, n]) => {
    const items = per[k].slice().sort(urutan), semuaDibuka = St.buka.has(k) || St.grup === k, tampil = semuaDibuka ? items : items.slice(0, 3);
    return `<section class="nfp-bag"><h3>${esc(n)} <em>${items.length}</em></h3>${tampil.map((i) => `<div class="nfp-hp-i">${baris(i, false).replace("data-nfp-pilih", "data-nfp-buka")}</div>`).join("")}${items.length > 3 && !semuaDibuka ? `<button type="button" class="nfp-lain" data-nfp-lain="${k}">＋ ${items.length - 3} lainnya</button>` : ""}</section>`;
  }).join("");
  return `<div class="nfp-kartu-baris">${kartu || ""}</div>${bagian || `<p class="nfp-kosong">Tidak ada pemberitahuan. Semua beres.</p>`}`;
}

function gambar() {
  if (!root) return;
  const semua = semuaItem();
  root.innerHTML = `<div class="nfp"><header class="nfp-kepala"><div><h2>Pemberitahuan</h2><p class="mr-sub">${semua.length ? `${semua.length} hal masih perlu ditangani` : "Semua beres"}</p></div><button type="button" class="mr-btn" data-nfp-segar>Segarkan</button></header>${bisaKelola() ? (hp() ? gambarHP(semua) : gambarDesktop(semua)) : `<p class="nfp-kosong">Halaman ini untuk admin atau master.</p>`}</div>`;
}

let terpasang = false;
export function mulaiPemberitahuan() {
  root = document.getElementById("nf-halaman");
  if (!terpasang) {
    terpasang = true;
    document.addEventListener("islhub:notif", () => { if (location.hash === "#pemberitahuan") gambar(); });
    window.matchMedia("(max-width: 760px)").addEventListener("change", () => { if (location.hash === "#pemberitahuan") gambar(); });
    document.addEventListener("click", (ev) => {
      if (location.hash !== "#pemberitahuan") return;
      const t = ev.target, ambil = (a) => t.closest(`[${a}]`);
      let b;
      if ((b = ambil("data-nfp-grup"))) { St.grup = b.dataset.nfpGrup; St.pilih = null; }
      else if ((b = ambil("data-nfp-level"))) { St.level = b.dataset.nfpLevel; St.pilih = null; }
      else if ((b = ambil("data-nfp-pilih"))) St.pilih = b.dataset.nfpPilih;
      else if ((b = ambil("data-nfp-lain"))) St.buka.add(b.dataset.nfpLain);
      else if ((b = ambil("data-nfp-buka"))) { const it = semuaItem().find((i) => i.id === b.dataset.nfpBuka); if (it) bukaTujuan(it.tujuan); return; }
      else if (ambil("data-nfp-segar")) { muatUlang(true); return; }
      else return;
      gambar();
    });
  }
  gambar();
  muatUlang(false);
}
