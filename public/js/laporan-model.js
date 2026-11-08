// ===========================================================
// LAPORAN MODEL — menyusun isi laporan (komparasi antar vendor,
// satu vendor, data mentah) dari data tarif + riwayat. Logika murni:
// tidak menyentuh DOM atau Firebase, jadi bisa diuji dan dipakai
// ulang untuk tampilan pratinjau, PDF, maupun Excel.
// Aturan: tarif yang belum diisi (modal kosong) TIDAK dicantumkan.
// ===========================================================
import { identitasTanpaVendor } from "./tampilan-data.js";

const adaModal = (r) => r.aktif !== false && typeof r.modal === "number";

// Perubahan modal terakhir per kunci dalam rentang tanggal.
export function perubahanModal(riwayat, kunciSet, sejak) {
  const batas = sejak ? new Date(sejak).getTime() : -Infinity;
  const hasil = [];
  for (const r of riwayat || []) {
    if (!kunciSet.has(r.kunci)) continue;
    const t = new Date(r.tanggal).getTime();
    if (!(t >= batas)) continue;
    const p = (r.perubahan || []).find((x) => x.field === "modal");
    if (!p || p.lama === p.baru) continue;
    hasil.push({ kunci: r.kunci, lama: p.lama, baru: p.baru, tanggal: r.tanggal, jenis: r.jenis });
  }
  return hasil.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
}

const persen = (lama, baru) => (typeof lama === "number" && typeof baru === "number" && lama !== 0 ? Math.round(((baru - lama) / Math.abs(lama)) * 1000) / 10 : null);

export function susunKomparasi({ rows, riwayat, liniId, vendorIds, sejak, namaVendor, namaLini, vendorList }) {
  const dipakai = rows.filter((r) => r.liniBisnisId === liniId && vendorIds.includes(r.vendorId) && adaModal(r));
  const peta = new Map();
  for (const r of dipakai) {
    const id = identitasTanpaVendor(r);
    if (!peta.has(id)) peta.set(id, { id, label: r.layananNama || r.layanan, satuan: r.satuanKode, lokasiId: r.lokasiId, sel: {} });
    peta.get(id).sel[r.vendorId] = r.modal;
  }
  const vendorAda = vendorIds.filter((id) => dipakai.some((r) => r.vendorId === id));
  const kolom = vendorAda.map((id) => ({ id, nama: namaVendor(id), vendor: (vendorList || []).find((v) => v.id === id) }));
  const baris = [...peta.values()]
    .map((b) => {
      const nilai = vendorAda.filter((v) => typeof b.sel[v] === "number");
      const min = nilai.length > 1 ? Math.min(...nilai.map((v) => b.sel[v])) : null;
      return { ...b, terendah: min === null ? [] : nilai.filter((v) => b.sel[v] === min) };
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label), "id"));
  const kunciSet = new Set(dipakai.map((r) => r.kunci));
  const perubahan = perubahanModal(riwayat, kunciSet, sejak).map((p) => {
    const r = dipakai.find((x) => x.kunci === p.kunci);
    return { ...p, layanan: r.layananNama || r.layanan, vendorId: r.vendorId, vendorNama: namaVendor(r.vendorId), pct: persen(p.lama, p.baru) };
  });
  return {
    jenis: "komparasi",
    judul: `Laporan tarif vendor: ${namaLini(liniId)}`,
    liniId,
    kolom,
    baris,
    perubahan,
    sejak: sejak || null,
    ringkasan: { item: baris.length, vendor: kolom.length, berubah: perubahan.length },
  };
}

export function susunSatuVendor({ rows, riwayat, vendorId, liniIds, sejak, namaVendor, namaLini, vendorList, hariTerakhir = 30 }) {
  const dipakai = rows.filter((r) => r.vendorId === vendorId && adaModal(r) && (!liniIds || !liniIds.length || liniIds.includes(r.liniBisnisId)));
  const kunciSet = new Set(dipakai.map((r) => r.kunci));
  const semuaPerubahan = perubahanModal(riwayat, kunciSet, sejak);
  const terakhir = new Map();
  for (const p of semuaPerubahan) if (!terakhir.has(p.kunci)) terakhir.set(p.kunci, p);
  const batas30 = Date.now() - hariTerakhir * 86400000;
  const berubah30 = new Set(perubahanModal(riwayat, kunciSet, new Date(batas30).toISOString()).map((p) => p.kunci)).size;

  const perLini = new Map();
  for (const r of dipakai) {
    if (!perLini.has(r.liniBisnisId)) perLini.set(r.liniBisnisId, []);
    const t = terakhir.get(r.kunci);
    perLini.get(r.liniBisnisId).push({
      kunci: r.kunci,
      layanan: r.layananNama || r.layanan,
      lokasiId: r.lokasiId,
      satuan: r.satuanKode,
      modal: r.modal,
      mataUang: r.mataUang || "IDR",
      metode: r.metodeHarga,
      diperbarui: r.diperbaruiPada || null,
      arah: t ? (t.baru > t.lama ? "naik" : "turun") : null,
    });
  }
  const kelompok = [...perLini.entries()].map(([liniId, item]) => ({ liniId, nama: namaLini(liniId), item: item.sort((a, b) => String(a.layanan).localeCompare(String(b.layanan), "id")) }));
  const v = (vendorList || []).find((x) => x.id === vendorId) || {};
  return {
    jenis: "satu_vendor",
    judul: `Daftar tarif vendor: ${namaVendor(vendorId)}`,
    vendorId,
    vendor: v,
    kelompok,
    sejak: sejak || null,
    ringkasan: { lini: kelompok.length, layanan: dipakai.length, berubah30 },
  };
}

// Data mentah untuk Excel: satu baris per tarif, tanpa format.
export function susunMentah({ rows, vendorIds, liniIds, namaVendor, namaLini, satuanNama }) {
  return rows
    .filter((r) => adaModal(r) && (!vendorIds || !vendorIds.length || vendorIds.includes(r.vendorId)) && (!liniIds || !liniIds.length || liniIds.includes(r.liniBisnisId)))
    .map((r) => ({
      "Lini Bisnis": namaLini(r.liniBisnisId),
      Vendor: namaVendor(r.vendorId),
      Lokasi: r.lokasiId || "",
      Layanan: r.layananNama || r.layanan,
      Satuan: satuanNama(r.satuanKode),
      Modal: r.modal,
      "Mata Uang": r.mataUang || "IDR",
      "Metode Harga": r.metodeHarga || "tetap",
      Diperbarui: r.diperbaruiPada ? String(r.diperbaruiPada).slice(0, 10) : "",
    }));
}

// Laporan master: semua tarif, dikelompokkan per lini bisnis lalu per vendor.
// Berisi ringkasan dan identitas vendor (untuk halaman pertama PDF).
export function susunMaster({ rows, vendorList, namaVendor, namaLini, namaSatuan }) {
  const perLini = new Map();
  for (const r of rows) {
    const lini = r.liniBisnisId || "";
    if (!perLini.has(lini)) perLini.set(lini, new Map());
    const perVendor = perLini.get(lini);
    if (!perVendor.has(r.vendorId)) perVendor.set(r.vendorId, []);
    perVendor.get(r.vendorId).push({
      layanan: r.layananNama || r.layanan,
      lokasi: r.lokasiId || "",
      satuan: namaSatuan(r.satuanKode),
      modal: typeof r.modal === "number" ? r.modal : null,
      mataUang: r.mataUang || "IDR",
      metode: r.metodeHarga || "tetap",
      status: r.aktif !== false ? "Aktif" : "Nonaktif",
      diperbarui: r.diperbaruiPada ? String(r.diperbaruiPada).slice(0, 10) : "",
    });
  }
  const urutLini = [...perLini.keys()].sort((a, b) => (a === "") - (b === "") || String(namaLini(a)).localeCompare(String(namaLini(b)), "id"));
  const kelompok = urutLini.map((lini) => {
    const perVendor = perLini.get(lini);
    const vendor = [...perVendor.entries()]
      .map(([vid, item]) => ({ vendorId: vid, nama: namaVendor(vid), item: item.sort((a, b) => String(a.layanan).localeCompare(String(b.layanan), "id")) }))
      .sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
    return { liniId: lini, nama: lini ? namaLini(lini) : "Belum diatur", vendor, jumlah: vendor.reduce((n, v) => n + v.item.length, 0) };
  });
  const identitas = [...new Set(rows.map((r) => r.vendorId))].map((id) => {
    const v = (vendorList || []).find((x) => x.id === id) || {};
    return { nama: v.nama || namaVendor(id), namaLengkap: v.namaLengkap || "", terminBayar: v.terminBayar || "", kontak: v.kontak || "", lini: (v.liniBisnis || []).map((l) => namaLini(l)).join(", ") };
  }).sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
  const baris = kelompok.flatMap((k) => k.vendor.flatMap((v) => v.item.map((i) => ({
    "Lini Bisnis": k.nama,
    Vendor: v.nama,
    Layanan: i.layanan,
    Lokasi: i.lokasi,
    Satuan: i.satuan,
    Modal: i.modal ?? "",
    "Mata Uang": i.mataUang,
    "Metode Harga": i.metode,
    Status: i.status,
    Diperbarui: i.diperbarui,
  }))));
  return {
    jenis: "master",
    judul: "Laporan master tarif",
    kelompok,
    identitas,
    baris,
    ringkasan: {
      tarif: rows.length,
      vendor: identitas.length,
      lini: kelompok.filter((k) => k.liniId).length,
      belumModal: rows.filter((r) => typeof r.modal !== "number").length,
      belumLini: rows.filter((r) => !r.liniBisnisId).length,
    },
  };
}
