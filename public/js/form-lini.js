// ===========================================================
// FORM LINI — aturan form "Tambah tarif" yang seragam untuk semua lini.
// Satu bentuk isian; yang beda per lini hanya: satuan yang diutamakan,
// jenis lokasi (fasilitas vs rute asal/tujuan), dan apakah lokasi wajib.
// Dimensi tarif rute: {asal, tujuan} (id zona/lokasi), sama dengan data lama,
// supaya quotation tetap mencocokkan tarif Distribusi lewat tujuan.
// ===========================================================
import { slug, rapikanNama } from "./kunci.js";

// jenis "rute" = lokasi berupa asal/tujuan; "umum" = lokasi berupa fasilitas (wajib bila lokasi: pilih/open_yard)
export const FORM_LINI = {
  trucking_trailer: { jenis: "rute", koleksi: "trucking_trailer_zona", satuan: ["per_trip", "per_kontainer", "per_unit"] },
  distribusi_kecil: { jenis: "rute", koleksi: "distribusi_kecil_lokasi", satuan: ["per_trip", "per_unit", "per_kontainer"] },
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

// Vendor tetap untuk tarif internal (dibuat otomatis saat pertama dipakai).
export const VENDOR_INTERNAL = { id: "isl_internal", nama: "ISL Internal" };

// Markup lini (%) untuk saran harga jual; sama dengan batas harga aman di db-firebase.js.
export const markupLini = (liniId, lini) => {
  const t = (lini || []).find((l) => l.id === liniId);
  const v = t && t.targetMargin;
  return v === undefined || v === null || v === "" ? (liniId === "depo" ? 20 : 15) : Number(v) || 0;
};
export const saranJual = (modal, pct) => (modal > 0 ? Math.ceil((modal * (1 + pct / 100)) / 1000) * 1000 : null);

// Cocokkan teks yang diketik dengan daftar lokasi/zona terdaftar.
export function cocokkanLokasi(teks, daftar) {
  const t = String(teks || "").trim();
  if (!t) return null;
  const n = t.toLowerCase();
  const s = slug(t);
  const ada = daftar.find((d) => String(d.nama).trim().toLowerCase() === n || d.id === s || d.id === t);
  return ada ? { id: ada.id, nama: ada.nama, baru: false, provinsi: ada.provinsi || "" } : { id: s, nama: t, baru: true, provinsi: "" };
}

const lokasiRuteBaru = (koleksi, l, provinsi) => ({ koleksi, id: l.id, data: koleksi === "trucking_trailer_zona" ? { namaZona: l.nama, provinsi: String(provinsi || "").trim(), kecamatanCakupan: [], catatan: "" } : { namaLokasi: l.nama, provinsi: String(provinsi || "").trim(), kecamatanCakupan: [], catatan: "" } });

// v: {nama, lokasi, asal, tujuan, asalProvinsi, tujuanProvinsi}   ref: {zona, lokasiDistribusi, openYard, rows, vendorId}
export function bangunItem(liniId, v, ref) {
  const cfg = konfigLini(liniId);
  const nama = String(v.nama || "").trim();
  const salah = [];
  if (!nama) salah.push("isi nama layanan");
  let lokasiId = null;
  const lokasiBaru = [];
  const dimensi = {};

  if (cfg.jenis === "rute") {
    const daftar = cfg.koleksi === "trucking_trailer_zona" ? ref.zona : ref.lokasiDistribusi;
    const t = cocokkanLokasi(v.tujuan, daftar);
    const a = cocokkanLokasi(v.asal, daftar);
    if (!t) salah.push("isi tujuan");
    else if (a && a.id === t.id) salah.push("asal dan tujuan tidak boleh sama");
    if (t) dimensi.tujuan = t.id;
    if (a) dimensi.asal = a.id;
    if (t && t.baru) lokasiBaru.push(lokasiRuteBaru(cfg.koleksi, t, v.tujuanProvinsi));
    if (a && a.baru && (!t || a.id !== t.id)) lokasiBaru.push(lokasiRuteBaru(cfg.koleksi, a, v.asalProvinsi));
  } else if (cfg.lokasi === "open_yard") {
    const l = cocokkanLokasi(v.lokasi, ref.openYard || []);
    if (!l) salah.push("isi atau pilih lokasi open yard");
    else {
      lokasiId = l.id;
      if (l.baru) lokasiBaru.push({ koleksi: "open_yard_lokasi", id: l.id, data: { namaLokasi: l.nama, alamat: "", luasTotalM2: null, luasTersedia: 0, fasilitas: {}, aksesJalan: "", fotoUrls: [], status: "draf", catatan: "Dibuat dari form tarif. Lengkapi alamat, luas, fasilitas, koordinat, dan foto di tab Lokasi.", vendorId: ref.vendorId || "belum_ditentukan" } });
    }
  } else if (v.lokasi) lokasiId = v.lokasi;
  else if (cfg.lokasi === "pilih") salah.push("pilih lokasi/fasilitas");

  if (salah.length) return { salah };
  const sama = ref.rows.find((r) => r.liniBisnisId === liniId && String(r.layananNama || "").trim().toLowerCase() === nama.toLowerCase());
  return { layanan: sama ? sama.layanan : slug(nama), layananNama: sama ? sama.layananNama : nama, dimensi, lokasiId, lokasiBaru, peringatan: [] };
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
