// ===========================================================
// DB-FIREBASE — semua baca/tulis Firestore untuk Master Rate.
//
// ATURAN UTAMA: tidak ada simpan yang "diam-diam".
//  1. Setiap tulis ditunggu sampai server mengonfirmasi (ada batas waktu).
//  2. Setelah itu dokumen DIBACA ULANG dari server dan dibandingkan
//     dengan yang dimaksud. Beda = dianggap GAGAL dan dilaporkan.
//  3. Perubahan harga dan catatan riwayatnya ditulis dalam satu batch
//     (atomik): keduanya tersimpan atau keduanya tidak.
// ===========================================================
import { db, app, auth } from "./firebase-config.js";
import { adalahMaster } from "./config-akses.js";
import {
  collection,
  doc,
  getDocs,
  getDocFromServer,
  writeBatch,
  serverTimestamp,
  deleteField,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

export const MODE = "firebase";

// Saat data di layar masih dari salinan lokal, semua penulisan ditolak sampai data terbaru dari server tiba.
const pastikanSegar = () => { if (window.__islSegar === false) throw new Error("Data di layar masih dari salinan lokal. Tunggu sampai muncul \"Data terbaru\", lalu simpan lagi."); };
const KOLEKSI = {
  tarif: "master_tarif",
  riwayat: "master_tarif_riwayat",
  vendor: "vendor",
  lini: "lini_bisnis",
  satuan: "satuan_baku",
  modal: "master_modal", // modal tarif: hanya akun master yang boleh baca (aturan Firestore). Sales hanya melihat tarif tanpa modal + hargaMin.
};
const masterSekarang = () => { try { return adalahMaster(auth.currentUser && auth.currentUser.email); } catch (_) { return false; } };
/* Pemilik atau admin (window.__ISL_KELOLA, diisi saat halaman dimuat). Modal tarif dan pemisahannya boleh diurus keduanya. */
const kelolaSekarang = () => (window.__ISL_KELOLA !== undefined ? !!window.__ISL_KELOLA : masterSekarang());
let cacheTarget = {};
/* batas harga aman untuk akun sales: modal + target markup lini, dibulatkan ke atas Rp1.000. Bukan modal itu sendiri.
   Lini Depo yang markupnya belum disimpan memakai 20% (sama dengan target awal di aplikasi), lini lain 15%. */
const hargaMinDari = (modal, liniId) => { const m = Number(modal); if (!(m > 0)) return null; const t = cacheTarget[liniId]; const pct = t === undefined || t === null || t === "" ? (liniId === "depo" ? 20 : 15) : Number(t); return Math.ceil((m * (1 + pct / 100)) / 1000) * 1000; };

// Tanggal lokal "YYYY-MM-DD". Dipakai untuk diverifikasiPada (acuan pengingat verifikasi ulang tarif ke vendor).
export const hariIniLokal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const BATAS_WAKTU_MS = 20000;
const UKURAN_BATCH = 200; // tiap item = 2 tulisan (tarif + riwayat), batas Firestore 500

// ---------- util ----------
function dengBatasWaktu(promise, label) {
  let t;
  const batas = new Promise((_, rej) => {
    t = setTimeout(
      () => rej(new Error(`${label}: server tidak mengonfirmasi dalam ${BATAS_WAKTU_MS / 1000} detik (cek koneksi). Perubahan BELUM dianggap tersimpan.`)),
      BATAS_WAKTU_MS
    );
  });
  return Promise.race([promise, batas]).then((v) => { if (/^(Simpan|Hapus)/.test(label) && window.ISLCadangan) window.ISLCadangan.tandai("master"); return v; }).finally(() => clearTimeout(t));
}

function normalisasi(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === "function" ? v.toDate().toISOString() : v;
  }
  return out;
}

// Firestore mengembalikan isi map dengan kunci terurut alfabet, jadi perbandingan
// TIDAK boleh bergantung pada urutan kunci (kalau tidak, simpan yang berhasil
// dilaporkan gagal). Urutan elemen array tetap diperhitungkan.
function urutkan(v) {
  if (Array.isArray(v)) return v.map(urutkan);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, urutkan(v[k])]));
  return v === undefined ? null : v;
}
// Firestore menolak nilai undefined di mana pun dalam dokumen ("Unsupported field value: undefined").
// Dokumen lama (mis. vendor hasil impor terminal) sering tidak punya sebagian isian, sehingga form
// mengirim undefined. Ganti dengan null supaya simpan tidak gagal.
export function tanpaUndefined(v) {
  if (v === undefined) return null;
  if (Array.isArray(v)) return v.map(tanpaUndefined);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tanpaUndefined(x)]));
  return v;
}
export function sama(a, b) {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  return JSON.stringify(urutkan(a)) === JSON.stringify(urutkan(b));
}

async function bacaKoleksi(nama) {
  let snap;
  try { snap = await getDocs(collection(db, nama)); }
  catch (e) { const izin = e && (e.code === "permission-denied" || /permission|insufficient/i.test(String(e.message || ""))); if (!izin) throw e; (window.__islTidakTerbaca = window.__islTidakTerbaca || new Set()).add(nama); console.warn("Koleksi ditolak aturan:", nama); return []; }
  const hasil = [];
  snap.forEach((d) => hasil.push({ id: d.id, ...normalisasi(d.data()) }));
  return hasil;
}

async function dalamKelompok(items, jumlah, fn) {
  const hasil = [];
  for (let i = 0; i < items.length; i += jumlah) {
    hasil.push(...(await Promise.all(items.slice(i, i + jumlah).map(fn))));
  }
  return hasil;
}

// ---------- baca ----------
export async function muatSemua() {
  const [tarif, vendor, lini, satuan] = await Promise.all([
    bacaKoleksi(KOLEKSI.tarif),
    bacaKoleksi(KOLEKSI.vendor),
    bacaKoleksi(KOLEKSI.lini),
    bacaKoleksi(KOLEKSI.satuan),
  ]);
  cacheTarget = Object.fromEntries(lini.map((l) => [l.id, l.targetMargin]));
  if (kelolaSekarang()) {
    try {
      const md = await bacaKoleksi(KOLEKSI.modal), peta = new Map(md.map((x) => [x.id, x.modal]));
      tarif.forEach((t) => { if (peta.has(t.id) && peta.get(t.id) !== null && peta.get(t.id) !== undefined) t.modal = peta.get(t.id); });
    } catch (e) { console.warn("master_modal belum bisa dibaca (aturan Firestore terbaru belum dipasang?):", e && e.code); }
  }
  return { tarif, vendor, lini, satuan };
}

// Daftar zona trucking, lokasi distribusi, depo, fasilitas gudang, dan lokasi open yard
// (untuk pilihan di form tambah item dan tab Lokasi)
export async function muatReferensi() {
  const [zona, lokasi, depo, wh, oy, profil] = await Promise.all([
    bacaKoleksi("trucking_trailer_zona"),
    bacaKoleksi("distribusi_kecil_lokasi"),
    bacaKoleksi("depo_lokasi"),
    bacaKoleksi("warehouse_fasilitas"),
    bacaKoleksi("open_yard_lokasi"),
    bacaKoleksi("profil_fasilitas").catch(() => []),
  ]);
  return {
    zona: zona.map((d) => ({ id: d.id, nama: d.namaZona || d.id, provinsi: d.provinsi || "" })),
    lokasiDistribusi: lokasi.map((d) => ({ id: d.id, nama: d.namaLokasi || d.id, provinsi: d.provinsi || "" })),
    depo: depo.map((d) => ({ id: d.id, nama: d.nama || d.id })),
    warehouse: wh.map((d) => ({ id: d.id, nama: d.id, liniBisnisId: d.liniBisnisId })),
    openYard: oy.map((d) => ({ ...d, nama: d.namaLokasi || d.id, provinsi: "" })),
    profil: profil.map((d) => ({ ...d })),
  };
}

export async function muatRiwayat(kunci) {
  const snap = await getDocs(query(collection(db, KOLEKSI.riwayat), where("kunci", "==", kunci)));
  const hasil = [];
  snap.forEach((d) => hasil.push({ id: d.id, ...normalisasi(d.data()) }));
  hasil.sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  return hasil;
}

// ---------- tulis tarif ----------
function siapkanItem(batch, item, oleh, sumber) {
  const refTarif = doc(db, KOLEKSI.tarif, item.kunci);
  const refRiwayat = doc(collection(db, KOLEKSI.riwayat));
  const stempel = { diperbaruiPada: serverTimestamp(), diperbaruiOleh: oleh };

  if (item.jenis === "baru") {
    const { modal: modalBaru, ...sisa } = tanpaUndefined(item.baris);
    const tanpaModal = { ...sisa, diverifikasiPada: sisa.diverifikasiPada || hariIniLokal() };
    const baris = { ...tanpaModal, kunci: item.kunci, ...stempel, hargaMin: hargaMinDari(modalBaru, item.baris.liniBisnisId) };
    batch.set(refTarif, baris);
    const refModal = doc(db, KOLEKSI.modal, item.kunci);
    if (modalBaru !== undefined && modalBaru !== null) batch.set(refModal, { modal: modalBaru, ...stempel });
    batch.set(refRiwayat, {
      kunci: item.kunci,
      liniBisnisId: item.baris.liniBisnisId,
      vendorId: item.baris.vendorId,
      jenis: "dibuat",
      perubahan: [{ field: "modal", lama: null, baru: item.baris.modal ?? null }],
      sumber,
      oleh,
      tanggal: serverTimestamp(),
    });
    return { refTarif, refRiwayat, harapan: { ...tanpaModal, hargaMin: baris.hargaMin }, refModal, harapanModal: modalBaru ?? null };
  }

  const set = {};
  item.perubahan.forEach((p) => (set[p.field] = p.baru));
  const refModal = doc(db, KOLEKSI.modal, item.kunci), adaModal = Object.prototype.hasOwnProperty.call(set, "modal"), modalUbah = set.modal;
  delete set.modal;
  if (adaModal && set.diverifikasiPada === undefined) set.diverifikasiPada = hariIniLokal(); // modal diperbarui = harga baru dari vendor = terverifikasi
  const ekstra = {};
  if (adaModal) { ekstra.modal = deleteField(); ekstra.hargaMin = hargaMinDari(modalUbah, item.liniBisnisId); set.hargaMin = ekstra.hargaMin; delete ekstra.hargaMin; batch.set(refModal, { modal: modalUbah ?? null, ...stempel }); }
  batch.update(refTarif, { ...set, ...ekstra, ...stempel });
  batch.set(refRiwayat, {
    kunci: item.kunci,
    liniBisnisId: item.liniBisnisId || null,
    vendorId: item.vendorId || null,
    jenis: "diubah",
    perubahan: item.perubahan,
    sumber,
    oleh,
    tanggal: serverTimestamp(),
  });
  return { refTarif, refRiwayat, harapan: set, refModal: adaModal ? refModal : null, harapanModal: modalUbah ?? null };
}

async function verifikasi(siap) {
  const [tarifSrv, riwSrv] = await Promise.all([getDocFromServer(siap.refTarif), getDocFromServer(siap.refRiwayat)]);
  if (!tarifSrv.exists()) return "dokumen tarif tidak ditemukan di server setelah disimpan";
  if (!riwSrv.exists()) return "catatan riwayat tidak ditemukan di server setelah disimpan";
  const aktual = tarifSrv.data();
  for (const [f, v] of Object.entries(siap.harapan)) {
    if (!sama(aktual[f], v)) return `field "${f}" di server (${JSON.stringify(aktual[f])}) tidak sama dengan yang disimpan (${JSON.stringify(v)})`;
  }
  if (aktual.modal !== undefined && siap.refModal) return "modal masih tertulis di dokumen tarif (seharusnya hanya di koleksi master_modal)";
  if (siap.refModal) {
    const m = await getDocFromServer(siap.refModal);
    if (siap.harapanModal !== null && (!m.exists() || !sama(m.data().modal, siap.harapanModal))) return "modal di koleksi master_modal tidak sama dengan yang disimpan";
  }
  return null;
}

// item: {jenis:"ubah"|"baru", kunci, perubahan?, baris?, liniBisnisId?, vendorId?}
// Mengembalikan {berhasil:[kunci], gagal:[{kunci, alasan}]}
export async function terapkanBanyak(items, { oleh, sumber, onProgress }) {
  pastikanSegar();
  const berhasil = [];
  const gagal = [];
  let selesai = 0;

  // baris baru: pastikan benar-benar belum ada di server (tidak menimpa)
  const baru = items.filter((i) => i.jenis === "baru");
  const adaDiServer = new Set();
  await dalamKelompok(baru, 20, async (i) => {
    const s = await dengBatasWaktu(getDocFromServer(doc(db, KOLEKSI.tarif, i.kunci)), "Cek duplikat");
    if (s.exists()) adaDiServer.add(i.kunci);
  });
  const layak = [];
  for (const i of items) {
    if (i.jenis === "baru" && adaDiServer.has(i.kunci)) {
      gagal.push({ kunci: i.kunci, alasan: "sudah ada di database (dilewati agar tidak menimpa)" });
      selesai++;
    } else layak.push(i);
  }

  for (let a = 0; a < layak.length; a += UKURAN_BATCH) {
    const potong = layak.slice(a, a + UKURAN_BATCH);
    const batch = writeBatch(db);
    const siap = potong.map((it) => siapkanItem(batch, it, oleh, sumber));
    try {
      await dengBatasWaktu(batch.commit(), "Simpan");
    } catch (e) {
      potong.forEach((it) => gagal.push({ kunci: it.kunci, alasan: e.message }));
      selesai += potong.length;
      onProgress && onProgress(selesai, items.length);
      continue;
    }
    const hasilCek = await dalamKelompok(siap, 20, (s) => verifikasi(s).catch((e) => `gagal membaca ulang: ${e.message}`));
    potong.forEach((it, idx) => (hasilCek[idx] ? gagal.push({ kunci: it.kunci, alasan: hasilCek[idx] }) : berhasil.push(it.kunci)));
    selesai += potong.length;
    onProgress && onProgress(selesai, items.length);
  }
  return { berhasil, gagal };
}

// ---------- vendor & lini bisnis ----------
async function simpanDokumen(koleksi, id, dataMentah, { baru, oleh }) {
  try { return await simpanDokumenInti(koleksi, id, dataMentah, { baru, oleh }); }
  catch (err) { throw galatIzin(err); }
}
async function simpanDokumenInti(koleksi, id, dataMentah, { baru, oleh }) {
  pastikanSegar();
  const data = tanpaUndefined(dataMentah);
  const ref = doc(db, koleksi, id);
  if (baru) {
    const s = await dengBatasWaktu(getDocFromServer(ref), "Cek duplikat");
    if (s.exists()) throw new Error(`ID "${id}" sudah dipakai.`);
  }
  const batch = writeBatch(db);
  const payload = { ...data, diperbaruiPada: serverTimestamp(), diperbaruiOleh: oleh };
  batch.set(ref, payload, { merge: true });
  await dengBatasWaktu(batch.commit(), "Simpan");
  const srv = await dengBatasWaktu(getDocFromServer(ref), "Verifikasi");
  if (!srv.exists()) throw new Error("Dokumen tidak ditemukan di server setelah disimpan.");
  const aktual = srv.data();
  for (const [f, v] of Object.entries(data)) {
    if (!sama(aktual[f], v)) throw new Error(`Verifikasi gagal pada field "${f}".`);
  }
  return { id, ...normalisasi(aktual) };
}

// Satuan baku: nama bisa diubah (kode tetap, tarif menyimpan kode). Penghapusan dicek pemanggil (dipakai tarif?).
export const ubahSatuan = (kode, nama, { oleh }) => simpanDokumen("satuan_baku", kode, { nama }, { baru: false, oleh });
export const hapusSatuan = (kode) => hapusDokumen("satuan_baku", kode);
export const simpanVendor = (id, data, opsi) => simpanDokumen(KOLEKSI.vendor, id, data, opsi);
export const simpanLini = (id, data, opsi) => simpanDokumen(KOLEKSI.lini, id, data, opsi);

// Markup lini diatur dari halaman Quotation. Setelah markup berubah, batas harga aman (hargaMin)
// semua tarif di lini itu dihitung ulang supaya lampu margin akun sales tidak memakai angka lama.
export async function simpanMarkupLini(liniId, markup, { oleh }) {
  if (!kelolaSekarang()) throw new Error("Hanya akun master atau admin yang bisa mengubah markup.");
  const hasil = await simpanLini(liniId, { targetMargin: markup }, { baru: false, oleh });
  cacheTarget[liniId] = markup;
  const [snap, md] = await Promise.all([getDocs(query(collection(db, KOLEKSI.tarif), where("liniBisnisId", "==", liniId))), bacaKoleksi(KOLEKSI.modal)]);
  const peta = new Map(md.map((x) => [x.id, x.modal])), kerja = [];
  snap.forEach((d) => { const x = d.data(), m = x.modal !== undefined ? x.modal : peta.get(d.id), hm = hargaMinDari(m, liniId); if (!sama(x.hargaMin ?? null, hm)) kerja.push({ id: d.id, hm }); });
  for (let a = 0; a < kerja.length; a += 400) {
    const batch = writeBatch(db);
    kerja.slice(a, a + 400).forEach((k) => batch.update(doc(db, KOLEKSI.tarif, k.id), { hargaMin: k.hm }));
    await dengBatasWaktu(batch.commit(), "Simpan batas harga aman");
  }
  return { lini: hasil, diperbarui: kerja.length };
}

// Membuat zona/lokasi baru kalau belum ada. Yang sudah ada TIDAK diubah.
const KOLEKSI_LOKASI = ["trucking_trailer_zona", "distribusi_kecil_lokasi", "open_yard_lokasi", "lini_bisnis", "satuan_baku"];
export async function buatJikaBelumAda(koleksi, id, data, { oleh }) {
  pastikanSegar();
  if (!KOLEKSI_LOKASI.includes(koleksi)) throw new Error(`Koleksi "${koleksi}" tidak diizinkan.`);
  const ref = doc(db, koleksi, id);
  const s = await dengBatasWaktu(getDocFromServer(ref), "Cek lokasi");
  if (s.exists()) return { sudahAda: true };
  await simpanDokumen(koleksi, id, data, { baru: true, oleh });
  return { sudahAda: false };
}

// ---------- riwayat per lini (untuk laporan) ----------
export async function muatRiwayatLini(liniId) {
  const snap = await getDocs(query(collection(db, KOLEKSI.riwayat), where("liniBisnisId", "==", liniId)));
  const hasil = [];
  snap.forEach((d) => hasil.push({ id: d.id, ...normalisasi(d.data()) }));
  return hasil;
}

// ---------- ubah identitas tarif (layanan, lokasi, satuan, dimensi, vendor, lini) ----------
// Kunci tarif dibentuk dari identitasnya. Kalau identitas berubah, kuncinya ikut berubah:
// tarif baru dibuat, tarif lama dan modalnya dihapus, dan riwayat dicatat, semua dalam satu batch.
// Kunci baru tidak boleh sudah ada. Setelah tulis, kedua dokumen dibaca ulang dari server.
export async function ubahIdentitasTarif(kunciLama, baris, modal, { oleh, perubahan }) {
  const kunciBaru = baris.kunci;
  const pindah = kunciBaru !== kunciLama;
  if (pindah) {
    const ada = await dengBatasWaktu(getDocFromServer(doc(db, KOLEKSI.tarif, kunciBaru)), "Cek kunci baru");
    if (ada.exists()) throw new Error("Sudah ada tarif dengan identitas ini. Ubah isiannya, atau edit tarif yang sudah ada.");
  }
  const { kunci, ...isi } = tanpaUndefined(baris);
  const stempel = { diperbaruiPada: serverTimestamp(), diperbaruiOleh: oleh };
  const refTarif = doc(db, KOLEKSI.tarif, kunciBaru);
  const refModal = doc(db, KOLEKSI.modal, kunciBaru);
  const batch = writeBatch(db);
  batch.set(refTarif, { ...isi, kunci: kunciBaru, hargaMin: hargaMinDari(modal, isi.liniBisnisId), ...stempel });
  if (modal !== null && modal !== undefined) batch.set(refModal, { modal, ...stempel });
  else batch.delete(refModal);
  if (pindah) {
    batch.delete(doc(db, KOLEKSI.tarif, kunciLama));
    batch.delete(doc(db, KOLEKSI.modal, kunciLama));
  }
  batch.set(doc(collection(db, KOLEKSI.riwayat)), {
    kunci: kunciBaru, kunciLama: pindah ? kunciLama : null, liniBisnisId: isi.liniBisnisId, vendorId: isi.vendorId,
    jenis: "diubah", perubahan, sumber: "edit_identitas", oleh, tanggal: serverTimestamp(),
  });
  await dengBatasWaktu(batch.commit(), "Simpan perubahan identitas");

  const srv = await dengBatasWaktu(getDocFromServer(refTarif), "Verifikasi");
  if (!srv.exists()) throw new Error("Tarif tidak ditemukan di server setelah disimpan.");
  const aktual = srv.data();
  for (const [f, v] of Object.entries(isi)) {
    if (!sama(aktual[f], v)) throw new Error(`Verifikasi gagal pada field "${f}".`);
  }
  if (pindah) {
    const lama = await dengBatasWaktu(getDocFromServer(doc(db, KOLEKSI.tarif, kunciLama)), "Verifikasi");
    if (lama.exists()) throw new Error("Tarif lama masih ada di server setelah dipindah.");
  }
  return { kunci: kunciBaru };
}

// ---------- hapus PERMANEN ----------
// Setiap item yang dihapus meninggalkan catatan "dihapus" di riwayat berisi SALINAN
// lengkap item itu, jadi riwayat tidak yatim dan harga terakhir tetap bisa dilihat.
// Setelah itu dokumen dibaca ulang dari server untuk memastikan benar-benar hilang.
export async function hapusBanyak(kunciList, { oleh, onProgress }) {
  pastikanSegar();
  const berhasil = [];
  const gagal = [];
  let selesai = 0;
  for (let a = 0; a < kunciList.length; a += 100) {
    const potong = kunciList.slice(a, a + 100);
    const snaps = await Promise.all(potong.map((k) => dengBatasWaktu(getDocFromServer(doc(db, KOLEKSI.tarif, k)), "Baca item")));
    const snapModal = await Promise.all(potong.map((k) => getDocFromServer(doc(db, KOLEKSI.modal, k)).catch(() => null)));
    const batch = writeBatch(db);
    const siap = [];
    potong.forEach((k, i) => {
      if (!snaps[i].exists()) {
        gagal.push({ kunci: k, alasan: "sudah tidak ada di database" });
        return;
      }
      const data = { ...snaps[i].data() };
      const mLama = snapModal[i] && snapModal[i].exists() ? snapModal[i].data().modal : undefined;
      if (mLama !== undefined) data.modal = mLama;
      const refRiwayat = doc(collection(db, KOLEKSI.riwayat));
      batch.delete(snaps[i].ref || doc(db, KOLEKSI.tarif, k));
      batch.delete(doc(db, KOLEKSI.modal, k));
      batch.set(refRiwayat, {
        kunci: k,
        liniBisnisId: data.liniBisnisId || null,
        vendorId: data.vendorId || null,
        jenis: "dihapus",
        perubahan: [{ field: "modal", lama: data.modal ?? null, baru: null }],
        snapshot: data,
        sumber: "hapus",
        oleh,
        tanggal: serverTimestamp(),
      });
      siap.push({ k, refTarif: doc(db, KOLEKSI.tarif, k), refRiwayat });
    });
    if (siap.length) {
      try {
        await dengBatasWaktu(batch.commit(), "Hapus");
        const cek = await Promise.all(siap.map(async (x) => ({ x, t: await getDocFromServer(x.refTarif), r: await getDocFromServer(x.refRiwayat) })));
        cek.forEach(({ x, t, r }) => {
          if (t.exists()) gagal.push({ kunci: x.k, alasan: "masih ada di server setelah dihapus" });
          else if (!r.exists()) gagal.push({ kunci: x.k, alasan: "terhapus tetapi catatan riwayat tidak ditemukan" });
          else berhasil.push(x.k);
        });
      } catch (e) {
        siap.forEach((x) => gagal.push({ kunci: x.k, alasan: e.message }));
      }
    }
    selesai += potong.length;
    onProgress && onProgress(selesai, kunciList.length);
  }
  return { berhasil, gagal };
}

// Hapus dokumen master kecil (vendor, lini bisnis, lokasi open yard). Pemeriksaan
// "masih dipakai atau tidak" dilakukan di tampilan sebelum fungsi ini dipanggil.
const KOLEKSI_HAPUS = ["vendor", "vendor_rahasia", "lini_bisnis", "open_yard_lokasi", "profil_fasilitas", "satuan_baku"];
export async function hapusDokumen(koleksi, id) {
  pastikanSegar();
  if (!KOLEKSI_HAPUS.includes(koleksi)) throw new Error(`Koleksi "${koleksi}" tidak boleh dihapus dari sini.`);
  const ref = doc(db, koleksi, id);
  const batch = writeBatch(db);
  batch.delete(ref);
  await dengBatasWaktu(batch.commit(), "Hapus");
  const srv = await dengBatasWaktu(getDocFromServer(ref), "Verifikasi");
  if (srv.exists()) throw new Error("Dokumen masih ada di server setelah dihapus.");
}

// ---------- data sensitif vendor (rekening, kontrak): hanya akun master ----------
export async function muatVendorRahasia(id) {
  try {
    const s = await dengBatasWaktu(getDocFromServer(doc(db, "vendor_rahasia", id)), "Baca data rahasia vendor");
    return s.exists() ? normalisasi(s.data()) : null;
  } catch (e) {
    if (/permission/i.test(String(e.code) + e.message)) return null; // bukan master: memang tidak boleh melihat
    throw e;
  }
}
export const simpanVendorRahasia = (id, data, opsi) => simpanDokumen("vendor_rahasia", id, data, { baru: false, ...opsi });

// ---------- lokasi open yard ----------
export const simpanProfilFasilitas = (id, data, opsi) => simpanDokumen("profil_fasilitas", id, data, opsi);
export const simpanLokasiOpenYard = (id, data, opsi) => simpanDokumen("open_yard_lokasi", id, data, opsi);

// ---------- file (foto lokasi, dokumen vendor) ----------
const BATAS_UNGGAH_MS = 90000;
// Galat izin dari Firebase ditampilkan dalam bahasa yang bisa dipahami pengguna.
const galatIzin = (err) => (err && (err.code === "permission-denied" || err.code === "storage/unauthorized")
  ? new Error("Akun ini belum punya izin untuk menyimpan data ini. Hubungi owner untuk memberi peran yang sesuai.")
  : err);

export async function unggahFile(path, file, { oleh }) {
  const r = sRef(getStorage(app), path);
  try {
    await Promise.race([
      uploadBytes(r, file, { contentType: file.type, customMetadata: { oleh: oleh || "" } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Unggah file tidak selesai dalam 90 detik (cek koneksi atau Firebase Storage). File BELUM tersimpan.")), BATAS_UNGGAH_MS)),
    ]);
  } catch (err) { throw galatIzin(err); }
  const url = await dengBatasWaktu(getDownloadURL(r), "Ambil tautan file");
  return { url, path, nama: file.name, ukuran: file.size, tipe: file.type };
}
export async function hapusFile(path) {
  try {
    await dengBatasWaktu(deleteObject(sRef(getStorage(app), path)), "Hapus file");
  } catch (e) {
    if (e && e.code === "storage/object-not-found") return;
    throw e;
  }
}

// Katalog layanan tambahan (dibuat dari formulir penawaran per lini). Dipakai Master Rate untuk daftar tipe body tambahan.
export async function muatKatalogLayanan(lini) {
  try {
    const snap = await dengBatasWaktu(getDocs(query(collection(db, "layanan_tambahan"), where("lini", "==", lini))), "Baca katalog");
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn("Katalog layanan tidak terbaca:", e && e.code); return []; }
}

// Pola pengenalan S&K vendor (global). Bawaan ada di js/sk-parser.js; yang tersimpan di sini menggantikannya.
export async function muatPolaSk() {
  try { const s = await dengBatasWaktu(getDocFromServer(doc(db, "sk_pola", "global")), "Baca pola S&K"); return s.exists() ? (s.data().pola || []) : []; }
  catch (e) { console.warn("Pola S&K tidak terbaca:", e && e.code); return []; }
}
export const simpanPolaSk = (pola, { oleh }) => simpanDokumen("sk_pola", "global", { pola }, { baru: false, oleh });


// ---------- pemisahan modal (sekali jalan) dan penyegaran batas harga aman ----------
// Memindahkan modal dari dokumen master_tarif ke master_tarif/master_modal (hanya master yang bisa baca) dan mengisi hargaMin.
export async function hitungModalBelumDipisah() {
  const [snap, md] = await Promise.all([getDocs(collection(db, KOLEKSI.tarif)), getDocs(collection(db, KOLEKSI.modal)).catch(() => ({ size: 0, forEach() {} }))]);
  let inline = 0, tanpaBatas = 0; snap.forEach((d) => { const x = d.data(); if (x.modal !== undefined) inline++; else if (x.hargaMin === undefined) tanpaBatas++; });
  return { inline, tanpaBatas, total: snap.size, terpisah: md.size || 0 };
}
export async function pisahkanModal({ oleh, onProgress }) {
  pastikanSegar();
  if (!kelolaSekarang()) throw new Error("Hanya pemilik atau admin yang bisa memisahkan modal.");
  const lini = await bacaKoleksi(KOLEKSI.lini); cacheTarget = Object.fromEntries(lini.map((l) => [l.id, l.targetMargin]));
  const [snap, md] = await Promise.all([getDocs(collection(db, KOLEKSI.tarif)), bacaKoleksi(KOLEKSI.modal)]);
  const peta = new Map(md.map((x) => [x.id, x.modal])), kerja = [];
  snap.forEach((d) => { const x = d.data(); const m = x.modal !== undefined ? x.modal : peta.get(d.id); const hm = hargaMinDari(m, x.liniBisnisId); if (x.modal !== undefined || !sama(x.hargaMin ?? null, hm)) kerja.push({ id: d.id, inline: x.modal !== undefined, modal: m, hm }); });
  let selesai = 0;
  for (let a = 0; a < kerja.length; a += 200) {
    const potong = kerja.slice(a, a + 200), batch = writeBatch(db);
    potong.forEach((k) => {
      const upd = { hargaMin: k.hm };
      if (k.inline) { upd.modal = deleteField(); if (k.modal !== null && k.modal !== undefined) batch.set(doc(db, KOLEKSI.modal, k.id), { modal: k.modal, diperbaruiPada: serverTimestamp(), diperbaruiOleh: oleh }); }
      batch.update(doc(db, KOLEKSI.tarif, k.id), upd);
    });
    await dengBatasWaktu(batch.commit(), "Simpan pemisahan modal"); selesai += potong.length; onProgress && onProgress(selesai, kerja.length);
  }
  const sisa = await hitungModalBelumDipisah();
  if (sisa.inline) throw new Error(`${sisa.inline} tarif masih menyimpan modal di dokumen tarif setelah dipisahkan.`);
  return { diproses: kerja.length };
}
