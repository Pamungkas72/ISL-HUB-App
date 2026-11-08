// ===========================================================
// SATUAN BAKU — logika data satuan (tambah, ubah nama, hapus dengan pindah tarif).
// Dipakai dari Quotation > Pengaturan dokumen. Hanya lewat db.js, seperti halaman lain.
// Daftar dan tarif yang diberikan dimutasi di tempat, jadi tampilan yang memegangnya ikut berubah.
// ===========================================================
import * as DB from "./db.js";
import { resolveSatuan } from "./satuan-combo.js";

export async function tambahSatuan(teks, daftar, oleh) {
  const sat = resolveSatuan(teks || "", daftar);
  if (sat.kosong) throw new Error("Isi nama satuan dulu.");
  if (!sat.baru) throw new Error(`Satuan “${sat.nama}” sudah ada.`);
  await DB.buatJikaBelumAda("satuan_baku", sat.kode, { kode: sat.kode, nama: sat.nama }, { oleh });
  daftar.push({ id: sat.kode, kode: sat.kode, nama: sat.nama });
  return sat;
}

export async function ubahNamaSatuan(kode, teks, daftar, oleh) {
  const nama = String(teks || "").trim().replace(/\s+/g, " ");
  if (!nama) throw new Error("Nama satuan tidak boleh kosong.");
  if (daftar.some((x) => (x.kode || x.id) !== kode && String(x.nama).trim().toLowerCase() === nama.toLowerCase())) throw new Error(`Sudah ada satuan bernama “${nama}”.`);
  await DB.ubahSatuan(kode, nama, { oleh });
  const x = daftar.find((y) => (y.kode || y.id) === kode);
  if (x) x.nama = nama;
}

// Satuan yang masih dipakai tarif: tarifnya dipindah ke pindahKe dulu, baru satuannya dihapus.
export async function hapusSatuan(kode, { daftar, tarif, pindahKe, oleh }) {
  const pakai = tarif.filter((t) => t.satuanKode === kode);
  if (pakai.length) {
    if (!pindahKe) throw new Error("Pilih satuan pengganti dulu.");
    const items = pakai.map((t) => ({ jenis: "ubah", kunci: t.kunci, perubahan: [{ field: "satuanKode", lama: kode, baru: pindahKe }], liniBisnisId: t.liniBisnisId, vendorId: t.vendorId }));
    const h = await DB.terapkanBanyak(items, { oleh, sumber: "hapus-satuan" });
    const sudah = new Set(h.berhasil);
    tarif.forEach((t) => { if (sudah.has(t.kunci)) t.satuanKode = pindahKe; });
    if (h.gagal.length) throw new Error(`${h.gagal.length} tarif gagal dipindah. Satuan belum dihapus, coba lagi.`);
  }
  await DB.hapusSatuan(kode);
  const i = daftar.findIndex((x) => (x.kode || x.id) === kode);
  if (i >= 0) daftar.splice(i, 1);
  return pakai.length;
}
