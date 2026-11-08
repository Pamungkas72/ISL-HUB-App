// ===========================================================
// EXCEL — ekspor tarif, baca file, dan SUSUN RENCANA import.
// Tidak menyentuh database. Rencana ditampilkan sebagai pratinjau;
// baru disimpan kalau Ega menekan tombol konfirmasi.
//
// Format file = format hasil Ekspor dari halaman ini:
//   Kunci | Lini Bisnis | Vendor | Lokasi | Layanan | Nama Layanan |
//   Dimensi | Satuan | Modal (Rupiah) | Metode Harga | Aktif | Catatan
// Aturan:
//  - Baris dengan Kunci terisi -> diperbarui. Hanya Modal, Metode Harga,
//    Aktif, Catatan yang dibaca; kolom lain diabaikan. Semua tarif dalam Rupiah.
//  - Baris tanpa Kunci -> baris baru (kuncinya dibuat otomatis). Kalau
//    kuncinya ternyata sudah ada, dianggap baris yang sama (bukan dobel).
//  - Sel kosong = tidak diubah. Angka 0 = gratis. Negatif = potongan.
// ===========================================================
import { buatKunci, parseAngka, bedaField, perubahanBesar, teksKeDimensi, dimensiKeTeks, rapikanNama, METODE_HARGA, slug } from "./kunci.js";

const KOLOM = ["Kunci", "Lini Bisnis", "Vendor", "Lokasi", "Layanan", "Nama Layanan", "Dimensi", "Satuan", "Modal", "Metode Harga", "Aktif", "Catatan"];

function xlsx() {
  if (!window.XLSX) throw new Error("Pustaka Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
  return window.XLSX;
}

export function eksporTarif(rows, { namaLini, namaVendor, namaSatuan }, namaFile) {
  const X = xlsx();
  const data = rows.map((r) => ({
    Kunci: r.kunci,
    "Lini Bisnis": namaLini(r.liniBisnisId),
    Vendor: namaVendor(r.vendorId),
    Lokasi: r.lokasiId || "",
    Layanan: r.layanan,
    "Nama Layanan": r.layananNama || "",
    Dimensi: dimensiKeTeks(r.dimensi),
    Satuan: namaSatuan(r.satuanKode),
    Modal: r.modal === null || r.modal === undefined ? "" : r.modal,
    "Metode Harga": r.metodeHarga || "tetap",
    Aktif: r.aktif === false ? "tidak" : "ya",
    Catatan: r.catatan || "",
  }));
  const ws = X.utils.json_to_sheet(data, { header: KOLOM });
  ws["!cols"] = [{ wch: 44 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 30 }];
  const petunjuk = X.utils.aoa_to_sheet([
    ["Cara memakai file ini"],
    ["1. Ubah kolom Modal (dalam Rupiah; juga Metode Harga, Aktif, Catatan) pada baris yang ada. Jangan ubah kolom Kunci."],
    ["2. Untuk item baru: tambah baris di bawah, KOSONGKAN kolom Kunci, isi Lini Bisnis, Vendor, Layanan, Satuan (Dimensi/Lokasi/Nama Layanan opsional)."],
    ["3. Sel kosong = tidak diubah. Angka 0 = gratis. Negatif = potongan."],
    ["4. Vendor harus sudah terdaftar di tab Vendor. Hasil impor selalu ditampilkan sebagai pratinjau dulu sebelum disimpan."],
  ]);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Tarif");
  X.utils.book_append_sheet(wb, petunjuk, "Petunjuk");
  X.writeFile(wb, namaFile);
}

export async function bacaFile(file) {
  const X = xlsx();
  const buf = await file.arrayBuffer();
  const wb = X.read(buf, { type: "array" });
  const nama = wb.SheetNames.includes("Tarif") ? "Tarif" : wb.SheetNames[0];
  const baris = X.utils.sheet_to_json(wb.Sheets[nama], { defval: "", raw: true });
  return baris.map((r) => {
    const out = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim().toLowerCase()] = typeof v === "string" ? v.trim() : v;
    return out;
  });
}

const teks = (v) => (v === undefined || v === null || v === "" ? undefined : String(v).trim());

function cari(daftar, nilai, ambil) {
  const n = String(nilai).trim().toLowerCase();
  const s = slug(nilai);
  return daftar.find((d) => ambil(d).some((x) => String(x).toLowerCase() === n || slug(x) === s));
}

function parseYaTidak(v) {
  if (v === "" || v === undefined || v === null) return { ok: true, val: undefined };
  const s = String(v).trim().toLowerCase();
  if (["ya", "y", "true", "1", "aktif"].includes(s)) return { ok: true, val: true };
  if (["tidak", "t", "no", "false", "0", "nonaktif"].includes(s)) return { ok: true, val: false };
  return { ok: false };
}

// referensi: {tarifMap: Map(kunci -> baris), vendor[], lini[], satuan[]}
export function buatRencana(barisExcel, ref) {
  const rencana = [];
  const terlihat = new Map(); // kunci -> nomor baris pertama

  barisExcel.forEach((r, idx) => {
    const no = idx + 2; // baris 1 = judul kolom
    const item = { no, status: "error", kunci: null, ringkas: "", perubahan: [], besar: false, alasan: "" };
    const kosongSemua = Object.values(r).every((v) => v === "" || v === undefined);
    if (kosongSemua) return;

    // --- isian yang boleh diubah ---
    const errs = [];
    const modal = parseAngka(r["modal"]);
    if (!modal.ok) errs.push(`Modal "${r["modal"]}" bukan angka`);
    const aktif = parseYaTidak(r["aktif"]);
    if (!aktif.ok) errs.push(`Aktif "${r["aktif"]}" harus ya/tidak`);
    let metode = teks(r["metode harga"]);
    if (metode) {
      const m = METODE_HARGA.find((x) => x.v === slug(metode) || x.t.toLowerCase() === metode.toLowerCase());
      if (!m) errs.push(`Metode Harga "${metode}" tidak dikenal`);
      else metode = m.v;
    }
    const isian = {
      modal: modal.ok ? modal.val : undefined,
      mataUang: undefined, // Master Rate hanya Rupiah; kolom Mata Uang di file lama diabaikan
      metodeHarga: metode,
      aktif: aktif.ok ? aktif.val : undefined,
      catatan: teks(r["catatan"]),
    };

    // --- tentukan baris mana yang dimaksud ---
    let kunci = teks(r["kunci"]);
    let lama = null;
    let barisBaru = null;

    if (kunci) {
      lama = ref.tarifMap.get(kunci);
      if (!lama) errs.push("Kunci tidak dikenal. Untuk baris baru, kosongkan kolom Kunci.");
    } else {
      const lini = teks(r["lini bisnis"]) && cari(ref.lini, r["lini bisnis"], (d) => [d.id, d.nama]);
      const vendor = teks(r["vendor"]) && cari(ref.vendor, r["vendor"], (d) => [d.id, d.nama]);
      const satuan = teks(r["satuan"]) && cari(ref.satuan, r["satuan"], (d) => [d.kode || d.id, d.nama]);
      const layanan = teks(r["layanan"]);
      if (!teks(r["lini bisnis"])) errs.push("Lini Bisnis kosong");
      else if (!lini) errs.push(`Lini Bisnis "${r["lini bisnis"]}" tidak terdaftar`);
      if (!teks(r["vendor"])) errs.push("Vendor kosong");
      else if (!vendor) errs.push(`Vendor "${r["vendor"]}" belum terdaftar (tambahkan di tab Vendor dulu)`);
      if (!layanan) errs.push("Layanan kosong");
      if (!teks(r["satuan"])) errs.push("Satuan kosong");
      else if (!satuan) errs.push(`Satuan "${r["satuan"]}" tidak ada di daftar satuan baku`);
      if (!errs.length) {
        const dimensi = teksKeDimensi(r["dimensi"]);
        const lokasi = teks(r["lokasi"]) || null;
        kunci = buatKunci(lini.id, vendor.id, lokasi, layanan, dimensi, satuan.kode || satuan.id, null);
        lama = ref.tarifMap.get(kunci) || null;
        if (!lama) {
          barisBaru = {
            liniBisnisId: lini.id,
            vendorId: vendor.id,
            lokasiId: lokasi,
            layanan: slug(layanan),
            layananNama: teks(r["nama layanan"]) || rapikanNama(slug(layanan)),
            dimensi,
            satuanKode: satuan.kode || satuan.id,
            mataUang: "IDR",
            modal: isian.modal === undefined ? null : isian.modal,
            metodeHarga: isian.metodeHarga || "tetap",
            hargaJualReferensi: null,
            referensiSumber: null,
            customerId: null,
            berlakuDari: null,
            berlakuSampai: null,
            aktif: isian.aktif === undefined ? true : isian.aktif,
            catatan: isian.catatan || "",
          };
        }
      }
    }

    item.kunci = kunci || null;
    if (errs.length) {
      item.alasan = errs.join("; ");
      rencana.push(item);
      return;
    }

    // --- duplikat di dalam file ---
    if (terlihat.has(kunci)) {
      item.status = "kembar";
      item.alasan = `Kunci sama dengan baris ${terlihat.get(kunci)} di file ini`;
      item.ringkas = (lama && lama.layananNama) || barisBaru?.layananNama || kunci;
      rencana.push(item);
      return;
    }
    terlihat.set(kunci, no);

    if (barisBaru) {
      item.status = "baru";
      item.baris = barisBaru;
      item.ringkas = `${barisBaru.layananNama} · ${barisBaru.vendorId}`;
      item.perubahan = [{ field: "modal", lama: null, baru: barisBaru.modal }];
    } else {
      item.ringkas = `${lama.layananNama || lama.layanan} · ${lama.vendorId}`;
      item.liniBisnisId = lama.liniBisnisId;
      item.vendorId = lama.vendorId;
      item.perubahan = bedaField(lama, isian);
      // tarif lama non-Rupiah yang modalnya diperbarui ikut menjadi Rupiah (sama dengan form Edit)
      if (item.perubahan.some((p) => p.field === "modal") && lama.mataUang && lama.mataUang !== "IDR") item.perubahan.push({ field: "mataUang", lama: lama.mataUang, baru: "IDR" });
      const pm = item.perubahan.find((p) => p.field === "modal");
      item.besar = !!pm && perubahanBesar(pm.lama, pm.baru);
      item.status = item.perubahan.length ? "ubah" : "sama";
    }
    rencana.push(item);
  });
  return rencana;
}


// ---------------------------------------------------------------------------
// Baca file LENGKAP hasil penawaran vendor: sheet "Tarif" (wajib), "Vendor" dan
// "T&C Vendor" (opsional). Sheet Vendor berisi pasangan Isian-Nilai; sheet T&C
// berisi satu klausul per baris. Dipakai oleh alur impor penawaran vendor
// (PDF/foto -> Excel lewat chat -> Import Excel).
// ---------------------------------------------------------------------------
const KOSONG = (v) => v === undefined || v === null || String(v).trim() === "" || /^\s*\(.*\)\s*$/.test(String(v));

function barisSheet(wb, nama) {
  const X = xlsx();
  const kunci = wb.SheetNames.find((n) => n.trim().toLowerCase() === nama.toLowerCase());
  return kunci ? X.utils.sheet_to_json(wb.Sheets[kunci], { defval: "", raw: true, header: 1 }) : null;
}

export function bacaVendorSheet(aoa, lini) {
  if (!aoa || aoa.length < 2) return null;
  const peta = {};
  aoa.slice(1).forEach((r) => {
    const label = String(r[0] || "").trim().toLowerCase();
    if (label && !KOSONG(r[1])) peta[label] = String(r[1]).trim();
  });
  const ambil = (...awalan) => {
    const k = Object.keys(peta).find((x) => awalan.some((a) => x.startsWith(a)));
    return k ? peta[k] : "";
  };
  const nama = ambil("nama singkat");
  if (!nama) return null;
  const picTeks = ambil("pic");
  const pic = picTeks ? [{ nama: picTeks.split(",")[0].trim(), jabatan: picTeks.split(",").slice(1).join(",").trim(), telepon: "", email: "" }] : [];
  const liniNama = ambil("lini bisnis");
  const l = liniNama ? lini.find((x) => slug(x.nama || x.id) === slug(liniNama) || x.id === slug(liniNama)) : null;
  const email = ambil("email");
  return {
    id: slug(nama),
    nama,
    namaLengkap: ambil("nama badan usaha"),
    jenisBadanUsaha: ambil("jenis badan usaha"),
    alamatKantor: ambil("alamat kantor"),
    kontak: ambil("telepon"),
    website: ambil("website"),
    emailUmum: /@/.test(email) ? email : "",
    pic,
    terminBayar: ambil("termin bayar"),
    liniBisnisNama: liniNama,
    liniBisnisId: l ? l.id : null,
    penawaran: ambil("nomor dan tanggal penawaran"),
  };
}

export function bacaTncSheet(aoa, liniId) {
  if (!aoa || aoa.length < 2) return [];
  const kepala = aoa[0].map((h) => String(h).trim().toLowerCase());
  const ix = (...awalan) => kepala.findIndex((h) => awalan.some((a) => h.startsWith(a)));
  const iK = ix("kategori"), iJ = ix("judul"), iI = ix("isi"), iT = ix("terjemahan"), iN = ix("nilai"), iS = ix("hal yang harus");
  return aoa
    .slice(1)
    .filter((r) => String(r[iJ] || "").trim())
    .map((r, i) => ({
      id: `tnc_${i + 1}`,
      liniBisnisId: liniId || "semua",
      kategori: String(r[iK] || "lainnya").trim(),
      judul: String(r[iJ]).trim(),
      isi: String(r[iI] || "").trim(),
      terjemahan: String(r[iT] || "").trim(),
      nilai: String(r[iN] || "").trim(),
      selaraskan: String(r[iS] || "").trim(),
    }));
}

export async function bacaFileLengkap(file, lini) {
  const X = xlsx();
  const wb = X.read(await file.arrayBuffer(), { type: "array" });
  const tarif = await bacaFile(file);
  const vendor = bacaVendorSheet(barisSheet(wb, "Vendor"), lini);
  let liniDariTarif = null;
  const sh = wb.Sheets[wb.SheetNames.find((n) => n.trim().toLowerCase() === "tarif") || wb.SheetNames[0]];
  const pertama = X.utils.sheet_to_json(sh, { defval: "", raw: true })[0];
  if (pertama) {
    const nilaiLini = pertama["Lini Bisnis"] || pertama["lini bisnis"];
    const l = nilaiLini && lini.find((x) => slug(x.nama || x.id) === slug(nilaiLini) || x.id === slug(nilaiLini));
    liniDariTarif = l ? l.id : null;
  }
  const tnc = bacaTncSheet(barisSheet(wb, "T&C Vendor"), (vendor && vendor.liniBisnisId) || liniDariTarif);
  return { tarif, vendor, tnc };
}
