// ===========================================================
// TAMPILAN DATA — logika murni untuk menyusun tabel tarif:
// vendor yang relevan per lini, pengelompokan, dan matriks
// perbandingan antar vendor. Tidak menyentuh Firebase maupun DOM.
// ===========================================================
import { buatKunci, rapikanNama } from "./kunci.js";

// Vendor yang boleh tampil untuk satu lini bisnis:
//  - terdaftar melayani lini itu, ATAU sudah punya tarif di lini itu,
//  - ATAU vendor penampung tanpa lini (mis. "Belum ditentukan").
// Vendor milik lini lain TIDAK ditampilkan.
export function vendorUntukLini(vendors, rows, liniId) {
  const punyaTarif = new Set(rows.filter((t) => t.liniBisnisId === liniId).map((t) => t.vendorId));
  return vendors.filter((v) => v.aktif !== false && ((v.liniBisnis || []).includes(liniId) || punyaTarif.has(v.id) || !(v.liniBisnis || []).length));
}

// Identitas baris TANPA vendor: dipakai untuk menyejajarkan vendor dalam satu baris.
// Lokasi milik vendor dilepas dari nama vendornya: lokasi depo "hlc" (= id vendor) dan
// "hlc_indoor_frozen_chiller" menjadi "" dan "indoor_frozen_chiller", jadi sejajar dengan vendor lain.
function lokasiTanpaVendor(r) {
  if (!r.lokasiId) return null;
  if (r.lokasiId === r.vendorId) return null;
  const awalan = `${r.vendorId}_`;
  return String(r.lokasiId).startsWith(awalan) ? String(r.lokasiId).slice(awalan.length) : r.lokasiId;
}

export function identitasTanpaVendor(r) {
  return buatKunci(r.liniBisnisId, "x", lokasiTanpaVendor(r), r.layanan, r.dimensi, r.satuanKode, r.customerId);
}

const LINI_GRUP_TUJUAN = ["trucking_trailer", "distribusi_kecil"];

// Kelompok: trucking & distribusi per tujuan (zona/kota), lini lain per jenis layanan.
export function kunciKelompok(r) {
  return `n:${r.liniBisnisId}`; // satu kelompok per lini bisnis
}

export function labelKelompok(r, namaDim, namaLini) {
  return namaLini ? namaLini(r.liniBisnisId) : String(r.liniBisnisId || "").replace(/_/g, " ");
}

export function kelompokkan(rows, namaDim, namaLini) {
  const peta = new Map();
  for (const r of rows) {
    const k = kunciKelompok(r);
    if (!peta.has(k)) peta.set(k, { kunci: k, label: labelKelompok(r, namaDim, namaLini), rows: [] });
    peta.get(k).rows.push(r);
  }
  return [...peta.values()];
}

// Matriks: baris = layanan+dimensi+satuan, kolom = vendor.
export function susunMatriks(rows, vendors) {
  const peta = new Map();
  const vendorAda = new Set();
  for (const r of rows) {
    const id = identitasTanpaVendor(r);
    if (!peta.has(id)) peta.set(id, { id, label: r.layananNama || r.layanan, satuan: r.satuanKode, lokasiId: r.lokasiId, sel: {} });
    peta.get(id).sel[r.vendorId] = r;
    vendorAda.add(r.vendorId);
  }
  const kolom = vendors.filter((v) => vendorAda.has(v.id));
  const baris = [...peta.values()].map((b) => {
    const nilai = kolom.map((v) => b.sel[v.id]).filter((x) => x && typeof x.modal === "number");
    let terendah = null;
    if (nilai.length > 1) {
      const min = Math.min(...nilai.map((x) => x.modal));
      terendah = nilai.filter((x) => x.modal === min).map((x) => x.vendorId);
    }
    return { ...b, terendah: terendah || [] };
  });
  return { kolom, baris };
}
