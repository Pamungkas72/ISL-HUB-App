// ===========================================================
// MASTER RATE — tampilan utama. Semua data lewat db.js (tidak ada
// Firestore di sini). Aturan (kunci, angka, pembanding) ada di
// kunci.js & excel.js; aturan form per lini di form-lini.js;
// susunan tabel di tampilan-data.js; isi laporan di laporan-model.js.
// ===========================================================
import { renderNav } from "./nav.js";
import * as DB from "./db.js";
import { ambilSalinan, simpanSalinan, bannerSinkron } from "./cache-lokal.js";
import { adalahMaster, emailMasterBelumDiisi, labelAkun } from "./config-akses.js";
import { adalahKelola } from "./akses.js";
import { slug, buatKunci, parseAngka, formatRp, dimensiTampil, formatInputAngka, pasangRibuan, bedaField, perubahanBesar, dimensiKeTeks, teksKeDimensi, rapikanNama, METODE_HARGA } from "./kunci.js";
import { bacaFile, bacaFileLengkap, buatRencana, eksporTarif } from "./excel.js";
import { ikon } from "./ikon.js";
import NAV from "./riwayat.js";
import "./tanggal.js";
import { e, $, $$, angka, tgl, toast, bukaLayer, tutupLayer, konfirmasi, konfirmasiKetik } from "./ui.js";
import { bukaTambahItem } from "./form-tambah.js";
import { bukaVendor, statusBerlaku, DOK_WAJIB } from "./form-vendor.js";
import { htmlTabProfil, htmlTabProfilHP, infoFilterProfil, hapusProfilLangsung, ubahStatusProfil, bukaProfil, bukaDetailProfil, kartuProfil, filterProfil, isiContohProfil, daftarProfil, profilTampil } from "./profil-fasilitas.js";
import { bukaLaporan } from "./laporan-ui.js";
import { vendorUntukLini, kelompokkan, kunciKelompok } from "./tampilan-data.js";
import { hueVendor, inisial } from "./warna.js";
import { gabungTnc, labelKategoriTnc } from "./form-vendor.js";
import { STANDAR_LINI, STANDAR_SATUAN, KERANGKA, URUTAN_LINI, KELOMPOK_LINI } from "./standar.js";
import { htmlPilihSatuan, pasangPilihSatuan, resolveSatuan } from "./satuan-combo.js";
import { konfigLini } from "./form-lini.js";
import { htmlFasilitas, isiOpsiFasilitas, pasangFasilitas, pilihFasilitasBaru, JENIS_FASILITAS } from "./fasilitas.js";
import { LINI_ASING, htmlNilaiAsing, pasangNilaiAsing, bacaNilaiAsing, teksNilaiAsing } from "./asing.js";
import { tarifPerluVerifikasi, acuanVerifikasi, labelUmur, ATURAN_PENGINGAT } from "./pengingat.js";
import { ambilTujuan } from "./notifikasi.js";

const DEMO = DB.MODE === "demo";
const PER_HALAMAN = 50;

// Keterangan tiap tab: muncul sebagai popup saat kursor di atas tab (lihat keterangan.js)
const KET_TAB = {
  tarif: "Daftar tarif per layanan beserta modal, vendor, dan lini bisnisnya. Klik baris untuk melihat atau mengubah.",
  vendor: "Vendor beserta PIC, legalitas, dan syarat (T&C). Vendor Internal dipakai untuk tarif milik perusahaan.",
  lini: "Lini bisnis bisa ditambah kapan saja saat bisnis berkembang. Lini yang masih punya tarif tidak bisa dihapus. Markup harga jual diatur di halaman Quotation (Pengaturan dokumen).",
  lokasi: "Depo, open yard, gudang dry, dan pendingin. Alamat dan PIC hanya internal; kartu customer otomatis menyamarkannya. Harga sewa diatur di tab Tarif.",
};

const S = {
  tarif: [],
  vendor: [],
  lini: [],
  satuan: [],
  ref: { zona: [], lokasiDistribusi: [], depo: [], warehouse: [], openYard: [], profil: [], gagal: false },
  user: null,
  master: false,
  kelola: false,
  tab: "tarif",
  view: "kelompok", // daftar | kelompok
  f: { lini: "semua", vendor: "semua", cari: "", kosong: false },
  fv: { cari: "", status: "semua", lini: "semua" }, // filter tab Vendor
  hal: 1,
  pilih: new Set(), // tarif terpilih
  pilihV: new Set(), // vendor terpilih
  pilihLok: new Set(), // lokasi (fasilitas) terpilih
  pilihLini: new Set(), // lini bisnis terpilih (HP)
  tutup: new Set(),
  liniBuka: !window.matchMedia("(max-width: 760px)").matches, // di layar kecil, pemilih lini tertutup dulu supaya tabel langsung terlihat
  muat: "memuat", // memuat | siap | gagal
  pesanGagal: "",
};

// ---------- util ----------
const namaLini = (id) => {
  if (!id) return "Belum diatur";
  const l = S.lini.find((x) => x.id === id);
  return (l && (l.nama || l.namaLengkap)) || rapikanNama(id);
};
// Vendor "internal" = tarif yang disediakan perusahaan sendiri (tidak perlu verifikasi vendor).
// Tarif tanpa vendor (id kosong) = "Belum ditentukan", boleh disimpan dan diingatkan di banner.
const VENDOR_INTERNAL = "internal";
const namaVendor = (id) => {
  if (!id) return "Belum ditentukan";
  const v = S.vendor.find((x) => x.id === id);
  return (v && v.nama) || (id === VENDOR_INTERNAL ? "Internal" : rapikanNama(id));
};
const namaSatuan = (kode) => {
  const s = S.satuan.find((x) => (x.kode || x.id) === kode);
  return (s && s.nama) || rapikanNama(kode);
};
// Nama lokasi yang enak dibaca: "hlc_indoor_frozen_chiller" -> "HLC Indoor Frozen Chiller"
function namaLokasi(id) {
  const fasilitas = (S.ref.profil || []).find((x) => x.id === id || x.lokasiRefId === id);
  if (fasilitas) return fasilitas.namaTampil || fasilitas.nama;
  return String(id || "")
    .split("_")
    .map((t) => {
      const v = S.vendor.find((x) => x.id === t);
      return v ? v.nama : t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join(" ");
}
const NAMA_LOKASI_DIM = ["asal", "tujuan", "terminal", "depoEmpty"];
const NAMA_KEPALA_BUNTUT = { head_tronton: "Head Tronton", head_engkel: "Head Engkel", flatbed: "Flatbed", lowbed: "Lowbed", dolly: "Dolly", berat: "Cargo berat", non_kontainer: "Non-kontainer" };
function labelDim(k, v) {
  if (k === "jenisPengiriman" || k === "kendaraan") return String(v).toUpperCase();
  if (NAMA_KEPALA_BUNTUT[v] && ["kepala", "buntut", "kelasBerat", "muatan"].includes(k)) return NAMA_KEPALA_BUNTUT[v];
  if (NAMA_LOKASI_DIM.includes(k)) {
    const z = S.ref.zona.find((x) => x.id === v) || S.ref.lokasiDistribusi.find((x) => x.id === v) || S.ref.depo.find((x) => x.id === v);
    return z ? z.nama : namaLokasi(v);
  }
  return String(v);
}
const vendorObj = (id) => S.vendor.find((x) => x.id === id) || { id, nama: namaVendor(id) };
const hueDari = (id) => hueVendor(vendorObj(id));
const badgeVendor = (id) => `<span class="mr-vbadge" style="--vh:${hueDari(id)}"><i>${e(inisial(namaVendor(id)))}</i>${e(namaVendor(id))}</span>`;
const peta = () => new Map(S.tarif.map((t) => [t.kunci || t.id, t]));
const kosongModal = (t) => t.modal === null || t.modal === undefined;

// ---------- data turunan ----------
// Tarif yang diperbarui dalam HARI_BARU hari terakhir (kartu KPI "Diperbarui 30 hari").
const HARI_BARU = 30;
const baruDiubah = (t) => t.diperbaruiPada && Date.now() - new Date(t.diperbaruiPada).getTime() <= HARI_BARU * 864e5;
// Vendor aktif yang datanya belum lengkap: masih Draf, tanpa kontak PIC (telepon/email), atau legalitas berakhir / segera berakhir.
// Kelengkapan data vendor: identitas dan dokumen seperti kelengkapan customer (7 butir). 0..1.
function kelengkapanVendor(v) {
  const dok = (jenis) => (v.legalitas || []).some((l) => l.jenis === jenis && l.nomor && l.file);
  const cek = [
    !!String(v.namaLengkap || "").trim(),
    !!String(v.jenisBadanUsaha || "").trim(),
    dok("NPWP"),
    dok("NIB"),
    dok("Akta pendirian"),
    !!String(v.alamatKantor || "").trim(),
    (v.pic || []).some((p) => String(p.nama || "").trim() && (String(p.telepon || "").trim() || String(p.email || "").trim())),
  ];
  return cek.filter(Boolean).length / cek.length;
}
// Bilah kelengkapan vendor, seperti di halaman Lokasi: hijau 80% ke atas, kuning 50-79%, merah di bawah 50%.
function bilahVendor(pct) {
  return `<div class="mr-pf-skor" title="${pct}% data lengkap" style="margin-top:6px;max-width:260px"><span class="mr-pf-skor__bar"><i style="width:${pct}%" class="${pct >= 80 ? "ok" : pct >= 50 ? "sedang" : "rendah"}"></i></span><small>${pct}% lengkap</small></div>`;
}
function kurangVendor(v) {
  if (v.aktif === false || v.id === VENDOR_INTERNAL) return [];
  const k = [];
  if (v.status === "draf") k.push("Draf");
  if (!(v.pic || []).some((p) => p.telepon || p.email)) k.push("Kontak PIC");
  const kurangDok = DOK_WAJIB.filter((w) => !(v.legalitas || []).some((l) => l.jenis === w.jenis && l.file)).map((w) => w.nama);
  if (kurangDok.length) k.push(`Dokumen ${kurangDok.join(", ")}`);
  const izin = (v.legalitas || []).map((l) => statusBerlaku(l.berlakuSampai)).filter(Boolean);
  if (izin.some((x) => x.kelas === "mati")) k.push("Legalitas berakhir");
  else if (izin.some((x) => x.kelas === "warn")) k.push("Legalitas segera berakhir");
  return k;
}
// Rata-rata kelengkapan vendor aktif (tanpa vendor internal), dalam persen.
function kelengkapanVendorRata() {
  const v = S.vendor.filter((x) => x.aktif !== false && x.id !== VENDOR_INTERNAL);
  return v.length ? Math.round((v.reduce((t, x) => t + kelengkapanVendor(x), 0) / v.length) * 100) : 0;
}
function hitung() {
  const aktif = S.tarif.filter((t) => t.aktif !== false);
  return {
    total: S.tarif.length, kosong: aktif.filter(kosongModal).length, vendor: S.vendor.filter((v) => v.aktif !== false).length, lini: S.lini.length,
    verifikasi: S.kelola ? tarifPerluVerifikasi(S.tarif, S.vendor).length : 0,
    lengkapi: S.vendor.filter((v) => kurangVendor(v).length).length,
    baru: S.tarif.filter(baruDiubah).length,
    tanpaLini: S.tarif.filter((t) => !t.liniBisnisId).length,
    tanpaVendor: S.tarif.filter((t) => !t.vendorId).length,
    jualKosong: aktif.filter((t) => !t.hargaJualSaran).length,
    kelengkapanVendor: kelengkapanVendorRata(),
  };
}

function tarifTampil() {
  const q = S.f.cari.trim().toLowerCase();
  const hasil = S.tarif.filter((t) => {
    if (S.f.lini === "__belum__" ? t.liniBisnisId : S.f.lini !== "semua" && t.liniBisnisId !== S.f.lini) return false;
    if (S.f.vendor === "__belum__" ? t.vendorId : S.f.vendor !== "semua" && t.vendorId !== S.f.vendor) return false;
    if (S.f.kosong && !kosongModal(t)) return false;
    if (S.f.baru && !baruDiubah(t)) return false;
    if (S.f.jualKosong && (t.aktif === false || t.hargaJualSaran)) return false;
    if (q) {
      const gudang = [t.layananNama, t.layanan, namaVendor(t.vendorId), t.lokasiId, dimensiKeTeks(t.dimensi), Object.entries(t.dimensi || {}).map(([k, v]) => labelDim(k, v)).join(" "), t.catatan,
        namaSatuan(t.satuanKode), METODE_HARGA.find((m) => m.v === (t.metodeHarga || "tetap"))?.t, kosongModal(t) ? "belum diisi" : `${formatRp(t.modal)} ${t.modal}`].join(" ").toLowerCase();
      if (!gudang.includes(q)) return false;
    }
    return true;
  });
  const urutLini = new Map(S.lini.map((l, i) => [l.id, i]));
  if (S.f.baru) return hasil.sort((a, b) => String(b.diperbaruiPada).localeCompare(String(a.diperbaruiPada))); // terbaru di atas
  hasil.sort((a, b) => (urutLini.get(a.liniBisnisId) ?? 99) - (urutLini.get(b.liniBisnisId) ?? 99) || String(a.layananNama).localeCompare(String(b.layananNama), "id") || namaVendor(a.vendorId).localeCompare(namaVendor(b.vendorId)));
  return hasil;
}

// Bagi "unit" (baris / kelompok / baris matriks) ke halaman ~PER_HALAMAN baris.
function bagiHalaman(unit, ukuran) {
  const hal = [];
  let cur = [];
  let n = 0;
  for (const u of unit) {
    cur.push(u);
    n += ukuran(u);
    if (n >= PER_HALAMAN) {
      hal.push(cur);
      cur = [];
      n = 0;
    }
  }
  if (cur.length) hal.push(cur);
  return hal.length ? hal : [[]];
}

// ---------- render ----------
function render() {
  const root = $("#mr-kontainer");
  if (!root) return;
  if (S.muat === "memuat") {
    root.innerHTML = `<div class="mr-kosong">${ikon("riwayat", 28)}<p>Memuat data tarif…</p></div>`;
    return;
  }
  if (S.muat === "gagal") {
    root.innerHTML = `<div class="mr-banner mr-banner--bahaya">${ikon("peringatan")}<div><strong>Data gagal dimuat.</strong> ${e(S.pesanGagal)}<br><button class="mr-btn mr-btn--kecil" data-aksi="muat-ulang">Coba lagi</button></div></div>`;
    return;
  }
  const h = hitung();
  // HP: ringkasan selalu tampil sebagai strip geser, tanpa tombol lipat
  const ringkasHp = window.matchMedia("(max-width: 760px)").matches;
  const ringkasStrip = ringkasHp || kpiTutup;
  const banners = [];
  if (DEMO) banners.push(`<div class="mr-banner mr-banner--demo">${ikon("info")}<div><strong>MODE DEMO.</strong> Memakai bentuk data asli milikmu (1.104 tarif). Perubahan hilang saat halaman dimuat ulang. Vendor bertanda "(contoh)" dan angka modal HLC, Karem, serta vendor trucking hanya contoh agar perbandingan terlihat. Versi yang di-deploy tidak memuat data demo.</div></div>`);
  if (!S.kelola) {
    banners.push(
      emailMasterBelumDiisi()
        ? `<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div><strong>Email master belum diisi.</strong> Buka <code>js/config-akses.js</code> dan isi <code>EMAIL_MASTER</code>. Sampai itu diisi, semua akun hanya bisa melihat.</div></div>`
        : `<div class="mr-banner">${ikon("info")}<div><strong>Mode lihat saja.</strong> Hanya pemilik dan admin yang bisa mengedit tarif, vendor, lini bisnis, dan lokasi. Kontrak dan rekening vendor tidak ditampilkan.</div></div>`
    );
  } else {
    const kurangLini = STANDAR_LINI.filter((l) => !S.lini.some((x) => x.id === l.id));
    const kurangSatuan = STANDAR_SATUAN.filter((s) => !S.satuan.some((x) => (x.kode || x.id) === s.kode));
    const sigStd = [...kurangLini.map((l) => l.id), ...kurangSatuan.map((s) => s.kode)].join(",");
    let sigTutup = "";
    try { sigTutup = localStorage.getItem("isl-banner-standar") || ""; } catch (err) { /* abaikan */ }
    if ((kurangLini.length || kurangSatuan.length) && sigTutup !== sigStd) {
      banners.push(`<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div style="flex:1"><strong>Ada data standar yang belum terdaftar:</strong> ${[...kurangLini.map((l) => `lini <b>${e(l.nama)}</b>`), ...kurangSatuan.map((s) => `satuan <b>${e(s.nama)}</b>`)].join(", ")}.<br><button class="mr-btn mr-btn--kecil" data-aksi="daftar-standar" style="margin-top:6px">Daftarkan sekarang</button></div><button class="mr-ikonbtn" data-aksi="tutup-banner" data-v="${e(sigStd)}" title="Tutup pemberitahuan" aria-label="Tutup pemberitahuan">${ikon("tutup")}</button></div>`);
    }
  }

  if (h.tanpaVendor > 0) banners.push(`<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div style="flex:1"><strong>${angka(h.tanpaVendor)} tarif belum ditentukan vendornya.</strong> Tarif tetap bisa dipakai. Lengkapi vendornya lewat Edit tarif, atau pakai vendor Internal untuk tarif milik perusahaan.<br><button class="mr-btn mr-btn--kecil" data-aksi="stat" data-v="tanpavendor" style="margin-top:6px">Lihat tarif ini</button></div></div>`);
  if (h.tanpaLini > 0) banners.push(`<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div style="flex:1"><strong>${angka(h.tanpaLini)} tarif belum punya lini bisnis.</strong> Tarif tetap bisa dipakai. Buat lini bisnisnya, lalu lengkapi lewat Edit tarif.<br><button class="mr-btn mr-btn--kecil" data-aksi="stat" data-v="tanpalini" style="margin-top:6px">Lihat tarif ini</button>${S.kelola ? ` <button class="mr-btn mr-btn--kecil" data-aksi="kategori-baru" style="margin-top:6px">Buat lini bisnis</button>` : ""}</div></div>`);

  if (HP()) { const htmlMobil = htmlHP(h, banners); if (window.ISLMorph) window.ISLMorph(root, htmlMobil); else root.innerHTML = htmlMobil; return; }
  const isiHtml = `
    ${banners.join("")}
    <section class="mr-ring ${ringkasStrip ? "is-tutup" : ""}">
      <button type="button" class="mr-ring__kepala" data-aksi="kpi-lipat" aria-expanded="${!ringkasStrip}" ${ringkasHp ? "disabled" : ""}>
        <b>Ringkasan</b><span class="mr-ring__ket">${e(ringkasSingkat(h))}</span>${ringkasHp ? "" : ikon(kpiTutup ? "maju" : "turun", 16)}
      </button>
      <div class="mr-stat is-ringkas">
        ${kartuStat({ v: "total", ikonNama: "tarif", n: h.total, label: "Total tarif", aktif: false, judul: "Tampilkan semua tarif" })}
        ${kartuStat({ v: "kosong", ikonNama: "peringatan", n: h.kosong, label: "Belum ada modal", perhatian: h.kosong > 0, aktif: S.tab === "tarif" && S.f.kosong, judul: "Tampilkan tarif yang modalnya belum diisi" })}
        ${kartuStat({ v: "jualkosong", ikonNama: "tarif", n: h.jualKosong, label: "Belum ada harga jual saran", perhatian: h.jualKosong > 0, aktif: S.tab === "tarif" && S.f.jualKosong, judul: "Tampilkan tarif aktif yang belum punya harga jual saran" })}
        ${S.kelola ? kartuStat({ v: "verifikasi", ikonNama: "riwayat", n: h.verifikasi, label: "Perlu verifikasi", perhatian: h.verifikasi > 0, aktif: false, judul: "Buka panel verifikasi ulang tarif ke vendor" }) : ""}
        <button type="button" class="mr-stat__kartu ${h.lengkapi > 0 ? "is-perhatian" : ""} ${S.tab === "vendor" && S.fv.status === "lengkapi" ? "is-aktif" : ""}" data-aksi="stat" data-v="lengkapi" title="Tampilkan vendor yang datanya belum lengkap" aria-pressed="${S.tab === "vendor" && S.fv.status === "lengkapi"}"><span class="mr-stat__ikon">${ikon("vendor")}</span><div><b>${h.kelengkapanVendor}%</b><small>Kelengkapan vendor rata-rata</small>${bilahVendor(h.kelengkapanVendor)}</div></button>
        ${kartuStat({ v: "baru", ikonNama: "edit", n: h.baru, label: `Baru diubah (${HARI_BARU} hari)`, aktif: S.tab === "tarif" && !!S.f.baru, judul: `Tampilkan tarif yang diperbarui ${HARI_BARU} hari terakhir, terbaru di atas` })}
      </div>
    </section>
    <div class="mr-tabs" role="tablist">
      ${[["tarif", "Tarif", "tarif"], ["vendor", "Vendor", "vendor"], ["lini", "Lini Bisnis", "lini"], ["lokasi", "Lokasi", "pin"]]
        .map(([id, label, ic]) => `<button role="tab" class="mr-tab ${S.tab === id ? "is-aktif" : ""}" data-aksi="tab" data-v="${id}" data-ket="${e(KET_TAB[id] || "")}">${ikon(ic, 16)}${label}</button>`)
        .join("")}
      ${S.tab === "tarif" ? `<label class="mr-cari mr-cari--atas">${ikon("cari", 16)}<input id="mr-cari" type="search" placeholder="Cari layanan, vendor, lokasi…" value="${e(S.f.cari)}" autocomplete="off"></label>` : ""}
    </div>
    ${S.kelola && S.tab === "tarif" ? `<button type="button" class="mr-fab" data-aksi="tambah" aria-label="Tambah item">${ikon("plus", 18)}<span class="fab-teks">Tambah item</span></button>` : ""}
    ${S.kelola && S.tab === "vendor" ? `<button type="button" class="mr-fab" data-aksi="vendor-tambah" aria-label="Tambah vendor">${ikon("plus", 18)}<span class="fab-teks">Tambah vendor</span></button>` : ""}
    ${S.kelola && S.tab === "lokasi" ? `<button type="button" class="mr-fab" data-aksi="lokasi-tambah" aria-label="Tambah fasilitas">${ikon("plus", 18)}<span class="fab-teks">Tambah fasilitas</span></button>` : ""}
    ${S.kelola && S.tab === "lini" ? `<button type="button" class="mr-fab" data-aksi="lini-tambah" aria-label="Tambah lini bisnis">${ikon("plus", 18)}<span class="fab-teks">Tambah lini bisnis</span></button>` : ""}
    <div id="mr-isi">${S.tab === "tarif" ? (window.ISLNotif ? window.ISLNotif.htmlPerModul(["tarif"], "Perlu verifikasi") : "") + htmlTarif() : S.tab === "vendor" ? htmlVendor() : S.tab === "lini" ? htmlLini() : barPilihTab(S.pilihLok.size, profilTampil(S, namaVendor).filter((p) => !p.lama).length) + htmlTabProfil(S, namaVendor)}</div>`;
  if (window.ISLMorph) window.ISLMorph(root, isiHtml); else root.innerHTML = isiHtml;
}

// Kartu KPI halaman awal: selalu bisa diklik dan membawa langsung ke datanya (lihat aksi "stat").
// Teks ringkas saat Ringkasan dilipat: hanya yang perlu ditindaklanjuti.
const ringkasSingkat = (h) => {
  const hal = [h.kosong && `${angka(h.kosong)} belum ada modal`, h.jualKosong && `${angka(h.jualKosong)} belum ada harga jual saran`, h.verifikasi && `${angka(h.verifikasi)} perlu verifikasi`, h.lengkapi && `${angka(h.lengkapi)} vendor belum lengkap`].filter(Boolean);
  return hal.length ? hal.join(" · ") : `${angka(h.total)} tarif, semua beres`;
};
const kartuStat = ({ v, ikonNama, n, label, perhatian = false, aktif, judul }) =>
  `<button type="button" class="mr-stat__kartu ${perhatian ? "is-perhatian" : ""} ${aktif ? "is-aktif" : ""}" data-aksi="stat" data-v="${v}" title="${e(judul)}" aria-pressed="${!!aktif}"><span class="mr-stat__ikon">${ikon(ikonNama)}</span><div><b>${angka(n)}</b><small>${e(label)}</small></div></button>`;

function baris(t, tampilLini) {
  const dim = Object.entries(t.dimensi || {})
    .map(([k, v]) => `<span class="mr-tag ${k === "jenisPengiriman" ? "mr-tag--jenis" : ["kelasBerat", "kepala", "buntut", "muatan"].includes(k) ? "mr-tag--spek" : ""}" title="${e(k)}">${e(labelDim(k, v))}</span>`)
    .join("");
  const metode = t.metodeHarga && t.metodeHarga !== "tetap" ? `<span class="mr-tag mr-tag--metode">${e(METODE_HARGA.find((m) => m.v === t.metodeHarga)?.t || t.metodeHarga)}</span>` : "";
  const bukanIdr = t.nilaiAsing ? `<span class="mr-tag mr-tag--asing" title="Nilai asing untuk referensi, total tetap dalam Rupiah">${e(teksNilaiAsing(t.nilaiAsing))}</span>` : (t.mataUang && t.mataUang !== "IDR" ? `<span class="mr-tag mr-tag--mati" title="Tercatat dalam ${e(t.mataUang)}. Isi modal dalam Rupiah.">${e(t.mataUang)}</span>` : "");
  const modalHtml = kosongModal(t) ? `<span class="mr-kosongpil">Belum diisi</span>` : `<span class="mr-uang">${e(formatRp(t.modal, t.mataUang || "IDR"))}</span>${bukanIdr}`;
  const jualSaran = t.hargaJualSaran ? `<div class="mr-sub mr-jual-saran">Jual saran <b class="mr-uang">${e(formatRp(t.hargaJualSaran))}</b></div>` : "";
  const modalSel = S.kelola ? `<button class="mr-modal-btn" data-aksi="edit-cepat" data-k="${e(t.kunci)}" title="Klik untuk ubah cepat">${modalHtml}${ikon("edit", 13)}</button>` : modalHtml;
  return `<tr class="${t.aktif === false ? "is-nonaktif" : ""} ${S.pilih.has(t.kunci) ? "is-dipilih" : ""}" data-k="${e(t.kunci)}" style="--vh:${hueDari(t.vendorId)}">
    ${S.kelola ? `<td class="mr-td-cek"><input type="checkbox" data-pilih="${e(t.kunci)}" ${S.pilih.has(t.kunci) ? "checked" : ""} aria-label="Pilih baris"></td>` : ""}
    <td class="mr-td-nama"><div class="mr-nama">${e(t.layananNama || t.layanan)}${t.aktif === false ? ' <span class="mr-tag mr-tag--mati">Nonaktif</span>' : ""}${t.perluUpdate ? ' <span class="mr-tag mr-tag--mati">Perlu update</span>' : ""}</div><div class="mr-sub">${dim}${t.lokasiId ? `<span class="mr-lokasi">${ikon("vendor", 12)}${e(namaLokasi(t.lokasiId))}</span>` : `<span class="mr-lokasi mr-lokasi--kosong">Tidak terikat lokasi</span>`}</div></td>
    <td class="mr-td-lini" data-label="Lini bisnis"><span class="mr-tag mr-tag--lini" title="${e(kelompokLini(S.lini.find((l) => l.id === t.liniBisnisId) || { id: t.liniBisnisId }))}">${e(namaLini(t.liniBisnisId))}</span></td>
    <td class="mr-td-vendor" data-label="Vendor">${badgeVendor(t.vendorId)}</td>
    <td class="mr-td-satuan" data-label="Satuan">${e(namaSatuan(t.satuanKode))}</td>
    <td class="mr-td-modal" data-label="Modal"><div class="mr-modal-sel">${modalSel}${metode}</div>${jualSaran}</td>
    <td class="mr-td-upd" data-label="Diperbarui">${t.diperbaruiPada ? `${e(tgl(t.diperbaruiPada))}<div class="mr-sub">${e((t.diperbaruiOleh || "").split("@")[0])}</div>` : '<span class="mr-sub">-</span>'}</td>
    <td class="mr-td-aksi"><button class="mr-ikonbtn" title="Riwayat harga" aria-label="Riwayat harga" data-aksi="riwayat" data-k="${e(t.kunci)}">${ikon("riwayat")}</button>${S.kelola ? `<button class="mr-ikonbtn" title="Edit" aria-label="Edit" data-aksi="edit" data-k="${e(t.kunci)}">${ikon("edit")}</button><button class="mr-ikonbtn mr-ikonbtn--bahaya" title="Hapus permanen" aria-label="Hapus permanen" data-aksi="hapus" data-k="${e(t.kunci)}">${ikon("tong")}</button>` : ""}</td>
  </tr>`;
}

function htmlTarif() {
  const daftar = tarifTampil();
  const linio = S.f.lini !== "semua";
  const vendorTersedia = linio ? vendorUntukLini(S.vendor, S.tarif, S.f.lini) : S.vendor.filter((v) => v.aktif !== false && S.tarif.some((t) => t.vendorId === v.id));

  const view = S.view === "perbandingan" ? "kelompok" : S.view; // perbandingan kini di menu Laporan
  let isi = "";
  let infoHal = "";
  let jumlahHal = 1;

  if (!daftar.length) {
    isi = `<div class="mr-kosong">${ikon("cari", 28)}<p>${S.tarif.some((t) => linio && t.liniBisnisId === S.f.lini) || !linio ? "Tidak ada tarif yang cocok dengan filter ini." : `Lini <b>${e(namaLini(S.f.lini))}</b> belum punya tarif.${KERANGKA[S.f.lini] && S.kelola ? " Gunakan <b>Kerangka tarif</b> untuk membuat daftar komponen standarnya." : ""}`}</p><button class="mr-btn mr-btn--kecil" data-aksi="reset-filter">Reset filter</button></div>`;
  } else if (view === "kelompok") {
    const grup = kelompokkan(daftar, labelDim, namaLini);
    const hal = bagiHalaman(grup, (g) => (S.tutup.has(g.kunci) ? 1 : g.rows.length + 1));
    jumlahHal = hal.length;
    if (S.hal > jumlahHal) S.hal = jumlahHal;
    const potong = hal[S.hal - 1];
    const kol = S.kelola ? 8 : 7;
    isi = `<div class="mr-kartu mr-tabelkartu"><table class="mr-table mr-table--grup">${kepalaTabel(potong.filter((g) => !S.tutup.has(g.kunci)).flatMap((g) => g.rows))}<tbody>${potong
      .map((g) => {
        const tutup = S.tutup.has(g.kunci);
        const vendorGrup = [...new Set(g.rows.map((r) => r.vendorId))];
        return `<tr class="mr-grup"><td colspan="${kol}"><button class="mr-grup__btn" data-aksi="grup" data-g="${e(g.kunci)}" aria-expanded="${!tutup}">${ikon(tutup ? "maju" : "turun", 16)}<b>${e(g.label)}</b><span class="mr-grup__n">${g.rows.length}</span><span class="mr-grup__v">${vendorGrup.map((v) => `<i class="mr-dot" style="--vh:${hueDari(v)}" title="${e(namaVendor(v))}"></i>`).join("")}</span></button></td></tr>${tutup ? "" : g.rows.map((r) => baris(r, !linio)).join("")}`;
      })
      .join("")}</tbody></table></div>`;
    infoHal = `${angka(potong.length)} kelompok di halaman ini · ${angka(daftar.length)} tarif`;
  } else {
    const hal = bagiHalaman(daftar, () => 1);
    jumlahHal = hal.length;
    if (S.hal > jumlahHal) S.hal = jumlahHal;
    const potong = hal[S.hal - 1];
    const awal = (S.hal - 1) * PER_HALAMAN;
    isi = `<div class="mr-kartu mr-tabelkartu"><table class="mr-table">${kepalaTabel(potong)}<tbody>${potong.map((r) => baris(r, !linio)).join("")}</tbody></table></div>`;
    infoHal = `Menampilkan ${angka(awal + 1)}-${angka(awal + potong.length)} dari ${angka(daftar.length)}`;
  }

  // Bar tarif terpilih: ringkasan di atas, aksi di bawah. Hanya aksi yang dipakai.
  const pilihBar =
    S.kelola && S.pilih.size
      ? `<div class="mr-pilihbar" role="region" aria-label="Tarif terpilih">
          <div class="mr-pilihbar__atas">
            <span class="mr-pilihbar__jml"><b>${angka(S.pilih.size)}</b> dipilih</span>
            ${S.pilih.size < daftar.length ? `<button type="button" class="mr-link" data-aksi="pilih-semua">Pilih semua (${angka(daftar.length)})</button>` : ""}
            <span class="mr-ruang"></span>
            <button type="button" class="mr-link" data-aksi="pilih-batal">Batal</button>
          </div>
          <div class="mr-pilihbar__aksi">
            <button type="button" class="mr-btn" data-aksi="duplikat-pilih">${ikon("plus", 14)}Duplikat</button>
            <button type="button" class="mr-btn" data-aksi="salin-vendor">${ikon("vendor", 14)}Salin ke vendor lain</button>
            ${S.master ? `<button type="button" class="mr-btn mr-btn--hapus" data-aksi="hapus-pilih">${ikon("tong", 14)}Hapus permanen</button>` : ""}
          </div>
        </div>`
      : "";

  const cacahLini = {};
  S.tarif.forEach((t) => (cacahLini[t.liniBisnisId] = (cacahLini[t.liniBisnisId] || 0) + 1));
  return `
    <div class="mr-toolbar mr-bar">
      <label class="mr-cari mr-cari--bar">${ikon("cari", 16)}<input id="mr-cari-bar" type="search" placeholder="Cari layanan, vendor, lokasi…" value="${e(S.f.cari)}" autocomplete="off"></label>
      <div class="mr-bar__filter">
        <select id="mr-f-lini" class="mr-select" aria-label="Filter lini bisnis"><option value="semua">Semua lini bisnis</option>${cacahLini[""] ? `<option value="__belum__" ${S.f.lini === "__belum__" ? "selected" : ""}>Belum diatur (${angka(cacahLini[""])})</option>` : ""}${daftarKelompok().filter((g) => g.isi.length).map((g) => `<optgroup label="${e(g.judul)}">${g.isi.map((l) => `<option value="${e(l.id)}" ${S.f.lini === l.id ? "selected" : ""}>${e(namaLini(l.id))} (${angka(cacahLini[l.id] || 0)})</option>`).join("")}</optgroup>`).join("")}</select>
        ${S.f.kosong || S.f.baru || S.f.jualKosong ? `<button type="button" class="mr-chip is-aktif mr-filter-aktif" data-aksi="kpi-hapus" title="Hapus filter ini">${S.f.kosong ? "Belum ada modal" : S.f.jualKosong ? "Belum ada harga jual saran" : `Diperbarui ${HARI_BARU} hari`} ✕</button>` : ""}
        <select id="mr-f-vendor" class="mr-select" aria-label="Filter vendor"><option value="semua">Semua vendor</option>${S.tarif.some((t) => !t.vendorId) ? `<option value="__belum__" ${S.f.vendor === "__belum__" ? "selected" : ""}>Belum ditentukan (${angka(S.tarif.filter((t) => !t.vendorId).length)})</option>` : ""}${vendorTersedia.map((v) => `<option value="${e(v.id)}" ${S.f.vendor === v.id ? "selected" : ""}>${e(v.nama || v.id)}</option>`).join("")}</select>
      </div>
      <div class="mr-bar__tampil">
        <div class="mr-seg mr-seg--kecil" id="mr-view" role="group" aria-label="Tampilan">${[["kelompok", "Kelompok"], ["daftar", "Daftar"]].map(([v, t]) => `<button type="button" class="mr-seg__btn ${view === v ? "is-aktif" : ""}" data-aksi="view" data-v="${v}" ${v === "perbandingan" && !linio ? 'disabled title="Pilih satu lini bisnis dulu"' : ""}>${t}</button>`).join("")}</div>
      </div>
      <div class="mr-bar__aksi">
        ${view === "kelompok" ? (() => { const grup = kelompokkan(daftar, labelDim, namaLini); const semuaTutup = grup.length > 0 && grup.every((g) => S.tutup.has(g.kunci)); return `<button type="button" class="mr-btn mr-btn--kecil" data-aksi="grup-semua" data-v="${semuaTutup ? "buka" : "tutup"}">${semuaTutup ? "Buka semua tarif" : "Lipat semua tarif"}</button>`; })() : ""}
        <details class="mr-alat">
          <summary class="mr-btn">${ikon("turun", 14)}Alat lain</summary>
          <div class="mr-alat__isi">
            ${S.kelola ? `<button class="mr-btn" data-aksi="verifikasi">${ikon("peringatan", 16)}Verifikasi vendor${tarifPerluVerifikasi(S.tarif, S.vendor).length ? ` <b>${angka(tarifPerluVerifikasi(S.tarif, S.vendor).length)}</b>` : ""}</button>` : ""}
            <button class="mr-btn" data-aksi="laporan">${ikon("download", 16)}Laporan</button>
            ${S.kelola ? `${KERANGKA[S.f.lini] ? `<button class="mr-btn" data-aksi="kerangka">${ikon("lini", 16)}Kerangka tarif</button>` : ""}<button class="mr-btn" data-aksi="import">${ikon("upload", 16)}Import Excel</button>` : ""}
          </div>
        </details>
      </div>
    </div>
    ${(() => { const hh = hitung(); return `<div class="mr-pc-chips" role="group" aria-label="Filter cepat">${chipHP(!S.f.kosong && !S.f.baru && !S.f.jualKosong, "Semua", hh.total, "kpi-hapus")}${chipHP(!!S.f.kosong, "Belum ada modal", hh.kosong, "m-qf", "kosong", hh.kosong > 0)}${chipHP(!!S.f.jualKosong, "Belum jual saran", hh.jualKosong, "m-qf", "jualKosong")}${chipHP(!!S.f.baru, "Baru diubah", hh.baru, "m-qf", "baru")}</div>`; })()}
    ${pilihBar}
    ${isi}
    ${daftar.length ? `<div class="mr-halaman"><span>${infoHal}</span><div><button class="mr-ikonbtn" data-aksi="hal" data-v="-1" ${S.hal <= 1 ? "disabled" : ""} aria-label="Sebelumnya">${ikon("kembali")}</button><b>${S.hal} / ${jumlahHal}</b><button class="mr-ikonbtn" data-aksi="hal" data-v="1" ${S.hal >= jumlahHal ? "disabled" : ""} aria-label="Berikutnya">${ikon("maju")}</button></div></div>` : ""}`;
}

// ---------- kategori lini bisnis ----------
// Kategori (Penyimpanan, Transportasi, ...) disimpan di dokumen lini (field "kelompok"). Lini lama tanpa field
// itu memakai pembagian bawaan di standar.js. Kategori baru ada begitu satu lini memakainya.
const LAIN = "Lainnya";
const kelompokLini = (l) => String(l.kelompok || "").trim() || (KELOMPOK_LINI.find((g) => g.ids.includes(l.id)) || {}).judul || LAIN;
function daftarKelompok() {
  const judul = [...KELOMPOK_LINI.map((g) => g.judul)];
  S.lini.forEach((l) => { const k = kelompokLini(l); if (!judul.includes(k)) judul.push(k); });
  const urut = [...judul.filter((j) => j !== LAIN), ...(judul.includes(LAIN) ? [LAIN] : [])];
  return urut.map((j) => ({ judul: j, isi: S.lini.filter((l) => kelompokLini(l) === j) }));
}
const K_KPI = "isl-mr-kpi-tutup-2";
// Di HP ringkasan terlipat dulu agar tabel langsung terlihat; pilihan pengguna diingat.
let kpiTutup = (() => { try { const v = localStorage.getItem(K_KPI); return v === null ? true : v === "1"; } catch (err) { return true; } })();
// Kategori lini tertutup secara default. Yang disimpan adalah daftar kategori yang sedang dibuka.
const K_GRUP = "isl-mr-grup-buka";
const grupBuka = (() => { try { return new Set(JSON.parse(localStorage.getItem(K_GRUP) || "[]")); } catch (err) { return new Set(); } })();
function lipatGrup(judul) {
  grupBuka.has(judul) ? grupBuka.delete(judul) : grupBuka.add(judul);
  try { localStorage.setItem(K_GRUP, JSON.stringify([...grupBuka])); } catch (err) { /* abaikan */ }
}

function kepalaTabel(rowsHalaman = []) {
  const semua = rowsHalaman.length > 0 && rowsHalaman.every((r) => S.pilih.has(r.kunci));
  return `<thead><tr>${S.kelola ? `<th class="mr-th-cek"><input type="checkbox" data-aksi="pilih-halaman" ${semua ? "checked" : ""} aria-label="Pilih semua di halaman ini"></th>` : ""}<th>Layanan</th><th>Lini bisnis</th><th>Vendor</th><th>Satuan</th><th>Modal</th><th>Diperbarui</th><th></th></tr></thead>`;
}

const statusVendor = (v) => (v.aktif === false ? "nonaktif" : v.status === "draf" ? "draf" : v.mitra ? "mitra" : "aktif");
function vendorTampil() {
  const q = S.fv.cari.trim().toLowerCase();
  return S.vendor.filter((v) => {
    if (S.fv.status === "lengkapi" ? !kurangVendor(v).length : S.fv.status !== "semua" && statusVendor(v) !== S.fv.status) return false;
    if (S.fv.lini !== "semua" && !(v.liniBisnis || []).includes(S.fv.lini) && !S.tarif.some((t) => t.vendorId === v.id && t.liniBisnisId === S.fv.lini)) return false;
    if (q) {
      const teks = [v.nama, v.namaLengkap, v.emailUmum, v.terminBayar, ...(v.pic || []).flatMap((p) => [p.nama, p.jabatan, p.telepon, p.email])].join(" ").toLowerCase();
      if (!teks.includes(q)) return false;
    }
    return true;
  });
}
// tombol kontak cepat PIC pertama yang punya telepon/email
function kontakCepat(v) {
  const p = (v.pic || []).find((x) => x.telepon || x.email);
  if (!p) return v.emailUmum ? `<a class="mr-ikonbtn" href="mailto:${e(v.emailUmum)}" title="Email ${e(v.emailUmum)}" aria-label="Email">@</a>` : "";
  const wa = nomorWa(p.telepon);
  return `<span class="mr-kontak">${wa ? `<a class="mr-ikonbtn mr-kontak__wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" title="WhatsApp ${e(p.nama || "")} ${e(p.telepon)}" aria-label="WhatsApp">WA</a><a class="mr-ikonbtn" href="tel:${e(String(p.telepon).replace(/[^\d+]/g, ""))}" title="Telepon ${e(p.telepon)}" aria-label="Telepon">Tel</a>` : ""}${p.email ? `<a class="mr-ikonbtn" href="mailto:${e(p.email)}" title="Email ${e(p.email)}" aria-label="Email">@</a>` : ""}</span>`;
}

// ---------- pilih banyak untuk tab Vendor dan Lokasi (pola sama dengan tab Tarif) ----------
const pilihTabAktif = () => (S.tab === "vendor" ? S.pilihV : S.tab === "lokasi" ? S.pilihLok : S.tab === "lini" ? S.pilihLini : S.pilih);
// id yang sedang tampil di tab aktif (sesudah filter); lokasi virtual dari open yard lama tidak ikut
function idTabTampil() {
  if (S.tab === "vendor") return vendorTampil().map((v) => v.id);
  if (S.tab === "lokasi") return profilTampil(S, namaVendor).filter((p) => !p.lama).map((p) => p.id);
  if (S.tab === "lini") return liniTampilHP().map((l) => l.id);
  return [];
}
function barPilihTab(n, total) {
  if (!S.kelola || !n) return "";
  const master = S.master;
  return `<div class="mr-pilihbar" role="region" aria-label="Pilihan terpilih">
    <div class="mr-pilihbar__atas">
      <span class="mr-pilihbar__jml"><b>${angka(n)}</b> dipilih</span>
      ${n < total ? `<button type="button" class="mr-link" data-aksi="tab-semua">Pilih semua (${angka(total)})</button>` : ""}
      <span class="mr-ruang"></span>
      <button type="button" class="mr-link" data-aksi="tab-batal">Batal</button>
    </div>
    <div class="mr-pilihbar__aksi">
      <button type="button" class="mr-btn" data-aksi="tab-nonaktif">${ikon("tutup", 14)}Nonaktifkan</button>
      ${master ? `<button type="button" class="mr-btn mr-btn--hapus" data-aksi="tab-hapus">${ikon("tong", 14)}Hapus permanen</button>` : ""}
    </div>
  </div>`;
}
// Tarif, vendor, atau lokasi yang masih dipakai tarif atau quotation tidak boleh dihapus
function terpakaiTab(id) {
  if (S.tab === "lini") return S.tarif.some((t) => t.liniBisnisId === id);
  const quotation = (cocok) => (window.__ISL_DATA?.quotations || []).some((q) => [q, ...(q.baris || [])].some(cocok));
  if (S.tab === "vendor") return S.tarif.some((t) => t.vendorId === id) || quotation((x) => x.vendorId === id);
  const p = (S.ref.profil || []).find((x) => x.id === id);
  const kunci = new Set([id, p && p.lokasiRefId].filter(Boolean));
  return S.tarif.some((t) => kunci.has(t.lokasiId)) || quotation((x) => kunci.has(x.lokasiId));
}
async function nonaktifPilihTab() {
  const ids = [...pilihTabAktif()];
  if (!ids.length) return;
  const vendor = S.tab === "vendor", lini = S.tab === "lini";
  const ok = await konfirmasi(`Nonaktifkan ${angka(ids.length)} ${vendor ? "vendor" : lini ? "lini bisnis" : "lokasi"}?`, vendor ? "Vendor yang nonaktif tidak muncul di pencarian Quotation. Tarifnya tetap tersimpan." : lini ? "Lini yang nonaktif tidak muncul di pilihan baru. Tarif dan riwayatnya tetap tersimpan." : "Lokasi yang nonaktif ditandai Tidak tersedia. Profilnya tetap tersimpan.", "Nonaktifkan");
  if (!ok) return;
  const gagal = [];
  for (const id of ids) {
    try {
      if (lini) {
        const l = S.lini.find((x) => x.id === id);
        if (l) Object.assign(l, await DB.simpanLini(id, { aktif: false }, { baru: false, oleh: S.user.email }));
      } else if (vendor) {
        const v = S.vendor.find((x) => x.id === id);
        if (v) Object.assign(v, await DB.simpanVendor(id, { aktif: false }, { baru: false, oleh: S.user.email }));
      } else {
        const p = (S.ref.profil || []).find((x) => x.id === id);
        if (p) Object.assign(p, await DB.simpanProfilFasilitas(id, { status: "tidak_tersedia" }, { baru: false, oleh: S.user.email }));
      }
      pilihTabAktif().delete(id);
    } catch (err) {
      gagal.push(id);
    }
  }
  render();
  toast(gagal.length ? `<b>${angka(ids.length - gagal.length)} dinonaktifkan, ${angka(gagal.length)} gagal.</b>` : `<b>${angka(ids.length)} dinonaktifkan.</b>`, gagal.length ? "peringatan" : "ok");
}
async function hapusPilihTab() {
  if (!S.master) return;
  const vendor = S.tab === "vendor", lini = S.tab === "lini";
  const ids = [...pilihTabAktif()];
  const bisa = ids.filter((id) => !terpakaiTab(id) && !(vendor && id === VENDOR_INTERNAL));
  const dilewati = ids.length - bisa.length;
  if (!bisa.length) return toast(`<b>Tidak ada yang dihapus.</b> ${angka(dilewati)} masih dipakai tarif atau quotation.`, "peringatan");
  const ok = await konfirmasiKetik(`Hapus ${angka(bisa.length)} ${vendor ? "vendor" : lini ? "lini bisnis" : "lokasi"} permanen?`, `${dilewati ? `${angka(dilewati)} yang masih dipakai tarif atau quotation dilewati. ` : ""}${vendor ? "Data kontrak dan rekening ikut terhapus. " : ""}File yang pernah diunggah tidak ikut terhapus dari penyimpanan. Tidak bisa dibatalkan.`, "HAPUS");
  if (!ok) return;
  const gagal = [];
  for (const id of bisa) {
    try {
      if (lini) {
        await DB.hapusDokumen("lini_bisnis", id);
        S.lini = S.lini.filter((x) => x.id !== id);
      } else if (vendor) {
        await DB.hapusDokumen("vendor", id);
        try { await DB.hapusDokumen("vendor_rahasia", id); } catch { /* dokumen rahasia mungkin belum ada */ }
        S.vendor = S.vendor.filter((x) => x.id !== id);
      } else {
        await DB.hapusDokumen("profil_fasilitas", id);
        S.ref.profil = (S.ref.profil || []).filter((x) => x.id !== id);
      }
      pilihTabAktif().delete(id);
    } catch (err) {
      gagal.push(id);
    }
  }
  render();
  const berhasil = bisa.length - gagal.length;
  toast(`<b>${angka(berhasil)} dihapus permanen.</b>${dilewati ? ` ${angka(dilewati)} dilewati karena masih dipakai.` : ""}${gagal.length ? ` ${angka(gagal.length)} gagal.` : ""}`, gagal.length ? "peringatan" : "ok");
}

function htmlVendor() {
  const cacah = {};
  S.tarif.forEach((t) => (cacah[t.vendorId] = (cacah[t.vendorId] || 0) + 1));
  const urut = vendorTampil().sort((a, b) => (b.aktif !== false) - (a.aktif !== false) || String(a.nama).localeCompare(String(b.nama)));
  const nStatus = (st) => S.vendor.filter((v) => statusVendor(v) === st).length;
  return `
    <div class="mr-vbar">
      <label class="mr-cari">${ikon("cari", 16)}<input id="mr-v-cari" type="search" placeholder="Cari vendor, PIC, telepon…" value="${e(S.fv.cari)}" autocomplete="off"></label>
      <div class="mr-vbar__filter">
  <select id="mr-v-lini" class="mr-select" aria-label="Filter lini bisnis"><option value="semua">Semua lini</option>${S.lini.map((l) => `<option value="${e(l.id)}" ${S.fv.lini === l.id ? "selected" : ""}>${e(namaLini(l.id))}</option>`).join("")}</select>
      </div>
      <span class="mr-vbar__info">${angka(urut.length)} dari ${angka(S.vendor.length)} vendor</span>
      ${S.kelola ? `<button class="mr-btn mr-btn--utama mr-vbar__tambah" data-aksi="vendor-tambah">${ikon("plus", 16)}Tambah vendor</button>` : ""}
    </div>
    <div class="mr-pc-chips" role="group" aria-label="Status vendor">${[["semua", "Semua", S.vendor.length], ["aktif", "Aktif", nStatus("aktif")], ["mitra", "Mitra", nStatus("mitra")], ["draf", "Draf", nStatus("draf")], ["nonaktif", "Nonaktif", nStatus("nonaktif")]].map(([v, t, n]) => chipHP(S.fv.status === v, t, n, "m-vstatus", v)).join("")}${chipHP(S.fv.status === "lengkapi", "Perlu dilengkapi", S.vendor.filter((v) => kurangVendor(v).length).length, "m-vstatus", "lengkapi", S.vendor.some((v) => kurangVendor(v).length))}</div>
    ${barPilihTab(S.pilihV.size, urut.length)}
    ${urut.length ? `<div class="mr-kartu mr-tabelkartu"><table class="mr-table mr-table--sederhana"><thead><tr>${S.kelola ? `<th class="mr-th-cek"><input type="checkbox" data-pilih-v-semua aria-label="Pilih semua vendor di daftar ini"></th>` : ""}<th>Vendor</th><th>Lini bisnis</th><th>Kontak PIC</th><th>Legalitas</th><th>Termin dan tarif</th><th></th></tr></thead><tbody>
    ${urut
      .map((v) => {
        const izin = (v.legalitas || []).map((l) => statusBerlaku(l.berlakuSampai)).filter(Boolean);
        const buruk = izin.find((s) => s.kelas === "mati") || izin.find((s) => s.kelas === "warn");
        const pic = (v.pic || [])[0];
        const st = statusVendor(v);
        const kosong = (t) => `<span class="mr-kosong-teks">${t}</span>`;
        const kurang = kurangVendor(v);
        const lini = v.liniBisnis || [];
        const pilL = { aktif: "Aktif", mitra: "Mitra", draf: "Draf", nonaktif: "Nonaktif" }[st];
        const kelasSt = st === "nonaktif" ? "mr-status--mati" : st === "aktif" ? "mr-status--aktif" : "mr-status--warn";
        return `<tr class="${v.aktif === false ? "is-nonaktif" : ""} ${S.pilihV.has(v.id) ? "is-dipilih" : ""}" style="--vh:${hueVendor(v)}">
        ${S.kelola ? `<td class="mr-td-cek"><input type="checkbox" data-pilih-v="${e(v.id)}" ${S.pilihV.has(v.id) ? "checked" : ""} aria-label="Pilih vendor ${e(v.nama)}"></td>` : ""}
        <td class="mr-td-nama" data-label="Vendor"><div><div class="mr-nama">${badgeVendor(v.id)}<span class="mr-status ${kelasSt}">${pilL}</span></div>
          <div class="mr-sub"><span class="mr-vnama">${v.namaLengkap ? e(v.namaLengkap) : kosong("Nama lengkap belum diisi")}</span>${kurang.length ? `<span class="mr-kurang mr-vkurang" title="Perlu: ${e(kurang.join(", "))}"> · Perlu ${kurang.length} data</span>` : ""}</div></div>${bilahVendor(Math.round(kelengkapanVendor(v) * 100))}</div></td>
        <td data-label="Lini bisnis" class="mr-vlini">${lini.slice(0, 2).map((l) => `<span class="mr-tag">${e(namaLini(l))}</span>`).join("") || kosong("Belum ada lini")}${lini.length > 2 ? `<span class="mr-tag mr-vlebih" title="${e(lini.slice(2).map(namaLini).join(", "))}">+${lini.length - 2}</span>` : ""}</td>
        <td data-label="Kontak PIC"><div class="mr-vpic">${pic ? `${e(pic.nama || "-")}<span class="mr-sub mr-vtelp"> · ${e(pic.telepon || pic.email || "")}</span>` : kosong("Belum ada PIC")}</div><span class="mr-vkontak">${kontakCepat(v)}</span></td>
        <td data-label="Legalitas" class="mr-vlegal"><div>${(v.legalitas || []).length ? `${(v.legalitas || []).length} dokumen${buruk ? ` <span class="mr-status mr-status--${buruk.kelas}">${e(buruk.teks)}</span>` : ""}` : kosong("Belum ada dokumen")}${(v.tnc || []).length ? ` <span class="mr-sub">· T&amp;C ${(v.tnc || []).length}</span>` : ""}</div></td>
        <td data-label="Termin dan tarif"><div><span class="mr-vtermin">${v.terminBayar ? e(v.terminBayar) : kosong("Belum diisi")} · </span>${cacah[v.id] ? `<button type="button" class="mr-link" data-aksi="lihat-vendor" data-k="${e(v.id)}" title="Lihat tarif vendor ini">${angka(cacah[v.id])} tarif</button>` : `<span class="mr-sub">0 tarif</span>`}</div></td>
        <td class="mr-td-aksi"><button class="mr-ikonbtn" title="${S.kelola ? "Edit" : "Detail"}" data-aksi="vendor-edit" data-k="${e(v.id)}" aria-label="${S.kelola ? "Edit vendor" : "Detail vendor"}">${ikon(S.kelola ? "edit" : "maju")}</button></td></tr>`;
      })
      .join("")}
    </tbody></table></div>` : `<div class="mr-kosong">${ikon("cari", 28)}<p>Tidak ada vendor yang cocok dengan filter ini.</p><button class="mr-btn mr-btn--kecil" data-aksi="reset-vendor">Reset filter</button></div>`}`;
}

// ---------- S&K per tipe (dibaca formulir penawaran per lini; wajib untuk tipe body dan buntut) ----------
const SK_TIPE = {
  distribusi_kecil: { tombol: "S&K tipe body", ket: "Wajib. Penawaran Trucking Distribusi tidak bisa diterbitkan kalau tipe body yang dipakai belum punya S&K.", wajib: true,
    tipe: [["boxdry", "Box dry"], ["reefer", "Reefer"], ["bak", "Bak"], ["lostbak", "Lost bak"], ["threeway", "Three way"], ["towing", "Towing"]] },
  trucking_trailer: { tombol: "S&K tipe buntut", ket: "Wajib. Penawaran Trailer tidak bisa diterbitkan kalau buntut yang dipakai belum punya S&K.", wajib: true,
    tipe: [["rangka", "Rangka"], ["flatbed", "Flatbed"], ["lowbed", "Lowbed"], ["dolly", "Dolly"]] },
  sewa_unit: { tombol: "S&K per varian", ket: "Peringatan saja (tidak memblokir). Varian dengan driver memuat jam kerja dan insentif driver.", wajib: false,
    tipe: [["lepas", "Sewa unit lepas kunci"], ["driver", "Sewa unit dengan driver"]] },
};
const skTerisi = (l) => { const d = SK_TIPE[l.id]; if (!d) return ""; const sk = l.skTipe || {}; const n = d.tipe.filter(([k]) => String(sk[k] || "").trim()).length; return `${n}/${d.tipe.length}`; };
async function bukaSkTipe(id) {
  const l = S.lini.find((x) => x.id === id), d = SK_TIPE[id]; if (!l || !d) return;
  let tipe = d.tipe.slice();
  if (id === "distribusi_kecil") { const kat = await DB.muatKatalogLayanan("distribusi_kecil"); kat.filter((k) => k.grup === "tipe" && k.nama).forEach((k) => tipe.push([k.id, k.nama + " (tambahan)"])); }
  const sk = l.skTipe || {}, ro = !S.kelola;
  const panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>${e(d.tombol)} · ${e(namaLini(id))}</h2><p class="mr-sub">${e(d.ket)} Satu butir per baris. Di penawaran hanya dibaca, dan disalin ke dokumen saat diterbitkan.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi"><div class="mr-form">${tipe.map(([k, n]) => `<label class="mr-f mr-f--lebar"><span>${e(n)}${d.wajib ? "" : ""} ${String(sk[k] || "").trim() ? "" : `<em class="mr-sub" style="display:inline">belum diisi</em>`}</span><textarea data-sktipe="${e(k)}" rows="4" ${ro ? "disabled" : ""} placeholder="Contoh: Muatan maksimal sesuai kapasitas unit.">${e(sk[k] || "")}</textarea></label>`).join("")}</div>
      <p class="mr-galat" id="sk-galat" hidden></p></div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Tutup</button>${ro ? "" : `<button class="mr-btn mr-btn--utama" id="sk-simpan">Simpan</button>`}</footer>`);
  const btn = $("#sk-simpan", panel); if (!btn) return;
  btn.onclick = async () => {
    const baru = { ...(l.skTipe || {}) }; $$("[data-sktipe]", panel).forEach((t) => { baru[t.dataset.sktipe] = t.value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join("\n"); });
    btn.disabled = true; btn.textContent = "Menyimpan…";
    try { const hasil = await DB.simpanLini(id, { skTipe: baru }, { baru: false, oleh: S.user.email }); l.skTipe = hasil.skTipe || baru; tutupLayer(); render(); toast(`${e(d.tombol)} ${e(namaLini(id))} tersimpan dan terverifikasi.`, "ok"); }
    catch (er) { const g = $("#sk-galat", panel); g.hidden = false; g.textContent = "GAGAL menyimpan: " + er.message; btn.disabled = false; btn.textContent = "Simpan"; }
  };
}

// Hapus lini dari kartu (hanya akun master). Aturannya sama dengan form edit: lini yang masih punya tarif tidak bisa dihapus.
async function hapusLiniDariKartu(id) {
  const dipakai = S.tarif.filter((t) => t.liniBisnisId === id).length;
  if (dipakai) return toast(`<b>Lini belum bisa dihapus.</b> Masih punya ${angka(dipakai)} tarif. Hapus tarifnya dulu.`, "bahaya");
  const ok = await konfirmasiKetik("Hapus lini bisnis permanen?", `Lini <b>${e(namaLini(id))}</b> akan dihapus. Tidak bisa dibatalkan.`, "HAPUS");
  if (!ok) return;
  try {
    await DB.hapusDokumen("lini_bisnis", id);
    const i = S.lini.findIndex((x) => x.id === id);
    if (i >= 0) S.lini.splice(i, 1);
    toast(`<b>Lini bisnis dihapus.</b> ${e(namaLini(id))}`, "ok");
    render();
  } catch (err) {
    toast(`<b>GAGAL menghapus lini bisnis.</b><br>${e(err.message)}`, "bahaya");
  }
}

function htmlLini() {
  const cacah = {};
  const vend = {};
  S.tarif.forEach((t) => {
    cacah[t.liniBisnisId] = (cacah[t.liniBisnisId] || 0) + 1;
    (vend[t.liniBisnisId] = vend[t.liniBisnisId] || new Set()).add(t.vendorId);
  });
  return `
    <div class="mr-toolbar"><span class="mr-ruang"></span>${S.kelola ? `<button class="mr-btn mr-btn--utama mr-lini__tambah" data-aksi="lini-tambah">${ikon("plus", 16)}Tambah lini bisnis</button>` : ""}</div>
    ${daftarKelompok().filter((g) => g.isi.length).map((g) => `<div class="mr-m-gh3 mr-pc-gh3">${e(g.judul)}<em>${g.isi.length}</em></div><div class="mr-grid">${g.isi
      .map(
        (l) => `<div class="mr-kartu mr-lini ${l.aktif === false ? "is-nonaktif" : ""}"><div class="mr-lini__atas"><span class="mr-stat__ikon">${ikon("lini")}</span>${S.kelola ? `<button class="mr-ikonbtn" title="Edit" aria-label="Edit" data-aksi="lini-edit" data-k="${e(l.id)}">${ikon("edit")}</button>` : ""}${S.master ? `<button class="mr-ikonbtn mr-ikonbtn--bahaya" title="Hapus lini bisnis" aria-label="Hapus ${e(namaLini(l.id))}" data-aksi="lini-hapus" data-k="${e(l.id)}">${ikon("tong")}</button>` : ""}</div>
        <h3>${e(namaLini(l.id))}</h3><p class="mr-sub">${e(kelompokLini(l))} · ${l.kategori === "request_based" ? "Berdasarkan permintaan" : l.kategori === "harga_tetap" ? "Harga tetap" : e(l.id)}</p>
        <div class="mr-lini__angka"><span><b>${angka(cacah[l.id] || 0)}</b> tarif</span><span><b>${angka((vend[l.id] || new Set()).size)}</b> vendor</span></div>
        <button class="mr-btn mr-btn--kecil" data-aksi="lihat-lini" data-k="${e(l.id)}">${cacah[l.id] ? "Lihat tarif" : "Buka lini"}</button>${SK_TIPE[l.id] ? `<button class="mr-btn mr-btn--kecil" data-aksi="lini-sk" data-k="${e(l.id)}" title="${e(SK_TIPE[l.id].ket)}">${ikon("file", 14)} ${e(SK_TIPE[l.id].tombol)} <span class="mr-sub" style="display:inline">${skTerisi(l)}</span></button>` : ""}</div>`
      )
      .join("")}</div>`).join("")}`;
}

// ---------- hapus PERMANEN ----------
async function hapusTarif(kunciList) {
  const n = kunciList.length;
  const baris = kunciList.map((k) => peta().get(k)).filter(Boolean);
  const contoh = baris.slice(0, 5).map((t) => `<li>${e(t.layananNama || t.layanan)} <span class="mr-sub" style="display:inline">· ${e(namaVendor(t.vendorId))}</span></li>`).join("");
  const adaIsi = baris.filter((t) => !kosongModal(t)).length;
  const ok = await konfirmasiKetik(
    n === 1 ? "Hapus tarif permanen?" : `Hapus ${angka(n)} tarif permanen?`,
    `<ul class="mr-konfirm__daftar">${contoh}${n > 5 ? `<li>…dan ${angka(n - 5)} lainnya</li>` : ""}</ul>${adaIsi ? `<p><b>${angka(adaIsi)}</b> di antaranya sudah punya angka modal.</p>` : ""}<p>Tidak bisa dibatalkan. Riwayat harga tetap tersimpan sebagai catatan <i>dihapus</i> berisi salinan item.</p>`,
    n === 1 ? "HAPUS" : `HAPUS ${n}`
  );
  if (!ok) return false;
  toast(`Menghapus ${angka(n)} tarif…`, "ok");
  try {
    const h = await DB.hapusBanyak(kunciList, { oleh: S.user.email });
    const hilang = new Set(h.berhasil);
    S.tarif = S.tarif.filter((t) => !hilang.has(t.kunci));
    h.berhasil.forEach((k) => S.pilih.delete(k));
    render();
    if (h.gagal.length) toast(`<b>${angka(h.berhasil.length)} terhapus, ${angka(h.gagal.length)} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
    else toast(`<b>${angka(h.berhasil.length)} tarif terhapus dan terverifikasi.</b> Catatan riwayat tersimpan.`, "ok");
    return h.berhasil.length > 0;
  } catch (err) {
    toast(`<b>GAGAL menghapus.</b><br>${e(err.message)}`, "bahaya");
    return false;
  }
}

// ---------- kerangka tarif (daftar komponen standar untuk satu vendor) ----------
function bukaKerangka() {
  const liniId = S.f.lini;
  const komponen = KERANGKA[liniId];
  if (!komponen) return;
  const vend = vendorUntukLini(S.vendor, S.tarif, liniId);
  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>Kerangka tarif</h2><p class="mr-sub">${e(namaLini(liniId))} · membuat baris kosong (modal belum diisi)</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi"><label class="mr-f mr-f--lebar"><span>Untuk vendor *</span><select id="k-vendor"><option value="">Pilih vendor…</option>${vend.map((v) => `<option value="${e(v.id)}">${e(v.nama)}</option>`).join("")}</select><small>Vendor baru? Tambahkan dulu di tab Vendor dan centang lini ${e(namaLini(liniId))}.</small></label>
    <div id="k-daftar"></div><p class="mr-galat" id="k-galat" hidden></p></div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="k-buat" disabled>Buat baris</button></footer>`
  );
  const daftar = () => {
    const vid = $("#k-vendor", panel).value;
    const ada = peta();
    const item = komponen.map(([layanan, nama, satuan, dim, cat], i) => {
      const kunci = vid ? buatKunci(liniId, vid, null, layanan, dim, satuan, null) : null;
      const satuanAda = S.satuan.some((s) => (s.kode || s.id) === satuan);
      return { i, layanan, nama, satuan, dim, cat, kunci, sudah: kunci && ada.has(kunci), satuanAda };
    });
    $("#k-daftar", panel).innerHTML = `<div class="mr-kerangka">${item
      .map((x) => `<label class="mr-cek mr-cek--baris ${x.sudah || !x.satuanAda ? "is-mati" : ""}"><input type="checkbox" data-i="${x.i}" ${x.sudah || !x.satuanAda ? "disabled" : "checked"}><span><b>${e(x.nama)}</b><small>${e(namaSatuan(x.satuan))}${x.sudah ? " · sudah ada" : ""}${!x.satuanAda ? " · satuan belum terdaftar" : ""}</small></span></label>`)
      .join("")}</div>`;
    $("#k-buat", panel).disabled = !vid;
    return item;
  };
  daftar();
  panel.addEventListener("change", (ev) => {
    if (ev.target.id === "k-vendor") daftar();
  });
  $("#k-buat", panel).onclick = async () => {
    const vid = $("#k-vendor", panel).value;
    const item = daftar();
    const dipilih = $$("#k-daftar input:checked", panel).map((c) => item[Number(c.dataset.i)]);
    if (!dipilih.length) {
      const g = $("#k-galat", panel);
      g.textContent = "Tidak ada komponen yang bisa dibuat.";
      g.hidden = false;
      return;
    }
    const tombol = $("#k-buat", panel);
    tombol.disabled = true;
    tombol.textContent = "Membuat…";
    const items = dipilih.map((x) => ({ jenis: "baru", kunci: x.kunci, baris: { liniBisnisId: liniId, vendorId: vid, lokasiId: null, layanan: x.layanan, layananNama: x.nama, dimensi: x.dim, satuanKode: x.satuan, mataUang: "IDR", modal: null, metodeHarga: "tetap", hargaJualReferensi: null, referensiSumber: null, customerId: null, berlakuDari: null, berlakuSampai: null, aktif: true, catatan: x.cat } }));
    try {
      const h = await DB.terapkanBanyak(items, { oleh: S.user.email, sumber: "kerangka" });
      const ok = new Set(h.berhasil);
      items.filter((x) => ok.has(x.kunci)).forEach((x) => S.tarif.push({ ...x.baris, kunci: x.kunci, id: x.kunci, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email }));
      tutupLayer();
      render();
      if (h.gagal.length) toast(`<b>${h.berhasil.length} dibuat, ${h.gagal.length} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
      else toast(`<b>${h.berhasil.length} baris kerangka dibuat dan terverifikasi.</b> Isi angka modalnya dari tabel.`, "ok");
    } catch (err) {
      toast(`<b>GAGAL membuat kerangka.</b><br>${e(err.message)}`, "bahaya");
      tombol.disabled = false;
      tombol.textContent = "Buat baris";
    }
  };
}

// ---------- daftarkan lini & satuan standar ----------
async function daftarkanStandar() {
  const hasil = [];
  try {
    for (const l of STANDAR_LINI.filter((x) => !S.lini.some((y) => y.id === x.id))) {
      const { id, ...data } = l;
      await DB.buatJikaBelumAda("lini_bisnis", id, data, { oleh: S.user.email });
      S.lini.push({ id, ...data });
      hasil.push(`lini ${l.nama}`);
    }
    for (const s of STANDAR_SATUAN.filter((x) => !S.satuan.some((y) => (y.kode || y.id) === x.kode))) {
      await DB.buatJikaBelumAda("satuan_baku", s.kode, { kode: s.kode, nama: s.nama }, { oleh: S.user.email });
      S.satuan.push({ id: s.kode, kode: s.kode, nama: s.nama });
      hasil.push(`satuan ${s.nama}`);
    }
    S.lini.sort(urutLini);
    render();
    toast(`<b>Terdaftar dan terverifikasi:</b> ${e(hasil.join(", "))}.`, "ok");
  } catch (err) {
    render();
    toast(`<b>GAGAL mendaftarkan.</b><br>${e(err.message)}${hasil.length ? `<br>Sudah berhasil: ${e(hasil.join(", "))}.` : ""}`, "bahaya");
  }
}
const urutLini = (a, b) => {
  const ia = URUTAN_LINI.indexOf(a.id);
  const ib = URUTAN_LINI.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || namaLini(a.id).localeCompare(namaLini(b.id));
};


// ---------- simpan (jalur tunggal untuk semua perubahan tarif) ----------
async function simpanPerubahan(row, perubahan, sumber) {
  if (!perubahan.length) {
    toast("Tidak ada yang berubah.", "ok");
    return true;
  }
  const pm = perubahan.find((p) => p.field === "modal");
  if (pm && perubahanBesar(pm.lama, pm.baru)) {
    const ok = await konfirmasi("Perubahan modal besar", `Modal <b>${e(row.layananNama)}</b> berubah lebih dari 50%:<br><b>${e(formatRp(pm.lama))}</b> → <b>${e(formatRp(pm.baru))}</b>.<br>Sudah benar?`, "Ya, simpan");
    if (!ok) return false;
  }
  if (pm && (pm.baru === null) && pm.lama !== null) {
    const ok = await konfirmasi("Kosongkan modal?", `Modal <b>${e(row.layananNama)}</b> akan dikembalikan ke <b>Belum diisi</b>. Harga lama (${e(formatRp(pm.lama))}) tetap tercatat di riwayat.`, "Kosongkan");
    if (!ok) return false;
  }
  try {
    const hasil = await DB.terapkanBanyak([{ jenis: "ubah", kunci: row.kunci, perubahan, liniBisnisId: row.liniBisnisId, vendorId: row.vendorId }], { oleh: S.user.email, sumber });
    if (hasil.gagal.length) throw new Error(hasil.gagal[0].alasan);
    perubahan.forEach((p) => (row[p.field] = p.baru));
    if (pm) row.diverifikasiPada = DB.hariIniLokal();
    row.diperbaruiPada = new Date().toISOString();
    row.diperbaruiOleh = S.user.email;
    toast(`<b>Tersimpan dan terverifikasi di server.</b> ${e(row.layananNama)}`, "ok");
    return true;
  } catch (err) {
    toast(`<b>GAGAL menyimpan — angka lama tetap berlaku.</b><br>${e(err.message)}`, "bahaya");
    return false;
  }
}

// ---------- edit cepat (klik angka modal) ----------
function mulaiEditCepat(kunci, nilaiAwal) {
  if (HP()) return sheetUbahCepat(kunci, nilaiAwal); // HP: baris bukan tabel, jadi ubah cepat dibuka sebagai panel dari bawah
  const row = peta().get(kunci);
  const sel = $(`tr[data-k="${CSS.escape(kunci)}"] .mr-modal-sel`);
  if (!row || !sel) return;
  sel.innerHTML = `<span class="mr-inline-wrap"><input class="mr-inline" inputmode="decimal" value="${e(formatInputAngka(nilaiAwal ?? row.modal ?? ""))}" placeholder="angka" aria-label="Modal baru"><button class="mr-ikonbtn mr-ikonbtn--ok" data-x="ok" title="Simpan (Enter)">${ikon("cek", 16)}</button><button class="mr-ikonbtn" data-x="batal" title="Batal (Esc)">${ikon("tutup", 16)}</button></span>`;
  const wrap = $(".mr-inline-wrap", sel);
  const input = $("input", wrap);
  pasangRibuan(input);
  input.focus();
  input.select();
  let sedang = false;
  const batal = () => render();
  const simpan = async () => {
    if (sedang) return;
    const p = parseAngka(input.value);
    if (!p.ok || p.val === undefined) {
      toast("Isi dengan angka (0 = gratis). Untuk mengosongkan modal, pakai tombol Edit.", "bahaya");
      input.focus();
      return;
    }
    sedang = true;
    wrap.classList.add("is-simpan");
    const lama = row.modal === undefined ? null : row.modal;
    const diketik = input.value;
    const perubahan = p.val === lama ? [] : [{ field: "modal", lama, baru: p.val }];
    const ok = await simpanPerubahan(row, perubahan, "manual");
    render();
    if (!ok) mulaiEditCepat(kunci, diketik);
  };
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") simpan();
    if (ev.key === "Escape") batal();
  });
  $('[data-x="ok"]', wrap).onclick = simpan;
  $('[data-x="batal"]', wrap).onclick = batal;
  wrap.addEventListener("focusout", (ev) => {
    if (!sedang && !wrap.contains(ev.relatedTarget)) setTimeout(() => !sedang && document.body.contains(wrap) && batal(), 120);
  });
}

// ---------- drawer: edit tarif ----------
// Lini berbasis lokasi wajib punya lokasi (depo, warehouse, open yard). Lini lain boleh kosong.
const lokasiWajib = (lini) => ["pilih", "open_yard"].includes(konfigLini(lini).lokasi);

function bukaEdit(kunci) {
  const row = peta().get(kunci);
  if (!row) return;
  // dokumen penawaran yang diunggah di detail vendor, untuk ditautkan sebagai sumber harga tarif ini
  const pen = (vendorObj(row.vendorId).penawaran || []).filter((x) => x && x.judul);
  const infoSumber = (judul) => {
    const x = pen.find((p) => String(p.judul).trim().toLowerCase() === String(judul || "").trim().toLowerCase());
    if (!judul) return pen.length ? `${pen.length} penawaran tersimpan di vendor ini.` : "Belum ada dokumen penawaran di detail vendor ini.";
    if (!x) return "Tidak cocok dengan penawaran tersimpan (tetap disimpan sebagai teks).";
    return x.file && x.file.url ? `<a href="${e(x.file.url)}" target="_blank" rel="noopener">${ikon("file", 13)} Buka ${e(x.file.nama || "file penawaran")}</a>` : "Penawaran tersimpan, belum ada file.";
  };
  const vendorOpsi = S.vendor.filter((v) => v.aktif !== false || v.id === row.vendorId);
  // tarif freight forwarding lama dalam mata uang asing: nilainya pindah ke blok nilai asing
  const fflegacy = row.liniBisnisId === LINI_ASING && !row.nilaiAsing && row.mataUang && row.mataUang !== "IDR";
  const modalIsi = fflegacy ? "" : formatInputAngka(row.modal ?? "");
  const asingMata = row.nilaiAsing?.mataUang || (fflegacy ? row.mataUang : "USD");
  const asingIsi = row.nilaiAsing ? formatInputAngka(row.nilaiAsing.nilai) : fflegacy ? formatInputAngka(row.modal) : "";
  const panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>Edit tarif</h2><p class="mr-sub">${e(namaLini(row.liniBisnisId))} · ${e(namaVendor(row.vendorId))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">
      <p class="mr-sub" style="margin:0 0 12px">Terakhir diverifikasi ke vendor: <b>${acuanVerifikasi(row) ? `${e(tgl(acuanVerifikasi(row)))}${row.diverifikasiPada ? "" : " (tanggal pembaruan)"}` : "-"}</b></p>
      <div class="mr-form">
        <h4 class="mr-form__sec">Layanan</h4>
        <label class="mr-f mr-f--lebar"><span>Nama layanan *</span><input id="f-nama" value="${e(row.layananNama || row.layanan)}" autocomplete="off"></label>
        <label class="mr-f"><span>Lini bisnis</span><select id="f-lini"><option value="" ${row.liniBisnisId ? "" : "selected"}>Belum diatur</option>${S.lini.filter((l) => l.aktif !== false || l.id === row.liniBisnisId).map((l) => `<option value="${e(l.id)}" ${l.id === row.liniBisnisId ? "selected" : ""}>${e(namaLini(l.id))}${l.aktif === false ? " (nonaktif)" : ""}</option>`).join("")}</select></label>
        <label class="mr-f"><span>Vendor</span><select id="f-vendor"><option value="" ${row.vendorId ? "" : "selected"}>Belum ditentukan</option>${vendorOpsi.map((v) => `<option value="${e(v.id)}" ${v.id === row.vendorId ? "selected" : ""}>${e(v.nama || v.id)}${v.id === VENDOR_INTERNAL ? " (perusahaan sendiri)" : ""}</option>`).join("")}</select></label>
        <label class="mr-f"><span>Satuan</span>${htmlPilihSatuan("f-satuan", namaSatuan(row.satuanKode))}</label>
        ${htmlFasilitas("f", row.liniBisnisId, S, row.lokasiId || "", { kosong: "Tidak terikat lokasi", label: "Lokasi" })}
        <h4 class="mr-form__sec">Harga dan status</h4>
        <label class="mr-f mr-f--lebar"><span>Modal (Rupiah)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="f-modal" inputmode="decimal" value="${e(modalIsi)}" placeholder="Kosong = belum diisi"></div><small>0 = gratis. Angka negatif = potongan. Mengubah modal otomatis menandai tarif ini sudah diverifikasi hari ini.</small>${row.mataUang && row.mataUang !== "IDR" && !fflegacy ? `<small class="mr-galat-kecil">Tarif ini tercatat dalam ${e(row.mataUang)}. Isi modal dalam Rupiah sebelum menyimpan.</small>` : ""}</label>
        <label class="mr-f mr-f--lebar"><span>Harga jual rekomendasi (Rp)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="f-jsaran" inputmode="decimal" value="${e(formatInputAngka(row.hargaJualSaran ?? ""))}" placeholder="Kosong = modal + markup lini"></div><small>Dipakai sebagai saran harga jual saat membuat quotation. Kosong berarti modal + markup lini.</small></label>        <div id="f-asing-blok" ${row.liniBisnisId === LINI_ASING ? "" : "hidden"}>${htmlNilaiAsing("f", asingMata, asingIsi)}</div>
        <label class="mr-f"><span>Metode harga</span><select id="f-metode">${METODE_HARGA.map((m) => `<option value="${m.v}" ${(row.metodeHarga || "tetap") === m.v ? "selected" : ""}>${m.t}</option>`).join("")}</select></label>
        <label class="mr-f"><span>Status</span><select id="f-aktif"><option value="1" ${row.aktif !== false ? "selected" : ""}>Aktif</option><option value="0" ${row.aktif === false ? "selected" : ""}>Nonaktif</option></select></label>
        <label class="mr-f"><span>Harga jual referensi (info)</span><div class="mr-f__awalan"><span class="mr-f__rp">Rp</span><input id="f-hjr" inputmode="decimal" value="${e(formatInputAngka(row.hargaJualReferensi ?? ""))}" placeholder="Opsional"></div><small>Hanya catatan (mis. harga jual lama). Harga jual saran Quotation tetap modal + markup.</small></label>
        <h4 class="mr-form__sec">Sumber dan catatan</h4>
        <label class="mr-f"><span>Sumber harga (penawaran vendor)</span><input id="f-sumber" list="dl-penawaran" value="${e(row.referensiSumber || "")}" placeholder="Pilih atau ketik nomor penawaran" autocomplete="off"><datalist id="dl-penawaran">${pen.map((x) => `<option value="${e(x.judul)}">${e([x.tanggal, x.catatan].filter(Boolean).join(" · "))}</option>`).join("")}</datalist><small id="f-sumber-info">${infoSumber(row.referensiSumber)}</small></label>
        <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="f-catatan" rows="3">${e(row.catatan || "")}</textarea></label>
      </div>
      <p class="mr-galat" id="f-galat" hidden></p>
    </div>
    <footer class="mr-panel__kaki"><button class="mr-btn mr-btn--hapus" id="f-hapus">${ikon("tong", 16)}Hapus</button><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="f-simpan">Simpan perubahan</button></footer>`);
  pasangRibuan($("#f-modal", panel));
  pasangRibuan($("#f-hjr", panel));
  pasangRibuan($("#f-jsaran", panel));
  pasangPilihSatuan($("#f-satuan-wrap", panel), () => S.satuan);
  pasangNilaiAsing(panel, "f");
  $("#f-lini", panel).addEventListener("change", (ev) => { $("#f-asing-blok", panel).hidden = ev.target.value !== LINI_ASING; });
  // lokasi: wajib hanya untuk lini yang memang berbasis lokasi (depo, gudang, open yard)
  // lokasi: pilihan mengikuti lini yang dipilih. Lini tanpa fasilitas hanya menampilkan "Tidak terikat lokasi" bila tarif sudah punya lokasi.
  const liniSekarang = () => $("#f-lini", panel).value;
  const aturLokasi = () => {
    const lini = liniSekarang();
    const wajib = lokasiWajib(lini);
    $("#f-lokasi-blok", panel).hidden = !JENIS_FASILITAS[lini] && !row.lokasiId;
    isiOpsiFasilitas(panel, "f", lini, S, { kosong: wajib ? "Pilih…" : "Tidak terikat lokasi", sekarang: lini === row.liniBisnisId ? row.lokasiId || "" : "" });
  };
  aturLokasi();
  $("#f-lini", panel).addEventListener("change", aturLokasi);
  pasangFasilitas(panel, "f", liniSekarang, { S, DB, onBaru: (id, nama) => { pilihFasilitasBaru(panel, "f", id, nama); } });
  $("#f-sumber", panel).addEventListener("input", (ev) => { $("#f-sumber-info", panel).innerHTML = infoSumber(ev.target.value); });
  $("#f-hapus", panel).onclick = async () => {
    if (await hapusTarif([kunci])) tutupLayer();
  };
  $("#f-simpan", panel).onclick = async () => {
    const galat = $("#f-galat", panel);
    const gagal = (pesan) => { galat.textContent = pesan; galat.hidden = false; };
    galat.hidden = true;

    // --- isian identitas ---
    const nama = $("#f-nama", panel).value.trim().replace(/\s+/g, " ");
    if (!nama) return gagal("Nama layanan wajib diisi.");
    // satuan boleh diketik bebas: yang belum ada disimpan dulu ke daftar satuan (bisa dipakai lagi nanti)
    const satPilih = resolveSatuan($("#f-satuan", panel).value, S.satuan);
    if (satPilih.kosong) return gagal("Satuan wajib diisi.");
    if (satPilih.baru) {
      await DB.buatJikaBelumAda("satuan_baku", satPilih.kode, { kode: satPilih.kode, nama: satPilih.nama }, { oleh: S.user.email });
      S.satuan.push({ id: satPilih.kode, kode: satPilih.kode, nama: satPilih.nama });
    }
    const lini = $("#f-lini", panel).value, vendor = $("#f-vendor", panel).value, satuan = satPilih.kode;
    const lokasiPilih = $("#f-lokasi", panel).value;
    if (lokasiWajib(lini) && !lokasiPilih) return gagal("Lokasi wajib diisi untuk lini bisnis ini.");
    const lokasiBaru = lokasiPilih || null;
    const dimBaru = row.dimensi || {}; // dimensi tidak diubah dari form Edit
    const layananBaru = row.layanan; // kode layanan tetap; yang berubah hanya nama tampilannya (kunci tidak ikut berubah)
    let kunciBaru = buatKunci(lini, vendor, lokasiBaru, layananBaru, dimBaru, satuan, null);
    // identitas sama dengan tarif lain (mis. hasil duplikat): tidak diblokir, kunci dibedakan dengan akhiran __salinan
    if (kunciBaru !== row.kunci && peta().has(kunciBaru)) {
      let k = kunciBaru + "__salinan", n = 2;
      while (k !== row.kunci && peta().has(k)) k = kunciBaru + "__salinan" + n++;
      kunciBaru = k;
    }

    // --- isian harga dan status ---
    const mentah = $("#f-modal", panel).value.trim();
    let modal = null;
    if (mentah !== "") {
      const p = parseAngka(mentah);
      if (!p.ok) return gagal(`Modal "${mentah}" bukan angka yang valid.`);
      modal = p.val;
    }
    const mataUang = "IDR";
    const asing = $("#f-lini", panel).value === LINI_ASING ? bacaNilaiAsing(panel, "f") : { ok: true, val: null };
    if (!asing.ok) return gagal(asing.pesan);
    const mentahJsaran = $("#f-jsaran", panel).value.trim();
    let jsaran = null;
    if (mentahJsaran !== "") {
      const p = parseAngka(mentahJsaran);
      if (!p.ok || p.val <= 0) return gagal(`Harga jual rekomendasi "${mentahJsaran}" harus angka lebih dari 0.`);
      jsaran = p.val;
    }
    const mentahHjr = $("#f-hjr", panel).value.trim();
    let hjr = null;
    if (mentahHjr !== "") {
      const p = parseAngka(mentahHjr);
      if (!p.ok) return gagal(`Harga jual referensi "${mentahHjr}" bukan angka yang valid.`);
      hjr = p.val;
    }
    const baru = {
      modal,
      hargaJualSaran: jsaran,
      mataUang,
      nilaiAsing: asing.val,
      metodeHarga: $("#f-metode", panel).value,
      aktif: $("#f-aktif", panel).value === "1",
      catatan: $("#f-catatan", panel).value.trim(),
      hargaJualReferensi: hjr,
      referensiSumber: $("#f-sumber", panel).value.trim() || null,
    };
    const lama = { ...row, hargaJualSaran: row.hargaJualSaran ?? null, mataUang: row.mataUang || "IDR", nilaiAsing: row.nilaiAsing ?? null, metodeHarga: row.metodeHarga || "tetap", aktif: row.aktif !== false, catatan: row.catatan || "", modal: row.modal ?? null, hargaJualReferensi: row.hargaJualReferensi ?? null, referensiSumber: row.referensiSumber || null };
    const perubahanHarga = bedaField(lama, baru);

    // --- perbedaan identitas ---
    const identitasLama = { liniBisnisId: row.liniBisnisId, vendorId: row.vendorId, lokasiId: row.lokasiId || null, layanan: row.layanan, layananNama: row.layananNama || row.layanan, satuanKode: row.satuanKode, dimensi: dimensiKeTeks(row.dimensi) };
    const identitasBaru = { liniBisnisId: lini, vendorId: vendor, lokasiId: lokasiBaru, layanan: layananBaru, layananNama: nama, satuanKode: satuan, dimensi: dimensiKeTeks(dimBaru) };
    const perubahanIdentitas = Object.keys(identitasBaru).filter((f) => String(identitasLama[f] ?? "") !== String(identitasBaru[f] ?? "")).map((f) => ({ field: f, lama: identitasLama[f] ?? null, baru: identitasBaru[f] ?? null }));
    const sudahBerubah = perubahanIdentitas.length > 0;

    // Tanpa perubahan identitas: jalur biasa (hanya harga dan status).
    if (!sudahBerubah) {
      const tombol = $("#f-simpan", panel);
      tombol.disabled = true;
      tombol.textContent = "Menyimpan…";
      const ok = await simpanPerubahan(row, perubahanHarga, "manual");
      if (ok) { tutupLayer(); render(); }
      else { tombol.disabled = false; tombol.textContent = "Simpan perubahan"; }
      return;
    }

    // Dengan perubahan identitas: tarif disimpan ulang dengan kunci sesuai identitas baru.
    const kunciBerubah = kunciBaru !== row.kunci;
    if (kunciBerubah && !(await konfirmasi("Ubah identitas tarif?", `Identitas tarif ini berubah, jadi <b>kuncinya ikut berubah</b>. Tarif lama dipindah ke identitas baru dan riwayat harga tetap tercatat. Lanjutkan?`, "Ya, pindahkan"))) return;
    const modalBerubah = modal !== (row.modal ?? null);
    if (modalBerubah && perubahanBesar(row.modal, modal) && !(await konfirmasi("Perubahan modal besar", `Modal <b>${e(nama)}</b> berubah lebih dari 50%:<br><b>${e(formatRp(row.modal))}</b> → <b>${e(formatRp(modal))}</b>. Sudah benar?`, "Ya, simpan"))) return;

    const dasar = { ...row };
    ["id", "modal", "hargaMin", "kunci", "diperbaruiPada", "diperbaruiOleh"].forEach((k) => delete dasar[k]);
    const baris = {
      ...dasar,
      liniBisnisId: lini, vendorId: vendor, lokasiId: lokasiBaru, layanan: layananBaru, layananNama: nama, dimensi: dimBaru, satuanKode: satuan,
      mataUang, nilaiAsing: baru.nilaiAsing, metodeHarga: baru.metodeHarga, aktif: baru.aktif, catatan: baru.catatan, hargaJualReferensi: hjr, referensiSumber: baru.referensiSumber,
      customerId: row.customerId ?? null, kunci: kunciBaru,
      diverifikasiPada: modalBerubah ? DB.hariIniLokal() : (row.diverifikasiPada ?? null),
    };
    const perubahanSemua = [...perubahanIdentitas, ...perubahanHarga, ...(kunciBerubah ? [{ field: "kunci", lama: row.kunci, baru: kunciBaru }] : [])];

    const tombol = $("#f-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    try {
      await DB.ubahIdentitasTarif(row.kunci, baris, modal, { oleh: S.user.email, perubahan: perubahanSemua });
      const i = S.tarif.findIndex((t) => t.kunci === row.kunci);
      const hasil = { ...baris, modal, id: kunciBaru, kunci: kunciBaru, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email };
      if (i >= 0) S.tarif.splice(i, 1, hasil);
      else S.tarif.push(hasil);
      if (S.pilih.has(row.kunci)) { S.pilih.delete(row.kunci); S.pilih.add(kunciBaru); }
      tutupLayer();
      render();
      toast(`<b>Tarif tersimpan dan terverifikasi di server.</b> ${e(nama)}${kunciBerubah ? " · kunci baru dibuat" : ""}`, "ok");
    } catch (err) {
      galat.textContent = `GAGAL menyimpan — angka lama tetap berlaku. ${err.message}`;
      galat.hidden = false;
      tombol.disabled = false;
      tombol.textContent = "Simpan perubahan";
    }
  };
}

// ---------- salin tarif ke vendor lain ----------
// Membuat baris baru dengan identitas sama (layanan, dimensi, satuan) untuk vendor tujuan.
// Lokasi milik vendor asal (mis. "hlc" atau "hlc_indoor") ikut diganti ke vendor tujuan.
function lokasiUntukVendor(t, vid) {
  if (!t.lokasiId) return null;
  if (t.lokasiId === t.vendorId) return vid;
  const awal = `${t.vendorId}_`;
  return String(t.lokasiId).startsWith(awal) ? vid + "_" + String(t.lokasiId).slice(awal.length) : t.lokasiId;
}
/* duplikat: salinan langsung di vendor dan lini yang sama, kunci baru berakhiran __salinan (bisa diedit identitasnya setelah dibuat) */
async function duplikatTarif(kunciList) {
  const rows = kunciList.map((k) => peta().get(k)).filter(Boolean);
  if (!rows.length) return;
  const pakai = new Set(peta().keys());
  const items = rows.map((t) => {
    let kunci = t.kunci + "__salinan", n = 2;
    while (pakai.has(kunci)) kunci = t.kunci + "__salinan" + n++;
    pakai.add(kunci);
    const { id, kunci: _kunci, diperbaruiPada, diperbaruiOleh, ...sisa } = t;
    return { kunci, baris: { ...sisa, catatan: `Duplikat dari ${t.kunci}.` } };
  });
  try {
    const h = await DB.terapkanBanyak(items.map((x) => ({ jenis: "baru", kunci: x.kunci, baris: x.baris })), { oleh: S.user.email, sumber: "duplikat" });
    const ok = new Set(h.berhasil);
    items.filter((x) => ok.has(x.kunci)).forEach((x) => S.tarif.push({ ...x.baris, kunci: x.kunci, id: x.kunci, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email }));
    S.pilih.clear();
    render();
    if (h.gagal.length) toast(`<b>${angka(h.berhasil.length)} diduplikat, ${angka(h.gagal.length)} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
    else toast(`<b>${angka(h.berhasil.length)} tarif diduplikat.</b> Edit identitas salinan bila perlu.`, "ok");
  } catch (err) {
    toast(`<b>GAGAL menduplikat.</b><br>${e(err.message)}`, "bahaya");
  }
}
function bukaSalinVendor(kunciList) {
  const rows = kunciList.map((k) => peta().get(k)).filter(Boolean);
  if (!rows.length) return;
  const liniAsal = [...new Set(rows.map((t) => t.liniBisnisId))];
  const vendorAsal = new Set(rows.map((t) => t.vendorId));
  const pilihan = S.vendor.filter((v) => v.aktif !== false && !(vendorAsal.size === 1 && vendorAsal.has(v.id))).sort((a, b) => {
    const cocok = (v) => liniAsal.every((l) => (v.liniBisnis || []).includes(l));
    return cocok(b) - cocok(a) || String(a.nama).localeCompare(String(b.nama));
  });
  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>Salin tarif ke vendor lain</h2><p class="mr-sub">${angka(rows.length)} tarif dipilih. Dibuat sebagai baris baru untuk vendor tujuan; tarif asal tidak berubah.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">
      <div class="mr-form">
        <label class="mr-f mr-f--lebar"><span>Vendor tujuan *</span><select id="sv-vendor"><option value="">Pilih vendor…</option>${pilihan.map((v) => `<option value="${e(v.id)}">${e(v.nama || v.id)}${liniAsal.every((l) => (v.liniBisnis || []).includes(l)) ? "" : " (lini belum terdaftar)"}</option>`).join("")}</select><small>Vendor yang belum terdaftar di lini tarifnya otomatis ditambahkan ke lini itu.</small></label>
        <label class="mr-cek mr-f--lebar"><input type="checkbox" id="sv-modal"><span>Ikut salin angka modal <small class="mr-sub">(kosongkan bila harga vendor tujuan belum diketahui)</small></span></label>
      </div>
      <div id="sv-pratinjau"></div>
    </div>
    <footer class="mr-panel__kaki"><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="sv-simpan" disabled>Salin</button></footer>`,
    { lebar: "lebar" }
  );
  const rencana = () => {
    const vid = $("#sv-vendor", panel).value, ikutModal = $("#sv-modal", panel).checked, ada = peta();
    if (!vid) return [];
    return rows.map((t) => {
      if (t.vendorId === vid) return { t, lewati: "vendor sama" };
      const lokasiId = lokasiUntukVendor(t, vid);
      const kunci = buatKunci(t.liniBisnisId, vid, lokasiId, t.layanan, t.dimensi, t.satuanKode, t.customerId || null);
      if (ada.has(kunci)) return { t, kunci, lewati: "sudah ada di vendor tujuan" };
      const baris = { liniBisnisId: t.liniBisnisId, vendorId: vid, lokasiId, layanan: t.layanan, layananNama: t.layananNama, dimensi: t.dimensi || {}, satuanKode: t.satuanKode, mataUang: "IDR",
        modal: ikutModal && !kosongModal(t) && (t.mataUang || "IDR") === "IDR" ? t.modal : null, metodeHarga: t.metodeHarga || "tetap", hargaJualReferensi: null, referensiSumber: null, customerId: t.customerId || null,
        berlakuDari: null, berlakuSampai: null, aktif: true, catatan: `Disalin dari ${namaVendor(t.vendorId)}.` };
      return { t, kunci, baris };
    });
  };
  const gambar = () => {
    const r = rencana(), baru = r.filter((x) => x.baris);
    $("#sv-pratinjau", panel).innerHTML = r.length ? `<div class="mr-kartu mr-tabelkartu"><table class="mr-table mr-table--import"><thead><tr><th>Layanan</th><th>Dari</th><th>Hasil</th></tr></thead><tbody>
      ${r.map((x) => `<tr class="${x.lewati ? "is-nonaktif" : ""}"><td class="mr-td-nama"><div class="mr-nama">${e(x.t.layananNama || x.t.layanan)}</div><div class="mr-sub">${e(namaLini(x.t.liniBisnisId))} · ${e(namaSatuan(x.t.satuanKode))}</div></td><td>${badgeVendor(x.t.vendorId)}</td><td>${x.lewati ? `<span class="mr-sub">Dilewati: ${e(x.lewati)}</span>` : `<span class="mr-lencana mr-s-baru">Baru</span> ${x.baris.modal == null ? '<span class="mr-kosongpil">Modal belum diisi</span>' : e(formatRp(x.baris.modal))}`}</td></tr>`).join("")}
      </tbody></table></div>` : "";
    const btn = $("#sv-simpan", panel);
    btn.disabled = !baru.length;
    btn.textContent = baru.length ? `Salin ${angka(baru.length)} tarif` : "Salin";
  };
  panel.addEventListener("change", gambar);
  $("#sv-simpan", panel).onclick = async () => {
    const vid = $("#sv-vendor", panel).value, r = rencana().filter((x) => x.baris);
    const btn = $("#sv-simpan", panel);
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
    try {
      const v = S.vendor.find((x) => x.id === vid);
      const kurang = [...new Set(r.map((x) => x.baris.liniBisnisId))].filter((l) => !(v.liniBisnis || []).includes(l));
      if (v && kurang.length) Object.assign(v, await DB.simpanVendor(vid, { liniBisnis: [...(v.liniBisnis || []), ...kurang] }, { baru: false, oleh: S.user.email }));
      const items = r.map((x) => ({ jenis: "baru", kunci: x.kunci, baris: x.baris }));
      const h = await DB.terapkanBanyak(items, { oleh: S.user.email, sumber: "salin" });
      const ok = new Set(h.berhasil);
      items.filter((x) => ok.has(x.kunci)).forEach((x) => S.tarif.push({ ...x.baris, kunci: x.kunci, id: x.kunci, diverifikasiPada: DB.hariIniLokal(), diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email }));
      S.pilih.clear();
      tutupLayer();
      render();
      if (h.gagal.length) toast(`<b>${angka(h.berhasil.length)} disalin, ${angka(h.gagal.length)} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
      else toast(`<b>${angka(h.berhasil.length)} tarif disalin ke ${e(namaVendor(vid))} dan terverifikasi.</b>${r.some((x) => x.baris.modal == null) ? " Isi modalnya dari tabel." : ""}`, "ok");
    } catch (err) {
      toast(`<b>GAGAL menyalin.</b><br>${e(err.message)}`, "bahaya");
      btn.disabled = false;
      gambar();
    }
  };
  gambar();
}

// ---------- drawer: verifikasi ulang tarif ke vendor ----------
// Tarif yang terakhir dicek >= 1 tahun dikelompokkan per vendor, lengkap dengan kontak PIC
// (WhatsApp / email berisi daftar tarifnya). Setelah vendor mengonfirmasi, tarif ditandai
// "sudah dicek" (diverifikasiPada = hari ini, tercatat di riwayat). Harga berubah? Edit modalnya:
// itu otomatis juga dihitung sebagai verifikasi.
const nomorWa = (telp) => {
  let d = String(telp || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!d) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d;
};
function pesanVerifikasi(v, daftar) {
  const baris = daftar.map((x, i) => `${i + 1}. ${x.t.layananNama || x.t.layanan} (${namaSatuan(x.t.satuanKode)}): ${kosongModal(x.t) ? "belum ada harga" : formatRp(x.t.modal, x.t.mataUang || "IDR")}`);
  return `Selamat siang ${v.nama || ""},\n\nKami dari PT Indo Sukses Logistik ingin memastikan tarif berikut masih berlaku:\n${baris.join("\n")}\n\nMohon konfirmasi apakah harga di atas masih sama, atau kirimkan penawaran terbaru bila ada perubahan. Terima kasih.`;
}

function bukaVerifikasi(fokusVendor) {
  const dipilih = new Set();
  let gulir = !!fokusVendor; // gulir ke vendor dari pemberitahuan, sekali saja
  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>Verifikasi ulang tarif</h2><p class="mr-sub">Tarif yang terakhir dicek ke vendor ${ATURAN_PENGINGAT.verifikasiHari} hari lalu atau lebih. Hubungi vendor, lalu tandai sudah dicek.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi" id="vf-isi"></div>
    <footer class="mr-panel__kaki"><span class="mr-sub" id="vf-n"></span><span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Tutup</button><button class="mr-btn mr-btn--hapus" id="vf-tidak" disabled>Tandai tidak valid</button><button class="mr-btn mr-btn--utama" id="vf-tandai" disabled>${ikon("cek", 16)}Tandai sudah dicek</button></footer>`,
    { lebar: "lebar" }
  );
  const kelompok = () => {
    const per = new Map();
    tarifPerluVerifikasi(S.tarif, S.vendor).forEach((x) => { const k = x.t.vendorId + "|" + x.t.liniBisnisId; if (!per.has(k)) per.set(k, []); per.get(k).push(x); });
    return [...per].sort((a, b) => (a[0] === fokusVendor ? -1 : b[0] === fokusVendor ? 1 : b[1].length - a[1].length));
  };
  const gambar = () => {
    const grup = kelompok();
    $("#vf-isi", panel).innerHTML = grup.length
      ? grup.map(([kunciGrup, daftar]) => {
          const [vid, lid] = kunciGrup.split("|");
          const v = vendorObj(vid);
          const pic = (v.pic || []).filter((p) => p.nama || p.telepon || p.email);
          const teks = encodeURIComponent(pesanVerifikasi(pic[0] || {}, daftar));
          const kontak = pic.length
            ? pic.map((p) => `<div class="vf-pic"><b>${e(p.nama || "PIC")}</b>${p.jabatan ? ` <span class="mr-sub" style="display:inline">${e(p.jabatan)}</span>` : ""}<span class="vf-pic__aksi">${nomorWa(p.telepon) ? `<a class="mr-btn mr-btn--kecil" href="https://wa.me/${nomorWa(p.telepon)}?text=${teks}" target="_blank" rel="noopener">WhatsApp ${e(p.telepon)}</a>` : ""}${p.email ? `<a class="mr-btn mr-btn--kecil" href="mailto:${e(p.email)}?subject=${encodeURIComponent("Konfirmasi tarif " + (v.nama || ""))}&body=${teks}">Email</a>` : ""}</span></div>`).join("")
            : `<p class="mr-galat-kecil">Vendor ini belum punya kontak PIC.${v.emailUmum ? ` Email umum: <a href="mailto:${e(v.emailUmum)}?body=${teks}">${e(v.emailUmum)}</a>.` : ""} <button type="button" class="mr-btn mr-btn--kecil" data-vf-vendor="${e(vid)}">Lengkapi kontak</button></p>`;
          const semua = daftar.every((x) => dipilih.has(x.t.kunci));
          return `<section class="mr-kartu vf-grup ${kunciGrup === fokusVendor ? "is-fokus" : ""}" style="--vh:${hueDari(vid)}">
            <div class="vf-grup__kepala">${badgeVendor(vid)}<span class="mr-tag">${e(namaLini(lid))}</span><span class="mr-sub" style="display:inline">${angka(daftar.length)} tarif</span><span class="mr-ruang"></span><label class="mr-cek"><input type="checkbox" data-vf-semua="${e(kunciGrup)}" ${semua ? "checked" : ""}><span>Pilih semua</span></label></div>
            <div class="vf-kontak">${kontak}</div>
            <ul class="vf-daftar">${daftar.map((x) => `<li><label class="mr-cek"><input type="checkbox" data-vf="${e(x.t.kunci)}" ${dipilih.has(x.t.kunci) ? "checked" : ""}><span><b>${e(x.t.layananNama || x.t.layanan)}</b>${x.t.perluUpdate ? ' <span class="mr-tag mr-tag--mati">Perlu update</span>' : ""} <span class="mr-sub" style="display:inline">${e(namaLini(x.t.liniBisnisId))} · ${e(namaSatuan(x.t.satuanKode))}</span></span></label><span class="vf-modal">${kosongModal(x.t) ? '<span class="mr-kosongpil">Belum diisi</span>' : e(formatRp(x.t.modal, x.t.mataUang || "IDR"))}</span><span class="mr-status ${x.tingkat === "lewat" ? "mr-status--mati" : "mr-status--warn"}" title="Terakhir dicek ${e(tgl(acuanVerifikasi(x.t)))}">${e(labelUmur(x.umur))}</span><button type="button" class="mr-ikonbtn" data-vf-edit="${e(x.t.kunci)}" title="Harga berubah? Edit modal" aria-label="Edit modal">${ikon("edit", 16)}</button></li>`).join("")}</ul>
          </section>`;
        }).join("")
      : `<div class="mr-kosong">${ikon("cek", 28)}<p>Semua tarif aktif sudah diverifikasi dalam ${ATURAN_PENGINGAT.verifikasiHari} hari terakhir.</p></div>`;
    $("#vf-n", panel).textContent = dipilih.size ? `${angka(dipilih.size)} tarif dipilih` : "";
    $("#vf-tandai", panel).disabled = !dipilih.size;
    $("#vf-tidak", panel).disabled = !dipilih.size;
    if (gulir) { gulir = false; const f = $(".vf-grup.is-fokus", panel); if (f) f.scrollIntoView({ block: "start" }); }
  };
  panel.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.vf) t.checked ? dipilih.add(t.dataset.vf) : dipilih.delete(t.dataset.vf);
    else if (t.dataset.vfSemua) { const [vid, lid] = t.dataset.vfSemua.split("|"); S.tarif.filter((x) => x.vendorId === vid && x.liniBisnisId === lid).forEach((x) => (t.checked ? dipilih.add(x.kunci) : dipilih.delete(x.kunci))); }
    else return;
    [...dipilih].forEach((k) => { if (!tarifPerluVerifikasi([peta().get(k)].filter(Boolean)).length) dipilih.delete(k); });
    gambar();
  });
  panel.addEventListener("click", (ev) => {
    const ed = ev.target.closest("[data-vf-edit]"), vv = ev.target.closest("[data-vf-vendor]");
    if (ed) bukaEdit(ed.dataset.vfEdit);
    else if (vv) bukaVendor({ S, DB, id: vv.dataset.vfVendor, namaLini, render });
  });
  $("#vf-tidak", panel).onclick = async () => {
    // tanggal verifikasi dibekukan ke acuan yang sekarang, supaya hitungan 1 tahun tidak mulai ulang
    const items = [...dipilih].map((k) => peta().get(k)).filter(Boolean).map((t) => ({ jenis: "ubah", kunci: t.kunci, perubahan: [{ field: "perluUpdate", lama: !!t.perluUpdate, baru: true }, { field: "diverifikasiPada", lama: t.diverifikasiPada || null, baru: acuanVerifikasi(t) }], liniBisnisId: t.liniBisnisId, vendorId: t.vendorId }));
    if (!items.length) return;
    const btn = $("#vf-tidak", panel);
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
    try {
      const h = await DB.terapkanBanyak(items, { oleh: S.user.email, sumber: "tidak-valid" });
      h.berhasil.forEach((k) => { const t = peta().get(k); if (t) { t.perluUpdate = true; t.diverifikasiPada = acuanVerifikasi(t); t.diperbaruiPada = new Date().toISOString(); t.diperbaruiOleh = S.user.email; } dipilih.delete(k); });
      render();
      gambar();
      if (h.gagal.length) toast(`<b>${angka(h.berhasil.length)} ditandai, ${angka(h.gagal.length)} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
      else toast(`<b>${angka(h.berhasil.length)} tarif ditandai tidak valid.</b> Menunggu update harga dari vendor.`, "ok");
    } catch (err) {
      toast(`<b>GAGAL menyimpan.</b><br>${e(err.message)}`, "bahaya");
    }
    btn.textContent = "Tandai tidak valid";
    btn.disabled = !dipilih.size;
  };
  $("#vf-tandai", panel).onclick = async () => {
    const kunci = [...dipilih];
    const ok = await konfirmasi("Tandai sudah dicek?", `<b>${angka(kunci.length)}</b> tarif ditandai sudah dikonfirmasi vendor hari ini. Pengingatnya muncul lagi ${ATURAN_PENGINGAT.verifikasiHari} hari lagi. Kalau harga berubah, edit modalnya dulu.`, "Tandai");
    if (!ok) return;
    const btn = $("#vf-tandai", panel);
    btn.disabled = true;
    btn.textContent = "Menyimpan…";
    const hari = DB.hariIniLokal();
    const items = kunci.map((k) => peta().get(k)).filter(Boolean).map((t) => ({ jenis: "ubah", kunci: t.kunci, perubahan: [{ field: "diverifikasiPada", lama: t.diverifikasiPada || null, baru: hari }, ...(t.perluUpdate ? [{ field: "perluUpdate", lama: true, baru: false }] : [])], liniBisnisId: t.liniBisnisId, vendorId: t.vendorId }));
    try {
      const h = await DB.terapkanBanyak(items, { oleh: S.user.email, sumber: "verifikasi" });
      h.berhasil.forEach((k) => { const t = peta().get(k); if (t) { t.diverifikasiPada = hari; t.perluUpdate = false; t.diperbaruiPada = new Date().toISOString(); t.diperbaruiOleh = S.user.email; } dipilih.delete(k); });
      render();
      if (h.gagal.length) toast(`<b>${angka(h.berhasil.length)} ditandai, ${angka(h.gagal.length)} GAGAL.</b><br>${e(h.gagal[0].alasan)}`, "bahaya");
      else toast(`<b>${angka(h.berhasil.length)} tarif ditandai sudah dicek dan terverifikasi di server.</b>`, "ok");
    } catch (err) {
      toast(`<b>GAGAL menyimpan.</b><br>${e(err.message)}`, "bahaya");
    }
    btn.innerHTML = `${ikon("cek", 16)}Tandai sudah dicek`;
    gambar();
  };
  gambar();
}

// ---------- drawer: riwayat ----------
const LABEL_FIELD = { layananNama: "Nama layanan", layanan: "Layanan (kode)", liniBisnisId: "Lini bisnis", vendorId: "Vendor", lokasiId: "Lokasi", satuanKode: "Satuan", dimensi: "Dimensi", kunci: "Kunci", modal: "Modal", mataUang: "Mata uang", metodeHarga: "Metode harga", hargaJualReferensi: "Harga jual referensi", referensiSumber: "Sumber referensi", berlakuDari: "Berlaku dari", berlakuSampai: "Berlaku sampai", aktif: "Status", catatan: "Catatan", diverifikasiPada: "Diverifikasi ke vendor" };
const LABEL_SUMBER = { edit_identitas: "Ubah identitas", manual: "Edit manual", import_excel: "Import Excel", tambah_baru: "Item baru", kerangka: "Kerangka tarif", hapus: "Dihapus", verifikasi: "Verifikasi vendor", ubah_massal: "Ubah harga massal", salin: "Disalin dari vendor lain" };

function nilaiRiwayat(field, v) {
  if (v === null || v === undefined || v === "") return "<i>kosong</i>";
  if (field === "modal" || field === "hargaJualReferensi") return `<b>${e(formatRp(v))}</b>`;
  if (field === "aktif") return `<b>${v ? "Aktif" : "Nonaktif"}</b>`;
  return `<b>${e(v)}</b>`;
}

async function bukaRiwayat(kunci) {
  const row = peta().get(kunci);
  if (!row) return;
  const panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>Riwayat perubahan</h2><p class="mr-sub">${e(row.layananNama || row.layanan)} · ${e(namaVendor(row.vendorId))}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi" id="riw-isi"><div class="mr-kosong">${ikon("riwayat", 24)}<p>Memuat riwayat…</p></div></div>`);
  try {
    const riw = await DB.muatRiwayat(kunci);
    const isi = $("#riw-isi", panel);
    if (!isi) return;
    isi.innerHTML = riw.length
      ? `<ol class="mr-riwayat">${riw
          .map(
            (r) => `<li><span class="mr-riwayat__titik"></span><div class="mr-riwayat__kepala"><b>${e(tgl(r.tanggal))}</b><span class="mr-tag">${e(LABEL_SUMBER[r.sumber] || r.sumber || "")}</span></div>
            <div class="mr-sub">${e((r.oleh || "").split("@")[0] || "—")}${r.jenis === "dibuat" ? " · item dibuat" : r.jenis === "dihapus" ? " · item dihapus" : ""}</div>
            ${(r.perubahan || []).map((p) => `<div class="mr-riwayat__baris"><span>${e(LABEL_FIELD[p.field] || p.field)}</span><span>${nilaiRiwayat(p.field, p.lama)} <em>→</em> ${nilaiRiwayat(p.field, p.baru)}</span></div>`).join("")}</li>`
          )
          .join("")}</ol>`
      : `<div class="mr-kosong">${ikon("riwayat", 24)}<p>Belum ada perubahan tercatat untuk item ini.<br>Perubahan berikutnya akan muncul di sini.</p></div>`;
  } catch (err) {
    const isi = $("#riw-isi", panel);
    if (isi) isi.innerHTML = `<div class="mr-banner mr-banner--bahaya">${ikon("peringatan")}<div>Riwayat gagal dimuat: ${e(err.message)}</div></div>`;
  }
}


// ---------- drawer: lini bisnis ----------
function bukaLini(id, { kelompok = "", kategoriBaru = false, pilihSetelah = false } = {}) {
  const lama = id ? S.lini.find((l) => l.id === id) : null;
  const grupAda = daftarKelompok().map((g) => g.judul);
  const grupAwal = lama ? kelompokLini(lama) : kelompok || (S.f.lini !== "semua" && S.lini.find((l) => l.id === S.f.lini) ? kelompokLini(S.lini.find((l) => l.id === S.f.lini)) : grupAda[0] || LAIN);
  const panel = bukaLayer(`
    <header class="mr-panel__kepala"><div><h2>${lama ? "Edit lini bisnis" : "Tambah lini bisnis"}</h2><p class="mr-sub">${lama ? `ID: ${e(lama.id)}` : "ID dibuat otomatis dari nama."}</p></div><div class="vf-kepala__aksi"><button type="button" class="mr-btn mr-btn--utama vf-kepala__simpan" id="l-simpan">Simpan</button><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></div></header>
    <div class="mr-panel__isi"><div class="mr-form">
      <label class="mr-f mr-f--lebar"><span>Nama lini bisnis *</span><input id="l-nama" value="${e(lama ? namaLini(lama.id) : "")}" placeholder="Mis. Cold Chain Trucking"></label>
      <label class="mr-f"><span>Kategori *</span><select id="l-grup">${grupAda.map((j) => `<option value="${e(j)}" ${!kategoriBaru && j === grupAwal ? "selected" : ""}>${e(j)}</option>`).join("")}<option value="__baru__" ${kategoriBaru ? "selected" : ""}>＋ Kategori baru…</option></select><small>Kelompok tampilan di tab Tarif.</small></label>
      <label class="mr-f" id="l-grupbaru-w" ${kategoriBaru ? "" : "hidden"}><span>Nama kategori baru *</span><input id="l-grupbaru" placeholder="Mis. Jasa gudang" autocomplete="off"></label>
      <label class="mr-f"><span>Jenis harga</span><select id="l-kat"><option value="harga_tetap" ${lama?.kategori !== "request_based" ? "selected" : ""}>Harga tetap</option><option value="request_based" ${lama?.kategori === "request_based" ? "selected" : ""}>Berdasarkan permintaan</option></select></label>
      <label class="mr-f"><span>Status</span><select id="l-aktif"><option value="1" ${lama?.aktif !== false ? "selected" : ""}>Aktif</option><option value="0" ${lama?.aktif === false ? "selected" : ""}>Nonaktif</option></select></label>
    </div><p class="mr-galat" id="l-galat" hidden></p></div>
    <footer class="mr-panel__kaki lini-kaki">${lama && S.master ? `<button class="mr-btn mr-btn--hapus" id="l-hapus">${ikon("tong", 16)}Hapus lini</button>` : ""}</footer>`);
  $("#l-grup", panel).addEventListener("change", (ev) => { $("#l-grupbaru-w", panel).hidden = ev.target.value !== "__baru__"; if (ev.target.value === "__baru__") $("#l-grupbaru", panel).focus(); });
  if (kategoriBaru) setTimeout(() => $("#l-grupbaru", panel).focus(), 50);
  const hapusLini = $("#l-hapus", panel);
  if (hapusLini) {
    const dipakai = S.tarif.filter((t) => t.liniBisnisId === lama.id).length;
    if (dipakai) {
      hapusLini.disabled = true;
      hapusLini.title = `Masih punya ${dipakai} tarif. Hapus tarifnya dulu.`;
    }
    hapusLini.onclick = async () => {
      const ok = await konfirmasiKetik("Hapus lini bisnis permanen?", `Lini <b>${e(namaLini(lama.id))}</b> akan dihapus. Tidak bisa dibatalkan.`, "HAPUS");
      if (!ok) return;
      try {
        await DB.hapusDokumen("lini_bisnis", lama.id);
        S.lini.splice(S.lini.findIndex((x) => x.id === lama.id), 1);
        toast(`<b>Lini bisnis dihapus.</b> ${e(namaLini(lama.id))}`, "ok");
        tutupLayer();
        render();
      } catch (err) {
        toast(`<b>GAGAL menghapus lini bisnis.</b><br>${e(err.message)}`, "bahaya");
      }
    };
  }
  $("#l-simpan", panel).onclick = async () => {
    const g = $("#l-galat", panel);
    const nama = $("#l-nama", panel).value.trim();
    if (!nama) {
      g.textContent = "Nama lini bisnis wajib diisi.";
      g.hidden = false;
      return;
    }
    let grup = $("#l-grup", panel).value;
    if (grup === "__baru__") {
      grup = $("#l-grupbaru", panel).value.trim().replace(/\s+/g, " ");
      if (!grup) {
        g.textContent = "Nama kategori baru wajib diisi.";
        g.hidden = false;
        return;
      }
      grup = grupAda.find((j) => j.toLowerCase() === grup.toLowerCase()) || grup; // pakai kategori yang sudah ada bila namanya sama
    }
    const lid = lama ? lama.id : slug(nama);
    if (!lama && S.lini.some((l) => l.id === lid)) {
      g.textContent = `Lini "${namaLini(lid)}" sudah ada. Pakai nama lain atau edit lini itu.`;
      g.hidden = false;
      return;
    }
    const data = { nama, kategori: $("#l-kat", panel).value, aktif: $("#l-aktif", panel).value === "1", kelompok: grup };
    const tombol = $("#l-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    try {
      const tersimpan = await DB.simpanLini(lid, data, { baru: !lama, oleh: S.user.email });
      const i = S.lini.findIndex((l) => l.id === lid);
      if (i >= 0) S.lini[i] = { ...S.lini[i], ...tersimpan };
      else S.lini.push(tersimpan);
      toast(`<b>Lini bisnis tersimpan dan terverifikasi.</b> ${e(nama)} · kategori ${e(grup)}`, "ok");
      grupBuka.add(grup);
      if (pilihSetelah) ((S.tab = "tarif"), (S.f = { lini: lid, vendor: "semua", cari: "", kosong: false }), ganti());
      tutupLayer();
      render();
    } catch (err) {
      toast(`<b>GAGAL menyimpan lini bisnis.</b><br>${e(err.message)}`, "bahaya");
      g.textContent = err.message;
      g.hidden = false;
      tombol.disabled = false;
      tombol.textContent = "Simpan lini bisnis";
    }
  };
}

// ---------- import Excel ----------
const LABEL_STATUS = { baru: "Baru", ubah: "Ubah", sama: "Sama", kembar: "Kembar", error: "Error" };

function bukaImport() {
  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>Import Excel</h2><p class="mr-sub">Pratinjau dulu, baru disimpan setelah kamu konfirmasi.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi" id="imp-isi">
      <label class="mr-drop" id="imp-drop">${ikon("file", 28)}<b>Pilih file Excel (.xlsx)</b><span>Gunakan file dari tombol <i>Unduh template</i> di bawah.</span><input type="file" id="imp-file" accept=".xlsx,.xls" hidden></label>
      <div class="mr-banner">${ikon("info")}<div>Belum punya file? Unduh <b>template</b> berisi tarif yang sedang tampil di tabel (sesuai filter), ubah kolom Modal, lalu unggah lagi di sini.<br><button class="mr-btn mr-btn--kecil" id="imp-templat" style="margin-top:6px">${ikon("download", 14)}Unduh template (.xlsx)</button></div></div>
      <ul class="mr-aturan"><li>File dari <b>penawaran vendor</b> (hasil bacaan PDF/foto lewat chat) boleh memuat sheet <b>Vendor</b> dan <b>T&amp;C Vendor</b>: vendor baru dibuat berstatus <b>Draf</b> dan T&amp;C-nya ikut tersimpan.</li><li>Baris dengan <b>Kunci</b> terisi diperbarui; baris tanpa Kunci dianggap item baru.</li><li>Sel kosong = tidak diubah. Angka 0 = gratis.</li><li>Baris kembar dalam file dan baris error <b>tidak disimpan</b>.</li><li>Baris tarif khusus format pivot (trucking, distribusi kecil) tetap lewat template terminal.</li></ul>
      ${DEMO ? `<button class="mr-btn" id="imp-contoh">${ikon("file", 16)}Coba dengan contoh file (demo)</button>` : ""}
    </div><footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Tutup</button></footer>`,
    { lebar: "lebar" }
  );
  $("#imp-templat", panel).onclick = () => {
    const daftar = tarifTampil();
    if (!daftar.length) return toast("Tidak ada baris di tabel untuk dijadikan template.", "bahaya");
    if (DEMO) return toast(`Di versi online, ini mengunduh template Excel berisi <b>${angka(daftar.length)} baris</b>. Unduhan dimatikan di mode demo.`, "ok");
    try {
      eksporTarif(daftar, { namaLini, namaVendor, namaSatuan }, `template-tarif_${S.f.lini}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      toast(`<b>Template gagal dibuat.</b><br>${e(err.message)}`, "bahaya");
    }
  };
  // paket = {tarif: baris Excel, vendor: data sheet Vendor|null, tnc: [klausul]}
  const pratinjau = (paket) => {
    const v = paket.vendor;
    const vendorAda = v ? S.vendor.find((x) => x.id === v.id || String(x.nama).trim().toLowerCase() === v.nama.toLowerCase()) : null;
    const vendorBaru = v && !vendorAda ? { id: v.id, nama: v.nama, liniBisnis: v.liniBisnisId ? [v.liniBisnisId] : [], aktif: true } : null;
    const rencana = buatRencana(paket.tarif, { tarifMap: peta(), vendor: vendorBaru ? [...S.vendor, vendorBaru] : S.vendor, lini: S.lini, satuan: S.satuan });
    tampilPratinjau(panel, rencana, { ...paket, vendorAda, vendorBaru });
  };
  $("#imp-file", panel).onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      pratinjau(await bacaFileLengkap(f, S.lini));
    } catch (err) {
      toast(`<b>File tidak bisa dibaca.</b><br>${e(err.message)}`, "bahaya");
    }
  };
  if (DEMO) $("#imp-contoh", panel).onclick = () => pratinjau({ tarif: contohBarisExcel(), vendor: null, tnc: [] });
}

function contohBarisExcel() {
  const aktif = S.tarif.filter((t) => t.aktif !== false);
  const ada = aktif.filter((t) => t.modal != null);
  const kosong = aktif.filter((t) => t.modal == null);
  const rows = [];
  const dasar = (t) => ({ kunci: t.kunci, "lini bisnis": "", vendor: "", layanan: "", modal: "", "metode harga": "", aktif: "", catatan: "" });
  if (kosong[0]) rows.push({ ...dasar(kosong[0]), modal: "Rp 1.250.000" });
  if (kosong[1]) rows.push({ ...dasar(kosong[1]), modal: 87500 });
  if (ada[0]) rows.push({ ...dasar(ada[0]), modal: Math.round(ada[0].modal * 1.08) });
  if (ada[1]) rows.push({ ...dasar(ada[1]), modal: ada[1].modal });
  if (ada[2]) rows.push({ ...dasar(ada[2]), modal: Math.round(ada[2].modal * 2.4), catatan: "Kenaikan besar (contoh tanda hati-hati)" });
  if (ada[0]) rows.push({ ...dasar(ada[0]), modal: 5555 }); // kembar
  if (ada[3]) rows.push({ ...dasar(ada[3]), modal: "abc" }); // error angka
  rows.push({ kunci: "kunci_ngawur__x__x__x__x__x__x", modal: 1000 }); // kunci tak dikenal
  rows.push({ kunci: "", "lini bisnis": "Depo Container", vendor: "Karem", lokasi: "", layanan: "Biaya Penimbangan", "nama layanan": "Biaya Penimbangan Container", dimensi: "ukuran=20ft", satuan: "Per Kontainer", modal: 150000 }); // baru
  rows.push({ kunci: "", "lini bisnis": "Depo Container", vendor: "Vendor Belum Ada", layanan: "Tes", satuan: "Per Kontainer", modal: 1 }); // vendor tak terdaftar
  return rows;
}

function kartuVendorImpor(paket) {
  if (!paket.vendor) return "";
  const v = paket.vendor;
  const status = paket.vendorBaru ? `<span class="mr-status mr-status--warn">Vendor baru · Draf</span>` : `<span class="mr-status mr-status--ok">Vendor sudah ada</span>`;
  const kat = [...new Set(paket.tnc.map((t) => labelKategoriTnc(t.kategori)))];
  return `<div class="mr-vimpor"><div class="mr-vimpor__kepala">${ikon("vendor", 18)}<b>${e(v.nama)}</b>${status}</div>
    <div class="mr-sub">${e(v.namaLengkap || "")}${v.alamatKantor ? ` · ${e(v.alamatKantor)}` : ""}</div>
    <div class="mr-vimpor__isi"><span>${paket.vendorBaru ? "Akan dibuat" : "Akan dilengkapi"}: identitas, ${v.pic.length} PIC, termin ${e(v.terminBayar || "-")}</span><span><b>${paket.tnc.length}</b> klausul T&amp;C vendor${kat.length ? ` (${kat.slice(0, 4).map(e).join(", ")}${kat.length > 4 ? ", …" : ""})` : ""}</span>${v.liniBisnisId ? `<span>Lini: <b>${e(namaLini(v.liniBisnisId))}</b></span>` : `<span class="mr-galat-kecil">Lini "${e(v.liniBisnisNama || "-")}" tidak dikenali. Daftarkan lini itu dulu.</span>`}</div></div>`;
}

function tampilPratinjau(panel, rencana, paket = { vendor: null, tnc: [], vendorAda: null, vendorBaru: null }) {
  const cacah = { baru: 0, ubah: 0, sama: 0, kembar: 0, error: 0 };
  rencana.forEach((r) => cacah[r.status]++);
  const layak = rencana.filter((r) => r.status === "baru" || r.status === "ubah");
  const bermasalah = cacah.kembar + cacah.error;
  let saring = layak.length ? "semua-berubah" : "semua";
  const isi = $("#imp-isi", panel);
  const kaki = $(".mr-panel__kaki", panel);

  const gambar = () => {
    const tampil = rencana.filter((r) => (saring === "semua" ? true : saring === "semua-berubah" ? r.status !== "sama" : r.status === saring));
    isi.innerHTML = `
      ${kartuVendorImpor(paket)}
      <div class="mr-ringkas">
        ${["baru", "ubah", "sama", "kembar", "error"].map((s) => `<button class="mr-ringkas__item mr-s-${s} ${saring === s ? "is-aktif" : ""}" data-s="${s}"><b>${cacah[s]}</b><span>${LABEL_STATUS[s]}</span></button>`).join("")}
      </div>
      ${bermasalah ? `<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div><b>${bermasalah} baris bermasalah tidak akan disimpan.</b> Perbaiki di Excel lalu import ulang, atau lanjutkan dengan baris yang valid saja.</div></div>` : ""}
      ${rencana.length ? "" : `<div class="mr-banner mr-banner--bahaya">${ikon("peringatan")}<div>File tidak berisi baris data.</div></div>`}
      <div class="mr-kartu mr-tabelkartu"><table class="mr-table mr-table--import"><thead><tr><th>Baris</th><th>Status</th><th>Item</th><th>Perubahan</th></tr></thead><tbody>
      ${tampil
        .slice(0, 300)
        .map(
          (r) => `<tr><td>${r.no}</td><td><span class="mr-lencana mr-s-${r.status}">${LABEL_STATUS[r.status]}</span>${r.besar ? ' <span class="mr-lencana mr-s-besar" title="Perubahan modal lebih dari 50%">Besar</span>' : ""}</td>
          <td class="mr-td-nama"><div class="mr-nama">${e(r.ringkas || r.kunci || "—")}</div>${r.alasan ? `<div class="mr-galat-kecil">${e(r.alasan)}</div>` : ""}</td>
          <td>${r.perubahan.map((p) => `<div class="mr-riwayat__baris"><span>${e(LABEL_FIELD[p.field] || p.field)}</span><span>${nilaiRiwayat(p.field, p.lama)} <em>→</em> ${nilaiRiwayat(p.field, p.baru)}</span></div>`).join("") || (r.status === "sama" ? '<span class="mr-sub">Tidak ada beda</span>' : "")}</td></tr>`
        )
        .join("")}
      </tbody></table></div>${tampil.length > 300 ? `<p class="mr-sub">Menampilkan 300 baris pertama dari ${tampil.length}. Semua baris valid tetap ikut disimpan.</p>` : ""}`;
    $$(".mr-ringkas__item", isi).forEach((b) => (b.onclick = () => ((saring = saring === b.dataset.s ? "semua" : b.dataset.s), gambar())));
  };
  gambar();

  kaki.innerHTML = `<button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn" id="imp-ulang">Pilih file lain</button><button class="mr-btn mr-btn--utama" id="imp-terapkan" ${layak.length || paket.vendorBaru || paket.tnc.length ? "" : "disabled"}>Simpan ${layak.length} perubahan${paket.vendorBaru ? " + vendor draf" : ""}${paket.tnc.length ? " + T&C" : ""}</button>`;
  $("#imp-ulang", kaki).onclick = () => bukaImport();
  $("#imp-terapkan", kaki).onclick = async () => {
    const ok = await konfirmasi("Simpan hasil import?", `<b>${cacah.baru}</b> item baru dan <b>${cacah.ubah}</b> perubahan akan disimpan. Setiap perubahan harga dicatat di riwayat.${bermasalah ? `<br><b>${bermasalah}</b> baris bermasalah dilewati.` : ""}`, "Simpan");
    if (!ok) return;
    isi.innerHTML = `<div class="mr-kosong"><div class="mr-progres"><span id="imp-bar"></span></div><p id="imp-teks">Menyimpan 0 dari ${layak.length}…</p></div>`;
    kaki.innerHTML = "";
    const v = paket.vendor;
    const tambahan = [];
    try {
      if (v && paket.vendorBaru) {
        const data = {
          nama: v.nama, namaLengkap: v.namaLengkap, jenisBadanUsaha: v.jenisBadanUsaha, alamatKantor: v.alamatKantor, mapsUrl: "", emailUmum: v.emailUmum, website: v.website,
          kontak: v.kontak, terminBayar: v.terminBayar, warnaHue: null, liniBisnis: v.liniBisnisId ? [v.liniBisnisId] : [], aktif: true, status: "draf",
          catatan: `Dibuat otomatis dari impor penawaran ${v.penawaran || ""}`.trim(), pic: v.pic, legalitas: [], tnc: paket.tnc,
        };
        const t = await DB.simpanVendor(v.id, data, { baru: true, oleh: S.user.email });
        S.vendor.push(t);
        tambahan.push(`vendor ${v.nama} (Draf)`);
      } else if (v && paket.vendorAda && paket.tnc.length) {
        const lama = S.vendor.find((x) => x.id === paket.vendorAda.id);
        const liniB = v.liniBisnisId && !(lama.liniBisnis || []).includes(v.liniBisnisId) ? [...(lama.liniBisnis || []), v.liniBisnisId] : lama.liniBisnis || [];
        const t = await DB.simpanVendor(lama.id, { tnc: gabungTnc(lama.tnc || [], paket.tnc), liniBisnis: liniB }, { baru: false, oleh: S.user.email });
        Object.assign(lama, t);
      }
      if (v && paket.vendorAda && paket.tnc.length) tambahan.push(`${paket.tnc.length} klausul T&C`);
      if (v && paket.vendorBaru) tambahan.push(`${paket.tnc.length} klausul T&C`);
    } catch (err) {
      isi.innerHTML = `<div class="mr-banner mr-banner--bahaya">${ikon("peringatan")}<div><b>GAGAL menyimpan vendor / T&amp;C.</b> Tarif belum disimpan.<br>${e(err.message)}</div></div>`;
      kaki.innerHTML = `<button class="mr-btn mr-btn--utama" data-aksi="tutup-layer">Tutup</button>`;
      return;
    }
    if (v) layak.forEach((r) => r.status === "baru" && r.baris && !r.baris.referensiSumber && (r.baris.referensiSumber = v.penawaran || null));
    const items = layak.map((r) => (r.status === "baru" ? { jenis: "baru", kunci: r.kunci, baris: r.baris } : { jenis: "ubah", kunci: r.kunci, perubahan: r.perubahan, liniBisnisId: r.liniBisnisId, vendorId: r.vendorId }));
    let hasil;
    try {
      hasil = await DB.terapkanBanyak(items, {
        oleh: S.user.email,
        sumber: "import_excel",
        onProgress: (n, total) => {
          $("#imp-bar", panel).style.width = `${Math.round((n / total) * 100)}%`;
          $("#imp-teks", panel).textContent = `Menyimpan & memverifikasi ${n} dari ${total}…`;
        },
      });
    } catch (err) {
      hasil = { berhasil: [], gagal: layak.map((r) => ({ kunci: r.kunci, alasan: err.message })) };
    }
    const sukses = new Set(hasil.berhasil);
    layak.forEach((r) => {
      if (!sukses.has(r.kunci)) return;
      if (r.status === "baru") S.tarif.push({ ...r.baris, kunci: r.kunci, id: r.kunci, diperbaruiPada: new Date().toISOString(), diperbaruiOleh: S.user.email });
      else {
        const row = peta().get(r.kunci);
        r.perubahan.forEach((p) => (row[p.field] = p.baru));
        if (r.perubahan.some((p) => p.field === "modal")) row.diverifikasiPada = DB.hariIniLokal();
        row.diperbaruiPada = new Date().toISOString();
        row.diperbaruiOleh = S.user.email;
      }
    });
    render();
    isi.innerHTML = `
      <div class="mr-hasil ${hasil.gagal.length ? "mr-hasil--sebagian" : ""}">
        <span class="mr-hasil__ikon">${ikon(hasil.gagal.length ? "peringatan" : "cek", 28)}</span>
        <h3>${hasil.berhasil.length} tersimpan dan terverifikasi di server</h3>
        ${tambahan.length ? `<p>Ikut tersimpan: ${e(tambahan.join(", "))}.</p>` : ""}
        ${hasil.gagal.length ? `<p><b>${hasil.gagal.length} gagal.</b> Angka lama pada baris ini tetap berlaku:</p><ul class="mr-gagal">${hasil.gagal.slice(0, 50).map((g) => `<li><code>${e(g.kunci)}</code><br>${e(g.alasan)}</li>`).join("")}</ul>` : "<p>Semua perubahan sudah dibaca ulang dari server dan cocok.</p>"}
      </div>`;
    kaki.innerHTML = `<button class="mr-btn mr-btn--utama" data-aksi="tutup-layer">Selesai</button>`;
  };
}



// ---------- event ----------
function ganti(pilihBersih = true) {
  if (pilihBersih) S.pilih.clear(); // pilihan hapus tidak boleh terbawa ke filter lain
  S.hal = 1;
}

function pasangEvent() {
  document.addEventListener("click", (ev) => {
    if (window.__rute !== "master-rate") return; // hanya saat halaman ini sedang tampil
    const el = ev.target.closest("[data-aksi]");
    if (!el || el.matches("input") || ev.target.matches("input")) return; // klik kotak centang tidak membuka baris
    const a = el.dataset.aksi;
    const k = el.dataset.k;
    const v = el.dataset.v;
    if (a === "tutup-layer") return tutupLayer();
    if (a === "tab") (ganti(false), (S.tab = v), render());
    else if (a === "view") ((S.view = v), (S.hal = 1), render());
    else if (a === "grup") {
      const g = el.dataset.g;
      S.tutup.has(g) ? S.tutup.delete(g) : S.tutup.add(g);
      render();
    } else if (a === "grup-semua") {
      if (v === "tutup") kelompokkan(tarifTampil(), labelDim, namaLini).forEach((g) => S.tutup.add(g.kunci));
      else S.tutup.clear();
      S.hal = 1;
      render();
    }
    else if (a === "filter-lini") ((S.f.lini = S.f.lini === v ? "semua" : v), (S.f.vendor = "semua"), (S.liniBuka = !window.matchMedia("(max-width: 760px)").matches), ganti(), render());
    else if (a === "lini-toggle") ((S.liniBuka = !S.liniBuka), render());
    else if (a === "hal") ((S.hal += Number(v)), render(), $("#mr-isi")?.scrollIntoView({ block: "start", behavior: "smooth" }));
    else if (a === "reset-filter") ((S.f = { lini: "semua", vendor: "semua", cari: "", kosong: false }), ganti(), render());
    else if (a === "edit-cepat") S.kelola && mulaiEditCepat(k);
    else if (a === "edit") S.kelola && bukaEdit(k);
    else if (a === "riwayat") bukaRiwayat(k);
    else if (a === "hapus") S.kelola && hapusTarif([k]);
    else if (a === "pilih-semua") ((S.pilih = new Set(tarifTampil().map((t) => t.kunci))), render());
    else if (a === "pilih-batal") (S.pilih.clear(), render());
    else if (a === "tab-semua") (idTabTampil().forEach((id) => pilihTabAktif().add(id)), render());
    else if (a === "tab-batal") (pilihTabAktif().clear(), render());
    else if (a === "tab-nonaktif") S.kelola && nonaktifPilihTab();
    else if (a === "tab-hapus") S.master && hapusPilihTab();
    else if (a === "hapus-pilih") S.kelola && hapusTarif([...S.pilih]);
    else if (a === "tambah") S.kelola && bukaTambahItem({ S, DB, peta, namaLini, namaLokasi, render });
    else if (a === "kerangka") S.kelola && bukaKerangka();
    else if (a === "tutup-banner") { try { localStorage.setItem("isl-banner-standar", el.dataset.v || ""); } catch (err) { /* abaikan */ } render(); }
    else if (a === "daftar-standar") S.kelola && daftarkanStandar();
    else if (a === "import") S.kelola && bukaImport();
    else if (a === "verifikasi") S.kelola && bukaVerifikasi();
    else if (a === "kpi-hapus") { S.f = { ...S.f, kosong: false, baru: false, jualKosong: false }; ganti(); render(); }
    else if (a === "stat") {
      const fBersih = { lini: "semua", vendor: "semua", cari: "", kosong: false, baru: false, jualKosong: false };
      if (v === "kosong") { const aktif = S.tab === "tarif" && S.f.kosong; S.tab = "tarif"; S.f = { ...fBersih, kosong: !aktif }; ganti(); } // klik lagi = matikan filter
      else if (v === "baru") { const aktif = S.tab === "tarif" && S.f.baru; S.tab = "tarif"; S.f = { ...fBersih, baru: !aktif }; S.view = aktif ? S.view : "daftar"; ganti(); }
      else if (v === "total") ((S.tab = "tarif"), (S.f = fBersih), ganti());
      else if (v === "tanpavendor") { const aktif = S.tab === "tarif" && S.f.vendor === "__belum__"; S.tab = "tarif"; S.f = { ...fBersih, vendor: aktif ? "semua" : "__belum__" }; ganti(); }
      else if (v === "jualkosong") { const aktif = S.tab === "tarif" && S.f.jualKosong; S.tab = "tarif"; S.f = { ...fBersih, jualKosong: !aktif }; S.view = aktif ? S.view : "daftar"; ganti(); }
      else if (v === "tanpalini") { const aktif = S.tab === "tarif" && S.f.lini === "__belum__"; S.tab = "tarif"; S.f = { ...fBersih, lini: aktif ? "semua" : "__belum__" }; ganti(); }
      else if (v === "lengkapi") { const aktif = S.tab === "vendor" && S.fv.status === "lengkapi"; S.tab = "vendor"; S.fv = { cari: "", lini: "semua", status: aktif ? "semua" : "lengkapi" }; ganti(false); }
      else if (v === "verifikasi") { S.tab = "tarif"; render(); return S.kelola && bukaVerifikasi(); }
      render();
    }
    else if (a === "salin-vendor") S.kelola && bukaSalinVendor([...S.pilih]);
    else if (a === "duplikat-pilih") S.kelola && duplikatTarif([...S.pilih]);
    else if (a === "lihat-vendor") ((S.tab = "tarif"), (S.f = { lini: "semua", vendor: k, cari: "", kosong: false }), ganti(), render());
    else if (a === "reset-vendor") ((S.fv = { cari: "", status: "semua", lini: "semua" }), render());
    else if (a === "laporan") bukaLaporan({ S, DB, namaLini, namaVendor, namaSatuan, awalLini: S.f.lini });
    else if (a === "vendor-tambah") S.kelola && bukaVendor({ S, DB, namaLini, render });
    else if (a === "vendor-edit") bukaVendor({ S, DB, id: k, namaLini, render });
    else if (a === "lini-tambah") S.kelola && bukaLini(null, { kelompok: v || "", pilihSetelah: S.tab === "tarif" });
    else if (a === "kategori-baru") S.kelola && bukaLini(null, { kategoriBaru: true, pilihSetelah: true });
    else if (a === "lipat-grup") (lipatGrup(v), render());
    else if (a === "kpi-lipat") {
      kpiTutup = !kpiTutup;
      try { localStorage.setItem(K_KPI, kpiTutup ? "1" : "0"); } catch (err) { /* abaikan */ }
      render();
    }
    else if (a === "lipat-semua") {
      grupBuka.clear();
      if (v === "buka") daftarKelompok().forEach((g) => grupBuka.add(g.judul));
      try { localStorage.setItem(K_GRUP, JSON.stringify([...grupBuka])); } catch (err) { /* abaikan */ }
      render();
    }
    else if (a === "lini-edit") S.kelola && bukaLini(k);
    else if (a === "lini-hapus") S.master && hapusLiniDariKartu(k);
    else if (a === "lini-sk") bukaSkTipe(k);
    else if (a === "lokasi-tambah") S.kelola && bukaProfil({ S, DB, render });
    else if (a === "lokasi-edit") S.kelola && bukaProfil({ S, DB, id: k, render });
    else if (a === "pf-detail") bukaDetailProfil({ S, DB, id: k, namaVendor, render });
    else if (a === "pf-kartu") { const p = daftarProfil(S).find((x) => x.id === k); if (p) kartuProfil(p, el); }
    else if (a === "pf-jenis") (filterProfil("jenis", el.dataset.v), render());
    else if (a === "pf-mode") (filterProfil("mode", el.dataset.v), render());
    else if (a === "pf-status") (filterProfil("status", el.dataset.v), render());
    else if (a === "pf-contoh") S.kelola && isiContohProfil({ S, DB, render });
    else if (a === "lihat-lini") ((S.tab = "tarif"), (S.f = { lini: k, vendor: "semua", cari: "", kosong: false }), (S.liniBuka = !window.matchMedia("(max-width: 760px)").matches), ganti(), render());
    else if (a === "lihat-lokasi") ((S.tab = "tarif"), (S.f = { lini: "open_yard", vendor: "semua", cari: k, kosong: false }), ganti(), render());
    else if (a === "muat-ulang") muatData();
  });
  document.addEventListener("input", (ev) => {
    if (window.__rute !== "master-rate") return; // hanya saat halaman ini sedang tampil
    if (ev.target.id === "pf-cari") {
      filterProfil("q", ev.target.value);
      clearTimeout(pasangEvent._tp);
      pasangEvent._tp = setTimeout(() => {
        render();
      }, 200);
    } else if (ev.target.id === "mr-v-cari") {
      S.fv.cari = ev.target.value;
      clearTimeout(pasangEvent._tv);
      pasangEvent._tv = setTimeout(() => render(), 200);
    } else if (ev.target.id === "mr-cari" || ev.target.id === "mr-cari-bar") {
      S.f.cari = ev.target.value;
      ganti();
      clearTimeout(pasangEvent._t);
      pasangEvent._t = setTimeout(() => {
        render();
      }, 200);
    }
  });
  document.addEventListener("change", (ev) => {
    if (window.__rute !== "master-rate") return; // hanya saat halaman ini sedang tampil
    const t = ev.target;
    if (t.id === "pf-status") (filterProfil("status", t.value), render());
    else if (t.id === "mr-f-vendor") ((S.f.vendor = t.value), ganti(), render());
    else if (t.id === "mr-f-lini") ((S.f.lini = t.value), (S.f.vendor = "semua"), ganti(), render());
    else if (t.id === "mr-v-status") ((S.fv.status = t.value), render());
    else if (t.id === "mr-v-lini") ((S.fv.lini = t.value), render());
    else if (t.matches("[data-pilih]")) {
      t.checked ? S.pilih.add(t.dataset.pilih) : S.pilih.delete(t.dataset.pilih);
      render();
    } else if (t.matches("[data-pilih-v]")) {
      t.checked ? S.pilihV.add(t.dataset.pilihV) : S.pilihV.delete(t.dataset.pilihV);
      render();
    } else if (t.matches("[data-pilih-lok]")) {
      t.checked ? S.pilihLok.add(t.dataset.pilihLok) : S.pilihLok.delete(t.dataset.pilihLok);
      render();
    } else if (t.matches("[data-pilih-v-semua]") || t.matches("[data-pilih-lok-semua]")) {
      // header tabel: pilih atau batal semua baris yang tampil di tabel ini
      const vendor = t.matches("[data-pilih-v-semua]");
      const set = vendor ? S.pilihV : S.pilihLok;
      $$(vendor ? "[data-pilih-v]" : "[data-pilih-lok]", t.closest("table")).forEach((c) => {
        const id = vendor ? c.dataset.pilihV : c.dataset.pilihLok;
        t.checked ? set.add(id) : set.delete(id);
      });
      render();
    } else if (t.matches('[data-aksi="pilih-halaman"]')) {
      $$("tr[data-k]").forEach((tr) => (t.checked ? S.pilih.add(tr.dataset.k) : S.pilih.delete(tr.dataset.k)));
      render();
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (window.__rute !== "master-rate") return; // hanya saat halaman ini sedang tampil
    if (ev.key === "Escape" && $("#mr-layer.is-open") && !$(".mr-konfirm")) tutupLayer();
  });
}

// =============================== HP: DESAIN A (disetujui 3 Nov 2026) ===============================
// Layar <= 760 px: ringkasan satu baris, tab berikon, cari + filter + menu, chip filter cepat, daftar padat.
// Ketuk baris = panel aksi; geser kiri = pintasan; Pilih / tekan-tahan = pilih banyak. PC memakai render lama dan tidak berubah.
const mqHP = window.matchMedia("(max-width: 760px)");
const HP = () => mqHP.matches;
const MH = { ringkas: false, pilih: false, pilihTab: "", tahanSampai: 0, tahanId: "", pending: "", intipSelesai: false, cariLini: "", pickUntuk: "f", sheet: "" };
const pilihAktif = () => S.kelola && ((MH.pilih && MH.pilihTab === S.tab) || pilihTabAktif().size > 0);
const ikonTab = { tarif: "tarif", vendor: "vendor", lini: "lini", lokasi: "pin" };
const WIDTH_AKSI_MR = 68, WIDTH_AKSI_MR_ = 68;

const atasHP = (h) => {
  const kartu = [
    kartuStat({ v: "total", ikonNama: "tarif", n: h.total, label: "Total tarif", aktif: false, judul: "Tampilkan semua tarif" }),
    kartuStat({ v: "kosong", ikonNama: "peringatan", n: h.kosong, label: "Belum ada modal", perhatian: h.kosong > 0, aktif: S.tab === "tarif" && S.f.kosong, judul: "Tampilkan tarif yang modalnya belum diisi" }),
    kartuStat({ v: "jualkosong", ikonNama: "tarif", n: h.jualKosong, label: "Belum ada harga jual saran", perhatian: h.jualKosong > 0, aktif: S.tab === "tarif" && S.f.jualKosong, judul: "Tampilkan tarif aktif yang belum punya harga jual saran" }),
    S.kelola ? kartuStat({ v: "verifikasi", ikonNama: "riwayat", n: h.verifikasi, label: "Perlu verifikasi", perhatian: h.verifikasi > 0, aktif: false, judul: "Buka panel verifikasi ulang tarif ke vendor" }) : "",
    `<button type="button" class="mr-stat__kartu ${h.lengkapi > 0 ? "is-perhatian" : ""} ${S.tab === "vendor" && S.fv.status === "lengkapi" ? "is-aktif" : ""}" data-aksi="stat" data-v="lengkapi" title="Tampilkan vendor yang datanya belum lengkap"><span class="mr-stat__ikon">${ikon("vendor")}</span><div><b>${h.kelengkapanVendor}%</b><small>Kelengkapan vendor rata-rata</small>${bilahVendor(h.kelengkapanVendor)}</div></button>`,
    kartuStat({ v: "baru", ikonNama: "edit", n: h.baru, label: `Baru diubah (${HARI_BARU} hari)`, aktif: S.tab === "tarif" && !!S.f.baru, judul: `Tampilkan tarif yang diperbarui ${HARI_BARU} hari terakhir` }),
  ].join("");
  return `<div class="mr-m-top">
      <button type="button" class="mr-m-ring" data-aksi="m-ringkas" aria-expanded="${MH.ringkas}"><b>${angka(h.total)} tarif</b><span>${h.kosong ? `<em>${angka(h.kosong)} belum ada modal</em>` : "Semua tarif sudah punya modal"}</span></button>
      ${S.kelola && h.verifikasi ? `<button type="button" class="mr-m-vf" data-aksi="verifikasi">${ikon("tameng", 15)}<span>Verifikasi ${angka(h.verifikasi)}</span></button>` : ""}
      <button type="button" class="mr-m-chev ${MH.ringkas ? "is-buka" : ""}" data-aksi="m-ringkas" aria-label="${MH.ringkas ? "Tutup" : "Buka"} ringkasan">${ikon("turun", 17)}</button>
    </div>
    ${MH.ringkas ? `<div class="mr-m-ringisi"><div class="mr-stat is-ringkas">${kartu}</div></div>` : ""}`;
};
const tabsHP = () => `<div class="mr-m-tabs" role="tablist">${[["tarif", "Tarif"], ["vendor", "Vendor"], ["lini", "Lini Bisnis"], ["lokasi", "Lokasi"]]
  .map(([id, l]) => `<button type="button" role="tab" aria-selected="${S.tab === id}" class="mr-m-tab ${S.tab === id ? "is-aktif" : ""}" data-aksi="tab" data-v="${id}">${ikon(ikonTab[id], 19)}<span>${l}</span></button>`).join("")}</div>`;
const cariHP = ({ id, ph, nilai, filterAktif = null, menu = false }) => `<div class="mr-m-cari">
  <label class="mr-cari mr-m-cari__in">${ikon("cari", 16)}<input id="${id}" type="search" placeholder="${e(ph)}" value="${e(nilai)}" autocomplete="off" enterkeyhint="search"></label>
  ${filterAktif === null ? "" : `<button type="button" class="mr-m-ib ${filterAktif ? "is-aktif" : ""}" data-aksi="m-filter" aria-label="Filter${filterAktif ? " (ada filter aktif)" : ""}">${ikon("filter", 19)}${filterAktif ? '<i class="mr-m-dot"></i>' : ""}</button>`}
  ${menu ? `<button type="button" class="mr-m-ib" data-aksi="m-menu" aria-label="Menu lain">${ikon("titik", 19)}</button>` : ""}</div>`;
const chipHP = (aktif, teks, n, aksi, v = "", warn = false) => `<button type="button" class="mr-m-chip ${aktif ? "is-on" : ""} ${warn ? "is-warn" : ""}" data-aksi="${aksi}" ${v ? `data-v="${v}"` : ""} aria-pressed="${aktif}">${warn ? ikon("peringatan", 14) : ""}${teks} <em>${angka(n)}</em></button>`;
const pilihBarHP = (n, total, tipe) => {
  if (!pilihAktif()) return "";
  const tarif = tipe === "tarif";
  return `<div class="mr-m-pb" role="region" aria-label="Pilih banyak"><div class="mr-m-pb__a"><span><b>${angka(n)}</b> dipilih</span>${n < total ? `<button type="button" class="mr-m-link" data-aksi="${tarif ? "pilih-semua" : "tab-semua"}">Pilih semua (${angka(total)})</button>` : ""}<span class="mr-ruang"></span><button type="button" class="mr-m-link" data-aksi="m-batal">Batal</button></div>
    ${n ? `<div class="mr-m-pb__b">${tarif
      ? `<button type="button" class="mr-btn" data-aksi="duplikat-pilih">${ikon("salin", 15)}Duplikat</button><button type="button" class="mr-btn" data-aksi="salin-vendor">${ikon("tukar", 15)}Salin ke vendor lain</button>${S.master ? `<button type="button" class="mr-btn mr-btn--hapus" data-aksi="hapus-pilih">${ikon("tong", 15)}Hapus permanen</button>` : ""}`
      : `<button type="button" class="mr-btn" data-aksi="tab-nonaktif">${ikon("tutup", 15)}Nonaktifkan</button>${S.master ? `<button type="button" class="mr-btn mr-btn--hapus" data-aksi="tab-hapus">${ikon("tong", 15)}Hapus permanen</button>` : ""}`}</div>` : `<p class="mr-m-pb__h">Ketuk untuk memilih. Tombol aksi muncul di sini.</p>`}</div>`;
};
const fabHP = () => {
  if (!S.kelola || pilihAktif()) return "";
  const [aksi, label] = { tarif: ["tambah", "Tambah item"], vendor: ["vendor-tambah", "Tambah vendor"], lokasi: ["lokasi-tambah", "Tambah fasilitas"], lini: ["lini-tambah", "Tambah lini bisnis"] }[S.tab];
  return `<button type="button" class="mr-fab mr-fab--m" data-aksi="${aksi}" aria-label="${label}">${ikon("plus", 22)}</button>`;
};

/* geser kanan di semua list = Pilih (mulai memilih banyak) */
const aksiPilih = (tipe, id) => (S.kelola ? `<div class="mr-m-actL"><button type="button" class="mr-m-ab mr-m-ab--pilih" data-aksi="m-pilih-mulai" data-tipe="${tipe}" data-k="${id}">${ikon("cek", 19)}<span>Pilih</span></button></div>` : "");
const tombolAb = (aksi, ik, label, attr = "", cls = "") => `<button type="button" class="mr-m-ab ${cls}" data-aksi="${aksi}" ${attr}>${ikon(ik, 19)}<span>${label}</span></button>`;
function barisTarifHP(t, { pilih, intip, tampilLini }) {
  const id = e(t.kunci), sel = S.pilih.has(t.kunci), kos = kosongModal(t);
  const dim = Object.entries(t.dimensi || {}).map(([k, v]) => `<span class="mr-tag" title="${e(k)}">${e(labelDim(k, v))}</span>`).join("");
  const metode = t.metodeHarga && t.metodeHarga !== "tetap" ? `<span class="mr-tag mr-tag--metode">${e(METODE_HARGA.find((m) => m.v === t.metodeHarga)?.t || t.metodeHarga)}</span>` : "";
  const asing = t.nilaiAsing ? `<span class="mr-tag mr-tag--asing">${e(teksNilaiAsing(t.nilaiAsing))}</span>` : (t.mataUang && t.mataUang !== "IDR" ? `<span class="mr-tag mr-tag--mati">${e(t.mataUang)}</span>` : "");
  const rp = kos ? "" : e(formatRp(t.modal, t.mataUang || "IDR"));
  const harga = kos
    ? (S.kelola ? `<button type="button" class="mr-m-kosong" data-aksi="edit-cepat" data-k="${id}">Belum diisi</button>` : `<span class="mr-kosongpil">Belum diisi</span>`)
    : (S.kelola ? `<button type="button" class="mr-m-harga" data-aksi="edit-cepat" data-k="${id}" aria-label="Ubah cepat modal ${rp}">${rp}${ikon("edit", 12)}</button>` : `<span class="mr-m-harga">${rp}</span>`);
  const aksi = `<button type="button" class="mr-m-ab" data-aksi="riwayat" data-k="${id}">${ikon("riwayat", 19)}<span>Riwayat</span></button>${S.kelola ? `<button type="button" class="mr-m-ab" data-aksi="edit" data-k="${id}">${ikon("edit", 19)}<span>Ubah</span></button><button type="button" class="mr-m-ab mr-m-ab--bahaya" data-aksi="hapus" data-k="${id}">${ikon("tong", 19)}<span>Hapus</span></button>` : ""}`;
  const n = 1 + (S.kelola ? 2 : 0);
  return `<div class="mr-m-baris mr-m-sw ${sel ? "is-pilih" : ""} ${t.aktif === false ? "is-nonaktif" : ""} ${intip ? "is-intip" : ""}" data-mid="${id}" data-tipe="t" data-bisapilih="${S.kelola ? 1 : ""}" style="--vh:${hueDari(t.vendorId)};--aw:${n * WIDTH_AKSI_MR}px;--awl:${WIDTH_AKSI_MR}px">
    ${pilih ? "" : `<div class="mr-m-act">${aksi}</div>${aksiPilih("t", id)}`}
    <div class="mr-m-isi mr-m-sc" data-aksi="${pilih ? "m-pilih" : "m-aksi"}" data-k="${id}" data-tipe="t">
      ${pilih ? `<span class="mr-m-cek ${sel ? "is-on" : ""}" aria-hidden="true">${sel ? ikon("cek", 16) : ""}</span>` : ""}
      <div class="mr-m-tengah">
        <div class="mr-m-a"><b>${e(t.layananNama || t.layanan)}</b></div>
        <div class="mr-m-b">${badgeVendor(t.vendorId)}<span>${e(namaSatuan(t.satuanKode))}</span>${tampilLini ? `<span class="mr-m-lini">${e(namaLini(t.liniBisnisId))}</span>` : ""}</div>
        <div class="mr-m-c">${t.aktif === false ? '<span class="mr-tag mr-tag--mati">Nonaktif</span>' : ""}${t.perluUpdate ? '<span class="mr-tag mr-tag--mati">Perlu update</span>' : ""}${dim}${t.lokasiId ? `<span class="mr-lokasi">${ikon("vendor", 12)}${e(namaLokasi(t.lokasiId))}</span>` : `<span class="mr-lokasi mr-lokasi--kosong">Tidak terikat lokasi</span>`}</div>
      </div>
      <div class="mr-m-p">${harga}${metode}${asing}${t.hargaJualSaran ? `<span class="mr-m-sub">Jual saran ${e(formatRp(t.hargaJualSaran))}</span>` : ""}${S.f.baru && t.diperbaruiPada ? `<span class="mr-m-sub">Diubah ${e(tgl(t.diperbaruiPada))}</span>` : ""}</div>
    </div></div>`;
}

function htmlTarifHP(h) {
  const daftar = tarifTampil(), linio = S.f.lini !== "semua", view = S.view === "perbandingan" ? "kelompok" : S.view, pilih = pilihAktif();
  const filterLuar = S.f.lini !== "semua" || S.f.vendor !== "semua";
  const qfSemua = !S.f.kosong && !S.f.baru && !S.f.jualKosong;
  let isi = "", infoHal = "", jumlahHal = 1, nGrup = 0, intipPakai = false;
  let intip = false;
  if (!MH.intipSelesai && S.kelola) { try { intip = !localStorage.getItem("islmr-geser"); } catch { intip = false; } if (intip) setTimeout(() => { MH.intipSelesai = true; try { localStorage.setItem("islmr-geser", "1"); } catch { /* abaikan */ } }, 3500); }
  const baris = (r) => { const i = intip && !intipPakai && !pilih; if (i) intipPakai = true; return barisTarifHP(r, { pilih, intip: i, tampilLini: !linio && view === "daftar" }); };
  if (!daftar.length) {
    isi = `<div class="mr-kosong">${ikon("cari", 28)}<p>${S.tarif.some((t) => linio && t.liniBisnisId === S.f.lini) || !linio ? "Tidak ada tarif yang cocok dengan filter ini." : `Lini <b>${e(namaLini(S.f.lini))}</b> belum punya tarif.${KERANGKA[S.f.lini] && S.kelola ? " Gunakan <b>Kerangka tarif</b> di menu ⋯ untuk membuat daftar komponen standarnya." : ""}`}</p><button type="button" class="mr-btn mr-btn--kecil" data-aksi="reset-filter">Reset filter</button></div>`;
  } else if (view === "kelompok") {
    const grup = kelompokkan(daftar, labelDim, namaLini); nGrup = grup.length;
    const hal = bagiHalaman(grup, (g) => (S.tutup.has(g.kunci) ? 1 : g.rows.length + 1));
    jumlahHal = hal.length; if (S.hal > jumlahHal) S.hal = jumlahHal;
    const potong = hal[S.hal - 1];
    isi = potong.map((g) => {
      const tutup = S.tutup.has(g.kunci), vendorGrup = [...new Set(g.rows.map((r) => r.vendorId))];
      return `<section class="mr-m-box"><button type="button" class="mr-m-gh" data-aksi="grup" data-g="${e(g.kunci)}" aria-expanded="${!tutup}">${ikon(tutup ? "maju" : "turun", 16)}<b>${e(g.label)}</b><em>${g.rows.length}</em><span class="mr-m-dots">${vendorGrup.slice(0, 6).map((v) => `<i style="--vh:${hueDari(v)}" title="${e(namaVendor(v))}"></i>`).join("")}</span></button>${tutup ? "" : g.rows.map(baris).join("")}</section>`;
    }).join("");
    infoHal = `${angka(potong.length)} kelompok di halaman ini · ${angka(daftar.length)} tarif`;
  } else {
    const hal = bagiHalaman(daftar, () => 1); jumlahHal = hal.length; if (S.hal > jumlahHal) S.hal = jumlahHal;
    const potong = hal[S.hal - 1], awal = (S.hal - 1) * PER_HALAMAN;
    isi = `<section class="mr-m-box">${potong.map(baris).join("")}</section>`;
    infoHal = `Menampilkan ${angka(awal + 1)}-${angka(awal + potong.length)} dari ${angka(daftar.length)}`;
  }
  const semuaTutup = view === "kelompok" && nGrup > 0 && kelompokkan(daftar, labelDim, namaLini).every((g) => S.tutup.has(g.kunci));
  return `${window.ISLNotif ? window.ISLNotif.htmlPerModul(["tarif"], "Perlu verifikasi") : ""}
    ${cariHP({ id: "mr-cari-bar", ph: "Cari layanan, vendor, lokasi…", nilai: S.f.cari, filterAktif: filterLuar, menu: true })}
    <div class="mr-m-chips" role="group" aria-label="Filter cepat">${chipHP(qfSemua, "Semua", h.total, "kpi-hapus")}${chipHP(!!S.f.kosong, "Belum ada modal", h.kosong, "m-qf", "kosong", h.kosong > 0)}${chipHP(!!S.f.jualKosong, "Belum jual saran", h.jualKosong, "m-qf", "jualKosong")}${chipHP(!!S.f.baru, "Baru diubah", h.baru, "m-qf", "baru")}</div>
    <div class="mr-m-meta"><span>${angka(daftar.length)} tarif${nGrup ? ` · ${angka(nGrup)} kelompok` : ""}</span><span class="mr-ruang"></span>
      ${S.kelola && daftar.length ? `<button type="button" class="mr-m-link" data-aksi="m-pilih-mode">${ikon("cek", 15)}${pilih ? "Selesai memilih" : "Pilih"}</button>` : ""}
      ${view === "kelompok" && nGrup ? `<button type="button" class="mr-m-link" data-aksi="grup-semua" data-v="${semuaTutup ? "buka" : "tutup"}">${ikon("lipat", 15)}${semuaTutup ? "Buka semua" : "Lipat semua"}</button>` : ""}</div>
    ${pilihBarHP(S.pilih.size, daftar.length, "tarif")}
    ${isi}
    ${daftar.length ? `<div class="mr-halaman"><span>${infoHal}</span><div><button type="button" class="mr-ikonbtn" data-aksi="hal" data-v="-1" ${S.hal <= 1 ? "disabled" : ""} aria-label="Sebelumnya">${ikon("kembali")}</button><b>${S.hal} / ${jumlahHal}</b><button type="button" class="mr-ikonbtn" data-aksi="hal" data-v="1" ${S.hal >= jumlahHal ? "disabled" : ""} aria-label="Berikutnya">${ikon("maju")}</button></div></div>` : ""}`;
}

function barisVendorHP(v, cacah, pilih) {
  const id = e(v.id), sel = S.pilihV.has(v.id), st = statusVendor(v), kurang = kurangVendor(v), pct = Math.round(kelengkapanVendor(v) * 100), pic = (v.pic || [])[0], lini = v.liniBisnis || [];
  const izin = (v.legalitas || []).map((l) => statusBerlaku(l.berlakuSampai)).filter(Boolean), buruk = izin.find((s) => s.kelas === "mati") || izin.find((s) => s.kelas === "warn");
  const pilL = { aktif: "Aktif", mitra: "Mitra", draf: "Draf", nonaktif: "Nonaktif" }[st], internal = v.id === VENDOR_INTERNAL;
  const kosong = (t) => `<i>${t}</i>`, k = `data-k="${id}"`;
  const kiri = S.kelola
    ? tombolAb("vendor-edit", "edit", "Ubah", k) + (internal ? "" : tombolAb("m-aktif", v.aktif === false ? "cek" : "tutup", v.aktif === false ? "Aktifkan" : "Nonaktifkan", `${k} data-jenis="vendor" data-v="${v.aktif === false ? 1 : 0}"`, "mr-m-ab--status")) + (S.master && !internal ? tombolAb("m-hapus", "tong", "Hapus", `${k} data-jenis="vendor"`, "mr-m-ab--bahaya") : "")
    : tombolAb("vendor-edit", "maju", "Detail", k);
  const n = (kiri.match(/<button/g) || []).length;
  return `<div class="mr-m-vr mr-m-sw ${sel ? "is-pilih" : ""} ${v.aktif === false ? "is-nonaktif" : ""}" data-mid="${id}" data-tipe="v" data-bisapilih="${S.kelola ? 1 : ""}" style="--vh:${hueVendor(v)};--aw:${n * WIDTH_AKSI_MR_}px;--awl:${WIDTH_AKSI_MR_}px">
    ${pilih ? "" : `<div class="mr-m-act">${kiri}</div>${aksiPilih("v", id)}`}
    <div class="mr-m-vr__isi mr-m-sc" data-aksi="${pilih ? "m-pilih" : "m-aksi-vendor"}" data-k="${id}" data-tipe="v">
      <div class="mr-m-vr__h">${pilih ? `<span class="mr-m-cek ${sel ? "is-on" : ""}" aria-hidden="true">${sel ? ikon("cek", 16) : ""}</span>` : ""}<span class="mr-m-av">${e(inisial(namaVendor(v.id)))}</span>
        <div class="mr-m-vr__t"><b>${e(namaVendor(v.id))}<span class="mr-m-vst mr-m-vst--${st}">${pilL}</span></b><small>${v.namaLengkap ? e(v.namaLengkap) : kosong("Nama lengkap belum diisi")}</small></div>
        <span class="mr-m-kontak" data-aksi="m-noop">${pilih ? "" : kontakCepat(v)}</span></div>
      <div class="mr-m-vr__tag">${lini.slice(0, 2).map((l) => `<span class="mr-tag">${e(namaLini(l))}</span>`).join("") || kosong("Belum ada lini")}${lini.length > 2 ? `<span class="mr-tag">+${lini.length - 2}</span>` : ""}</div>
      <div class="mr-m-vr__f"><span>${pic ? `${e(pic.nama || "-")}` : kosong("Belum ada PIC")}${buruk ? ` · <b class="mr-m-warn">${e(buruk.teks)}</b>` : ""}</span><span>${v.terminBayar ? e(v.terminBayar) : kosong("Termin belum diisi")} · ${cacah[v.id] ? `<button type="button" class="mr-m-link" data-aksi="lihat-vendor" data-k="${id}">${angka(cacah[v.id])} tarif ›</button>` : "0 tarif"}</span></div>
      <div class="mr-m-vr__b"><div class="mr-m-bar"><i style="width:${pct}%" class="${pct < 60 ? "is-rendah" : ""}"></i></div><span>${pct}%${kurang.length ? ` · <em>Perlu ${kurang.length} data</em>` : ""}</span></div>
    </div></div>`;
}
function htmlVendorHP() {
  const cacah = {}; S.tarif.forEach((t) => (cacah[t.vendorId] = (cacah[t.vendorId] || 0) + 1));
  const urut = vendorTampil().sort((a, b) => (b.aktif !== false) - (a.aktif !== false) || String(a.nama).localeCompare(String(b.nama)));
  const nSt = (st) => S.vendor.filter((v) => statusVendor(v) === st).length, pilih = pilihAktif();
  const lengkapi = S.vendor.filter((v) => kurangVendor(v).length).length;
  const chip = (v, t, n, warn) => chipHP(S.fv.status === v, t, n, "m-vstatus", v, warn);
  return `${cariHP({ id: "mr-v-cari", ph: "Cari vendor, PIC, telepon…", nilai: S.fv.cari, filterAktif: S.fv.lini !== "semua", menu: S.kelola })}
    <div class="mr-m-chips" role="group" aria-label="Status vendor">${chip("semua", "Semua", S.vendor.length)}${chip("aktif", "Aktif", nSt("aktif"))}${chip("mitra", "Mitra", nSt("mitra"))}${chip("draf", "Draf", nSt("draf"))}${chip("nonaktif", "Nonaktif", nSt("nonaktif"))}${chip("lengkapi", "Perlu dilengkapi", lengkapi, lengkapi > 0)}</div>
    <div class="mr-m-meta"><span>${angka(urut.length)} dari ${angka(S.vendor.length)} vendor</span><span class="mr-ruang"></span>${S.kelola && urut.length ? `<button type="button" class="mr-m-link" data-aksi="m-pilih-mode">${ikon("cek", 15)}${pilih ? "Selesai memilih" : "Pilih"}</button>` : ""}</div>
    ${pilihBarHP(S.pilihV.size, urut.length, "vendor")}
    ${urut.length ? `<section class="mr-m-box">${urut.map((v) => barisVendorHP(v, cacah, pilih)).join("")}</section>` : `<div class="mr-kosong">${ikon("cari", 28)}<p>Tidak ada vendor yang cocok dengan filter ini.</p><button type="button" class="mr-btn mr-btn--kecil" data-aksi="reset-vendor">Reset filter</button></div>`}`;
}

const liniTampilHP = () => { const q = MH.cariLini.trim().toLowerCase(); return daftarKelompok().flatMap((g) => g.isi).filter((l) => !q || `${namaLini(l.id)} ${l.id}`.toLowerCase().includes(q)); };
function barisLiniHP(l, cacah, vend, pilih) {
  const id = e(l.id), sel = S.pilihLini.has(l.id), k = `data-k="${id}"`, nonaktif = l.aktif === false;
  const kiri = S.kelola
    ? tombolAb("lini-edit", "edit", "Ubah", k) + tombolAb("m-aktif", nonaktif ? "cek" : "tutup", nonaktif ? "Aktifkan" : "Nonaktifkan", `${k} data-jenis="lini" data-v="${nonaktif ? 1 : 0}"`, "mr-m-ab--status") + (S.master ? tombolAb("m-hapus", "tong", "Hapus", `${k} data-jenis="lini"`, "mr-m-ab--bahaya") : "")
    : tombolAb("lihat-lini", "tarif", "Lihat tarif", k);
  const n = (kiri.match(/<button/g) || []).length;
  return `<div class="mr-m-li mr-m-sw ${sel ? "is-pilih" : ""} ${nonaktif ? "is-nonaktif" : ""}" data-mid="${id}" data-tipe="n" data-bisapilih="${S.kelola ? 1 : ""}" style="--aw:${n * WIDTH_AKSI_MR_}px;--awl:${WIDTH_AKSI_MR_}px">
    ${pilih ? "" : `<div class="mr-m-act">${kiri}</div>${aksiPilih("n", id)}`}
    <div class="mr-m-li__isi mr-m-sc" data-aksi="${pilih ? "m-pilih" : "m-aksi-lini"}" data-k="${id}" data-tipe="n" role="button" tabindex="0">
      ${pilih ? `<span class="mr-m-cek ${sel ? "is-on" : ""}" aria-hidden="true">${sel ? ikon("cek", 16) : ""}</span>` : `<span class="mr-m-li__ik">${ikon("lini", 20)}</span>`}
      <div class="mr-m-li__t"><b>${e(namaLini(l.id))}${nonaktif ? ' <span class="mr-tag mr-tag--mati">Nonaktif</span>' : ""}</b><small>${l.kategori === "request_based" ? "Berdasarkan permintaan" : l.kategori === "harga_tetap" ? "Harga tetap" : e(l.id)}</small><small>${angka(cacah[l.id] || 0)} tarif · ${angka((vend[l.id] || new Set()).size)} vendor</small>
        ${SK_TIPE[l.id] ? `<button type="button" class="mr-m-skc ${SK_TIPE[l.id].wajib && skTerisi(l).split("/")[0] !== skTerisi(l).split("/")[1] ? "is-wajib" : ""}" data-aksi="lini-sk" data-k="${id}">${ikon("file", 12)}${e(SK_TIPE[l.id].tombol)} ${skTerisi(l)}${SK_TIPE[l.id].wajib ? " · Wajib" : ""}</button>` : ""}</div>
      ${pilih ? "" : `<button type="button" class="mr-m-link" data-aksi="lihat-lini" data-k="${id}">${cacah[l.id] ? "Lihat" : "Buka"} ›</button>`}</div></div>`;
}
function htmlLiniHP() {
  const cacah = {}, vend = {}, pilih = pilihAktif();
  S.tarif.forEach((t) => { cacah[t.liniBisnisId] = (cacah[t.liniBisnisId] || 0) + 1; (vend[t.liniBisnisId] = vend[t.liniBisnisId] || new Set()).add(t.vendorId); });
  const q = MH.cariLini.trim().toLowerCase(), tampil = liniTampilHP();
  const grup = daftarKelompok().map((g) => ({ ...g, isi: g.isi.filter((l) => !q || `${namaLini(l.id)} ${l.id}`.toLowerCase().includes(q)) })).filter((g) => g.isi.length);
  return `<div class="mr-m-cari"><label class="mr-cari mr-m-cari__in">${ikon("cari", 16)}<input id="mr-l-cari" type="search" placeholder="Cari lini bisnis…" value="${e(MH.cariLini)}" autocomplete="off" enterkeyhint="search"></label></div>
    <div class="mr-m-meta"><span>${angka(tampil.length)} dari ${angka(S.lini.length)} lini bisnis</span><span class="mr-ruang"></span>${S.kelola && tampil.length ? `<button type="button" class="mr-m-link" data-aksi="m-pilih-mode">${ikon("cek", 15)}${pilih ? "Selesai memilih" : "Pilih"}</button>` : ""}</div>
    ${pilihBarHP(S.pilihLini.size, tampil.length, "lini")}
    ${grup.length ? grup.map((g) => `<div class="mr-m-gh3">${e(g.judul)}<em>${g.isi.length}</em></div><section class="mr-m-box">${g.isi.map((l) => barisLiniHP(l, cacah, vend, pilih)).join("")}</section>`).join("") : `<div class="mr-kosong">${ikon("cari", 28)}<p>Tidak ada lini bisnis yang cocok.</p></div>`}`;
}

function htmlHP(h, banners) {
  const pilih = pilihAktif();
  let isi;
  if (S.tab === "tarif") isi = htmlTarifHP(h);
  else if (S.tab === "vendor") isi = htmlVendorHP();
  else if (S.tab === "lini") isi = htmlLiniHP();
  else {
    const tampilLok = profilTampil(S, namaVendor).filter((p) => !p.lama);
    isi = pilihBarHP(S.pilihLok.size, tampilLok.length, "lokasi") + htmlTabProfilHP(S, namaVendor, { pilih });
  }
  return `<div class="mr-m">${banners.join("")}${atasHP(h)}${tabsHP()}<div id="mr-isi">${isi}</div></div>${fabHP()}`;
}

// ---------- sheet dari bawah ----------
function tutupSheetMR() { const d = $("#mr-sheet"); if (d) d.remove(); if (!$("#mr-layer.is-open")) document.body.classList.remove("mr-kunci-scroll"); }
function bukaSheetMR({ judul, sub = "", isi, kembali = "" }) {
  const sudahAda = !!$("#mr-sheet");
  tutupSheetMR();
  const d = document.createElement("div"); d.id = "mr-sheet"; d.className = "mr-sheet" + (sudahAda ? " is-buka" : "");
  d.innerHTML = `<div class="mr-sheet__scrim" data-aksi="m-tutup"></div><div class="mr-sheet__kotak" role="dialog" aria-modal="true" aria-label="${e(judul)}"><div class="mr-sheet__grip" aria-hidden="true"></div>
    <div class="mr-sheet__h">${kembali ? `<button type="button" class="mr-ikonbtn" data-aksi="${kembali}" aria-label="Kembali">${ikon("kembali", 18)}</button>` : ""}<div><b>${e(judul)}</b>${sub ? `<small>${e(sub)}</small>` : ""}</div><button type="button" class="mr-ikonbtn mr-sheet__x" data-aksi="m-tutup" aria-label="Tutup">${ikon("tutup", 18)}</button></div><div class="mr-sheet__isi">${isi}</div></div>`;
  document.body.appendChild(d); document.body.classList.add("mr-kunci-scroll");
  if (!sudahAda) requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("is-buka")));
}
const itemMR = (aksi, ik, judul, ket = "", attr = "", cls = "") => `<button type="button" class="mr-sheet__i ${cls}" data-aksi="${aksi}" ${attr}>${ikon(ik, 20)}<span><b>${judul}</b>${ket ? `<small>${ket}</small>` : ""}</span></button>`;
const pilMR = (aksi, v, label, aktif) => `<button type="button" class="mr-m-pil ${aktif ? "is-on" : ""}" data-aksi="${aksi}" data-v="${v}" aria-pressed="${aktif}">${label}</button>`;
const barisPilih = (aksi, v, judul, n, aktif) => `<button type="button" class="mr-sheet__p ${aktif ? "is-on" : ""}" data-aksi="${aksi}" data-v="${v}"><span>${judul}</span>${n === null ? "" : `<em>${angka(n)}</em>`}${aktif ? ikon("cek", 16) : ""}</button>`;

function sheetFilter() {
  MH.sheet = "filter";
  if (S.tab === "tarif") {
    const n = tarifTampil().length, linio = S.f.lini !== "semua";
    const lini = S.f.lini === "__belum__" ? "Belum diatur" : linio ? namaLini(S.f.lini) : "Semua lini bisnis", vend = S.f.vendor === "__belum__" ? "Belum ditentukan" : S.f.vendor !== "semua" ? namaVendor(S.f.vendor) : "Semua vendor";
    const view = S.view === "perbandingan" ? "kelompok" : S.view;
    bukaSheetMR({ judul: "Filter tarif", sub: `Menampilkan ${angka(n)} dari ${angka(S.tarif.length)} tarif`, isi: `
      <div class="mr-m-fs"><h4>Lini bisnis</h4><button type="button" class="mr-m-sel" data-aksi="m-pick" data-v="lini"><span>${e(lini)}</span>${ikon("maju", 16)}</button></div>
      <div class="mr-m-fs"><h4>Vendor</h4><button type="button" class="mr-m-sel" data-aksi="m-pick" data-v="vendor"><span>${e(vend)}</span>${ikon("maju", 16)}</button></div>
      <div class="mr-m-fs"><h4>Tampilan daftar</h4><div class="mr-m-seg">${[["kelompok", "Kelompok", "lini"], ["daftar", "Daftar", "file"]].map(([v, t, ic]) => `<button type="button" class="${view === v ? "is-on" : ""}" data-aksi="m-view" data-v="${v}">${ikon(ic, 16)}${t}</button>`).join("")}</div></div>
      <div class="mr-m-fs__aksi"><button type="button" class="mr-btn" data-aksi="m-freset">Hapus filter</button><button type="button" class="mr-btn mr-btn--utama" data-aksi="m-tutup">Tampilkan ${angka(n)} tarif</button></div>` });
  } else if (S.tab === "vendor") {
    const n = vendorTampil().length;
    bukaSheetMR({ judul: "Filter vendor", sub: `Menampilkan ${angka(n)} dari ${angka(S.vendor.length)} vendor`, isi: `
      <div class="mr-m-fs"><h4>Lini bisnis</h4><button type="button" class="mr-m-sel" data-aksi="m-pick" data-v="vlini"><span>${S.fv.lini === "semua" ? "Semua lini" : e(namaLini(S.fv.lini))}</span>${ikon("maju", 16)}</button></div>
      <div class="mr-m-fs__aksi"><button type="button" class="mr-btn" data-aksi="m-freset">Hapus filter</button><button type="button" class="mr-btn mr-btn--utama" data-aksi="m-tutup">Tampilkan ${angka(n)} vendor</button></div>` });
  } else if (S.tab === "lokasi") {
    const f = infoFilterProfil();
    bukaSheetMR({ judul: "Filter lokasi", sub: `Menampilkan ${angka(profilTampil(S, namaVendor).length)} dari ${angka(daftarProfil(S).length)} fasilitas`, isi: `
      <div class="mr-m-fs"><h4>Status</h4><div class="mr-m-pils">${[["semua", "Semua"], ["tersedia", "Tersedia"], ["draf", "Draf"], ["tidak_tersedia", "Tidak tersedia"]].map(([v, t]) => pilMR("m-lstatus", v, t, f.status === v)).join("")}</div></div>
      <div class="mr-m-fs"><h4>Tampilan</h4><div class="mr-m-seg">${[["kartu", "Kartu", "grid"], ["ringkas", "Ringkasan", "lini"]].map(([v, t, ic]) => `<button type="button" class="${(f.mode === "ringkas" ? "ringkas" : "kartu") === v ? "is-on" : ""}" data-aksi="m-lmode" data-v="${v}">${ikon(ic, 16)}${t}</button>`).join("")}</div></div>
      <div class="mr-m-fs__aksi"><button type="button" class="mr-btn" data-aksi="m-freset">Hapus filter</button><button type="button" class="mr-btn mr-btn--utama" data-aksi="m-tutup">Selesai</button></div>` });
  }
}
function sheetPick(jenis) {
  MH.sheet = "pick"; MH.pickUntuk = jenis;
  if (jenis === "lini") {
    const cacah = {}; S.tarif.forEach((t) => (cacah[t.liniBisnisId] = (cacah[t.liniBisnisId] || 0) + 1));
    bukaSheetMR({ judul: "Lini bisnis", kembali: "m-filter", isi: `${barisPilih("m-set-lini", "semua", "Semua lini bisnis", S.tarif.length, S.f.lini === "semua")}${cacah[""] ? barisPilih("m-set-lini", "__belum__", "Belum diatur", cacah[""], S.f.lini === "__belum__") : ""}
      ${daftarKelompok().filter((g) => g.isi.length).map((g) => `<h4 class="mr-m-sh">${e(g.judul)}</h4>${g.isi.map((l) => barisPilih("m-set-lini", l.id, e(namaLini(l.id)), cacah[l.id] || 0, S.f.lini === l.id)).join("")}`).join("")}` });
  } else if (jenis === "vendor") {
    const linio = S.f.lini !== "semua", tersedia = linio ? vendorUntukLini(S.vendor, S.tarif, S.f.lini) : S.vendor.filter((v) => v.aktif !== false && S.tarif.some((t) => t.vendorId === v.id));
    const tanpa = S.tarif.filter((t) => !t.vendorId).length;
    bukaSheetMR({ judul: "Vendor", kembali: "m-filter", isi: `${barisPilih("m-set-vendor", "semua", "Semua vendor", null, S.f.vendor === "semua")}${tanpa ? barisPilih("m-set-vendor", "__belum__", "Belum ditentukan", tanpa, S.f.vendor === "__belum__") : ""}${tersedia.map((v) => barisPilih("m-set-vendor", v.id, e(v.nama || v.id), S.tarif.filter((t) => t.vendorId === v.id).length, S.f.vendor === v.id)).join("")}` });
  } else {
    bukaSheetMR({ judul: "Lini bisnis", kembali: "m-filter", isi: `${barisPilih("m-set-vlini", "semua", "Semua lini", null, S.fv.lini === "semua")}${S.lini.map((l) => barisPilih("m-set-vlini", l.id, e(namaLini(l.id)), null, S.fv.lini === l.id)).join("")}` });
  }
}
function sheetMenu() {
  MH.sheet = "menu";
  const adaKerangka = !!KERANGKA[S.f.lini], nVf = S.kelola ? tarifPerluVerifikasi(S.tarif, S.vendor).length : 0;
  const vf = S.kelola ? itemMR("verifikasi", "tameng", "Verifikasi vendor", "Cek ulang tarif yang lama tidak dikonfirmasi", "", "") .replace("</span></button>", `</span>${nVf ? `<em class="mr-sheet__bdg">${angka(nVf)}</em>` : ""}</button>`) : "";
  if (S.tab === "vendor") return bukaSheetMR({ judul: "Menu vendor", isi: vf || '<p class="mr-m-sm">Tidak ada menu untuk akun ini.</p>' });
  bukaSheetMR({ judul: "Menu tarif", isi: `${vf}${itemMR("laporan", "download", "Laporan", "Perbandingan harga dan ringkasan, unduh PDF atau Excel")}
    ${S.kelola ? (adaKerangka ? itemMR("kerangka", "lini", "Kerangka tarif", "Buat daftar komponen standar untuk lini ini") : `<div class="mr-sheet__i is-off">${ikon("lini", 20)}<span><b>Kerangka tarif</b><small>Pilih satu lini bisnis dulu di Filter</small></span></div>`) + itemMR("import", "upload", "Import Excel", "Pratinjau dulu, disimpan setelah Anda konfirmasi") : ""}` });
}
function sheetAksiTarif(t) {
  const k = `data-k="${e(t.kunci)}"`;
  bukaSheetMR({ judul: t.layananNama || t.layanan, sub: `${namaVendor(t.vendorId)} · ${namaLini(t.liniBisnisId)}`, isi: `${S.kelola ? itemMR("edit", "edit", "Ubah tarif", "Nama, vendor, satuan, lokasi, modal, harga jual", k) : ""}${itemMR("riwayat", "riwayat", "Riwayat harga", "Perubahan modal dan data tarif", k)}
    ${S.kelola ? itemMR("m-duplikat", "salin", "Duplikat", "Salin tarif ini sebagai item baru", k) + itemMR("m-salin", "tukar", "Salin ke vendor lain", "Pakai harga ini sebagai dasar tarif vendor lain", k) + itemMR("m-tarif-aktif", t.aktif === false ? "cek" : "tutup", t.aktif === false ? "Aktifkan lagi" : "Nonaktifkan", t.aktif === false ? "Tarif tampil lagi di pencarian Quotation" : "Tarif tidak muncul di pencarian Quotation, tetap tersimpan", k) + itemMR("m-pilih-mulai", "cek", "Pilih beberapa", "Mulai memilih banyak tarif sekaligus", `${k} data-tipe="t"`) + itemMR("hapus", "tong", "Hapus permanen", "Tidak bisa dibatalkan", k, "is-bahaya") : ""}` });
}
function sheetAksiLini(l) {
  const k = `data-k="${e(l.id)}"`, n = S.tarif.filter((t) => t.liniBisnisId === l.id).length, nonaktif = l.aktif === false;
  bukaSheetMR({ judul: namaLini(l.id), sub: `${angka(n)} tarif${nonaktif ? " · Nonaktif" : ""}`, isi: `${itemMR("lihat-lini", "tarif", n ? `Lihat ${angka(n)} tarif` : "Buka lini", "Tampilkan tarif lini ini di tab Tarif", k)}${S.kelola ? itemMR("lini-edit", "edit", "Ubah lini bisnis", "Nama, kategori, kelompok, dan status", k) : ""}
    ${SK_TIPE[l.id] ? itemMR("lini-sk", "file", SK_TIPE[l.id].tombol, `${skTerisi(l)} terisi${SK_TIPE[l.id].wajib ? " · wajib untuk penawaran" : ""}`, k) : ""}
    ${S.kelola ? itemMR("m-aktif", nonaktif ? "cek" : "tutup", nonaktif ? "Aktifkan lagi" : "Nonaktifkan", nonaktif ? "Lini tampil kembali di pilihan Quotation" : "Disembunyikan dari pilihan baru, tarif tetap tersimpan", `${k} data-jenis="lini" data-v="${nonaktif ? 1 : 0}"`) + itemMR("m-pilih-mulai", "cek", "Pilih beberapa", "Mulai memilih banyak lini bisnis", `${k} data-tipe="n"`) : ""}
    ${S.master ? itemMR("m-hapus", "tong", "Hapus lini bisnis", n ? `Masih punya ${angka(n)} tarif · lihat pilihan` : "Tidak bisa dibatalkan", `${k} data-jenis="lini"`, "is-bahaya") : ""}` });
}
function sheetAksiVendor(v) {
  const k = `data-k="${e(v.id)}"`, n = S.tarif.filter((t) => t.vendorId === v.id).length, internal = v.id === VENDOR_INTERNAL, nonaktif = v.aktif === false;
  bukaSheetMR({ judul: namaVendor(v.id), sub: `${v.namaLengkap || "Nama lengkap belum diisi"}`, isi: `${itemMR("vendor-edit", S.kelola ? "edit" : "maju", S.kelola ? "Ubah vendor" : "Lihat detail vendor", "Data, PIC, legalitas, penawaran, dan termin", k)}${n ? itemMR("lihat-vendor", "tarif", `Lihat ${angka(n)} tarif`, "Tampilkan tarif vendor ini di tab Tarif", k) : ""}
    ${S.kelola && !internal ? itemMR("m-aktif", nonaktif ? "cek" : "tutup", nonaktif ? "Aktifkan lagi" : "Nonaktifkan", nonaktif ? "Vendor tampil lagi di pencarian Quotation" : "Tidak muncul di pencarian Quotation, tarif tetap tersimpan", `${k} data-jenis="vendor" data-v="${nonaktif ? 1 : 0}"`) : ""}${S.kelola ? itemMR("m-pilih-mulai", "cek", "Pilih beberapa", "Mulai memilih banyak vendor", `${k} data-tipe="v"`) : ""}
    ${S.master && !internal ? itemMR("m-hapus", "tong", "Hapus vendor", n ? `Masih punya ${angka(n)} tarif · lihat pilihan` : "Beserta data kontrak dan rekening. Tidak bisa dibatalkan", `${k} data-jenis="vendor"`, "is-bahaya") : ""}` });
}
function sheetAksiLok(p) {
  const k = `data-k="${e(p.id)}"`, tersedia = p.status === "tersedia";
  bukaSheetMR({ judul: p.nama, sub: p.kawasan || p.alamat || "Kawasan belum diisi", isi: `${itemMR("pf-detail", "foto", "Lihat profil", "Foto, spesifikasi, fasilitas, dan PIC", k)}${S.kelola ? itemMR("lokasi-edit", "edit", "Ubah lokasi", "Data profil lokasi", k) : ""}
    ${S.kelola && !p.lama ? itemMR("m-lstat", tersedia ? "tutup" : "cek", tersedia ? "Tandai tidak tersedia" : "Tandai tersedia", tersedia ? "Lokasi ditandai Tidak tersedia, profil tetap tersimpan" : "Perlu kawasan, luas, foto, dan PIC", `${k} data-v="${tersedia ? "tidak_tersedia" : "tersedia"}"`) + itemMR("m-pilih-mulai", "cek", "Pilih beberapa", "Mulai memilih banyak lokasi", `${k} data-tipe="l"`) : ""}
    ${S.master ? itemMR("m-hapus", "tong", "Hapus lokasi", "Tarif Master Rate tidak ikut terhapus. Tidak bisa dibatalkan", `${k} data-jenis="lokasi"`, "is-bahaya") : ""}` });
}

// ---------- ubah status dan hapus dari daftar HP ----------
const tarifDari = (jenis, id) => S.tarif.filter((t) => (jenis === "lini" ? t.liniBisnisId === id : t.vendorId === id));
async function ubahAktif(jenis, id, aktif) {
  if (!S.kelola) return;
  const nama = jenis === "lini" ? namaLini(id) : namaVendor(id);
  if (!aktif && !(await konfirmasi(`Nonaktifkan ${jenis === "lini" ? "lini bisnis" : "vendor"} ${nama}?`, jenis === "lini" ? "Lini yang nonaktif tidak muncul di pilihan baru. Tarif dan riwayatnya tetap tersimpan." : "Vendor yang nonaktif tidak muncul di pencarian Quotation. Tarifnya tetap tersimpan.", "Nonaktifkan"))) return;
  try {
    if (jenis === "lini") { const l = S.lini.find((x) => x.id === id); if (l) Object.assign(l, await DB.simpanLini(id, { aktif }, { baru: false, oleh: S.user.email })); }
    else { const v = S.vendor.find((x) => x.id === id); if (v) Object.assign(v, await DB.simpanVendor(id, { aktif }, { baru: false, oleh: S.user.email })); }
    render();
    toast(`<b>${e(nama)} ${aktif ? "diaktifkan lagi" : "dinonaktifkan"}.</b>`, "ok");
  } catch (err) { toast(`<b>GAGAL menyimpan.</b><br>${e(err.message)}`, "bahaya"); }
}
async function ubahAktifTarif(kunci) {
  const row = peta().get(kunci); if (!row || !S.kelola) return;
  const lama = row.aktif !== false;
  if (await simpanPerubahan(row, [{ field: "aktif", lama, baru: !lama }], "manual")) render();
}
async function hapusVendorKosong(id) {
  const v = S.vendor.find((x) => x.id === id); if (!v || !S.master || id === VENDOR_INTERNAL) return;
  if (!(await konfirmasiKetik("Hapus vendor permanen?", `Vendor <b>${e(v.nama || id)}</b> akan dihapus beserta data kontrak dan rekeningnya. File yang pernah diunggah tidak ikut terhapus dari penyimpanan. Tidak bisa dibatalkan.`, "HAPUS"))) return;
  try {
    await DB.hapusDokumen("vendor", id);
    try { await DB.hapusDokumen("vendor_rahasia", id); } catch (err) { /* dokumen rahasia mungkin belum ada */ }
    S.vendor = S.vendor.filter((x) => x.id !== id); render();
    toast(`<b>Vendor dihapus.</b> ${e(v.nama || id)}`, "ok");
  } catch (err) { toast(`<b>GAGAL menghapus vendor.</b><br>${e(err.message)}`, "bahaya"); }
}
function mulaiHapus(jenis, id) {
  if (!S.master) return;
  tutupSheetMR();
  if (jenis === "lokasi") return hapusProfilLangsung({ S, DB, id, render });
  if (jenis === "vendor" && id === VENDOR_INTERNAL) return toast("Vendor Internal tidak bisa dihapus.", "peringatan");
  if (tarifDari(jenis, id).length) return sheetHapusDipakai(jenis, id);
  return jenis === "lini" ? hapusLiniDariKartu(id) : hapusVendorKosong(id);
}
function sheetHapusDipakai(jenis, id) {
  const lini = jenis === "lini", daftar = tarifDari(jenis, id), n = daftar.length, nama = lini ? namaLini(id) : namaVendor(id);
  const sudahNon = lini ? (S.lini.find((l) => l.id === id) || {}).aktif === false : (S.vendor.find((v) => v.id === id) || {}).aktif === false;
  const lain = lini ? new Set(daftar.map((t) => t.vendorId)).size : new Set(daftar.map((t) => t.liniBisnisId)).size, k = `data-k="${e(id)}" data-jenis="${jenis}"`;
  const opsi = (cls, ik, judul, ket, aksi, attr) => `<button type="button" class="mr-m-opt ${cls}" ${aksi ? `data-aksi="${aksi}"` : "disabled"} ${attr}><span class="mr-m-opt__ik">${ikon(ik, 20)}</span><span><b>${judul}</b><small>${ket}</small></span></button>`;
  bukaSheetMR({ judul: `Hapus ${lini ? "lini" : "vendor"} "${nama}"?`, sub: "Pilih cara yang Anda mau", isi: `
    <div class="mr-m-warnbox">${ikon("peringatan", 18)}<span>${lini ? "Lini" : "Vendor"} ini masih punya <b>${angka(n)} tarif</b> dari ${angka(lain)} ${lini ? "vendor" : "lini bisnis"}. Tarifnya perlu ikut ditangani supaya tidak tertinggal.</span></div>
    ${opsi("is-rek", "tutup", sudahNon ? "Sudah nonaktif" : "Nonaktifkan saja", sudahNon ? "Sudah disembunyikan dari pilihan baru. Semua tarif dan riwayat tetap tersimpan." : `${lini ? "Lini" : "Vendor"} disembunyikan dari pilihan baru. Semua tarif dan riwayat tetap tersimpan, bisa diaktifkan lagi.`, sudahNon ? "" : "m-nonaktif-satu", k)}
    ${opsi("", "tarif", `Lihat ${angka(n)} tarifnya dulu`, "Buka di tab Tarif, lalu hapus tarifnya satu per satu atau massal.", lini ? "lihat-lini" : "lihat-vendor", `data-k="${e(id)}"`)}
    ${opsi("is-bahaya", "tong", `Hapus ${lini ? "lini" : "vendor"} beserta ${angka(n)} tarifnya`, "Hanya akun master. Perlu mengetik konfirmasi. Tidak bisa dibatalkan.", "m-hapus-ikut", k)}` });
}
async function hapusBesertaTarif(jenis, id) {
  if (!S.master) return;
  const lini = jenis === "lini", daftar = tarifDari(jenis, id), n = daftar.length, nama = lini ? namaLini(id) : namaVendor(id);
  if (!lini && id === VENDOR_INTERNAL) return;
  const ok = await konfirmasiKetik(`Hapus ${lini ? "lini" : "vendor"} + ${angka(n)} tarif permanen?`,
    `<p>Yang akan dihapus:</p><ul class="mr-konfirm__daftar"><li>${lini ? "Lini bisnis" : "Vendor"} <b>${e(nama)}</b></li><li><b>${angka(n)} tarif</b></li></ul><p>Riwayat harga tarif tetap tersimpan. Isi quotation yang sudah dibuat tidak berubah, hanya penautan ke tarif asalnya yang hilang.${lini ? "" : " Data kontrak dan rekening vendor ikut terhapus."} <b>Tidak bisa dibatalkan.</b></p>`, `HAPUS ${n}`);
  if (!ok) return;
  toast(`Menghapus ${angka(n)} tarif…`, "ok");
  try {
    const h = await DB.hapusBanyak(daftar.map((t) => t.kunci), { oleh: S.user.email });
    const hilang = new Set(h.berhasil); S.tarif = S.tarif.filter((t) => !hilang.has(t.kunci)); h.berhasil.forEach((x) => S.pilih.delete(x));
    if (h.gagal.length) { render(); return toast(`<b>${angka(h.berhasil.length)} tarif terhapus, ${angka(h.gagal.length)} GAGAL.</b> ${lini ? "Lini" : "Vendor"} tidak dihapus.<br>${e(h.gagal[0].alasan)}`, "bahaya"); }
    if (lini) { await DB.hapusDokumen("lini_bisnis", id); S.lini = S.lini.filter((x) => x.id !== id); }
    else { await DB.hapusDokumen("vendor", id); try { await DB.hapusDokumen("vendor_rahasia", id); } catch (err) { /* dokumen rahasia mungkin belum ada */ } S.vendor = S.vendor.filter((x) => x.id !== id); }
    render();
    toast(`<b>${lini ? "Lini bisnis" : "Vendor"} ${e(nama)} dihapus beserta ${angka(n)} tarifnya.</b>`, "ok");
  } catch (err) { render(); toast(`<b>GAGAL menghapus.</b><br>${e(err.message)}`, "bahaya"); }
}
function sheetUbahCepat(kunci, nilaiAwal) {
  const row = peta().get(kunci); if (!row || !S.kelola) return;
  bukaSheetMR({ judul: "Ubah modal", sub: `${row.layananNama || row.layanan} · ${namaVendor(row.vendorId)}`, isi: `
    <div class="mr-m-fs"><h4>Modal baru (Rupiah)</h4><div class="mr-m-inp"><span>Rp</span><input id="mr-uc-in" inputmode="decimal" value="${e(formatInputAngka(nilaiAwal ?? row.modal ?? ""))}" placeholder="angka" aria-label="Modal baru" autocomplete="off"></div>
      <p class="mr-m-sm">Sekarang: <b>${kosongModal(row) ? "Belum diisi" : e(formatRp(row.modal, row.mataUang || "IDR"))}</b>. Isi 0 bila gratis. Untuk mengosongkan modal atau mengubah data lain, pakai Ubah tarif.</p></div>
    <div class="mr-m-fs__aksi"><button type="button" class="mr-btn" data-aksi="m-tutup">Batal</button><button type="button" class="mr-btn mr-btn--utama" id="mr-uc-ok">${ikon("cek", 16)}Simpan</button></div>` });
  const input = $("#mr-uc-in"), tombol = $("#mr-uc-ok"); if (!input || !tombol) return;
  pasangRibuan(input);
  let sedang = false;
  const simpan = async () => {
    if (sedang) return;
    const p = parseAngka(input.value);
    if (!p.ok || p.val === undefined) { toast("Isi dengan angka (0 = gratis). Untuk mengosongkan modal, pakai Ubah tarif.", "bahaya"); input.focus(); return; }
    sedang = true; tombol.disabled = true;
    const lama = row.modal === undefined ? null : row.modal, diketik = input.value;
    const ok = await simpanPerubahan(row, p.val === lama ? [] : [{ field: "modal", lama, baru: p.val }], "manual");
    if (ok) { tutupSheetMR(); render(); } else { sedang = false; tombol.disabled = false; sheetUbahCepat(kunci, diketik); }
  };
  tombol.onclick = simpan;
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); simpan(); } });
  setTimeout(() => { input.focus(); input.select(); }, 280);
}
const sheetKonteks = () => { if (MH.sheet === "filter") sheetFilter(); else if (MH.sheet === "pick") sheetPick(MH.pickUntuk); };

function pasangEventHP() {
  document.addEventListener("click", (ev) => {
    if (window.__rute !== "master-rate") return;
    const b = ev.target.closest("[data-aksi]"); if (!b) return;
    const a = b.dataset.aksi, d = b.dataset;
    if (a.indexOf("m-") === 0) {
      const ulang = () => { render(); sheetKonteks(); };
      if (a === "m-tutup") tutupSheetMR();
      else if (a === "m-noop") return;
      else if (a === "m-ringkas") { MH.ringkas = !MH.ringkas; render(); }
      else if (a === "m-qf") { const on = !S.f[d.v]; S.f = { ...S.f, [d.v]: on }; if (on && d.v !== "kosong") S.view = "daftar"; ganti(); render(); }
      else if (a === "m-vstatus") { S.fv.status = d.v; render(); }
      else if (a === "m-batal") { S.pilih.clear(); S.pilihV.clear(); S.pilihLok.clear(); S.pilihLini.clear(); MH.pilih = false; render(); }
      else if (a === "m-pilih-mode") { const aktif = pilihAktif(); if (aktif) { pilihTabAktif().clear(); MH.pilih = false; } else { MH.pilih = true; MH.pilihTab = S.tab; } render(); }
      else if (a === "m-pilih") { const set = d.tipe === "v" ? S.pilihV : d.tipe === "l" ? S.pilihLok : d.tipe === "n" ? S.pilihLini : S.pilih; if (set.has(d.k)) set.delete(d.k); else set.add(d.k); render(); }
      else if (a === "m-pilih-mulai") { const tp = d.tipe || "t"; MH.pilih = true; MH.pilihTab = { t: "tarif", v: "vendor", l: "lokasi", n: "lini" }[tp]; (tp === "v" ? S.pilihV : tp === "l" ? S.pilihLok : tp === "n" ? S.pilihLini : S.pilih).add(d.k); tutupSheetMR(); render(); }
      else if (a === "m-aksi-vendor") { const v = S.vendor.find((x) => x.id === d.k); if (v) sheetAksiVendor(v); }
      else if (a === "m-aksi-lok") { const p = daftarProfil(S).find((x) => x.id === d.k); if (p) sheetAksiLok(p); }
      else if (a === "m-aktif") { tutupSheetMR(); ubahAktif(d.jenis, d.k, d.v === "1"); }
      else if (a === "m-tarif-aktif") { tutupSheetMR(); ubahAktifTarif(d.k); }
      else if (a === "m-lstat") { tutupSheetMR(); ubahStatusProfil({ S, DB, id: d.k, status: d.v, render }); }
      else if (a === "m-hapus") mulaiHapus(d.jenis, d.k);
      else if (a === "m-nonaktif-satu") { tutupSheetMR(); ubahAktif(d.jenis, d.k, false); }
      else if (a === "m-hapus-ikut") { tutupSheetMR(); hapusBesertaTarif(d.jenis, d.k); }
      else if (a === "m-aksi") { const t = peta().get(d.k); if (t) sheetAksiTarif(t); }
      else if (a === "m-aksi-lini") { const l = S.lini.find((x) => x.id === d.k); if (l) sheetAksiLini(l); }
      else if (a === "m-duplikat") { tutupSheetMR(); S.kelola && duplikatTarif([d.k]); }
      else if (a === "m-salin") { tutupSheetMR(); S.kelola && bukaSalinVendor([d.k]); }
      else if (a === "m-filter") sheetFilter();
      else if (a === "m-menu") sheetMenu();
      else if (a === "m-pick") sheetPick(d.v);
      else if (a === "m-set-lini") { S.f.lini = d.v; S.f.vendor = "semua"; ganti(); render(); sheetFilter(); }
      else if (a === "m-set-vendor") { S.f.vendor = d.v; ganti(); render(); sheetFilter(); }
      else if (a === "m-set-vlini") { S.fv.lini = d.v; render(); sheetFilter(); }
      else if (a === "m-view") { S.view = d.v; S.hal = 1; ulang(); }
      else if (a === "m-lstatus") { filterProfil("status", d.v); ulang(); }
      else if (a === "m-lmode") { filterProfil("mode", d.v); ulang(); }
      else if (a === "m-freset") {
        if (S.tab === "tarif") { S.f = { lini: "semua", vendor: "semua", cari: "", kosong: false }; ganti(); }
        else if (S.tab === "vendor") S.fv = { cari: "", status: "semua", lini: "semua" };
        else if (S.tab === "lokasi") { filterProfil("status", "semua"); filterProfil("jenis", "semua"); filterProfil("q", ""); }
        ulang();
      }
      return;
    }
    if (b.closest(".mr-sheet")) setTimeout(tutupSheetMR, 0); // aksi lain di sheet menutup sheet
  });
  document.addEventListener("keydown", (ev) => { if (window.__rute === "master-rate" && ev.key === "Escape" && $("#mr-sheet")) tutupSheetMR(); });
  document.addEventListener("input", (ev) => {
    if (window.__rute !== "master-rate" || ev.target.id !== "mr-l-cari") return;
    MH.cariLini = ev.target.value; clearTimeout(pasangEventHP._t); pasangEventHP._t = setTimeout(() => render(), 150);
  });
  if (mqHP.addEventListener) mqHP.addEventListener("change", () => { tutupSheetMR(); if (window.__rute === "master-rate") render(); });

  // semua list: geser kiri = aksi (ubah, nonaktifkan, hapus ...), geser kanan = Pilih, tekan-tahan = mulai pilih banyak (akun yang boleh mengelola)
  const tutupGeser = (kecuali) => $$(".mr-m-sw.is-geser, .mr-m-sw.is-geserR").forEach((x) => { if (x !== kecuali) x.classList.remove("is-geser", "is-geserR"); });
  const terbuka = (r) => r.classList.contains("is-geser") || r.classList.contains("is-geserR");
  document.addEventListener("click", (ev) => {
    if (window.__rute !== "master-rate") return;
    const r = ev.target.closest(".mr-m-sw"), diAksi = ev.target.closest(".mr-m-act, .mr-m-actL");
    if (r && !diAksi && Date.now() < MH.tahanSampai && (MH.tahanId === "*" || r.dataset.mid === MH.tahanId)) { ev.stopPropagation(); ev.preventDefault(); return; }
    if (r && !diAksi && terbuka(r)) { tutupGeser(); ev.stopPropagation(); ev.preventDefault(); return; }
    if (!r) tutupGeser();
  }, true);
  let x0 = 0, y0 = 0, el = null, isi = null, dx = 0, arah = "", timer = null, mulaiGeser = 0;
  const lebar = (r, sel) => { const a = r.querySelector(sel); return a ? a.offsetWidth : 0; };
  const batalTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
  document.addEventListener("touchstart", (ev) => {
    if (window.__rute !== "master-rate") return;
    const i = ev.target.closest && ev.target.closest(".mr-m-sc");
    if (!i || ev.touches.length !== 1) { el = null; return; }
    el = i.closest(".mr-m-sw"); isi = i; const t = ev.touches[0]; x0 = t.clientX; y0 = t.clientY; dx = 0; arah = "";
    const wR = lebar(el, ".mr-m-act"), wL = lebar(el, ".mr-m-actL");
    mulaiGeser = el.classList.contains("is-geser") ? -wR : el.classList.contains("is-geserR") ? wL : 0;
    const awalBuka = terbuka(el); tutupGeser(el); el.classList.remove("is-intip"); batalTimer(); MH.pending = "";
    if (S.kelola && el.dataset.bisapilih && !pilihAktif() && !awalBuka) { const r = el, id = r.dataset.mid, tipe = r.dataset.tipe; timer = setTimeout(() => { timer = null; MH.pending = tipe + ":" + id; r.classList.add("is-tahan"); try { navigator.vibrate && navigator.vibrate(15); } catch { /* abaikan */ } }, 520); }
  }, { passive: true });
  document.addEventListener("touchmove", (ev) => {
    if (!el) return; const t = ev.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) batalTimer();
    if (MH.pending && (Math.abs(mx) > 14 || Math.abs(my) > 14)) { MH.pending = ""; el.classList.remove("is-tahan"); }
    if (!arah) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; arah = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y"; }
    if (arah !== "x" || pilihAktif()) return;
    const wR = lebar(el, ".mr-m-act"), wL = lebar(el, ".mr-m-actL"); if (!wR && !wL) return;
    dx = Math.max(wR ? -wR - 20 : 0, Math.min(wL ? wL + 20 : 0, mulaiGeser + mx)); isi.style.transition = "none"; isi.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  const akhir = (batal) => {
    batalTimer();
    if (MH.pending) { const [tipe, id] = MH.pending.split(":"); MH.pending = ""; el = null; isi = null; (tipe === "v" ? S.pilihV : tipe === "l" ? S.pilihLok : tipe === "n" ? S.pilihLini : S.pilih).add(id); MH.pilih = true; MH.pilihTab = S.tab; MH.tahanId = "*"; MH.tahanSampai = Date.now() + 700; render(); return; }
    if (!el) return;
    if (arah === "x") {
      MH.tahanId = el.dataset.mid; MH.tahanSampai = Date.now() + 350;
      const wR = lebar(el, ".mr-m-act"), wL = lebar(el, ".mr-m-actL"); isi.style.transition = ""; isi.style.transform = "";
      el.classList.toggle("is-geser", !batal && wR > 0 && dx < -wR * 0.4); el.classList.toggle("is-geserR", !batal && wL > 0 && dx > wL * 0.4);
    }
    el = null; isi = null;
  };
  document.addEventListener("touchend", () => akhir(false), { passive: true });
  document.addEventListener("touchcancel", () => akhir(true), { passive: true });
  document.addEventListener("contextmenu", (ev) => { if (window.__rute === "master-rate" && ev.target.closest && ev.target.closest(".mr-m-sw")) ev.preventDefault(); });
}

// ---------- mulai ----------
/* Penyegaran dari server ditunda sampai browser idle, supaya layar yang sudah tampil dari salinan tetap lancar digulir.
   Simpan tetap diblokir sampai data terbaru tiba (lihat __islSegar). */
const setelahIdle = (fn) => new Promise((ok) => { if ("requestIdleCallback" in window) requestIdleCallback(() => ok(fn()), { timeout: 3000 }); else setTimeout(() => ok(fn()), 1200); });
async function muatData() {
  S.muat = "memuat";
  render();
  const kunci = "mr:" + (S.user && S.user.uid ? S.user.uid : "") + ":" + (S.kelola ? "m" : "l");
  DB.muatPolaSk().then((p) => { window.__islSkPola = p; }).catch(() => {});
  const ambilServer = async () => {
    const d = await DB.muatSemua();
    let ref;
    try { ref = { zona: [], lokasiDistribusi: [], depo: [], warehouse: [], openYard: [], profil: [], ...(await DB.muatReferensi()), gagal: false }; }
    catch (err) { ref = { zona: [], lokasiDistribusi: [], depo: [], warehouse: [], openYard: [], profil: [], gagal: true }; }
    return { d, ref };
  };
  const pasang = ({ d, ref }) => {
    S.tarif = d.tarif.map((t) => ({ ...t, kunci: t.kunci || t.id }));
    S.vendor = d.vendor;
    // vendor internal dibuat sekali (otomatis) bila belum ada
    if (S.kelola && !S.vendor.some((v) => v.id === VENDOR_INTERNAL)) {
      const data = { nama: "Internal", namaLengkap: "Internal perusahaan", liniBisnis: [], terminBayar: "", kontak: "", aktif: true, catatan: "Tarif yang disediakan perusahaan sendiri (kendaraan, gudang, biaya internal)." };
      DB.simpanVendor(VENDOR_INTERNAL, data, { baru: true, oleh: S.user.email }).then(() => { S.vendor.push({ id: VENDOR_INTERNAL, ...data }); render(); }).catch(() => {});
    }
    S.lini = d.lini;
    S.satuan = d.satuan;
    S.lini.sort(urutLini);
    S.ref = ref;
    S.muat = "siap";
  };
  try {
    const salinan = await ambilSalinan(kunci);
    if (salinan) {
      // Tampil dari salinan dulu. Simpan diblokir sampai data terbaru dari server tiba.
      pasang(salinan); window.__islSegar = false; render();
      bannerSinkron("Menampilkan data tersimpan. Memperbarui dari server…", "info");
      setelahIdle(ambilServer).then((f) => {
        pasang(f); window.__islSegar = true; simpanSalinan(kunci, f); render();
        bannerSinkron("Data terbaru dimuat", "ok");
        setTimeout(() => { const el = document.getElementById("sinkron-banner"); if (el) el.hidden = true; }, 2500);
      }).catch((err) => {
        console.error("Gagal memperbarui data dari server:", err);
        bannerSinkron("Gagal memperbarui dari server. Simpan diblokir sampai muat ulang halaman.", "gagal");
      });
    } else {
      const f = await ambilServer(); pasang(f); simpanSalinan(kunci, f);
    }
  } catch (err) {
    S.muat = "gagal";
    S.pesanGagal = err.message;
  }
  render();
  if (S.muat === "siap" && window.__skBuka && SK_TIPE[window.__skBuka]) { const tipe = window.__skBuka; window.__skBuka = null; bukaSkTipe(tipe); }
  // pemberitahuan dari halaman lain: buka tarif yang bermasalah setelah data siap
  if (S.muat === "siap") { const tujuan = ambilTujuan(); if (tujuan && tujuan.jenis === "tarif") setTimeout(() => window.__islBukaMR(tujuan), 0); }
}

let mulai = false;
/* Dipanggil router (app.html#master-rate) setiap kali halaman ini dibuka. Data dimuat sekali; kunjungan berikutnya hanya menggambar ulang. */
export function mulaiMR(user, profil) {
  if (profil && profil.peran === "sales") { location.hash = "#quotation"; return; }
  try { const tujuan = localStorage.getItem("islhub-sk-buka"); if (tujuan) { window.__skBuka = tujuan; localStorage.removeItem("islhub-sk-buka"); } } catch (e) { /* abaikan */ }
  S.user = user;
  if (window.__islMR && window.__islMR.satuan) S.satuan = window.__islMR.satuan; // satuan dikelola di Quotation: pakai daftar yang sama
  S.master = adalahMaster(user.email);
  S.kelola = S.master || adalahKelola(profil);
  window.__ISL_KELOLA = S.kelola;
  renderNav("master-rate"); // menu menyesuaikan peran setelah profil diketahui
  const el = $("#user-email");
  if (el) el.textContent = labelAkun(user.email, user.displayName);
  if (!mulai) {
    mulai = true;
    muatData();
  } else render();
}
// Dari pemberitahuan: buka tarif yang bermasalah (master: form edit; lihat saja: filter ke tarifnya).
window.__islBukaMR = (t) => {
  if (t.verifikasi) { S.tab = "tarif"; render(); if (S.kelola) bukaVerifikasi(t.verifikasi); return; }
  const tr = S.tarif.find((x) => x.kunci === t.kunci);
  if (!tr) return;
  S.tab = "tarif"; S.f = { lini: tr.liniBisnisId, vendor: tr.vendorId, cari: "", kosong: false };
  S.liniBuka = !window.matchMedia("(max-width: 760px)").matches; render();
  if (S.kelola) setTimeout(() => bukaEdit(tr.kunci), 50);
};
renderNav("master-rate");
if (window.ISLCadangan) window.ISLCadangan.daftarSumber("master", () => (S.muat === "siap" ? { master_tarif: S.tarif, vendor: S.vendor, lini_bisnis: S.lini, satuan_baku: S.satuan } : null));
NAV.pasang({ lapisan: () => ($("#mr-layer.is-open") ? 1 : 0), tutup: () => { tutupLayer(); return true; } });
pasangEvent();
pasangEventHP();

