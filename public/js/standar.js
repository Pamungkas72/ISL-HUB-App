// ===========================================================
// STANDAR — data bawaan sistem yang bisa didaftarkan dengan satu klik
// kalau belum ada di database: lini bisnis standar, satuan standar,
// dan kerangka tarif (daftar komponen) untuk lini tertentu.
// Mau menambah lini/satuan/kerangka baru? Cukup edit file ini.
// ===========================================================

// Urutan tampil lini bisnis (lini yang tidak tercantum di sini tampil setelahnya, urut nama).
export const URUTAN_LINI = ["depo", "warehouse_dry", "warehouse_frozen", "gudang_plb", "open_yard", "trucking_trailer", "distribusi_kecil", "customs_clearance", "sewa_container_empty", "sewa_unit", "freight_forwarding"];

// Pengelompokan lini di pemilih lini (tab Tarif). Lini yang tidak tercantum di sini
// otomatis masuk kelompok "Lainnya", jadi lini baru tetap muncul tanpa edit file ini.
export const KELOMPOK_LINI = [
  { judul: "Penyimpanan", ids: ["depo", "warehouse_dry", "warehouse_frozen", "gudang_plb", "open_yard"] },
  { judul: "Transportasi", ids: ["trucking_trailer", "distribusi_kecil"] },
  { judul: "Jasa dan sewa", ids: ["customs_clearance", "freight_forwarding", "sewa_container_empty", "sewa_unit"] },
];

export const STANDAR_LINI = [
  { id: "gudang_plb", nama: "Gudang PLB", kategori: "harga_tetap", butuhKontrak: false, aktif: true, deskripsi: "Pusat Logistik Berikat milik perusahaan PLB mitra. ISL berstatus PD PLB dengan sebagian space di sana. Tarif mitra = harga beli (modal), dijual lagi dengan markup." },
];

// Revenue ton = yang lebih besar antara berat (ton) dan volume (m3). Dipakai di tarif gudang
// (storage, handling) dan freight forwarding, dan menjadi acuan daftar tagihan.
export const STANDAR_SATUAN = [
  { kode: "per_titik", nama: "per titik" },
  { kode: "per_revenue_ton", nama: "per revenue ton" },
  { kode: "per_revenue_ton_per_hari", nama: "per revenue ton per hari" },
];

// Kerangka tarif: komponen yang dibuatkan barisnya (modal kosong) untuk satu vendor.
// [layanan, nama layanan, satuan, dimensi, catatan]
export const KERANGKA = {
  gudang_plb: [
    ["bc_16", "BC 1.6 (per dokumen, per BL)", "per_dokumen", {}, "Dihitung per nomor BL, bukan per kontainer."],
    ["bc_27", "BC 2.7 (per dokumen, per BL)", "per_dokumen", {}, "Dihitung per nomor BL, bukan per kontainer."],
    ["lolo", "LOLO 20ft", "per_kontainer", { ukuran: "20ft" }, ""],
    ["lolo", "LOLO 40ft", "per_kontainer", { ukuran: "40ft" }, ""],
    ["handling_in_gudang", "Handling in gudang", "per_revenue_ton", {}, "Basis: revenue ton (yang lebih besar antara berat dan volume)."],
    ["handling_out_gudang", "Handling out gudang", "per_revenue_ton", {}, "Basis: revenue ton (yang lebih besar antara berat dan volume)."],
    ["storage_harian", "Storage harian", "per_revenue_ton_per_hari", {}, "Basis: revenue ton (yang lebih besar antara berat dan volume)."],
    ["storage_bulanan", "Storage bulanan (lebih dari 30 hari)", "per_ton_per_bulan", {}, "Dibulatkan ke atas per kelipatan 30 hari."],
    ["overtime", "Overtime hari kerja", "per_jam", { hari: "weekday" }, ""],
    ["overtime", "Overtime akhir pekan / libur", "per_jam", { hari: "weekend" }, ""],
    ["eseal", "E-Seal", "per_kontainer", {}, ""],
    ["handling_pelabuhan", "Handling container pelabuhan 20ft, kontainer pertama", "per_kontainer", { ukuran: "20ft", urutan: "pertama" }, "Bertingkat per ukuran dalam satu No BL."],
    ["handling_pelabuhan", "Handling container pelabuhan 20ft, kontainer berikutnya", "per_kontainer", { ukuran: "20ft", urutan: "berikutnya" }, ""],
    ["handling_pelabuhan", "Handling container pelabuhan 40ft, kontainer pertama", "per_kontainer", { ukuran: "40ft", urutan: "pertama" }, ""],
    ["handling_pelabuhan", "Handling container pelabuhan 40ft, kontainer berikutnya", "per_kontainer", { ukuran: "40ft", urutan: "berikutnya" }, ""],
    ["sewa_dedicated", "Sewa dedicated per m2", "per_m2_per_bulan", {}, "Minimal luas dedicated 2.500 m2 untuk proyek tertentu."],
  ],
};
