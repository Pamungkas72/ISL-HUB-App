// ===========================================================
// CACHE LOKAL — salinan data yang SUDAH dibaca akun ini dari server, disimpan di browser (IndexedDB).
//  - Dipakai hanya untuk menampilkan data lebih cepat saat halaman dibuka. Data dari server
//    tetap dibaca ulang di belakang layar, dan simpan diblokir sampai data itu tiba (lihat segar.js).
//  - Kunci per akun dan per peran, jadi sales tidak pernah memakai salinan milik master.
//  - Isi salinan hanya berisi apa yang boleh dibaca akun itu (sama dengan yang diterima dari server).
//  - Dibersihkan saat keluar (logoutUser) dan kedaluwarsa setelah 12 jam.
// ===========================================================
const NAMA_DB = "islhub-cache", STORE = "salinan", UMUR_MAKS_MS = 12 * 60 * 60 * 1000;

function buka() {
  return new Promise((ok, gagal) => {
    const r = indexedDB.open(NAMA_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => gagal(r.error);
  });
}

// Timestamp Firestore diubah jadi teks ISO supaya bisa disimpan dengan aman.
export function kanonik(v) {
  if (v && typeof v.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(kanonik);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = kanonik(v[k]); return o; }
  return v;
}

export async function simpanSalinan(kunci, nilai) {
  try {
    const db = await buka();
    await new Promise((ok, gagal) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put({ waktu: Date.now(), nilai: kanonik(nilai) }, kunci);
      t.oncomplete = ok; t.onerror = () => gagal(t.error); t.onabort = () => gagal(t.error);
    });
    db.close();
  } catch (e) { console.warn("Salinan lokal tidak tersimpan (tidak apa-apa, data tetap dari server):", e && e.message); }
}

export async function ambilSalinan(kunci) {
  try {
    const db = await buka();
    const v = await new Promise((ok, gagal) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(kunci);
      r.onsuccess = () => ok(r.result); r.onerror = () => gagal(r.error);
    });
    db.close();
    if (!v || Date.now() - v.waktu > UMUR_MAKS_MS) return null;
    return v.nilai;
  } catch (e) { return null; }
}

export function hapusSemuaSalinan() {
  try { indexedDB.deleteDatabase(NAMA_DB); } catch (e) { /* abaikan: browser tanpa IndexedDB */ }
}

/* Banner kecil di atas layar: status data (memperbarui / terbaru / gagal). */
export function bannerSinkron(teks, jenis) {
  let el = document.getElementById("sinkron-banner");
  if (!el) { el = document.createElement("div"); el.id = "sinkron-banner"; el.setAttribute("role", "status");
    el.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9000;padding:8px 14px;border-radius:999px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18)";
    document.body.appendChild(el); }
  el.textContent = teks;
  el.style.background = jenis === "gagal" ? "#FCEAEA" : jenis === "ok" ? "#E4F5EE" : "#FFF4E0";
  el.style.color = jenis === "gagal" ? "#A12626" : jenis === "ok" ? "#1F6B4B" : "#7A4A00";
  el.hidden = false;
  return el;
}
