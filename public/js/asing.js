// ===========================================================
// NILAI ASING (freight forwarding saja)
// Tarif freight forwarding punya modal Rupiah (wajib) dan nilai jasa dalam mata uang asing
// sebagai referensi (mis. air freight USD 1.200). Total shipment tetap dihitung dalam Rupiah.
// Lini lain selalu Rupiah dan tidak menampilkan blok ini.
// ===========================================================
import { MATA_UANG, parseAngka, pasangRibuan, formatInputAngka } from "./kunci.js";
import { e, $ } from "./ui.js";

export const LINI_ASING = "freight_forwarding";
const MATA_ASING = MATA_UANG.filter((m) => m.kode !== "IDR");

// Blok input nilai asing. `p` = awalan id (mis. "t" untuk form tambah, "f" untuk form edit).
export function htmlNilaiAsing(p, mata = "", nilai = "") {
  const ada = MATA_ASING.some((m) => m.kode === mata);
  const opsi = `${MATA_ASING.map((m) => `<option value="${m.kode}" ${m.kode === mata ? "selected" : ""}>${m.kode}</option>`).join("")}${mata && !ada ? `<option value="${e(mata)}" selected>${e(mata)}</option>` : ""}<option value="__lain__">Lainnya…</option>`;
  return `<div class="mr-f mr-f--lebar" id="${p}-asing-wrap"><span>Nilai asing (referensi, opsional)</span>
    <div class="mr-f__awalan"><select id="${p}-asing-mata" class="mr-f__mata" aria-label="Mata uang asing">${opsi}</select><input id="${p}-asing-nilai" inputmode="decimal" placeholder="Mis. 1.200" value="${e(nilai)}"></div>
    <input id="${p}-asing-lain" class="mr-f__matalain" maxlength="3" autocomplete="off" placeholder="Kode mata uang, mis. AUD" hidden>
    <small>Nilai jasa dalam mata uang asing, untuk referensi. Total shipment tetap dalam Rupiah.</small></div>`;
}

// Pasang perilaku: kolom "Lainnya…" dan format ribuan.
export function pasangNilaiAsing(panel, p) {
  const sel = $(`#${p}-asing-mata`, panel);
  if (!sel) return;
  sel.addEventListener("change", () => {
    const lain = sel.value === "__lain__";
    $(`#${p}-asing-lain`, panel).hidden = !lain;
    if (lain) $(`#${p}-asing-lain`, panel).focus();
  });
  pasangRibuan($(`#${p}-asing-nilai`, panel));
}

// Membaca isian: { ok, val } dengan val = { mataUang, nilai } atau null bila kosong.
export function bacaNilaiAsing(panel, p) {
  const teks = $(`#${p}-asing-nilai`, panel)?.value.trim() || "";
  if (teks === "") return { ok: true, val: null };
  const angka = parseAngka(teks);
  if (!angka.ok || angka.val <= 0) return { ok: false, pesan: "Nilai asing harus angka lebih dari 0." };
  const pilih = $(`#${p}-asing-mata`, panel).value;
  const mataUang = pilih === "__lain__" ? $(`#${p}-asing-lain`, panel).value.trim().toUpperCase() : pilih;
  if (!/^[A-Z]{3}$/.test(mataUang)) return { ok: false, pesan: "Kode mata uang asing harus 3 huruf, mis. USD." };
  return { ok: true, val: { mataUang, nilai: angka.val } };
}

export const teksNilaiAsing = (na) => (na ? `${na.mataUang} ${Number(na.nilai).toLocaleString("id-ID")}` : "");
export { formatInputAngka };
