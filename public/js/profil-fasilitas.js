// ===========================================================
// PROFIL FASILITAS — direktori tab "Lokasi" di Master Rate.
// Satu direktori untuk Depo Container, Open Yard, Gudang Dry, Chiller,
// Cold Room, dan Frozen. Isinya profil: galeri, ukuran lahan dan bangunan,
// spesifikasi teknis per jenis, fasilitas, PIC, tautan Google Maps, lampiran.
// Aturan privasi: data lokasi (alamat, peta, PIC, pemilik) HANYA internal.
// Kartu profil siap kirim ke customer otomatis menyamarkan semuanya.
// Harga tetap hanya ada di tab Tarif (tidak ada dua sumber harga).
// ===========================================================
import { e, $, $$, toast, bukaLayer, tutupLayer, konfirmasiKetik, angka } from "./ui.js";
import { ikon } from "./ikon.js";
import { slug } from "./kunci.js";
import { parseKoordinat } from "./lokasi-util.js";
import { perkecilGambar } from "./gambar.js";

export const JENIS = [
  { id: "depo", nama: "Depo Container", warna: "#1e6fa8", grup: "depo" },
  { id: "open_yard", nama: "Open Yard", warna: "#b7791f", grup: "open_yard" },
  { id: "gudang_dry", nama: "Gudang Dry", warna: "#2f855a", grup: "gudang_dry" },
  { id: "chiller", nama: "Gudang Chiller", warna: "#2b9bb8", grup: "pendingin" },
  { id: "cold_room", nama: "Cold Room", warna: "#5a67d8", grup: "pendingin" },
  { id: "frozen", nama: "Gudang Frozen", warna: "#6b46c1", grup: "pendingin" },
];
const jenisDari = (id) => JENIS.find((j) => j.id === id) || JENIS[0];

// Spesifikasi teknis menurut kelompok jenis. tipe: "angka" atau "teks"
const SPEK = {
  depo: [
    { k: "kapasitasTeus", t: "Kapasitas tumpuk", u: "TEUs", tipe: "angka" },
    { k: "tinggiTumpuk", t: "Tinggi tumpukan", u: "tier", tipe: "angka" },
    { k: "jumlahGate", t: "Jumlah gate / lane", u: "", tipe: "angka" },
    { k: "alatAngkat", t: "Alat angkat", u: "", tipe: "teks", ph: "Mis. Reach stacker 2 unit, forklift 5 ton" },
    { k: "reeferPlug", t: "Titik colokan reefer", u: "titik", tipe: "angka" },
    { k: "timbangan", t: "Jembatan timbang", u: "", tipe: "teks", ph: "Mis. Ada, kapasitas 60 ton" },
    { k: "areaRepair", t: "Area repair / cuci", u: "", tipe: "teks", ph: "Mis. Ada, repair dan washing" },
  ],
  open_yard: [
    { k: "kapasitasTeus", t: "Kapasitas tumpuk", u: "TEUs", tipe: "angka" },
    { k: "tinggiTumpuk", t: "Tinggi tumpukan", u: "tier", tipe: "angka" },
    { k: "dayaDukung", t: "Daya dukung tanah", u: "ton/m²", tipe: "angka" },
    { k: "lebarJalan", t: "Lebar jalan masuk", u: "m", tipe: "angka" },
    { k: "akses40ft", t: "Akses trailer 40ft", u: "", tipe: "teks", ph: "Mis. Bisa, putar balik leluasa" },
    { k: "drainase", t: "Drainase", u: "", tipe: "teks", ph: "Mis. Saluran keliling, tidak banjir" },
    { k: "penerangan", t: "Penerangan malam", u: "", tipe: "teks", ph: "Mis. Lampu sorot tiap 30 m" },
  ],
  gudang_dry: [
    { k: "tinggiBangunan", t: "Tinggi bangunan", u: "m", tipe: "angka" },
    { k: "bebanLantai", t: "Beban lantai", u: "ton/m²", tipe: "angka" },
    { k: "jumlahDock", t: "Jumlah dock door", u: "", tipe: "angka" },
    { k: "kapasitasPalet", t: "Kapasitas palet", u: "palet", tipe: "angka" },
    { k: "rak", t: "Sistem rak", u: "", tipe: "teks", ph: "Mis. Selective rack 5 level" },
    { k: "dayaListrik", t: "Daya listrik", u: "kVA", tipe: "angka" },
    { k: "proteksiApi", t: "Proteksi kebakaran", u: "", tipe: "teks", ph: "Mis. Sprinkler, hydrant, APAR" },
    { k: "sistemWms", t: "Sistem WMS", u: "", tipe: "teks", ph: "Mis. WMS mitra, laporan stok harian" },
  ],
  pendingin: [
    { k: "suhuMin", t: "Suhu terendah", u: "°C", tipe: "angka" },
    { k: "suhuMax", t: "Suhu tertinggi", u: "°C", tipe: "angka" },
    { k: "kapasitasPalet", t: "Kapasitas palet", u: "palet", tipe: "angka" },
    { k: "jumlahRuang", t: "Jumlah ruang pendingin", u: "", tipe: "angka" },
    { k: "tinggiBangunan", t: "Tinggi ruang", u: "m", tipe: "angka" },
    { k: "jumlahDock", t: "Jumlah dock door", u: "", tipe: "angka" },
    { k: "dayaListrik", t: "Daya listrik", u: "kVA", tipe: "angka" },
    { k: "genset", t: "Genset cadangan", u: "", tipe: "teks", ph: "Mis. Ada, otomatis (ATS)" },
    { k: "monitoringSuhu", t: "Monitoring suhu", u: "", tipe: "teks", ph: "Mis. Data logger 24 jam, alarm SMS" },
  ],
};
const spekDari = (jenis) => SPEK[jenisDari(jenis).grup] || [];

export const FASILITAS = [
  ["office", "Office"], ["toilet", "Toilet"], ["listrik", "Listrik"], ["sumberAir", "Sumber air"], ["pagar", "Pagar keliling"],
  ["cctv", "CCTV"], ["security", "Security 24 jam"], ["parkirTruk", "Parkir truk"], ["ruangDriver", "Ruang driver"], ["musholla", "Musholla"],
  ["penerangan", "Penerangan area"], ["genset", "Genset"], ["apar", "APAR / hydrant"], ["dockLeveler", "Dock leveler"], ["jembatanTimbang", "Jembatan timbang"], ["wifi", "Wi-Fi"],
];
const PERMUKAAN = [["", "-"], ["beton", "Beton"], ["paving_block", "Paving block"], ["aspal", "Aspal"], ["tanah_merah", "Tanah merah"], ["epoxy", "Epoxy"], ["lainnya", "Lainnya"]];
const STATUS = [["draf", "Draf"], ["tersedia", "Tersedia"], ["tidak_tersedia", "Tidak tersedia"]];
const KAT_FOTO = [["eksterior", "Eksterior"], ["interior", "Interior"], ["layout", "Layout / denah"], ["citra", "Citra satelit"], ["lainnya", "Lainnya"]];
const KAT_LAMP = [["layout", "Layout / denah"], ["izin", "Izin / legalitas"], ["sertifikat", "Sertifikat"], ["lainnya", "Lainnya"]];
const labelDari = (daftar, v) => (daftar.find(([k]) => k === v) || [v, v || "-"])[1];

// ---------- data: profil asli + lokasi Open Yard lama yang belum punya profil ----------
const fotoLama = (l) => (Array.isArray(l.fotos) && l.fotos.length ? l.fotos : (l.fotoUrls || []).filter((u) => /^https?:|^blob:|^data:/.test(String(u))).map((url) => ({ url })));
export function daftarProfil(S) {
  const asli = (S.ref.profil || []).map((p) => ({ ...p, fotos: Array.isArray(p.fotos) ? p.fotos : [], lampiran: Array.isArray(p.lampiran) ? p.lampiran : [] }));
  const terpakai = new Set(asli.map((p) => p.lokasiRefId).filter(Boolean));
  const lama = (S.ref.openYard || [])
    .filter((l) => !terpakai.has(l.id))
    .map((l) => ({
      id: `lama:${l.id}`, lama: true, lokasiRefId: l.id, jenis: "open_yard", nama: l.nama || l.id, namaTampil: "", pemilik: "mitra", vendorId: l.vendorId || "",
      kawasan: "", alamat: /PLACEHOLDER/i.test(l.alamat || "") ? "" : l.alamat || "", luasLahanM2: l.luasTotalM2 || null, luasBangunanM2: null, luasTersediaM2: l.luasTersedia || null,
      spek: {}, fasilitas: { ...(l.fasilitas || {}) }, fasilitasLain: "", jamOperasional: "", pic: { nama: "", jabatan: "", telp: "", email: "" }, aksesJalan: l.aksesJalan || "",
      deskripsi: l.deskripsiKondisi || "", catatan: l.catatan || "", status: l.status === "tersedia" ? "tersedia" : "draf", maps: (l.koordinat && l.koordinat.mapsUrl) || "",
      fotos: fotoLama(l).map((f) => ({ ...f, kategori: f.kategori || "lainnya" })), lampiran: [],
    }));
  return [...asli, ...lama].sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
}

// ---------- kelengkapan ----------
export function butirKelengkapan(p) {
  const pic = p.pic || {};
  const spekIsi = spekDari(p.jenis).filter((s) => p.spek && p.spek[s.k] !== undefined && p.spek[s.k] !== "" && p.spek[s.k] !== null).length;
  return [
    ["Nama untuk customer", !!String(p.namaTampil || "").trim()],
    ["Kawasan / area umum", !!String(p.kawasan || "").trim()],
    ["Alamat", !!String(p.alamat || "").trim()],
    ["Link Google Maps", !!String(p.maps || "").trim()],
    ["Luas lahan atau bangunan", Number(p.luasLahanM2) > 0 || Number(p.luasBangunanM2) > 0],
    ["Spesifikasi teknis (min. 3)", spekIsi >= 3],
    ["Fasilitas", Object.entries(p.fasilitas || {}).some(([k, v]) => k !== "permukaan" && v === true)],
    ["Foto (min. 3)", (p.fotos || []).length >= 3],
    ["PIC lapangan (nama dan telepon)", !!String(pic.nama || "").trim() && !!String(pic.telp || "").trim()],
    ["Jam operasional", !!String(p.jamOperasional || "").trim()],
  ];
}
export const skor = (p) => {
  const b = butirKelengkapan(p);
  return Math.round((b.filter(([, ok]) => ok).length / b.length) * 100);
};
// syarat minimum agar status bisa "Tersedia"
export function kurangUntukTersedia(p) {
  const k = [];
  if (!String(p.kawasan || "").trim()) k.push("kawasan");
  if (!(Number(p.luasLahanM2) > 0 || Number(p.luasBangunanM2) > 0)) k.push("luas");
  if (!(p.fotos || []).length) k.push("minimal satu foto");
  if (!String((p.pic || {}).nama || "").trim() || !String((p.pic || {}).telp || "").trim()) k.push("PIC (nama dan telepon)");
  return k;
}

const namaCustomer = (p) => String(p.namaTampil || "").trim() || `${jenisDari(p.jenis).nama}${p.kawasan ? " " + p.kawasan : ""}`;
const angkaOrStrip = (v) => (v === "" || v === null || v === undefined ? "–" : angka(v));
const angkaIn = (t) => {
  const s = String(t ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  const n = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const waLink = (telp) => {
  let d = String(telp || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  d = d.replace(/^\+/, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return `https://wa.me/${d}`;
};

// ============================================================
// TAB: kartu-kartu profil
// ============================================================
const FILTER = { q: "", jenis: "semua", status: "semua", mode: "kartu" };
const demoLokal = () => {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("islhub-demo-db") !== null;
  } catch {
    return false;
  }
};

// Daftar yang tampil sesuai filter aktif (dipakai juga oleh bar pilih banyak di master-rate)
export function profilTampil(S, namaVendor) {
  const q = FILTER.q.trim().toLowerCase();
  return daftarProfil(S).filter((p) => {
    if (FILTER.jenis !== "semua" && p.jenis !== FILTER.jenis) return false;
    if (FILTER.status !== "semua" && (p.status || "draf") !== FILTER.status) return false;
    if (!q) return true;
    return [p.nama, p.namaTampil, p.kawasan, p.alamat, namaVendor ? namaVendor(p.vendorId) : "", (p.pic || {}).nama].join(" ").toLowerCase().includes(q);
  });
}

// Peringatan fasilitas Draf (mis. dibuat cepat dari form tarif) agar segera dilengkapi
const bannerDraf = (semua) => {
  const n = semua.filter((p) => !p.lama && (p.status || "draf") === "draf").length;
  return n && FILTER.status !== "draf" ? `<div class="mr-banner mr-banner--peringatan">${ikon("peringatan")}<div style="flex:1"><strong>${angka(n)} fasilitas masih Draf.</strong> Lengkapi foto, luas, PIC, dan spesifikasinya sebelum dipakai di penawaran.</div><button type="button" class="mr-btn mr-btn--kecil" data-aksi="pf-status" data-v="draf">Tampilkan</button></div>` : "";
};

export function htmlTabProfil(S, namaVendor) {
  const semua = daftarProfil(S);
  const tampil = profilTampil(S, namaVendor);
  const hitung = (id) => semua.filter((p) => p.jenis === id).length;
  const chips = [["semua", "Semua", semua.length], ...JENIS.map((j) => [j.id, j.nama, hitung(j.id)])]
    .map(([id, t, n]) => `<button type="button" class="mr-chip ${FILTER.jenis === id ? "is-aktif" : ""}" data-aksi="pf-jenis" data-v="${id}">${e(t)} <b>${n}</b></button>`)
    .join("");
  const ada = tampil.length;
  return `${bannerDraf(semua)}
    <div class="mr-pfbar">
      <div class="mr-pfbar__kepala">
        <div class="mr-pfbar__aksi">
          ${S.kelola && demoLokal() && !(S.ref.profil || []).length ? `<button class="mr-btn mr-btn--kecil" data-aksi="pf-contoh">Isi 3 contoh (demo)</button>` : ""}
          ${S.kelola ? `<button class="mr-btn mr-btn--utama mr-pfbar__tambah" data-aksi="lokasi-tambah">${ikon("plus", 16)}Tambah fasilitas</button>` : ""}
        </div>
      </div>
      <div class="mr-pfbar__filter">
        <label class="mr-cari">${ikon("cari", 16)}<input id="pf-cari" type="search" placeholder="Cari nama, kawasan, mitra, PIC…" value="${e(FILTER.q)}" autocomplete="off"></label>
        <select id="pf-status" aria-label="Filter status"><option value="semua">Semua status</option>${STATUS.map(([v, t]) => `<option value="${v}" ${FILTER.status === v ? "selected" : ""}>${t}</option>`).join("")}</select>
        <div class="mr-seg mr-seg--kecil mr-pfbar__mode" role="group" aria-label="Tampilan">
          <button type="button" class="mr-seg__btn ${FILTER.mode !== "ringkas" ? "is-aktif" : ""}" data-aksi="pf-mode" data-v="kartu">Kartu</button>
          <button type="button" class="mr-seg__btn ${FILTER.mode === "ringkas" ? "is-aktif" : ""}" data-aksi="pf-mode" data-v="ringkas">Ringkasan</button>
        </div>
      </div>
      <div class="mr-pfbar__jenis">${chips}</div>
      <p class="mr-pfbar__info">${angka(ada)} dari ${angka(semua.length)} fasilitas</p>
    </div>
    ${
      ada
        ? (FILTER.mode === "ringkas" ? ringkasan(tampil, namaVendor, S) : `<div class="mr-grid mr-grid--lokasi">${tampil.map((p) => kartu(p, S, namaVendor)).join("")}</div>`)
        : `<div class="mr-kosong">${ikon("pin", 28)}<p>${semua.length ? "Tidak ada fasilitas yang cocok dengan filter." : "Belum ada profil fasilitas."}</p>${!semua.length && S.master && demoLokal() ? `<button class="mr-btn mr-btn--kecil" data-aksi="pf-contoh">Isi 3 contoh fasilitas (demo)</button>` : ""}</div>`
    }`;
}

// Filter yang sedang aktif (dibaca tampilan HP untuk menandai tombol filter)
// Hapus lokasi langsung dari daftar HP (aturan sama dengan tombol Hapus di formulir: data lama Open Yard tidak boleh dihapus selama masih dipakai tarif)
export async function hapusProfilLangsung({ S, DB, id, render }) {
  const p = daftarProfil(S).find((x) => x.id === id); if (!p) return;
  const legacy = !!p.lama;
  if (legacy) {
    const dipakai = (S.tarif || []).filter((t) => t.lokasiId === p.lokasiRefId).length;
    if (dipakai) return toast(`<b>Lokasi belum bisa dihapus.</b> Masih dipakai ${angka(dipakai)} tarif. Hapus tarifnya dulu.`, "bahaya");
  }
  if (!(await konfirmasiKetik("Hapus lokasi?", `<b>${e(p.nama)}</b> dan profilnya akan dihapus permanen. Tarif Master Rate tidak ikut terhapus.`, "HAPUS"))) return;
  try {
    if (legacy) {
      await DB.hapusDokumen("open_yard_lokasi", p.lokasiRefId);
      S.ref.openYard = (S.ref.openYard || []).filter((x) => x.id !== p.lokasiRefId);
    } else {
      await DB.hapusDokumen("profil_fasilitas", p.id);
      S.ref.profil = (S.ref.profil || []).filter((x) => x.id !== p.id);
    }
    toast("<b>Lokasi dihapus.</b>", "ok");
    render();
  } catch (err) {
    toast(`<b>GAGAL menghapus.</b><br>${e(err.message)}`, "bahaya");
  }
}
// Tandai Tersedia / Tidak tersedia langsung dari daftar HP (Tersedia tetap butuh data minimum yang sama dengan formulir)
export async function ubahStatusProfil({ S, DB, id, status, render }) {
  const asli = (S.ref.profil || []).find((x) => x.id === id), p = daftarProfil(S).find((x) => x.id === id);
  if (!asli || !p) return toast("Lokasi ini belum punya profil. Buka Ubah lokasi dan lengkapi dulu.", "bahaya");
  if (status === "tersedia") {
    const kurang = kurangUntukTersedia(p);
    if (kurang.length) return toast(`<b>Belum bisa ditandai Tersedia.</b> Lengkapi dulu: ${e(kurang.join(", "))}.`, "bahaya");
  }
  try {
    Object.assign(asli, await DB.simpanProfilFasilitas(id, { status }, { baru: false, oleh: S.user.email }));
    render();
    toast(`<b>${e(p.nama)} ditandai ${status === "tersedia" ? "Tersedia" : "Tidak tersedia"}.</b>`, "ok");
  } catch (err) {
    toast(`<b>GAGAL menyimpan.</b><br>${e(err.message)}`, "bahaya");
  }
}

export const infoFilterProfil = () => ({ ...FILTER });

// ---------- HP (desain A): chip jenis, kartu dengan foto kecil, pilih banyak lewat tombol Pilih atau tekan-tahan ----------
function kartuHP(p, S, namaVendor, pilih) {
  const j = jenisDari(p.jenis), f = p.fotos || [], bisaPilih = S.kelola && !p.lama;
  const st = p.status === "tersedia" ? ["ok", "Tersedia"] : p.status === "tidak_tersedia" ? ["no", "Tidak tersedia"] : ["warn", "Draf"];
  const kapas = (p.spek || {}).kapasitasPalet || (p.spek || {}).kapasitasTeus, kapSatuan = (p.spek || {}).kapasitasPalet ? "palet" : "TEUs";
  const sel = S.pilihLok.has(p.id), id = e(p.id), k = `data-k="${id}"`;
  const mitra = p.pemilik === "isl" ? "Milik ISL" : namaVendor && p.vendorId ? `Mitra: ${namaVendor(p.vendorId)}` : "";
  const luas = [Number(p.luasLahanM2) > 0 ? `${angka(p.luasLahanM2)} m² lahan` : "", Number(p.luasBangunanM2) > 0 ? `${angka(p.luasBangunanM2)} m² bangunan` : "", kapas ? `${angka(kapas)} ${kapSatuan}` : ""].filter(Boolean);
  const tombol = (aksi, ik, label, attr = "", cls = "") => `<button type="button" class="mr-m-ab ${cls}" data-aksi="${aksi}" ${attr}>${ikon(ik, 19)}<span>${label}</span></button>`;
  const tersedia = p.status === "tersedia";
  const kiri = S.kelola
    ? tombol("lokasi-edit", "edit", "Ubah", k) + (p.lama ? "" : tombol("m-lstat", tersedia ? "tutup" : "cek", tersedia ? "Tidak tersedia" : "Tersedia", `${k} data-v="${tersedia ? "tidak_tersedia" : "tersedia"}"`, "mr-m-ab--status")) + (S.master ? tombol("m-hapus", "tong", "Hapus", `${k} data-jenis="lokasi"`, "mr-m-ab--bahaya") : "")
    : tombol("pf-detail", "maju", "Detail", k);
  const n = (kiri.match(/<button/g) || []).length, W = 68;
  const kanan = bisaPilih ? `<div class="mr-m-actL"><button type="button" class="mr-m-ab mr-m-ab--pilih" data-aksi="m-pilih-mulai" data-tipe="l" ${k}>${ikon("cek", 19)}<span>Pilih</span></button></div>` : "";
  return `<div class="mr-m-lok mr-m-sw ${sel ? "is-pilih" : ""}" data-mid="${id}" data-tipe="l" ${bisaPilih ? 'data-bisapilih="1"' : ""} style="--aw:${n * W}px;--awl:${W}px">
    ${pilih ? "" : `<div class="mr-m-act">${kiri}</div>${kanan}`}
    <div class="mr-m-lok__isi mr-m-sc" data-aksi="${pilih && bisaPilih ? "m-pilih" : pilih ? "m-noop" : "m-aksi-lok"}" ${k} data-tipe="l" role="button" tabindex="0" aria-label="${pilih ? "Pilih" : "Aksi"} ${e(p.nama)}">
      ${pilih && bisaPilih ? `<span class="mr-m-cek ${sel ? "is-on" : ""}" aria-hidden="true">${sel ? ikon("cek", 16) : ""}</span>` : ""}
      <div class="mr-m-th">${f.length ? `<img src="${e(f[0].url)}" alt="" loading="lazy">` : ikon("foto", 24)}</div>
      <div class="mr-m-lok__t">
        <span class="mr-pf-jenis" style="background:${j.warna}">${e(j.nama)}</span>
        <b>${e(p.nama)}</b>
        <div class="mr-m-lok__s">${ikon("pin", 13)}<span>${e(p.kawasan || p.alamat || "Kawasan belum diisi")}</span></div>
        ${mitra ? `<div class="mr-m-lok__s">${ikon("vendor", 13)}<span>${e(mitra)}</span></div>` : ""}
        ${luas.length ? `<div class="mr-m-lok__n">${luas.map((x) => `<span>${e(x)}</span>`).join("")}</div>` : ""}
      </div>
      <span class="mr-m-st mr-m-st--${st[0]}">${st[1]}</span>
    </div></div>`;
}
export function htmlTabProfilHP(S, namaVendor, { pilih = false } = {}) {
  const semua = daftarProfil(S), tampil = profilTampil(S, namaVendor);
  const chips = [["semua", "Semua", semua.length], ...JENIS.map((j) => [j.id, j.nama, semua.filter((p) => p.jenis === j.id).length])]
    .map(([id, t, n]) => `<button type="button" class="mr-m-chip ${FILTER.jenis === id ? "is-on" : ""}" data-aksi="pf-jenis" data-v="${id}" aria-pressed="${FILTER.jenis === id}">${e(t)} <em>${n}</em></button>`).join("");
  const ringkas = FILTER.mode === "ringkas", filterAktif = FILTER.status !== "semua";
  const kosong = `<div class="mr-kosong">${ikon("pin", 28)}<p>${semua.length ? "Tidak ada fasilitas yang cocok dengan filter." : "Belum ada profil fasilitas."}</p></div>`;
  return `${bannerDraf(semua)}
    <div class="mr-m-cari">
      <label class="mr-cari mr-m-cari__in">${ikon("cari", 16)}<input id="pf-cari" type="search" placeholder="Cari nama, kawasan, mitra, PIC…" value="${e(FILTER.q)}" autocomplete="off" enterkeyhint="search"></label>
      <button type="button" class="mr-m-ib ${filterAktif ? "is-aktif" : ""}" data-aksi="m-filter" aria-label="Filter${filterAktif ? " (ada filter aktif)" : ""}">${ikon("filter", 19)}${filterAktif ? '<i class="mr-m-dot"></i>' : ""}</button>
    </div>
    <div class="mr-m-chips" role="group" aria-label="Jenis fasilitas">${chips}</div>
    <div class="mr-m-meta"><span>${angka(tampil.length)} dari ${angka(semua.length)} fasilitas</span><span class="mr-ruang"></span>
      ${S.kelola ? `<button type="button" class="mr-m-link" data-aksi="m-pilih-mode">${ikon("cek", 15)}${pilih ? "Selesai memilih" : "Pilih"}</button>` : ""}
      <button type="button" class="mr-m-link" data-aksi="pf-mode" data-v="${ringkas ? "kartu" : "ringkas"}">${ikon(ringkas ? "grid" : "lini", 15)}${ringkas ? "Tampilan: Ringkasan" : "Tampilan: Kartu"}</button></div>
    ${tampil.length ? (ringkas ? ringkasan(tampil, namaVendor, S) : `<div class="mr-m-box mr-m-box--lok">${tampil.map((p) => kartuHP(p, S, namaVendor, pilih)).join("")}</div>`) : kosong}`;
}

// Ringkasan: semua lokasi (dan vendor/mitranya) dikelompokkan per jenis fasilitas
function ringkasan(daftar, namaVendor, S) {
  return JENIS.map((j) => {
    const isi = daftar.filter((p) => p.jenis === j.id); if (!isi.length) return "";
    const luas = (p) => Number(p.luasBangunanM2) || Number(p.luasLahanM2) || 0;
    const st = Object.fromEntries(STATUS);
    return `<section class="mr-pf-rk"><h3><span class="mr-pf-jenis" style="background:${j.warna}">${e(j.nama)}</span> <small>${isi.length} lokasi</small></h3><div class="mr-kartu mr-tabelkartu"><table class="mr-table mr-table--sederhana"><thead><tr>${S.kelola ? '<th class="mr-th-cek"><input type="checkbox" data-pilih-lok-semua aria-label="Pilih semua lokasi di jenis ini"></th>' : ""}<th>Lokasi</th><th>Kawasan</th><th>Vendor / mitra</th><th class="r">Luas (m²)</th><th>Status</th></tr></thead><tbody>${isi.map((p) => `<tr data-aksi="lokasi-edit" data-k="${e(p.id)}" class="${S.pilihLok.has(p.id) ? "is-dipilih" : ""}" style="cursor:pointer">${S.kelola && !p.lama ? `<td class="mr-td-cek"><input type="checkbox" data-pilih-lok="${e(p.id)}" ${S.pilihLok.has(p.id) ? "checked" : ""} aria-label="Pilih ${e(p.nama)}"></td>` : S.kelola ? "<td></td>" : ""}<td><b>${e(p.nama)}</b></td><td>${e(p.kawasan || "-")}</td><td>${e((namaVendor && p.vendorId ? namaVendor(p.vendorId) : "") || (p.pemilik === "isl" ? "Milik ISL" : "-"))}</td><td class="r">${luas(p) ? angka(luas(p)) : "-"}</td><td>${e(st[p.status || "draf"] || "Draf")}</td></tr>`).join("")}</tbody></table></div></section>`;
  }).join("");
}

function kartu(p, S, namaVendor) {
  const j = jenisDari(p.jenis);
  const f = p.fotos || [];
  const sk = skor(p);
  const aktif = FASILITAS.filter(([k]) => (p.fasilitas || {})[k] === true).map(([, t]) => t);
  const draf = (p.status || "draf") === "draf";
  const st = p.status === "tersedia" ? ["ok", "Tersedia"] : p.status === "tidak_tersedia" ? ["warn", "Tidak tersedia"] : ["warn", "Draf"];
  const kapas = (p.spek || {}).kapasitasPalet || (p.spek || {}).kapasitasTeus;
  const kapSatuan = (p.spek || {}).kapasitasPalet ? "palet" : "TEUs";
  const pic = p.pic || {};
  const cek = S.kelola && !p.lama;
  return `<div class="mr-kartu mr-lok mr-pf ${cek && S.pilihLok.has(p.id) ? "is-dipilih" : ""}" data-id="${e(p.id)}">
    ${cek ? `<label class="mr-lok__cek" title="Pilih lokasi ini"><input type="checkbox" data-pilih-lok="${e(p.id)}" aria-label="Pilih ${e(p.nama)}" ${S.pilihLok.has(p.id) ? "checked" : ""}><span aria-hidden="true"></span></label>` : ""}
    <div class="mr-lok__foto" data-aksi="pf-detail" data-k="${e(p.id)}" role="button" tabindex="0" aria-label="Lihat profil ${e(p.nama)}">
      ${f.length ? `<img src="${e(f[0].url)}" alt="Foto ${e(p.nama)}" loading="lazy">${f.length > 1 ? `<span class="mr-lok__jml">${f.length} foto</span>` : ""}` : `<div class="mr-lok__kosong">${ikon("foto", 26)}<span>Belum ada foto</span></div>`}
      <span class="mr-pf-jenis" style="background:${j.warna}">${e(j.nama)}</span>
    </div>
    <div class="mr-lok__isi">
      <div class="mr-lok__judul"><h3>${e(p.nama)}</h3><span class="mr-status mr-status--${st[0]}">${st[1]}</span></div>
      <span class="mr-pf-jenis mr-pf-jenis--hp" style="background:${j.warna}">${e(j.nama)}</span>
      <p class="mr-sub">${e(p.kawasan || p.alamat || "Kawasan belum diisi")}${p.pemilik === "isl" ? " · milik ISL" : namaVendor && p.vendorId ? ` · ${e(namaVendor(p.vendorId))}` : ""}</p>
      <div class="mr-lok__angka"><span><b>${angkaOrStrip(p.luasLahanM2)}</b> m² lahan</span>${Number(p.luasBangunanM2) > 0 ? `<span><b>${angka(p.luasBangunanM2)}</b> m² bangunan</span>` : ""}${kapas ? `<span><b>${angka(kapas)}</b> ${kapSatuan}</span>` : ""}</div>
      <div class="mr-lok__fas">${aktif.slice(0, 4).map((t) => `<span class="mr-tag">${e(t)}</span>`).join("")}${aktif.length > 4 ? `<span class="mr-tag">+${aktif.length - 4}</span>` : ""}${aktif.length ? "" : '<span class="mr-sub">Fasilitas belum diisi</span>'}</div>
      <div class="mr-pf-skor" title="Kelengkapan profil ${sk}%"><span class="mr-pf-skor__bar"><i style="width:${sk}%" class="${sk >= 80 ? "ok" : sk >= 50 ? "sedang" : "rendah"}"></i></span><small>${sk}% lengkap</small></div>
      <p class="mr-sub mr-pf-pic">${pic.nama ? `PIC: ${e(pic.nama)}${pic.telp ? " · " + e(pic.telp) : ""}` : "PIC belum diisi"}</p>
      <div class="mr-lok__aksi">
        <button class="mr-btn mr-btn--kecil" data-aksi="pf-detail" data-k="${e(p.id)}">${ikon("maju", 14)}Profil</button>
        ${p.maps ? `<a class="mr-btn mr-btn--kecil" href="${e(p.maps)}" target="_blank" rel="noopener">${ikon("cari", 14)}Maps</a>` : ""}
        <button class="mr-btn mr-btn--kecil" data-aksi="pf-kartu" data-k="${e(p.id)}" title="Kartu profil siap kirim ke customer (data mitra disamarkan)">${ikon("file", 14)}Kartu</button>
        ${S.kelola ? `<button class="mr-ikonbtn" data-aksi="lokasi-edit" data-k="${e(p.id)}" aria-label="Edit ${e(p.nama)}">${ikon("edit", 16)}</button>` : ""}
      </div>
    </div></div>`;
}

// ============================================================
// DETAIL
// ============================================================
export function bukaDetailProfil({ S, DB, id, namaVendor, render }) {
  const p = daftarProfil(S).find((x) => x.id === id);
  if (!p) return;
  const j = jenisDari(p.jenis);
  const pic = p.pic || {};
  const f = p.fotos || [];
  const sk = skor(p);
  const butir = butirKelengkapan(p);
  const spek = spekDari(p.jenis).filter((s) => p.spek && p.spek[s.k] !== undefined && p.spek[s.k] !== "" && p.spek[s.k] !== null);
  const aktif = FASILITAS.filter(([k]) => (p.fasilitas || {})[k] === true).map(([, t]) => t);
  const permukaan = (p.fasilitas || {}).permukaan;
  const wa = waLink(pic.telp);
  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>${e(p.nama)}</h2><p class="mr-sub"><span class="mr-pf-jenis mr-pf-jenis--ln" style="background:${j.warna}">${e(j.nama)}</span> ${p.pemilik === "isl" ? "Milik ISL" : namaVendor && p.vendorId ? "Mitra: " + e(namaVendor(p.vendorId)) : "Milik mitra"}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi mr-pf-detail">
      <div class="mr-pf-hero">${f.length ? `<img id="pf-besar" src="${e(f[0].url)}" alt="Foto utama"><span class="mr-pf-hero__kat" id="pf-kat">${e(labelDari(KAT_FOTO, f[0].kategori))}</span>` : `<div class="mr-lok__kosong">${ikon("foto", 30)}<span>Belum ada foto</span></div>`}</div>
      ${f.length > 1 ? `<div class="mr-pf-thumb">${f.map((x, i) => `<button type="button" data-pf-thumb="${i}" class="${i === 0 ? "is-aktif" : ""}" aria-label="Foto ${i + 1}"><img src="${e(x.url)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      <div class="mr-pf-angka">
        <div><small>Luas lahan</small><b>${angkaOrStrip(p.luasLahanM2)}</b><span>m²</span></div>
        <div><small>Luas bangunan</small><b>${angkaOrStrip(p.luasBangunanM2)}</b><span>m²</span></div>
        <div><small>Tersedia disewakan</small><b>${angkaOrStrip(p.luasTersediaM2)}</b><span>m²</span></div>
        <div><small>Status</small><b>${e(labelDari(STATUS, p.status || "draf"))}</b><span>${sk}% lengkap</span></div>
      </div>
      ${spek.length ? `<section class="mr-pf-bag"><h3>Spesifikasi teknis</h3><dl class="mr-pf-spek">${spek.map((s) => `<div><dt>${e(s.t)}</dt><dd>${e(s.tipe === "angka" ? angka(p.spek[s.k]) : p.spek[s.k])}${s.u ? " " + e(s.u) : ""}</dd></div>`).join("")}${permukaan ? `<div><dt>Permukaan</dt><dd>${e(labelDari(PERMUKAAN, permukaan))}</dd></div>` : ""}</dl></section>` : ""}
      <section class="mr-pf-bag"><h3>Fasilitas</h3><div class="mr-lok__fas">${aktif.map((t) => `<span class="mr-tag">${e(t)}</span>`).join("") || '<span class="mr-sub">Belum diisi</span>'}</div>${p.fasilitasLain ? `<p class="mr-sub" style="margin-top:6px">${e(p.fasilitasLain).replace(/\n/g, "<br>")}</p>` : ""}${p.jamOperasional ? `<p class="mr-sub" style="margin-top:6px"><b>Jam operasional:</b> ${e(p.jamOperasional)}</p>` : ""}${p.aksesJalan ? `<p class="mr-sub"><b>Akses jalan:</b> ${e(p.aksesJalan)}</p>` : ""}</section>
      <section class="mr-pf-bag mr-pf-internal"><h3>${ikon("peringatan", 14)} Hanya internal</h3>
        <div class="mr-pf-kartu-pic"><div><small>PIC fasilitas</small><b>${e(pic.nama || "Belum diisi")}</b><span>${e(pic.jabatan || "")}</span></div><div class="mr-pf-kontak">${pic.telp ? `<a class="mr-btn mr-btn--kecil" href="tel:${e(String(pic.telp).replace(/[^\d+]/g, ""))}">Telepon</a>` : ""}${wa ? `<a class="mr-btn mr-btn--kecil" href="${e(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${pic.email ? `<a class="mr-btn mr-btn--kecil" href="mailto:${e(pic.email)}">Email</a>` : ""}</div></div>
        <p class="mr-sub"><b>Kawasan:</b> ${e(p.kawasan || "-")}<br><b>Alamat:</b> ${e(p.alamat || "Belum diisi")}</p>
        ${p.maps ? `<a class="mr-btn mr-btn--kecil" href="${e(p.maps)}" target="_blank" rel="noopener">${ikon("cari", 14)}Buka di Google Maps</a>` : '<p class="mr-sub">Link Google Maps belum diisi.</p>'}
        ${p.deskripsi ? `<p class="mr-sub" style="margin-top:8px"><b>Kondisi:</b> ${e(p.deskripsi).replace(/\n/g, "<br>")}</p>` : ""}${p.catatan ? `<p class="mr-sub"><b>Catatan:</b> ${e(p.catatan).replace(/\n/g, "<br>")}</p>` : ""}
      </section>
      ${(p.lampiran || []).length ? `<section class="mr-pf-bag"><h3>Lampiran</h3><ul class="mr-pf-lamp">${p.lampiran.map((l) => `<li><a href="${e(l.url)}" target="_blank" rel="noopener">${ikon("file", 14)} ${e(l.nama || "Berkas")}</a> <span class="mr-tag">${e(labelDari(KAT_LAMP, l.kategori))}</span></li>`).join("")}</ul></section>` : ""}
      <section class="mr-pf-bag"><h3>Kelengkapan profil · ${sk}%</h3><ul class="mr-pf-cek">${butir.map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? ikon("cek", 14) : ikon("tutup", 14)} ${e(t)}</li>`).join("")}</ul></section>
    </div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-pf-kartu>${ikon("file", 16)}Kartu profil (PDF)</button><span class="mr-ruang"></span>${S.master ? `<button class="mr-btn mr-btn--utama" data-pf-edit>${ikon("edit", 16)}Edit</button>` : ""}</footer>`,
    { lebar: "lebar" }
  );
  panel.addEventListener("click", (ev) => {
    const th = ev.target.closest("[data-pf-thumb]");
    if (th) {
      const x = f[Number(th.dataset.pfThumb)];
      $("#pf-besar", panel).src = x.url;
      $("#pf-kat", panel).textContent = labelDari(KAT_FOTO, x.kategori);
      $$("[data-pf-thumb]", panel).forEach((b) => b.classList.toggle("is-aktif", b === th));
    } else if (ev.target.closest("[data-pf-kartu]")) kartuProfil(p, ev.target.closest("button"));
    else if (ev.target.closest("[data-pf-edit]")) bukaProfil({ S, DB, id: p.id, render });
  });
}

// ============================================================
// FORM
// ============================================================
// Formulir dibagi per langkah seperti form vendor: satu bagian tampil, lalu Lanjut/Kembali.
const TAHAP_PF = [["identitas", "Identitas"], ["lokasi", "Lokasi"], ["ukuran", "Ukuran"], ["spek", "Spesifikasi"], ["fasilitas", "Fasilitas"], ["pic", "PIC"], ["galeri", "Galeri"], ["lampiran", "Lampiran"], ["catatan", "Catatan"]];
let tahapPf = "identitas";
// bungkus setiap judul bagian (h3) beserta isinya ke dalam satu langkah
function bagiTahapPf(panel) {
  const induk = $(".mr-pf-form", panel);
  if (!induk) return;
  const grup = [];
  [...induk.children].forEach((el) => {
    if (el.matches("h3.mr-pf-sek")) grup.push({ h: el, isi: [] });
    else if (grup.length) grup[grup.length - 1].isi.push(el);
  });
  grup.forEach((g, n) => {
    const sec = document.createElement("section");
    sec.className = "vf-tahap mr-pf-tahap";
    sec.dataset.tahap = TAHAP_PF[n] ? TAHAP_PF[n][0] : `bagian${n}`;
    g.h.className = "mr-pf-sek vf-tahap__judul";
    g.h.innerHTML = g.h.innerHTML.replace(/^\s*\d+\.\s*/, "");
    g.h.before(sec);
    sec.append(g.h, ...g.isi);
  });
  const nav = document.createElement("div");
  nav.id = "p-nav";
  induk.before(nav);
  segarkanTahapPf(panel);
}
function segarkanTahapPf(panel) {
  const t = $$(".mr-pf-tahap", panel);
  const i = t.findIndex((x) => x.dataset.tahap === tahapPf);
  const aktif = i >= 0 ? i : 0;
  tahapPf = t[aktif] ? t[aktif].dataset.tahap : tahapPf;
  t.forEach((x, n) => (x.hidden = n !== aktif));
  const label = t.map((x) => ({ k: x.dataset.tahap, j: TAHAP_PF.find(([k]) => k === x.dataset.tahap)?.[1] || x.dataset.tahap }));
  const nav = $("#p-nav", panel);
  if (nav) nav.innerHTML = `<nav class="vf-nav" aria-label="Bagian formulir">
    <div class="vf-nav__progres">Langkah ${aktif + 1} dari ${label.length}<b>${e(label[aktif].j)}</b></div>
    <div class="vf-nav__daftar">${label.map((x, n) => `<button type="button" class="vf-nav__t ${n === aktif ? "is-aktif" : ""}" data-ptahap="${e(x.k)}"${n === aktif ? ' aria-current="step"' : ""}><span>${n + 1}</span>${e(x.j)}</button>`).join("")}</div>
  </nav>`;
  const langkah = $("#p-langkah", panel);
  if (langkah) langkah.innerHTML = `${aktif > 0 ? `<button class="mr-btn vf-kaki__mundur" data-pmundur>${ikon("kembali", 16)}Kembali</button>` : ""}${aktif < label.length - 1 ? `<button class="mr-btn mr-btn--utama vf-kaki__maju" data-pmaju>Lanjut${ikon("maju", 16)}</button>` : ""}`;
  const isi = $(".mr-panel__isi", panel);
  if (isi) isi.scrollTop = 0;
}
function pindahTahapPf(panel, arah, kunci = null) {
  const t = $$(".mr-pf-tahap", panel).map((x) => x.dataset.tahap);
  if (kunci) tahapPf = kunci;
  else { const i = t.indexOf(tahapPf); tahapPf = t[Math.min(t.length - 1, Math.max(0, i + arah))]; }
  segarkanTahapPf(panel);
}
export function bukaProfil({ S, DB, id, render }) {
  tahapPf = "identitas";
  const lama = id ? daftarProfil(S).find((x) => x.id === id) : null;
  const dasar = { nama: "", namaTampil: "", jenis: "gudang_dry", pemilik: "mitra", vendorId: "", kawasan: "", alamat: "", maps: "", luasLahanM2: null, luasBangunanM2: null, luasTersediaM2: null, spek: {}, fasilitas: {}, fasilitasLain: "", jamOperasional: "", pic: { nama: "", jabatan: "", telp: "", email: "" }, aksesJalan: "", deskripsi: "", catatan: "", status: "draf", fotos: [], lampiran: [], lokasiRefId: "" };
  const d = { ...dasar, ...(lama ? JSON.parse(JSON.stringify(lama)) : {}) };
  d.pic = { ...dasar.pic, ...(d.pic || {}) };
  d.spek = d.spek || {};
  d.fasilitas = d.fasilitas || {};
  d.fotos = (d.fotos || []).map((f) => ({ ...f, kategori: f.kategori || "lainnya" }));
  d.lampiran = d.lampiran || [];
  const barisBaru = !lama || lama.lama;
  const fmt = (v) => (v === null || v === undefined || v === "" ? "" : String(v).replace(".", ","));
  const vendors = (S.vendor || []).filter((v) => v.id !== "belum_ditentukan").sort((a, b) => String(a.nama || a.id).localeCompare(String(b.nama || b.id)));

  const spekHtml = () =>
    spekDari($("#p-jenis", panel).value)
      .map(
        (s) => `<label class="mr-f"><span>${e(s.t)}${s.u ? ` (${e(s.u)})` : ""}</span><input data-spek="${s.k}" data-tipe="${s.tipe}" ${s.tipe === "angka" ? 'inputmode="decimal"' : ""} value="${e(fmt(d.spek[s.k]))}" placeholder="${e(s.ph || "")}" autocomplete="off"></label>`
      )
      .join("");

  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>${lama && !lama.lama ? "Edit fasilitas" : lama ? "Lengkapi profil fasilitas" : "Tambah fasilitas"}</h2><p class="mr-sub">${lama && lama.lama ? "Lokasi Open Yard lama. Setelah disimpan, profilnya tersimpan di direktori baru; tarif lama tetap tersambung." : "Profil lengkap: galeri, ukuran, spesifikasi, fasilitas, PIC, peta."}</p></div><div class="vf-kepala__aksi"><button type="button" class="mr-btn mr-btn--utama vf-kepala__simpan" id="p-simpan">Simpan</button><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></div></header>
    <div class="mr-panel__isi"><div class="mr-form mr-pf-form">
      <h3 class="mr-pf-sek">1. Identitas</h3>
      <label class="mr-f"><span>Jenis fasilitas *</span><select id="p-jenis">${JENIS.map((j) => `<option value="${j.id}" ${d.jenis === j.id ? "selected" : ""}>${e(j.nama)}</option>`).join("")}</select></label>
      <label class="mr-f"><span>Status</span><select id="p-status">${STATUS.map(([v, t]) => `<option value="${v}" ${d.status === v ? "selected" : ""}>${t}</option>`).join("")}</select><small>Tersedia butuh kawasan, luas, satu foto, dan PIC.</small></label>
      <label class="mr-f mr-f--lebar"><span>Nama internal *</span><input id="p-nama" value="${e(d.nama)}" placeholder="Mis. Gudang Chiller HLC Cikarang"></label>
      <label class="mr-f mr-f--lebar"><span>Nama untuk customer</span><input id="p-tampil" value="${e(d.namaTampil)}" placeholder="Tanpa nama mitra. Mis. Gudang Chiller Cikarang 2.400 m²"><small>Dipakai di kartu profil. Kosong = jenis + kawasan.</small></label>
      <label class="mr-f"><span>Pemilik</span><select id="p-pemilik"><option value="mitra" ${d.pemilik !== "isl" ? "selected" : ""}>Mitra (vendor)</option><option value="isl" ${d.pemilik === "isl" ? "selected" : ""}>Milik ISL</option></select></label>
      <label class="mr-f" id="p-vendor-w"><span>Mitra pemilik</span><select id="p-vendor"><option value="">Belum ditentukan</option>${vendors.map((v) => `<option value="${e(v.id)}" ${v.id === d.vendorId ? "selected" : ""}>${e(v.nama || v.id)}</option>`).join("")}</select></label>

      <h3 class="mr-pf-sek">2. Lokasi <small>(hanya internal)</small></h3>
      <label class="mr-f"><span>Kawasan / area umum</span><input id="p-kawasan" value="${e(d.kawasan)}" placeholder="Mis. Cikarang, Bekasi"><small>Boleh tampil di kartu customer.</small></label>
      <label class="mr-f mr-f--lebar"><span>Alamat detail</span><textarea id="p-alamat" rows="2">${e(d.alamat)}</textarea></label>
      <label class="mr-f mr-f--lebar"><span>Link Google Maps atau koordinat</span><input id="p-maps" value="${e(d.maps)}" placeholder="Tempel link Google Maps atau -6.3269, 107.1370"><small id="p-maps-info"></small></label>

      <h3 class="mr-pf-sek">3. Ukuran</h3>
      <label class="mr-f"><span>Luas lahan (m²)</span><input id="p-lahan" inputmode="decimal" value="${e(fmt(d.luasLahanM2))}"></label>
      <label class="mr-f"><span>Luas bangunan (m²)</span><input id="p-bangunan" inputmode="decimal" value="${e(fmt(d.luasBangunanM2))}"></label>
      <label class="mr-f"><span>Luas yang tersedia disewakan (m²)</span><input id="p-tersedia" inputmode="decimal" value="${e(fmt(d.luasTersediaM2))}"></label>
      <label class="mr-f"><span>Permukaan / lantai</span><select id="p-permukaan">${PERMUKAAN.map(([v, t]) => `<option value="${v}" ${(d.fasilitas.permukaan || "") === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>

      <h3 class="mr-pf-sek">4. Spesifikasi teknis <small id="p-spek-judul"></small></h3>
      <div class="mr-pf-spekgrid" id="p-spek"></div>

      <h3 class="mr-pf-sek">5. Fasilitas dan operasional</h3>
      <div class="mr-f mr-f--lebar"><div class="mr-cekgrup" id="p-fas">${FASILITAS.map(([k, t]) => `<label class="mr-cek"><input type="checkbox" value="${k}" ${d.fasilitas[k] === true ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></div>
      <label class="mr-f mr-f--lebar"><span>Fasilitas lainnya (satu per baris)</span><textarea id="p-fas-lain" rows="2" placeholder="Mis. Kantor 100 m²&#10;Area bongkar muat berkanopi">${e(d.fasilitasLain)}</textarea></label>
      <label class="mr-f"><span>Jam operasional</span><input id="p-jam" value="${e(d.jamOperasional)}" placeholder="Mis. Sen–Jum 08.00–17.00, Sab 08.00–14.00"></label>
      <label class="mr-f"><span>Akses jalan</span><input id="p-akses" value="${e(d.aksesJalan)}" placeholder="Mis. Akses kontainer 40ft, lebar jalan 9 m"></label>

      <h3 class="mr-pf-sek">6. PIC fasilitas <small>(hanya internal)</small></h3>
      <label class="mr-f"><span>Nama PIC</span><input id="p-pic-nama" value="${e(d.pic.nama)}"></label>
      <label class="mr-f"><span>Jabatan</span><input id="p-pic-jab" value="${e(d.pic.jabatan)}" placeholder="Mis. Kepala gudang"></label>
      <label class="mr-f"><span>Telepon / WhatsApp</span><input id="p-pic-telp" inputmode="tel" value="${e(d.pic.telp)}" placeholder="08xx..."></label>
      <label class="mr-f"><span>Email</span><input id="p-pic-email" type="email" value="${e(d.pic.email)}"></label>

      <h3 class="mr-pf-sek">7. Galeri foto</h3>
      <div class="mr-f mr-f--lebar"><div class="mr-galeri mr-galeri--kat" id="p-galeri"></div>
        <div class="mr-pf-unggah"><select id="p-kat-foto" aria-label="Kategori foto baru">${KAT_FOTO.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select><label class="mr-btn mr-btn--kecil mr-unggah">${ikon("upload", 14)}Tambah foto<input type="file" id="p-foto" accept="image/*" multiple hidden></label></div>
        <small>Pilih kategori dulu, lalu tambah foto. Foto pertama jadi sampul. Foto diperkecil otomatis.</small></div>

      <h3 class="mr-pf-sek">8. Lampiran dokumen</h3>
      <div class="mr-f mr-f--lebar"><ul class="mr-pf-lamp mr-pf-lamp--edit" id="p-lamp"></ul>
        <div class="mr-pf-unggah"><select id="p-kat-lamp" aria-label="Kategori lampiran">${KAT_LAMP.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select><label class="mr-btn mr-btn--kecil mr-unggah">${ikon("upload", 14)}Tambah lampiran<input type="file" id="p-lampiran" accept="application/pdf,image/*" hidden></label></div>
        <small>PDF atau gambar (layout, izin, sertifikat). Dikecilkan otomatis ke maksimal 4 MB.</small></div>

      <h3 class="mr-pf-sek">9. Catatan</h3>
      <label class="mr-f mr-f--lebar"><span>Kondisi fasilitas</span><textarea id="p-kondisi" rows="2">${e(d.deskripsi)}</textarea></label>
      <label class="mr-f mr-f--lebar"><span>Catatan internal</span><textarea id="p-catatan" rows="2">${e(d.catatan)}</textarea></label>
    </div><p class="mr-galat" id="p-galat" hidden></p></div>
    <footer class="mr-panel__kaki vf-kaki">${lama ? `<button class="mr-btn mr-btn--hapus vf-kaki__hapus" id="p-hapus">${ikon("tong", 16)}Hapus</button>` : ""}<span class="mr-ruang"></span><span class="vf-kaki__langkah" id="p-langkah"></span></footer>`,
    { lebar: "lebar" }
  );

  const idProfil = () => (lama && !lama.lama ? lama.id : slug($("#p-nama", panel).value) || `fasilitas_${Date.now().toString(36)}`);
  const kolek = () => {
    // simpan isian spek saat ini ke d.spek sebelum jenis berganti
    $$("[data-spek]", panel).forEach((i) => {
      const v = i.dataset.tipe === "angka" ? angkaIn(i.value) : i.value.trim();
      if (v === null || v === "") delete d.spek[i.dataset.spek];
      else d.spek[i.dataset.spek] = v;
    });
  };
  const gambarSpek = () => {
    $("#p-spek", panel).innerHTML = spekHtml();
    $("#p-spek-judul", panel).textContent = `(${jenisDari($("#p-jenis", panel).value).nama})`;
  };
  const vendorTampil = () => ($("#p-vendor-w", panel).style.display = $("#p-pemilik", panel).value === "isl" ? "none" : "");
  const galeri = () => {
    $("#p-galeri", panel).innerHTML = d.fotos.length
      ? d.fotos
          .map(
            (f, i) => `<figure class="mr-foto"><img src="${e(f.url)}" alt="Foto ${i + 1}" loading="lazy">${i === 0 ? '<span class="mr-foto__sampul">Sampul</span>' : `<button type="button" class="mr-foto__jadi" data-fjadi="${i}" title="Jadikan sampul">★</button>`}<button type="button" class="mr-foto__x" data-fx="${i}" aria-label="Hapus foto">${ikon("tutup", 14)}</button><select class="mr-foto__kat" data-fkat="${i}" aria-label="Kategori foto ${i + 1}">${KAT_FOTO.map(([v, t]) => `<option value="${v}" ${f.kategori === v ? "selected" : ""}>${t}</option>`).join("")}</select></figure>`
          )
          .join("")
      : '<p class="mr-sub">Belum ada foto.</p>';
  };
  const lampiran = () => {
    $("#p-lamp", panel).innerHTML = d.lampiran.length
      ? d.lampiran.map((l, i) => `<li><a href="${e(l.url)}" target="_blank" rel="noopener">${ikon("file", 14)} ${e(l.nama || "Berkas")}</a> <span class="mr-tag">${e(labelDari(KAT_LAMP, l.kategori))}</span><button type="button" class="mr-ikonbtn" data-lx="${i}" aria-label="Hapus lampiran">${ikon("tutup", 14)}</button></li>`).join("")
      : '<li class="mr-sub">Belum ada lampiran.</li>';
  };
  const infoMaps = () => {
    const r = parseKoordinat($("#p-maps", panel).value);
    const el = $("#p-maps-info", panel);
    if (r.kosong) el.innerHTML = "";
    else if (r.ok) el.innerHTML = `<span class="mr-hint mr-hint--ok">✓ ${r.lat != null ? r.lat + ", " + r.lng : "Link tersimpan"}</span> · <a href="${e(r.mapsUrl)}" target="_blank" rel="noopener">Uji link</a>`;
    else el.innerHTML = `<span class="mr-hint" style="color:var(--mr-bahaya)">${e(r.pesan)}</span>`;
    return r;
  };
  gambarSpek();
  vendorTampil();
  galeri();
  lampiran();
  infoMaps();
  bagiTahapPf(panel);

  panel.addEventListener("input", (ev) => {
    if (ev.target.id === "p-maps") infoMaps();
  });
  panel.addEventListener("change", async (ev) => {
    const t = ev.target;
    if (t.id === "p-jenis") {
      kolek();
      gambarSpek();
    } else if (t.id === "p-pemilik") vendorTampil();
    else if (t.dataset && t.dataset.fkat !== undefined) d.fotos[Number(t.dataset.fkat)].kategori = t.value;
    else if (t.id === "p-foto" || t.id === "p-lampiran") {
      const berkas = [...t.files];
      t.value = "";
      if (!$("#p-nama", panel).value.trim()) return toast("Isi nama internal dulu sebelum mengunggah berkas.", "bahaya");
      const foto = t.id === "p-foto";
      const kat = $(foto ? "#p-kat-foto" : "#p-kat-lamp", panel).value;
      const label = t.closest(".mr-unggah");
      label.classList.add("is-simpan");
      let gagal = 0;
      for (const f0 of berkas) {
        try {
          const f = foto || String(f0.type).startsWith("image/") ? await perkecilGambar(f0) : f0;
          const ext = (String(f.name).match(/\.[a-z0-9]+$/i) || [foto ? ".jpg" : ""])[0];
          const path = `profil_fasilitas/${idProfil()}/${foto ? "foto" : "lampiran"}_${Date.now()}_${(foto ? d.fotos : d.lampiran).length}${ext}`;
          const h = await DB.unggahFile(path, f, { oleh: S.user.email });
          (foto ? d.fotos : d.lampiran).push({ url: h.url, path: h.path, nama: h.nama || f.name, kategori: kat });
          foto ? galeri() : lampiran();
        } catch (err) {
          gagal++;
          toast(`<b>GAGAL mengunggah ${e(f0.name)}.</b><br>${e(err.message)}`, "bahaya");
        }
      }
      label.classList.remove("is-simpan");
      if (!gagal && berkas.length) toast(`<b>${berkas.length} berkas terunggah.</b> Klik <b>Simpan fasilitas</b> untuk menyimpan.`, "ok");
    }
  });
  panel.addEventListener("click", (ev) => {
    const langkah = ev.target.closest("[data-ptahap]");
    const maju = ev.target.closest("[data-pmaju]"), mundur = ev.target.closest("[data-pmundur]");
    if (langkah) return pindahTahapPf(panel, 0, langkah.dataset.ptahap);
    if (maju) return pindahTahapPf(panel, 1);
    if (mundur) return pindahTahapPf(panel, -1);
    const x = ev.target.closest("[data-fx]");
    const jadi = ev.target.closest("[data-fjadi]");
    const lx = ev.target.closest("[data-lx]");
    if (x) {
      const f = d.fotos.splice(Number(x.dataset.fx), 1)[0];
      if (f && f.path) DB.hapusFile(f.path).catch(() => {});
      galeri();
    } else if (jadi) {
      const f = d.fotos.splice(Number(jadi.dataset.fjadi), 1)[0];
      d.fotos.unshift(f);
      galeri();
    } else if (lx) {
      const l = d.lampiran.splice(Number(lx.dataset.lx), 1)[0];
      if (l && l.path) DB.hapusFile(l.path).catch(() => {});
      lampiran();
    }
  });

  const hapus = $("#p-hapus", panel);
  // data lama Open Yard boleh dihapus juga; aturannya sama dengan lokasi lain: tidak bisa dihapus selama masih dipakai tarif
  const legacy = !!(lama && lama.lama);
  if (hapus && legacy) {
    const dipakai = (S.tarif || []).filter((t) => t.lokasiId === lama.lokasiRefId).length;
    if (dipakai) { hapus.disabled = true; hapus.title = `Masih dipakai ${dipakai} tarif. Hapus tarifnya dulu.`; }
  }
  if (hapus)
    hapus.onclick = async () => {
      if (!(await konfirmasiKetik("Hapus lokasi?", `<b>${e(d.nama)}</b> dan profilnya akan dihapus permanen. Tarif Master Rate tidak ikut terhapus.`, "HAPUS"))) return;
      try {
        if (legacy) {
          await DB.hapusDokumen("open_yard_lokasi", lama.lokasiRefId);
          S.ref.openYard = (S.ref.openYard || []).filter((x) => x.id !== lama.lokasiRefId);
        } else {
          await DB.hapusDokumen("profil_fasilitas", lama.id);
          S.ref.profil = (S.ref.profil || []).filter((x) => x.id !== lama.id);
        }
        toast("<b>Lokasi dihapus.</b>", "ok");
        tutupLayer();
        render();
      } catch (err) {
        toast(`<b>GAGAL menghapus.</b><br>${e(err.message)}`, "bahaya");
      }
    };

  $("#p-simpan", panel).onclick = async () => {
    const g = $("#p-galat", panel);
    g.hidden = true;
    kolek();
    const nama = $("#p-nama", panel).value.trim();
    const kor = infoMaps();
    const data = {
      nama,
      namaTampil: $("#p-tampil", panel).value.trim(),
      jenis: $("#p-jenis", panel).value,
      pemilik: $("#p-pemilik", panel).value,
      vendorId: $("#p-pemilik", panel).value === "isl" ? "" : $("#p-vendor", panel).value,
      kawasan: $("#p-kawasan", panel).value.trim(),
      alamat: $("#p-alamat", panel).value.trim(),
      maps: kor.ok && !kor.kosong ? kor.mapsUrl : "",
      luasLahanM2: angkaIn($("#p-lahan", panel).value),
      luasBangunanM2: angkaIn($("#p-bangunan", panel).value),
      luasTersediaM2: angkaIn($("#p-tersedia", panel).value),
      spek: { ...d.spek },
      fasilitas: { permukaan: $("#p-permukaan", panel).value },
      fasilitasLain: $("#p-fas-lain", panel).value.trim(),
      jamOperasional: $("#p-jam", panel).value.trim(),
      aksesJalan: $("#p-akses", panel).value.trim(),
      pic: { nama: $("#p-pic-nama", panel).value.trim(), jabatan: $("#p-pic-jab", panel).value.trim(), telp: $("#p-pic-telp", panel).value.trim(), email: $("#p-pic-email", panel).value.trim() },
      deskripsi: $("#p-kondisi", panel).value.trim(),
      catatan: $("#p-catatan", panel).value.trim(),
      status: $("#p-status", panel).value,
      fotos: d.fotos.map((f) => ({ url: f.url, path: f.path || "", nama: f.nama || "", kategori: f.kategori || "lainnya" })),
      lampiran: d.lampiran.map((l) => ({ url: l.url, path: l.path || "", nama: l.nama || "", kategori: l.kategori || "lainnya" })),
      lokasiRefId: d.lokasiRefId || "",
    };
    FASILITAS.forEach(([k]) => (data.fasilitas[k] = $(`#p-fas input[value="${k}"]`, panel).checked));
    const salah = [];
    if (!nama) salah.push("nama internal wajib diisi");
    if (!kor.ok) salah.push("link Google Maps tidak terbaca");
    // kelengkapan (foto, PIC, dst.) hanya diberi peringatan setelah tersimpan, tidak memblokir simpan
    const kurangTersedia = data.status === "tersedia" ? kurangUntukTersedia(data) : [];
    if (salah.length) {
      g.textContent = `Belum bisa disimpan: ${salah.join("; ")}.`;
      g.hidden = false;
      return;
    }
    const tombol = $("#p-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    try {
      const pid = idProfil();
      const t = await DB.simpanProfilFasilitas(pid, data, { baru: barisBaru, oleh: S.user.email });
      S.ref.profil = S.ref.profil || [];
      const entri = { ...t, id: pid };
      const i = S.ref.profil.findIndex((x) => x.id === pid);
      if (i >= 0) S.ref.profil[i] = entri;
      else S.ref.profil.push(entri);
      toast(`<b>Fasilitas tersimpan dan terverifikasi.</b> ${e(nama)}`, "ok");
      if (kurangTersedia.length) toast(`<b>Peringatan:</b> status Tersedia belum lengkap, masih kurang ${e(kurangTersedia.join(", "))}. Data tetap tersimpan, lengkapi nanti.`, "peringatan");
      tutupLayer();
      render();
    } catch (err) {
      toast(`<b>GAGAL menyimpan.</b><br>${e(err.message)}`, "bahaya");
      g.textContent = err.message;
      g.hidden = false;
      tombol.disabled = false;
      tombol.innerHTML = `${ikon("cek", 16)}Simpan fasilitas`;
    }
  };
}

// ============================================================
// KARTU PROFIL SIAP KIRIM (PDF 1 halaman, data mitra disamarkan)
// ============================================================
export async function kartuProfil(p, tombol) {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J || !window.html2canvas) return toast("Pustaka PDF belum termuat. Muat ulang halaman lalu coba lagi.", "bahaya");
  const j = jenisDari(p.jenis);
  const spek = spekDari(p.jenis).filter((s) => p.spek && p.spek[s.k] !== undefined && p.spek[s.k] !== "" && p.spek[s.k] !== null);
  const aktif = FASILITAS.filter(([k]) => (p.fasilitas || {})[k] === true).map(([, t]) => t);
  const fotos = (p.fotos || []).filter((f) => f.kategori !== "layout" && f.kategori !== "citra").concat((p.fotos || []).filter((f) => f.kategori === "layout" || f.kategori === "citra")).slice(0, 5);
  const hari = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const tiles = [
    Number(p.luasLahanM2) > 0 ? [angka(p.luasLahanM2), "m² luas lahan"] : null,
    Number(p.luasBangunanM2) > 0 ? [angka(p.luasBangunanM2), "m² luas bangunan"] : null,
    Number(p.luasTersediaM2) > 0 ? [angka(p.luasTersediaM2), "m² tersedia"] : null,
    (p.spek || {}).kapasitasPalet ? [angka(p.spek.kapasitasPalet), "kapasitas palet"] : null,
    (p.spek || {}).kapasitasTeus ? [angka(p.spek.kapasitasTeus), "kapasitas TEUs"] : null,
  ].filter(Boolean).slice(0, 4);
  const suhu = (p.spek || {}).suhuMin !== undefined && (p.spek || {}).suhuMax !== undefined ? `${p.spek.suhuMin}°C s/d ${p.spek.suhuMax}°C` : "";
  const wadah = document.createElement("div");
  wadah.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1";
  wadah.innerHTML = `<div style="width:794px;height:1123px;box-sizing:border-box;font-family:Inter,Arial,sans-serif;color:#10233f;position:relative;overflow:hidden;background:#fff">
    <div style="height:10px;background:linear-gradient(90deg,#1e8fc0,#e8832a)"></div>
    <div style="padding:28px 44px 0;display:flex;justify-content:space-between;align-items:flex-start">
      <div><div style="font:800 11px Arial;letter-spacing:1.4px;color:#1e8fc0">PT INDO SUKSES LOGISTIK</div><div style="font-size:10px;color:#5b6977;margin-top:2px">Container Yard · Warehousing · Transportation</div></div>
      <div style="font-size:10px;color:#5b6977;text-align:right">Profil fasilitas<br>${e(hari)}</div></div>
    <div style="padding:20px 44px 0"><span style="display:inline-block;background:${j.warna};color:#fff;font:700 10px Arial;letter-spacing:1px;text-transform:uppercase;border-radius:4px;padding:4px 9px">${e(j.nama)}</span>
      <h1 style="margin:10px 0 4px;font:800 28px Arial;line-height:1.15;color:#0e5a82">${e(namaCustomer(p))}</h1>
      <div style="font-size:12px;color:#5b6977">${p.kawasan ? e(p.kawasan) + " · " : ""}${suhu ? e(suhu) + " · " : ""}Alamat lengkap diberikan setelah kesepakatan</div></div>
    <div style="padding:16px 44px 0">${fotos.length ? `<div style="display:grid;grid-template-columns:${fotos.length > 1 ? "2fr 1fr" : "1fr"};grid-template-rows:${fotos.length > 2 ? "170px 170px" : "340px"};gap:8px;height:348px"><img src="${e(fotos[0].url)}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:8px;${fotos.length > 2 ? "grid-row:1 / span 2" : ""}">${fotos.slice(1, 3).map((f) => `<img src="${e(f.url)}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:8px">`).join("")}</div>${fotos.length > 3 ? `<div style="display:grid;grid-template-columns:repeat(${fotos.length - 3},1fr);gap:8px;margin-top:8px">${fotos.slice(3).map((f) => `<img src="${e(f.url)}" crossorigin="anonymous" style="width:100%;height:100px;object-fit:cover;border-radius:8px">`).join("")}</div>` : ""}` : `<div style="height:200px;border-radius:8px;background:#eef5fa;display:flex;align-items:center;justify-content:center;color:#6b7886;font-size:12px">Foto fasilitas tersedia atas permintaan</div>`}</div>
    ${tiles.length ? `<div style="padding:16px 44px 0;display:grid;grid-template-columns:repeat(${tiles.length},1fr);gap:8px">${tiles.map(([a, b]) => `<div style="background:#f5fafd;border:1px solid #d6e6f1;border-left:3px solid #1e8fc0;border-radius:6px;padding:9px 11px"><div style="font:800 20px Arial;color:#10233f">${e(a)}</div><div style="font-size:9.5px;color:#0e5a82;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${e(b)}</div></div>`).join("")}</div>` : ""}
    <div style="padding:16px 44px 0;display:grid;grid-template-columns:1fr 1fr;gap:22px">
      <div><div style="font:800 10px Arial;letter-spacing:1px;color:#1e8fc0;text-transform:uppercase;margin-bottom:6px">Spesifikasi</div>
        ${spek.length ? spek.map((s) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:11px;padding:4px 0;border-bottom:1px solid #e7eef4"><span style="color:#5b6977">${e(s.t)}</span><b>${e(s.tipe === "angka" ? angka(p.spek[s.k]) : p.spek[s.k])}${s.u ? " " + e(s.u) : ""}</b></div>`).join("") : '<div style="font-size:11px;color:#6b7886">Spesifikasi lengkap tersedia atas permintaan.</div>'}
        ${(p.fasilitas || {}).permukaan ? `<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0"><span style="color:#5b6977">Permukaan</span><b>${e(labelDari(PERMUKAAN, p.fasilitas.permukaan))}</b></div>` : ""}</div>
      <div><div style="font:800 10px Arial;letter-spacing:1px;color:#1e8fc0;text-transform:uppercase;margin-bottom:6px">Fasilitas</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${aktif.map((t) => `<span style="background:#eef5fa;border:1px solid #d6e6f1;border-radius:99px;padding:3px 9px;font-size:10.5px">${e(t)}</span>`).join("") || '<span style="font-size:11px;color:#6b7886">Tersedia atas permintaan</span>'}</div>
        ${p.fasilitasLain ? `<div style="font-size:10.5px;color:#334;margin-top:8px;line-height:1.5">${e(p.fasilitasLain).replace(/\n/g, "<br>")}</div>` : ""}
        ${p.jamOperasional ? `<div style="font-size:10.5px;margin-top:8px"><b>Jam operasional:</b> ${e(p.jamOperasional)}</div>` : ""}
        ${p.aksesJalan ? `<div style="font-size:10.5px;margin-top:4px"><b>Akses:</b> ${e(p.aksesJalan)}</div>` : ""}</div>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:0;background:#0e5a82;color:#fff;padding:16px 44px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px">
      <div><b style="font-size:12px">Hubungi tim Marketing ISL</b><br>Jl. Sulawesi No.01, Tanjung Priok, Jakarta Utara · Telp. (62) 21-22495947</div><div style="text-align:right">market@indosukseslogistik.com<br>Tarif diberikan melalui surat penawaran resmi</div></div>
  </div>`;
  document.body.appendChild(wadah);
  const asli = tombol ? tombol.innerHTML : "";
  if (tombol) {
    tombol.disabled = true;
    tombol.textContent = "Membuat PDF…";
  }
  try {
    await Promise.all([...wadah.querySelectorAll("img")].map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))));
    const canvas = await window.html2canvas(wadah.firstElementChild, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const doc = new J({ unit: "mm", format: "a4", orientation: "portrait" });
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
    doc.save(`Profil_${slug(namaCustomer(p)).slice(0, 50) || "fasilitas"}.pdf`);
    toast("<b>Kartu profil terunduh.</b> Alamat, peta, PIC, dan nama mitra tidak ikut tercetak.", "ok");
  } catch (err) {
    toast(`<b>GAGAL membuat kartu profil.</b><br>${e(err.message || "Foto tidak bisa dibaca (cek izin CORS Firebase Storage).")}`, "bahaya");
  } finally {
    wadah.remove();
    if (tombol) {
      tombol.disabled = false;
      tombol.innerHTML = asli;
    }
  }
}

// ============================================================
// pengendali filter tab (dipanggil dari master-rate.js)
// ============================================================
export function filterProfil(aksi, nilai) {
  if (aksi === "q") FILTER.q = nilai;
  else if (aksi === "jenis") FILTER.jenis = nilai;
  else if (aksi === "status") FILTER.status = nilai;
  else if (aksi === "mode") FILTER.mode = nilai;
}

// ---------- contoh untuk demo ----------
const svgFoto = (judul, a, b) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><text x="320" y="215" font-family="Arial" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${judul}</text></svg>`)}`;
export async function isiContohProfil({ S, DB, render }) {
  const contoh = [
    { id: "contoh_chiller_cikarang", nama: "Gudang Chiller Cikarang (contoh)", namaTampil: "Gudang Chiller Cikarang 2.400 m²", jenis: "chiller", pemilik: "mitra", vendorId: "", kawasan: "Cikarang, Bekasi", alamat: "Kawasan industri Cikarang (contoh)", maps: "https://www.google.com/maps?q=-6.3269,107.137", luasLahanM2: 4200, luasBangunanM2: 2400, luasTersediaM2: 1500, spek: { suhuMin: 2, suhuMax: 8, kapasitasPalet: 2200, jumlahRuang: 3, tinggiBangunan: 9, jumlahDock: 6, dayaListrik: 555, genset: "Ada, otomatis (ATS)", monitoringSuhu: "Data logger 24 jam, alarm SMS" }, fasilitas: { permukaan: "epoxy", office: true, toilet: true, listrik: true, cctv: true, security: true, genset: true, apar: true, dockLeveler: true }, fasilitasLain: "Area bongkar muat berkanopi", jamOperasional: "Sen–Sab 08.00–20.00", aksesJalan: "Akses kontainer 40ft", pic: { nama: "Bpk. Dani", jabatan: "Kepala gudang", telp: "0812 0000 1111", email: "" }, deskripsi: "", catatan: "Data contoh demo", status: "tersedia", fotos: [{ url: svgFoto("Eksterior", "#2b9bb8", "#10233f"), kategori: "eksterior" }, { url: svgFoto("Ruang chiller", "#5a67d8", "#2b9bb8"), kategori: "interior" }, { url: svgFoto("Dock loading", "#1e6fa8", "#2b9bb8"), kategori: "interior" }], lampiran: [], lokasiRefId: "" },
    { id: "contoh_open_yard_patimban", nama: "Open Yard Patimban (contoh)", namaTampil: "Open Yard Patimban 5.000 m²", jenis: "open_yard", pemilik: "isl", vendorId: "", kawasan: "Patimban, Subang", alamat: "Jl. Pelabuhan Patimban (contoh)", maps: "https://www.google.com/maps?q=-6.2,107.9", luasLahanM2: 5000, luasBangunanM2: null, luasTersediaM2: 3200, spek: { kapasitasTeus: 320, tinggiTumpuk: 2, dayaDukung: 5, lebarJalan: 9, akses40ft: "Bisa, putar balik leluasa", penerangan: "Lampu sorot" }, fasilitas: { permukaan: "paving_block", office: true, pagar: true, cctv: true, security: true, parkirTruk: true, penerangan: true }, fasilitasLain: "", jamOperasional: "24 jam", aksesJalan: "Akses trailer 40ft", pic: { nama: "Bpk. Rudi", jabatan: "Koordinator lapangan", telp: "0813 0000 2222", email: "" }, deskripsi: "", catatan: "Data contoh demo", status: "tersedia", fotos: [{ url: svgFoto("Lapangan", "#b7791f", "#10233f"), kategori: "eksterior" }, { url: svgFoto("Layout lahan", "#2f855a", "#10233f"), kategori: "layout" }, { url: svgFoto("Citra satelit", "#4a5568", "#1e6fa8"), kategori: "citra" }], lampiran: [], lokasiRefId: "" },
    { id: "contoh_depo_priok", nama: "Depo Tanjung Priok (contoh)", namaTampil: "Depo Container Tanjung Priok", jenis: "depo", pemilik: "mitra", vendorId: "", kawasan: "Tanjung Priok, Jakarta Utara", alamat: "", maps: "", luasLahanM2: 18000, luasBangunanM2: 600, luasTersediaM2: null, spek: { kapasitasTeus: 2500, tinggiTumpuk: 4, jumlahGate: 2, alatAngkat: "Reach stacker 3 unit", reeferPlug: 40, timbangan: "Ada, kapasitas 60 ton", areaRepair: "Ada, repair dan washing" }, fasilitas: { permukaan: "beton", office: true, toilet: true, cctv: true, security: true, jembatanTimbang: true }, fasilitasLain: "", jamOperasional: "Sen–Sab 07.00–22.00", aksesJalan: "", pic: { nama: "", jabatan: "", telp: "", email: "" }, deskripsi: "", catatan: "Contoh profil belum lengkap", status: "draf", fotos: [{ url: svgFoto("Gate depo", "#1e6fa8", "#10233f"), kategori: "eksterior" }], lampiran: [], lokasiRefId: "" },
  ];
  S.ref.profil = S.ref.profil || [];
  for (const c of contoh) {
    const { id, ...data } = c;
    const t = await DB.simpanProfilFasilitas(id, data, { baru: false, oleh: S.user.email });
    const i = S.ref.profil.findIndex((x) => x.id === id);
    if (i >= 0) S.ref.profil[i] = { ...t, id };
    else S.ref.profil.push({ ...t, id });
  }
  toast("<b>3 contoh fasilitas ditambahkan.</b> Hanya untuk percobaan; hapus kapan saja.", "ok");
  render();
}
