// ===========================================================
// FASILITAS / LOKASI TARIF — satu sumber untuk form tambah dan edit tarif.
// Pilihan diambil dari halaman Lokasi (profil_fasilitas) sesuai jenis lini, plus daftar lama
// (depo_lokasi, warehouse_fasilitas, open_yard_lokasi). Jika belum ada, bisa didaftarkan dari form.
// ===========================================================
import { slug } from "./kunci.js";
import { e, $, toast } from "./ui.js";
import { htmlCombo, pasangCombo } from "./satuan-combo.js";

// jenis di halaman Lokasi yang dipakai tiap lini
export const JENIS_FASILITAS = { depo: ["depo"], warehouse_dry: ["gudang_dry"], warehouse_frozen: ["chiller", "cold_room", "frozen"], open_yard: ["open_yard"] };
const JENIS_BARU = { depo: "depo", warehouse_dry: "gudang_dry", warehouse_frozen: "chiller", open_yard: "open_yard" };

// [id, nama] untuk lini ini, tanpa duplikat
export function opsiFasilitas(S, liniId) {
  const hasil = new Map();
  const tambah = (id, nama) => id && !hasil.has(id) && hasil.set(id, nama || id);
  (S.ref.profil || []).filter((p) => (!JENIS_FASILITAS[liniId] || JENIS_FASILITAS[liniId].includes(p.jenis)) && p.status !== "nonaktif").forEach((p) => tambah(p.lokasiRefId || p.id, p.namaTampil || p.nama));
  if (liniId === "depo") (S.ref.depo || []).forEach((d) => tambah(d.id, d.nama));
  else if (liniId === "open_yard") (S.ref.openYard || []).forEach((l) => tambah(l.id, l.nama));
  else (S.ref.warehouse || []).filter((w) => w.liniBisnisId === liniId).forEach((w) => tambah(w.id, w.nama));
  return [...hasil];
}

// Daftar jenis fasilitas yang boleh dipilih di form cepat (jenis di halaman Lokasi) untuk lini ini.
const NAMA_JENIS = { depo: "Depo Container", open_yard: "Open Yard", gudang_dry: "Gudang Dry", chiller: "Gudang Chiller", cold_room: "Cold Room", frozen: "Gudang Frozen" };
const jenisLini = (liniId) => JENIS_FASILITAS[liniId] || Object.keys(NAMA_JENIS);

// Blok pilihan lokasi + tambah cepat. `kosong` = teks opsi kosong ("Pilih…" atau "Tidak terikat lokasi").
// Opsi terakhir "＋ Tambah fasilitas baru…" ikut tampil di pemilih bawaan HP; tombol ＋ Baru untuk desktop.
export function htmlFasilitas(p, liniId, S, sekarang = "", { kosong = "Pilih…", label = "Lokasi / fasilitas", wajib = false } = {}) {
  const ids = opsiFasilitas(S, liniId);
  const ada = sekarang && ids.some(([id]) => id === sekarang);
  const extra = sekarang && !ada ? [[sekarang, sekarang]] : [];
  const jenis = jenisLini(liniId);
  return `<div class="mr-f mr-f--lebar" id="${p}-lokasi-blok" data-w="lokasi"><span>${label}${wajib ? " *" : ""}</span>
    <div class="mr-f__awalan"><select id="${p}-lokasi" style="flex:1;min-width:0"><option value="">${e(kosong)}</option>${[...ids, ...extra].map(([id, n]) => `<option value="${e(id)}" ${id === sekarang ? "selected" : ""}>${e(n)}</option>`).join("")}<option value="__baru__">＋ Tambah fasilitas baru…</option></select>
    <button type="button" class="mr-btn mr-btn--kecil" id="${p}-fas-buka" aria-label="Tambah fasilitas baru" style="white-space:nowrap">＋ Baru</button></div>
    ${ids.length ? "" : `<small class="mr-galat-kecil">Belum ada fasilitas untuk lini ini. Tambahkan sekarang, lengkapi nanti di tab Lokasi.</small>`}
    <div id="${p}-fas-form" class="mr-kartu" hidden style="margin-top:8px;padding:12px">
      <label class="mr-f mr-f--lebar"><span>Nama fasilitas *</span><input id="${p}-fas-nama" autocomplete="off" placeholder="Mis. Gudang Dry Cikarang 2"></label>
      <div class="mr-f mr-f--lebar"><span>Jenis fasilitas *</span>${htmlCombo(`${p}-fas-jenis`, { nilai: NAMA_JENIS[jenis[0]], placeholder: "Pilih atau ketik jenis lain", hint: "Tidak ada yang sesuai? Ketik jenisnya sendiri." })}</div>
      <label class="mr-f mr-f--lebar"><span>Alamat atau kawasan (opsional)</span><input id="${p}-fas-alamat" autocomplete="off"></label>
      <small>Tersimpan sebagai <b>Draf</b>. Foto, luas, PIC, dan spesifikasi dilengkapi di tab Lokasi.</small>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="mr-btn" id="${p}-fas-batal">Batal</button><button type="button" class="mr-btn mr-btn--utama" id="${p}-fas-simpan">Simpan fasilitas</button></div>
      <p class="mr-galat" id="${p}-fas-galat" hidden></p>
    </div></div>`;
}

// Isi ulang opsi saat lini berubah (dipakai form edit).
export function isiOpsiFasilitas(panel, p, liniId, S, { kosong = "Pilih…", sekarang = "" } = {}) {
  const sel = $(`#${p}-lokasi`, panel); if (!sel) return;
  const ids = opsiFasilitas(S, liniId);
  sel.innerHTML = `<option value="">${e(kosong)}</option>${ids.map(([id, n]) => `<option value="${e(id)}" ${id === sekarang ? "selected" : ""}>${e(n)}</option>`).join("")}<option value="__baru__">＋ Tambah fasilitas baru…</option>`;
}

// Pasang tambah cepat. `onBaru(id, nama)` dipanggil setelah tersimpan, untuk memilih opsi baru.
// `liniId` boleh string atau fungsi (form edit: lini bisa diganti setelah form dibuka).
// `pemilik()` (opsional) -> {isl: true} atau {vendorId}: pemilik fasilitas baru (internal atau vendor yang dipilih di form tarif).
export function pasangFasilitas(panel, p, liniId, { S, DB, onBaru, pemilik }) {
  const lini = () => (typeof liniId === "function" ? liniId() : liniId);
  const buka = $(`#${p}-fas-buka`, panel); if (!buka) return;
  const sel = $(`#${p}-lokasi`, panel), form = $(`#${p}-fas-form`, panel);
  let terakhir = sel.value;
  const tampil = (ya) => { form.hidden = !ya; if (ya) { $(`#${p}-fas-nama`, panel).focus(); form.scrollIntoView({ block: "nearest", behavior: "smooth" }); } };
  buka.onclick = () => tampil(form.hidden);
  sel.addEventListener("change", () => { if (sel.value === "__baru__") { sel.value = terakhir; tampil(true); } else terakhir = sel.value; });
  // tidak ada fasilitas sama sekali pada lokasi wajib: langsung buka form
  if (sel.options.length === 2 && sel.closest("[data-w=lokasi]").querySelector("span").textContent.includes("*")) tampil(true);
  pasangCombo($(`#${p}-fas-jenis-wrap`, panel), () => jenisLini(lini()).map((j) => ({ nama: NAMA_JENIS[j] })), { baruTeks: (t) => `＋ Pakai jenis “${t}”` });
  $(`#${p}-fas-batal`, panel).onclick = () => tampil(false);
  $(`#${p}-fas-simpan`, panel).onclick = async () => {
    const g = $(`#${p}-fas-galat`, panel), tombol = $(`#${p}-fas-simpan`, panel);
    const nama = $(`#${p}-fas-nama`, panel).value.trim().replace(/\s+/g, " ");
    if (!nama) { g.textContent = "Isi nama fasilitas dulu."; g.hidden = false; return; }
    // nama yang sudah ada dipakai ulang, bukan dibuat dobel
    const sama = [...sel.options].find((o) => o.value && o.value !== "__baru__" && o.textContent.trim().toLowerCase() === nama.toLowerCase());
    if (sama) { sel.value = terakhir = sama.value; tampil(false); sel.dispatchEvent(new Event("change", { bubbles: true })); toast(`<b>${e(nama)}</b> sudah terdaftar, langsung dipilih.`, "ok"); return; }
    const id = slug(nama) + "_" + Date.now().toString(36);
    const alamat = $(`#${p}-fas-alamat`, panel).value.trim();
    // jenis diketik: yang cocok dengan daftar dipakai; yang lain disimpan apa adanya di jenisLain (jenis dasar = jenis pertama lini ini, agar tetap muncul di pilihan)
    const ketik = $(`#${p}-fas-jenis`, panel).value.trim().replace(/\s+/g, " ");
    if (!ketik) { g.textContent = "Isi jenis fasilitas dulu."; g.hidden = false; return; }
    const cocok = Object.entries(NAMA_JENIS).find(([, n]) => n.toLowerCase() === ketik.toLowerCase());
    const jenis = cocok ? cocok[0] : jenisLini(lini())[0];
    const jenisLain = cocok ? "" : ketik;
    const own = (pemilik && pemilik()) || {};
    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      const oleh = S.user.email;
      if (jenis === "open_yard") {
        // lokasi open yard = dokumen open_yard_lokasi (draf), id-nya sama dengan yang dipakai tarif
        const data = { namaLokasi: nama, alamat, luasTotalM2: null, luasTersedia: 0, fasilitas: {}, aksesJalan: "", fotoUrls: [], status: "draf", catatan: "Dibuat dari form tarif. Lengkapi di tab Lokasi." };
        await DB.simpanLokasiOpenYard(id, data, { baru: true, oleh });
        S.ref.openYard = [...(S.ref.openYard || []), { ...data, id, nama, provinsi: "" }];
      }
      const data = { nama, namaTampil: "", jenis, ...(jenisLain ? { jenisLain } : {}), pemilik: own.isl ? "isl" : "mitra", vendorId: own.isl ? "" : own.vendorId || "", kawasan: "", alamat, maps: "", luasLahanM2: null, luasBangunanM2: null, luasTersediaM2: null, spek: {}, fasilitas: {}, fasilitasLain: "", jamOperasional: "", pic: { nama: "", jabatan: "", telp: "", email: "" }, aksesJalan: "", deskripsi: "", catatan: "Dibuat dari form tarif. Lengkapi di tab Lokasi.", status: "draf", fotos: [], lampiran: [], lokasiRefId: jenis === "open_yard" ? id : "" };
      await DB.simpanProfilFasilitas(id, data, { baru: true, oleh });
      S.ref.profil = [...(S.ref.profil || []), { id, ...data }];
      tampil(false);
      $(`#${p}-fas-nama`, panel).value = ""; $(`#${p}-fas-alamat`, panel).value = "";
      g.hidden = true;
      onBaru(id, nama);
      terakhir = sel.value;
      toast(`Fasilitas <b>${e(nama)}</b> didaftarkan sebagai <b>Draf</b> dan dipilih. Lengkapi datanya di tab Lokasi.`, "ok");
    } catch (err) { g.textContent = "Gagal menyimpan fasilitas: " + err.message; g.hidden = false; }
    finally { tombol.disabled = false; tombol.textContent = "Simpan fasilitas"; }
  };
}

// Tambah opsi baru ke select lalu pilih
export function pilihFasilitasBaru(panel, p, id, nama) {
  const sel = $(`#${p}-lokasi`, panel); if (!sel) return;
  const akhir = sel.querySelector('option[value="__baru__"]');
  const o = new Option(nama, id);
  akhir ? sel.insertBefore(o, akhir) : sel.append(o);
  sel.value = id;
}
