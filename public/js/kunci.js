// ===========================================================
// KUNCI & ATURAN DATA — logika murni, tidak menyentuh Firebase.
// Aturan pembuatan kunci HARUS sama persis dengan skrip terminal
// (alat-tarif.js), supaya baris dari web dan dari terminal
// dikenali sebagai baris yang sama (tidak dobel).
// ===========================================================

export function slug(s) {
  const t = String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return t || "x";
}

export function buatKunci(lini, vendorId, lokasi, layanan, dims, satuan, customer) {
  const d =
    Object.keys(dims || {})
      .sort()
      .map((k) => `${slug(k)}_${slug(dims[k])}`)
      .join("-") || "x";
  return [
    slug(lini),
    slug(vendorId),
    lokasi ? slug(lokasi) : "x",
    slug(layanan),
    d,
    slug(satuan),
    customer ? slug(customer) : "x",
  ].join("__");
}

// Field yang boleh diubah dari halaman edit / import Excel.
// Bagian kunci (lini, vendor, lokasi, layanan, dimensi, satuan) tidak
// pernah diubah: mengubahnya berarti membuat baris baru.
export const FIELD_BISA_BERUBAH = [
  "modal",
  "mataUang",
  "nilaiAsing",
  "metodeHarga",
  "hargaJualReferensi",
  "hargaJualSaran",
  "referensiSumber",
  "berlakuDari",
  "berlakuSampai",
  "aktif",
  "catatan",
];

export const METODE_HARGA = [
  { v: "tetap", t: "Tetap" },
  { v: "at_cost", t: "At cost" },
  { v: "persentase", t: "Persentase" },
  { v: "proyekan", t: "Proyekan" },
];

// ---- angka dari teks bebas ("Rp 1.500.000", "1,500,000", "2500000,50") ----
export function parseAngka(v) {
  if (v === undefined || v === null || v === "") return { ok: true, val: undefined };
  if (typeof v === "number") return Number.isFinite(v) ? { ok: true, val: v } : { ok: false };
  let s = String(v).replace(/rp/gi, "").replace(/\s/g, "");
  if (s === "" || s === "-") return { ok: false };
  if (s.includes(".") && s.includes(",")) {
    // pemisah desimal = yang muncul terakhir
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? { ok: true, val: n } : { ok: false };
}

export function formatRp(n, mataUang = "IDR") {
  if (n === null || n === undefined) return "";
  const s = Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return mataUang === "IDR" ? `Rp ${s}` : `${mataUang} ${s}`;
}

// ---- pembanding: apa yang berubah antara baris lama dan isian baru ----
// Isian undefined = tidak diubah (sel kosong tidak menghapus apa pun).
export function bedaField(lama, baru) {
  const hasil = [];
  for (const f of FIELD_BISA_BERUBAH) {
    if (baru[f] === undefined) continue;
    const a = lama[f] === undefined ? null : lama[f];
    const b = baru[f];
    if (JSON.stringify(a) !== JSON.stringify(b)) hasil.push({ field: f, lama: a, baru: b });
  }
  return hasil;
}

// perubahan modal lebih dari 50% -> beri tanda hati-hati
export function perubahanBesar(lamaModal, baruModal) {
  if (typeof lamaModal !== "number" || typeof baruModal !== "number" || lamaModal === 0) return false;
  return Math.abs(baruModal - lamaModal) / Math.abs(lamaModal) > 0.5;
}

// ---- dimensi <-> teks ("ukuran=20ft; jenisIsi=dry") ----
export function dimensiKeTeks(d) {
  return Object.keys(d || {})
    .sort()
    .map((k) => `${k}=${d[k]}`)
    .join("; ");
}

export function teksKeDimensi(t) {
  const out = {};
  String(t || "")
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
  return out;
}

export function rapikanNama(id) {
  return String(id || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}


// ---- tampilan & input angka (perbaikan MR2, MR5) ----
// Dimensi untuk dibaca manusia: "Ukuran: 20 ft" (bukan "ukuran=20ft"). Hanya tampilan; kunci data tidak berubah.
export function dimensiTampil(d) {
  const rapi = (v) => String(v ?? "").replace(/_/g, " ").replace(/^(\d+)\s?ft$/i, "$1 ft");
  return Object.keys(d || {}).sort().map((k) => `${k.charAt(0).toUpperCase()}${k.slice(1).replace(/([A-Z])/g, " $1").toLowerCase()}: ${rapi(d[k])}`).join(" · ");
}

// Teks angka dengan pemisah ribuan titik dan desimal koma, mis. 1500000 -> "1.500.000".
export function formatInputAngka(n) {
  if (n === null || n === undefined || n === "") return "";
  const [b, d] = String(n).replace(".", ",").split(",");
  return b.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d !== undefined ? "," + d : "");
}

// Pasang pemisah ribuan otomatis saat mengetik. Nilai tetap terbaca oleh parseAngka.
export function pasangRibuan(input) {
  if (!input || input.dataset.ribuan) return;
  input.dataset.ribuan = "1";
  const rapikan = () => {
    const mentah = input.value.replace(/rp/gi, "").replace(/[^\d,-]/g, "");
    const neg = mentah.startsWith("-") ? "-" : "";
    const [b, ...sisa] = mentah.replace(/-/g, "").split(",");
    const desimal = sisa.length ? "," + sisa.join("").slice(0, 2) : "";
    const baru = neg + b.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + desimal;
    if (baru !== input.value) {
      const dariAkhir = input.value.length - (input.selectionStart ?? input.value.length);
      input.value = baru;
      const pos = Math.max(0, baru.length - dariAkhir);
      try { input.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ }
    }
  };
  input.addEventListener("input", rapikan);
  // Nilai awal biasanya sudah berformat ("1.500.000"); rapikan() membaca titik sebagai pemisah ribuan.
  // Jangan formatInputAngka() lagi: titik akan dianggap desimal ("1,500.000" = 1.500).
  if (input.value) rapikan();
}

// Mata uang modal tarif yang disediakan (kode lain bisa diketik lewat "Lainnya…").
export const MATA_UANG = [
  { kode: "IDR", label: "Rp" },
  { kode: "USD", label: "USD" },
  { kode: "SGD", label: "SGD" },
  { kode: "EUR", label: "EUR" },
  { kode: "CNY", label: "CNY" },
  { kode: "JPY", label: "JPY" },
  { kode: "MYR", label: "MYR" },
  { kode: "THB", label: "THB" },
];
