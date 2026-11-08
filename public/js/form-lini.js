// ===========================================================
// FORM LINI — aturan form "Tambah item" untuk tiap lini bisnis.
// Mau mengubah isian/satuan/pola/peringatan suatu lini? Cukup edit
// file ini. Tampilan (form-tambah.js) tidak perlu disentuh.
//
// Bentuk data MENGIKUTI data yang sudah ada di database, supaya item
// baru dari web punya kunci yang sama dengan item hasil impor terminal
// (tidak dobel). Isian yang bernilai "bawaan" TIDAK dicatat di
// dimensi, sehingga 82 tarif REPO lama tetap dikenali sama:
//   trucking   -> layanan "trucking_container",
//                 dimensi {jenisPengiriman, tujuan(id zona), ukuran,
//                          + kelasBerat / kepala / buntut / terminal
//                            hanya kalau BUKAN bawaan}
//   distribusi -> layanan "kirim_kendaraan",
//                 dimensi {asal, tujuan (id lokasi), kendaraan, body}
// ===========================================================
import { slug, rapikanNama } from "./kunci.js";

export const TERMINAL_UTAMA = "Tanjung Priok";
export const TERMINAL_SARAN = ["Tanjung Priok", "Patimban"];
export const UKURAN_KONTAINER = [["20ft", "20 ft"], ["40ft", "40 ft"], ["40hc", "40 HC"]];
export const KENDARAAN = [["cde", "CDE"], ["cdd", "CDD"], ["fuso", "Fuso"], ["tronton", "Tronton"]];
export const BODY = [["box", "Box"], ["wingbox", "Wingbox"], ["bak", "Bak"], ["losbak", "Losbak"]];

// Batas cargo berat memakai BERAT KOTOR (gross), dalam ton. Bisa diatur per ukuran.
export const BATAS_BERAT_TON = { default: 25, "20ft": 25, "40ft": 25, "40hc": 25 };
export const batasBerat = (ukuran) => BATAS_BERAT_TON[ukuran] ?? BATAS_BERAT_TON.default;
export const kelasDariBerat = (beratKotorTon, ukuran) => (Number(beratKotorTon) > batasBerat(ukuran) ? "berat" : "normal");

export const KEPALA = [["semua", "Semua kepala"], ["head_tronton", "Head Tronton (6x4)"], ["head_engkel", "Head Engkel (4x2)"]];
export const BUNTUT = [["rangka", "Rangka (chassis) kontainer"], ["flatbed", "Flatbed"], ["lowbed", "Lowbed"], ["dolly", "Dolly"]];
export const JENIS_MUATAN = [["kontainer", "Kontainer"], ["non_kontainer", "Non-kontainer (alat berat / project cargo)"]];
export const ITEM_DOMESTIK = [["utama", "Rute utama (asal ke tujuan)"], ["titik_tambahan", "Titik tambahan (multi pick up / multi drop)"], ["proyekan", "Paket proyekan"]];

// Empat kategori trucking trailer dan polanya masing-masing.
export const KATEGORI_TRUCKING = {
  import: {
    nama: "Import", arah: "ke", terminal: true, depo: true, asal: false,
    langkah: ["Pick up kontainer isi di pelabuhan/terminal", "Antar ke gudang customer", "Kembalikan kontainer empty ke depo"],
    label: { terminal: "Pick up di (pelabuhan/terminal)", zona: "Gudang customer (kota/zona)", depoEmpty: "Kembalikan empty ke (depo)", asal: "" },
  },
  export: {
    nama: "Export", arah: "dari", terminal: true, depo: true, asal: false,
    langkah: ["Ambil kontainer empty di depo", "Muat / stamping di lokasi customer", "Antar ke pelabuhan/terminal"],
    label: { terminal: "Tujuan akhir (pelabuhan/terminal)", zona: "Lokasi muat customer (kota/zona)", depoEmpty: "Ambil empty di (depo)", asal: "" },
  },
  repo: {
    nama: "REPO", arah: "ke", terminal: true, depo: false, asal: false,
    langkah: ["Pick up kontainer di pelabuhan/terminal", "Antar ke tujuan, kontainer di-ground (satu kegiatan, empty tidak dibawa pulang)"],
    label: { terminal: "Pick up di (pelabuhan/terminal)", zona: "Tujuan / depo (kota/zona)", depoEmpty: "", asal: "" },
  },
  domestik: {
    nama: "Domestik", arah: "ke", terminal: false, depo: false, asal: true,
    langkah: ["Pick up di titik asal (bisa lebih dari satu titik)", "Antar ke tujuan (bisa lebih dari satu titik drop)", "Pakai kontainer domestik, atau cargo dimuat langsung di flatbed"],
    label: { terminal: "", zona: "Tujuan (kota/zona)", depoEmpty: "", asal: "Asal / pick up (kota/zona)" },
  },
};

// Peringatan untuk kombinasi yang tidak lazim. Hanya PERINGATAN, tidak memblokir.
// Tambah/ubah aturan di sini kapan saja.
export const ATURAN_PERINGATAN = [
  { jika: (v) => v.kepala === "head_engkel" && ["lowbed", "dolly"].includes(v.buntut), pesan: "Head Engkel jarang dipakai untuk lowbed atau dolly. Pastikan kombinasinya benar." },
  { jika: (v) => v.kepala === "head_engkel" && v.kelasBerat === "berat", pesan: "Head Engkel untuk cargo berat (di atas 25 ton) jarang dipakai." },
  { jika: (v) => v.muatan === "non_kontainer" && (!v.buntut || v.buntut === "rangka"), pesan: "Alat berat biasanya memakai flatbed, lowbed, atau dolly, bukan rangka kontainer." },
  { jika: (v) => v.muatan !== "non_kontainer" && ["lowbed", "dolly"].includes(v.buntut), pesan: "Kontainer biasanya memakai rangka atau flatbed. Lowbed dan dolly umumnya untuk alat berat." },
];
export const peringatanKombinasi = (v) => ATURAN_PERINGATAN.filter((a) => a.jika(v)).map((a) => a.pesan);

// Satuan yang relevan per lini (urutan = urutan tampil, yang pertama default).
// Kode memakai satuan_baku asli; kode yang tidak ada otomatis dilewati.
export const FORM_LINI = {
  trucking_trailer: { jenis: "trucking", satuan: ["per_trip", "per_kontainer", "per_unit"] },
  distribusi_kecil: { jenis: "distribusi", satuan: ["per_trip", "per_unit", "per_kontainer"] },
  depo: { jenis: "umum", lokasi: "pilih", satuan: ["per_kontainer", "per_hari", "per_bulan", "per_dokumen", "per_shift", "per_jam", "persen_dari_tarif_normal"] },
  warehouse_dry: { jenis: "umum", lokasi: "pilih", satuan: ["per_palet_position_per_hari", "per_revenue_ton", "per_revenue_ton_per_hari", "per_cbm_per_hari", "per_ton_per_hari", "per_m2_per_bulan", "per_kontainer", "per_jam"] },
  warehouse_frozen: { jenis: "umum", lokasi: "pilih", satuan: ["per_palet_position_per_hari", "per_revenue_ton", "per_revenue_ton_per_hari", "per_cbm_per_hari", "per_ton_per_hari", "per_kontainer", "per_jam"] },
  gudang_plb: { jenis: "umum", lokasi: false, satuan: ["per_kontainer", "per_dokumen", "per_revenue_ton", "per_revenue_ton_per_hari", "per_ton_per_hari", "per_ton_per_bulan", "per_jam", "per_m2_per_bulan"] },
  open_yard: { jenis: "umum", lokasi: "open_yard", satuan: ["per_m2_per_bulan", "per_bulan", "per_hari"] },
  sewa_container_empty: { jenis: "umum", lokasi: false, satuan: ["per_hari", "per_minggu", "per_bulan", "per_kontainer"] },
  customs_clearance: { jenis: "umum", lokasi: false, satuan: ["per_kontainer", "per_dokumen", "per_shipment", "per_set"] },
  sewa_unit: { jenis: "umum", lokasi: false, satuan: ["per_bulan", "per_hari"] },
  freight_forwarding: { jenis: "umum", lokasi: false, satuan: ["per_shipment", "per_kontainer", "per_revenue_ton", "per_kg"] },
};

export function konfigLini(id) {
  return FORM_LINI[id] || { jenis: "umum", lokasi: false, satuan: [] };
}

// Cocokkan teks yang diketik dengan daftar lokasi/zona terdaftar.
export function cocokkanLokasi(teks, daftar) {
  const t = String(teks || "").trim();
  if (!t) return null;
  const n = t.toLowerCase();
  const s = slug(t);
  const ada = daftar.find((d) => String(d.nama).trim().toLowerCase() === n || d.id === s || d.id === t);
  return ada ? { id: ada.id, nama: ada.nama, baru: false, provinsi: ada.provinsi || "" } : { id: s, nama: t, baru: true, provinsi: "" };
}

const labelDari = (daftar, kode) => (daftar.find(([k]) => k === kode) || [kode, kode])[1];
const zonaBaru = (z, provinsi) => ({ koleksi: "trucking_trailer_zona", id: z.id, data: { namaZona: z.nama, provinsi: String(provinsi || "").trim(), kecamatanCakupan: [], catatan: "" } });

// ---------- Trucking Trailer ----------
// v: {kategori, itemJenis, muatan, ukuran, kelasMuatan, kelasBerat, kepala, buntut,
//     terminal, zona, zonaProvinsi, asal, asalProvinsi, depoEmpty, tipeTitik, namaPaket}
export function bangunTrucking(v, zona) {
  const kat = KATEGORI_TRUCKING[v.kategori];
  const salah = [];
  if (!kat) return { salah: ["pilih kategori pengiriman"] };
  const dom = v.kategori === "domestik";
  const itemJenis = dom ? v.itemJenis || "utama" : "utama";
  const muatan = v.muatan === "non_kontainer" ? "non_kontainer" : "kontainer";
  const titik = itemJenis === "titik_tambahan";

  if (muatan === "kontainer" && !titik && !v.ukuran) salah.push("pilih ukuran kontainer");
  if (muatan === "non_kontainer" && !String(v.kelasMuatan || "").trim()) salah.push("isi kelas/dimensi unit alat berat");
  if (titik && !v.tipeTitik) salah.push("pilih jenis titik (pick up atau drop)");
  if (itemJenis === "proyekan" && !String(v.namaPaket || "").trim()) salah.push("isi nama paket proyekan");

  let z = null;
  let a = null;
  if (!titik) {
    z = cocokkanLokasi(v.zona, zona);
    if (!z) salah.push(`isi ${kat.label.zona.toLowerCase()}`);
    if (dom) {
      a = cocokkanLokasi(v.asal, zona);
      if (!a) salah.push(`isi ${kat.label.asal.toLowerCase()}`);
    }
  }
  if (salah.length) return { salah };

  const dimensi = { jenisPengiriman: v.kategori };
  if (titik) dimensi.tipeTitik = v.tipeTitik;
  else {
    dimensi.tujuan = z.id;
    if (dom) dimensi.asal = a.id;
  }
  if (itemJenis === "proyekan") dimensi.paket = slug(v.namaPaket);
  if (muatan === "kontainer") {
    if (v.ukuran) dimensi.ukuran = v.ukuran;
  } else {
    dimensi.muatan = "non_kontainer";
    dimensi.kelasMuatan = slug(v.kelasMuatan);
  }
  if (v.kelasBerat === "berat") dimensi.kelasBerat = "berat";
  if (v.kepala && v.kepala !== "semua") dimensi.kepala = v.kepala;
  if (v.buntut && v.buntut !== "rangka") dimensi.buntut = v.buntut;

  const term = String(v.terminal || "").trim();
  const terminLain = kat.terminal && term && slug(term) !== slug(TERMINAL_UTAMA);
  if (terminLain) dimensi.terminal = slug(term);
  const depo = String(v.depoEmpty || "").trim();
  if (depo && kat.depo) dimensi.depoEmpty = slug(depo);

  // nama layanan yang mudah dibaca
  const tambahan = [];
  if (dimensi.kelasBerat) tambahan.push("Cargo berat");
  if (dimensi.kepala) tambahan.push(labelDari(KEPALA, dimensi.kepala));
  if (dimensi.buntut) tambahan.push(labelDari(BUNTUT, dimensi.buntut));
  if (terminLain) tambahan.push(term);
  const akhiran = tambahan.length ? ` · ${tambahan.join(" · ")}` : "";
  const unit = muatan === "kontainer" ? (v.ukuran ? labelDari(UKURAN_KONTAINER, v.ukuran) : "") : `alat berat (${String(v.kelasMuatan).trim()})`;

  let layanan = "trucking_container";
  let layananNama;
  if (titik) {
    layanan = "trucking_titik_tambahan";
    layananNama = `Titik tambahan Domestik · ${v.tipeTitik === "pickup" ? "pick up" : "drop"}${unit ? ` · ${unit}` : ""}${akhiran}`;
  } else if (itemJenis === "proyekan") {
    layanan = "trucking_proyekan";
    layananNama = `Proyekan ${kat.nama}: ${String(v.namaPaket).trim()} (${dom ? `${a.nama} ke ${z.nama}` : z.nama})${akhiran}`;
  } else {
    layananNama = dom ? `Trucking Domestik ${unit} ${a.nama} ke ${z.nama}${akhiran}` : `Trucking ${kat.nama} ${unit} ${kat.arah} ${z.nama}${akhiran}`;
  }

  const lokasiBaru = [];
  if (z && z.baru) lokasiBaru.push(zonaBaru(z, v.zonaProvinsi));
  if (a && a.baru && (!z || a.id !== z.id)) lokasiBaru.push(zonaBaru(a, v.asalProvinsi));
  return {
    layanan,
    layananNama: layananNama.replace(/\s+/g, " ").trim(),
    dimensi,
    lokasiId: null,
    lokasiBaru,
    metodeSaran: itemJenis === "proyekan" ? "proyekan" : null,
    peringatan: peringatanKombinasi({ ...v, muatan }),
  };
}

// ---------- Distribusi Kendaraan Kecil ----------
// v: {asal, tujuan, kendaraan, body}
export function bangunDistribusi(v, lokasi) {
  const salah = [];
  const a = cocokkanLokasi(v.asal, lokasi);
  const t = cocokkanLokasi(v.tujuan, lokasi);
  if (!a) salah.push("isi titik pick up (asal)");
  if (!t) salah.push("isi tujuan");
  if (!v.kendaraan) salah.push("pilih jenis kendaraan");
  if (!v.body) salah.push("pilih body");
  if (salah.length) return { salah };
  if (a.id === t.id) return { salah: ["asal dan tujuan tidak boleh sama"] };

  const baru = [];
  if (a.baru) baru.push({ koleksi: "distribusi_kecil_lokasi", id: a.id, data: { namaLokasi: a.nama, provinsi: String(v.asalProvinsi || "").trim(), kecamatanCakupan: [], catatan: "" } });
  if (t.baru) baru.push({ koleksi: "distribusi_kecil_lokasi", id: t.id, data: { namaLokasi: t.nama, provinsi: String(v.tujuanProvinsi || "").trim(), kecamatanCakupan: [], catatan: "" } });
  return {
    layanan: "kirim_kendaraan",
    layananNama: `Kirim ${String(v.kendaraan).toUpperCase()} ${v.body} ${a.nama} ke ${t.nama}`,
    dimensi: { asal: a.id, tujuan: t.id, kendaraan: v.kendaraan, body: v.body },
    lokasiId: null,
    lokasiBaru: baru,
    peringatan: [],
  };
}

// ---------- Lini lain (umum) ----------
// v: {lokasi, nama, dimensi:{}}  ctx: {liniId, rows, openYard, vendorId}
export function bangunUmum(v, ctx) {
  const nama = String(v.nama || "").trim();
  if (!nama) return { salah: ["isi nama layanan"] };
  const cfg = konfigLini(ctx.liniId);
  let lokasiId = null;
  const lokasiBaru = [];
  if (cfg.lokasi === "pilih") {
    if (!v.lokasi) return { salah: ["pilih lokasi/fasilitas"] };
    lokasiId = v.lokasi;
  } else if (cfg.lokasi === "open_yard") {
    const l = cocokkanLokasi(v.lokasi, ctx.openYard || []);
    if (!l) return { salah: ["isi atau pilih lokasi open yard"] };
    lokasiId = l.id;
    if (l.baru) lokasiBaru.push({ koleksi: "open_yard_lokasi", id: l.id, data: { namaLokasi: l.nama, alamat: "", luasTotalM2: null, luasTersedia: 0, fasilitas: {}, aksesJalan: "", fotoUrls: [], status: "draf", catatan: "Dibuat dari form tarif. Lengkapi alamat, luas, fasilitas, koordinat, dan foto di tab Lokasi.", vendorId: ctx.vendorId || "belum_ditentukan" } });
  }
  const sama = ctx.rows.find((r) => r.liniBisnisId === ctx.liniId && String(r.layananNama || "").trim().toLowerCase() === nama.toLowerCase());
  return {
    layanan: sama ? sama.layanan : slug(nama),
    layananNama: sama ? sama.layananNama : nama,
    dimensi: v.dimensi || {},
    lokasiId,
    lokasiBaru,
    peringatan: [],
  };
}

export function bangunItem(liniId, v, ref) {
  const cfg = konfigLini(liniId);
  if (cfg.jenis === "trucking") return bangunTrucking(v, ref.zona);
  if (cfg.jenis === "distribusi") return bangunDistribusi(v, ref.lokasiDistribusi);
  return bangunUmum(v, { liniId, rows: ref.rows, openYard: ref.openYard, vendorId: ref.vendorId });
}

// Urutan satuan untuk dropdown: yang relevan dulu, lalu sisanya.
export function susunSatuan(liniId, semua) {
  const cfg = konfigLini(liniId);
  const ada = new Map(semua.map((s) => [s.kode || s.id, s]));
  const utama = (cfg.satuan || []).filter((k) => ada.has(k)).map((k) => ada.get(k));
  const lain = semua.filter((s) => !utama.includes(s));
  return { utama, lain, bawaan: utama[0] ? utama[0].kode || utama[0].id : "" };
}

export { rapikanNama };
