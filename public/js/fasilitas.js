// ===========================================================
// FASILITAS / LOKASI TARIF — satu sumber untuk form tambah dan edit tarif.
// Pilihan diambil dari halaman Lokasi (profil_fasilitas) sesuai jenis lini, plus daftar lama
// (depo_lokasi, warehouse_fasilitas, open_yard_lokasi). Jika belum ada, bisa didaftarkan dari form.
// ===========================================================
import { slug } from "./kunci.js";
import { e, $, toast } from "./ui.js";

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

// Blok pilihan lokasi + tombol daftarkan. `kosong` = teks opsi kosong ("Pilih…" atau "Tidak terikat lokasi").
export function htmlFasilitas(p, liniId, S, sekarang = "", { kosong = "Pilih…", label = "Lokasi / fasilitas", wajib = false } = {}) {
  const ids = opsiFasilitas(S, liniId);
  const ada = sekarang && ids.some(([id]) => id === sekarang);
  const extra = sekarang && !ada ? [[sekarang, sekarang]] : [];
  return `<div class="mr-f mr-f--lebar" id="${p}-lokasi-blok" data-w="lokasi"><span>${label}${wajib ? " *" : ""}</span>
    <select id="${p}-lokasi"><option value="">${e(kosong)}</option>${[...ids, ...extra].map(([id, n]) => `<option value="${e(id)}" ${id === sekarang ? "selected" : ""}>${e(n)}</option>`).join("")}</select>
    ${ids.length ? "" : `<small class="mr-galat-kecil">Belum ada fasilitas untuk lini ini.</small>`}
    <button type="button" class="mr-btn mr-btn--kecil" id="${p}-fas-buka" style="margin-top:6px">＋ Daftarkan fasilitas</button>
    <div id="${p}-fas-form" class="mr-kartu" hidden style="margin-top:8px;padding:10px">
      <label class="mr-f mr-f--lebar"><span>Nama fasilitas *</span><input id="${p}-fas-nama" autocomplete="off" placeholder="Mis. Gudang Dry Cikarang 2"></label>
      <label class="mr-f mr-f--lebar"><span>Alamat (opsional)</span><input id="${p}-fas-alamat" autocomplete="off"></label>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="mr-btn" id="${p}-fas-batal">Batal</button><button type="button" class="mr-btn mr-btn--utama" id="${p}-fas-simpan">Simpan fasilitas</button></div>
      <p class="mr-galat" id="${p}-fas-galat" hidden></p>
    </div></div>`;
}

// Isi ulang opsi saat lini berubah (dipakai form edit).
export function isiOpsiFasilitas(panel, p, liniId, S, { kosong = "Pilih…", sekarang = "" } = {}) {
  const sel = $(`#${p}-lokasi`, panel); if (!sel) return;
  const ids = opsiFasilitas(S, liniId);
  sel.innerHTML = `<option value="">${e(kosong)}</option>${ids.map(([id, n]) => `<option value="${e(id)}" ${id === sekarang ? "selected" : ""}>${e(n)}</option>`).join("")}`;
}

// Pasang tombol "Daftarkan fasilitas". `onBaru(id, nama)` dipanggil setelah tersimpan, untuk memilih opsi baru.
// `liniId` boleh string atau fungsi (form edit: lini bisa diganti setelah form dibuka).
export function pasangFasilitas(panel, p, liniId, { S, DB, onBaru }) {
  const lini = () => (typeof liniId === "function" ? liniId() : liniId);
  const buka = $(`#${p}-fas-buka`, panel); if (!buka) return;
  buka.onclick = () => { const k = $(`#${p}-fas-form`, panel); k.hidden = !k.hidden; if (!k.hidden) $(`#${p}-fas-nama`, panel).focus(); };
  $(`#${p}-fas-batal`, panel).onclick = () => { $(`#${p}-fas-form`, panel).hidden = true; };
  $(`#${p}-fas-simpan`, panel).onclick = async () => {
    const g = $(`#${p}-fas-galat`, panel), tombol = $(`#${p}-fas-simpan`, panel);
    const nama = $(`#${p}-fas-nama`, panel).value.trim().replace(/\s+/g, " ");
    if (!nama) { g.textContent = "Isi nama fasilitas dulu."; g.hidden = false; return; }
    const id = slug(nama) + "_" + Date.now().toString(36);
    const alamat = $(`#${p}-fas-alamat`, panel).value.trim();
    const jenis = JENIS_BARU[lini()] || "gudang_dry";
    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      const oleh = S.user.email;
      if (lini() === "open_yard") {
        // lokasi open yard = dokumen open_yard_lokasi (draf), id-nya sama dengan yang dipakai tarif
        const data = { namaLokasi: nama, alamat, luasTotalM2: null, luasTersedia: 0, fasilitas: {}, aksesJalan: "", fotoUrls: [], status: "draf", catatan: "Dibuat dari form tarif. Lengkapi di tab Lokasi." };
        await DB.simpanLokasiOpenYard(id, data, { baru: true, oleh });
        S.ref.openYard = [...(S.ref.openYard || []), { ...data, id, nama, provinsi: "" }];
      }
      const data = { nama, namaTampil: nama, jenis, pemilik: "mitra", vendorId: "", kawasan: "", alamat, maps: "", luasLahanM2: null, luasBangunanM2: null, luasTersediaM2: null, spek: {}, fasilitas: {}, fasilitasLain: "", jamOperasional: "", pic: { nama: "", jabatan: "", telp: "", email: "" }, aksesJalan: "", deskripsi: "", catatan: "", status: "aktif", fotos: [], lampiran: [], lokasiRefId: lini() === "open_yard" ? id : "" };
      await DB.simpanProfilFasilitas(id, data, { baru: true, oleh });
      S.ref.profil = [...(S.ref.profil || []), { id, ...data }];
      $(`#${p}-fas-form`, panel).hidden = true;
      $(`#${p}-fas-nama`, panel).value = ""; $(`#${p}-fas-alamat`, panel).value = "";
      g.hidden = true;
      onBaru(id, nama);
      toast(`Fasilitas <b>${e(nama)}</b> didaftarkan dan dipilih.`, "ok");
    } catch (err) { g.textContent = "Gagal menyimpan fasilitas: " + err.message; g.hidden = false; }
    finally { tombol.disabled = false; tombol.textContent = "Simpan fasilitas"; }
  };
}

// Tambah opsi baru ke select lalu pilih
export function pilihFasilitasBaru(panel, p, id, nama) {
  const sel = $(`#${p}-lokasi`, panel); if (!sel) return;
  sel.insertAdjacentHTML("beforeend", `<option value="${e(id)}">${e(nama)}</option>`);
  sel.value = id;
}
