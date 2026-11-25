// Impor/ekspor Excel Master Uang Jalan. Rencana (buatRencana) murni dan diuji di tests/unit/uang-jalan-impor.test.mjs; baca/tulis file memakai window.XLSX.
// Satu sheet "Uang Jalan": kolom wajib Pick up, Tujuan, Armada, Uang jalan (atau minimal satu rincian). Rincian opsional: Jarak, Driver, BBM/Solar, Tol, Mel, TKBM, Checker, Helper, Asuransi, Insentif.
// Aturan: Uang jalan terisi = angka resmi (rincian hanya keterangan, selisih diberi peringatan); kosong = rincian dijumlah. Hasil impor bersumber "impor" (tidak ikut hitung ulang otomatis).
import { slug } from "./kunci.js";
import { ARMADA, OPSIONAL, armadaDari, angkaRp, desimal, hitung, rasioAwal, kunciUJ, namaRute } from "./uang-jalan-hitung.js";

export const KOLOM = ["Pick up", "Tujuan", "Armada", "Uang jalan", "Jarak PP (km)", "Driver", "BBM / Solar", "Tol", "Mel", "TKBM", "Checker", "Helper", "Asuransi", "Insentif driver", "Catatan"];
const ALIAS = { pickup: ["pick up", "pickup", "asal", "dari"], tujuan: ["tujuan", "tujuan akhir", "drop"], armada: ["armada", "jenis armada", "kendaraan", "unit"], total: ["uang jalan", "total", "total uang jalan", "nominal"],
  jarak: ["jarak pp (km)", "jarak pp", "jarak (km)", "jarak"], driver: ["driver", "status driver"], bbm: ["bbm / solar", "bbm/solar", "bbm", "solar"], tol: ["tol"], mel: ["mel", "biaya mel", "retribusi"], tkbm: ["tkbm"], checker: ["checker"],
  helper: ["helper"], asuransi: ["asuransi"], insentif: ["insentif driver", "insentif"], catatan: ["catatan", "keterangan"] };
const NAMA_KOLOM = {}; Object.entries(ALIAS).forEach(([k, l]) => l.forEach((a) => { NAMA_KOLOM[a] = k; }));
const ALT_ARMADA = { grand_max: "bv", grandmax: "bv", gm_blind_van: "bv", blind_van: "bv", cde: "cde", cdd: "cdd", cde_std: "cde", cdd_std: "cdd", "20ft": "t20", "40ft": "t40", trailer_20: "t20", trailer_40: "t40", trailer20: "t20", trailer40: "t40" };

export function cariArmada(t) {
  const s = slug(t);
  return ARMADA.find((a) => [a.k, a.nama, a.pendek].some((x) => slug(x) === s)) || armadaDari(ALT_ARMADA[s]) || null;
}
// Ubah baris hasil sheet_to_json (kunci = judul kolom apa adanya) menjadi kunci baku; kolom tak dikenal diabaikan.
export function petakanKolom(objs) {
  return objs.map((r) => { const o = {}; Object.entries(r).forEach(([k, v]) => { const n = NAMA_KOLOM[String(k).trim().toLowerCase().replace(/\s+/g, " ")]; if (n) o[n] = typeof v === "string" ? v.trim() : v; }); return o; });
}
// Angka Rupiah dari sel: angka, "200.000", "Rp 200.000". Kosong = 0 (tidak diisi). Huruf atau negatif = tidak valid.
const nominal = (v) => {
  if (v === "" || v === undefined || v === null) return { ok: true, v: 0, ada: false };
  if (typeof v === "number") return isFinite(v) && v >= 0 ? { ok: true, v: Math.round(v), ada: v > 0 } : { ok: false };
  const t = String(v).trim(); if (!/^(rp\.?\s*)?[\d.,\s]+$/i.test(t)) return { ok: false };
  const n = angkaRp(t); return { ok: true, v: n, ada: n > 0 };
};
const kmVal = (v) => { if (v === "" || v === undefined || v === null) return { ok: true, v: 0 }; if (typeof v === "number") return v >= 0 ? { ok: true, v } : { ok: false }; return /^[\d.,\s]+(km)?$/i.test(String(v).trim()) ? { ok: true, v: desimal(v) } : { ok: false }; };
const kosong = (b) => Object.values(b).every((v) => v === "" || v === undefined || v === null);

const FIELD = [["Uang jalan", (d) => d.total, "rp"], ["Jarak PP", (d) => d.jarak, "km"], ["Driver", (d) => (d.digaji ? "Digaji" : "Tidak digaji")], ["BBM", (d) => d.bbm, "rp"], ["Tol", (d) => d.tol, "rp"], ["Mel", (d) => d.mel, "rp"],
  ...OPSIONAL.map((c) => [c.n, (d) => (d.opsi || {})[c.k] || 0, "rp"]), ["Catatan", (d) => d.catatan || ""]];
const tampilNilai = (v, jenis) => (jenis === "rp" ? (v ? "Rp" + Math.round(v).toLocaleString("id-ID") : "–") : jenis === "km" ? (v ? v + " km" : "–") : v === "" ? "–" : String(v));
// Nilai tampil lama dari baris master (rincian dihitung ulang dari isinya).
const dasarLama = (r) => { const h = hitung({ ...r, opsi: r.opsi, manual: r.manual }); return { total: r.total, jarak: r.jarak || 0, digaji: r.digaji !== false, bbm: r.rincian === false ? 0 : h.bbm, tol: r.rincian === false ? 0 : angkaRp(r.tol), mel: r.rincian === false ? 0 : angkaRp(r.mel), opsi: r.rincian === false ? {} : r.opsi || {}, catatan: r.catatan || "" }; };

/* barisExcel: hasil petakanKolom. ref: { master: Map(kunci -> baris master), peng: {solar, rasio} }.
   Status: baru | ubah | sama | kembar (rute+armada muncul lagi di file) | error. data = baris master yang akan disimpan (untuk baru/ubah). */
export function buatRencana(barisExcel, ref) {
  const hasil = [], dilihat = new Set(), peng = ref.peng || {};
  barisExcel.forEach((b, i) => {
    if (kosong(b)) return;
    const no = i + 2, r = { no, status: "error", kunci: "", ringkas: "", alasan: "", peringatan: "", perubahan: [], data: null, lama: null }, salah = (m) => { r.alasan = m; hasil.push(r); };
    const pickup = String(b.pickup ?? "").trim(), tujuan = String(b.tujuan ?? "").trim(), a = b.armada ? cariArmada(b.armada) : null;
    r.ringkas = [pickup && tujuan ? namaRute(pickup, tujuan) : pickup || tujuan, a ? a.nama : String(b.armada ?? "")].filter(Boolean).join(" · ");
    if (!pickup || !tujuan) return salah("Pick up dan Tujuan wajib diisi.");
    if (!b.armada) return salah("Armada wajib diisi.");
    if (!a) return salah(`Armada "${b.armada}" tidak dikenal. Pakai: ${ARMADA.map((x) => x.nama).join(", ")}.`);
    const k = kunciUJ(pickup, tujuan, a.k); r.kunci = k;
    for (const [kolom, nilai] of [["Uang jalan", b.total], ["BBM / Solar", b.bbm], ["Tol", b.tol], ["Mel", b.mel], ...OPSIONAL.map((c) => [c.n, b[c.k]])]) if (!nominal(nilai).ok) return salah(`Kolom ${kolom}: "${nilai}" bukan angka Rupiah yang valid (tanpa huruf, tidak negatif).`);
    const jr = kmVal(b.jarak); if (!jr.ok) return salah(`Kolom Jarak PP: "${b.jarak}" bukan angka kilometer yang valid.`);
    const n = (v) => nominal(v).v, lama = ref.master.get(k) || null, opsi = Object.fromEntries(OPSIONAL.map((c) => [c.k, n(b[c.k])]));
    let digaji = lama ? lama.digaji !== false : true;
    const drv = String(b.driver ?? "").trim().toLowerCase();
    if (drv) { if (/^(tidak|non|bukan|borongan|mitra)/.test(drv)) digaji = false; else if (/^(digaji|gaji|ya|internal)/.test(drv)) digaji = true; else return salah(`Kolom Driver: "${b.driver}" tidak dikenal. Isi "Digaji" atau "Tidak digaji".`); }
    else if (opsi.insentif > 0) digaji = false; // insentif terisi tanpa keterangan driver = driver tidak digaji
    if (digaji && opsi.insentif > 0) return salah("Insentif hanya untuk driver tidak digaji (kolom Driver diisi Digaji).");
    const bbmNom = n(b.bbm), jarak = jr.v || (lama ? lama.jarak || 0 : 0), total = n(b.total);
    const adaRincian = bbmNom > 0 || n(b.tol) > 0 || n(b.mel) > 0 || Object.values(opsi).some((v) => v > 0) || (total === 0 && jarak > 0 && jr.v > 0);
    const rasio = (lama && lama.rasio) || rasioAwal(a.k, peng), solar = peng.solar || (lama && lama.solar) || 0;
    const h = hitung({ jarak, rasio, solar, bbmNominal: bbmNom, tol: n(b.tol), mel: n(b.mel), digaji, opsi, bulat: 0 });
    if (!total && !(adaRincian && h.subtotal > 0)) return salah("Isi kolom Uang jalan, atau minimal satu rincian (BBM, Tol, Mel, TKBM, dst.).");
    const manual = total || h.subtotal;
    if (total && adaRincian && h.subtotal > 0 && h.subtotal !== total) r.peringatan = `Rincian berjumlah Rp${h.subtotal.toLocaleString("id-ID")}, berbeda Rp${Math.abs(total - h.subtotal).toLocaleString("id-ID")} dari Uang jalan. Uang jalan yang dipakai.`;
    r.data = { pickup, tujuan, rute: namaRute(pickup, tujuan), armada: a.k, armadaNama: a.nama, grup: a.grup, digaji, jarak, rasio, solar, bbmNominal: bbmNom, tol: n(b.tol), mel: n(b.mel), opsi, lain: (lama && lama.lain) || [], bulat: 0, manual, bbm: adaRincian ? h.bbm : 0,
      subtotal: adaRincian ? h.subtotal : 0, pembulatan: 0, total: manual, sumber: "impor", rincian: adaRincian, catatan: String(b.catatan ?? "").trim() || (lama && lama.catatan) || "" };
    if (dilihat.has(k)) { r.status = "kembar"; r.alasan = "Rute dan armada ini muncul lebih dari sekali di file; baris pertama yang dipakai."; return hasil.push(r); }
    dilihat.add(k);
    if (!lama) { r.status = "baru"; return hasil.push(r); }
    const L = dasarLama(lama), B = dasarLama(r.data);
    r.lama = lama; r.perubahan = FIELD.map(([label, f, j]) => ({ label, lama: tampilNilai(f(L), j), baru: tampilNilai(f(B), j), beda: f(L) !== f(B) })).filter((x) => x.beda);
    r.status = r.perubahan.length ? "ubah" : "sama"; hasil.push(r);
  });
  return hasil;
}

// ---------- berkas Excel (window.XLSX) ----------
const xlsx = () => { if (!window.XLSX) throw new Error("Pustaka Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman."); return window.XLSX; };
export async function bacaFile(file) {
  const X = xlsx(), wb = X.read(await file.arrayBuffer(), { type: "array" }), nama = wb.SheetNames.includes("Uang Jalan") ? "Uang Jalan" : wb.SheetNames[0];
  return petakanKolom(X.utils.sheet_to_json(wb.Sheets[nama], { defval: "", raw: true }));
}
const LEBAR = [18, 18, 22, 14, 13, 14, 13, 11, 11, 11, 11, 11, 11, 14, 28];
function simpanBuku(sheetData, namaFile) {
  const X = xlsx(), ws = X.utils.json_to_sheet(sheetData, { header: KOLOM }), wb = X.utils.book_new();
  ws["!cols"] = LEBAR.map((wch) => ({ wch }));
  const petunjuk = X.utils.aoa_to_sheet([
    ["Cara memakai file ini"],
    ["1. Isi sheet 'Uang Jalan'. Satu baris = satu rute + satu armada. Wajib: Pick up, Tujuan, Armada, dan Uang jalan (atau minimal satu rincian)."],
    ["2. Cukup isi Uang jalan untuk nominal langsung (mis. A → B, CDD Standar, 200000), tanpa rincian."],
    ["3. Bila ada rincian, isi kolom BBM / Solar, Tol, Mel, TKBM, Checker, Helper, Asuransi, Insentif driver (Rupiah). Kosong = tidak dipakai."],
    ["4. Uang jalan terisi = angka resmi. Uang jalan kosong = rincian dijumlahkan. Bila keduanya terisi tapi berbeda, pratinjau memberi peringatan dan Uang jalan yang dipakai."],
    ["5. BBM / Solar kosong tetapi Jarak PP (km) terisi: BBM dihitung sistem dari rasio armada x harga solar."],
    ["6. Driver: kosongkan atau 'Digaji' untuk driver digaji; 'Tidak digaji' bila ada Insentif driver. Insentif tidak berlaku untuk driver digaji."],
    ["7. Rute + armada yang sudah ada akan ditawarkan sebagai Ubah (angka lama dan baru terlihat di pratinjau); baris master yang tidak ada di file tidak disentuh. Hasil impor ditandai sumber 'Impor' dan tidak ikut hitung ulang otomatis."],
    [],
    ["Contoh isi"], ["Pick up", "Tujuan", "Armada", "Uang jalan", "BBM / Solar", "Tol", "Mel", "Helper"],
    ["Cikarang", "Subang", "CDD Standar", 200000], ["Jakarta", "Cikarang", "Fuso", "", 204000, 135000, 75000, 100000],
    [],
    ["Armada yang dikenal"], ...ARMADA.map((a) => [a.nama]),
  ]);
  X.utils.book_append_sheet(wb, ws, "Uang Jalan"); X.utils.book_append_sheet(wb, petunjuk, "Petunjuk"); X.writeFile(wb, namaFile);
}
export const unduhTemplate = (namaFile) => simpanBuku([], namaFile);
export function eksporData(rows, namaFile) {
  simpanBuku(rows.map((r) => {
    const h = hitung({ ...r, opsi: r.opsi, manual: r.manual }), rin = r.rincian !== false, o = r.opsi || {}, v = (x) => (rin && x ? x : "");
    return { "Pick up": r.pickup, Tujuan: r.tujuan, Armada: r.armadaNama, "Uang jalan": r.total, "Jarak PP (km)": r.jarak || "", Driver: r.digaji === false ? "Tidak digaji" : "Digaji", "BBM / Solar": v(h.bbm), Tol: v(angkaRp(r.tol)), Mel: v(angkaRp(r.mel)),
      TKBM: v(o.tkbm), Checker: v(o.checker), Helper: v(o.helper), Asuransi: v(o.asuransi), "Insentif driver": v(o.insentif), Catatan: r.catatan || "" };
  }), namaFile);
}
