// ===========================================================
// SESI — aturan keamanan login:
//  1. Tidak ada gerakan selama 10 menit  -> keluar otomatis (peringatan 60 detik sebelumnya).
//  2. Paling lama 24 jam sejak masuk     -> keluar otomatis, wajib login ulang.
// Dasar waktu:
//  - Aktivitas terakhir disimpan di localStorage, dibagi semua tab (gerak di tab mana pun dihitung).
//  - Waktu masuk diambil dari Firebase (user.metadata.lastLoginAt), jadi tidak bisa diulang
//    dengan membersihkan data browser.
// Catatan: ini pengaman di sisi browser. Untuk pembatasan 24 jam di sisi server, lihat
// CATATAN-SESI.md (syarat auth_time pada firestore.rules).
// ===========================================================
export const BATAS_DIAM_MS = 10 * 60 * 1000;
export const BATAS_SESI_MS = 24 * 60 * 60 * 1000;
export const PERINGATAN_MS = 60 * 1000;

const K_AKTIF = "islhub-aktif";   // waktu aktivitas terakhir (ms)
const K_MASUK = "islhub-masuk";   // penanda sign-in Firebase yang sudah dicatat

const baca = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const tulis = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const hapus = (k) => { try { localStorage.removeItem(k); } catch (e) {} };

export const catatAktif = () => tulis(K_AKTIF, String(Date.now()));
export function bersihkanSesi() { hapus(K_AKTIF); hapus(K_MASUK); }


export function waktuMasuk(user) {
  const m = user && user.metadata;
  if (!m) return null;
  const a = Number(m.lastLoginAt);
  if (a > 0) return a;
  const t = Date.parse(m.lastSignInTime || "");
  return Number.isFinite(t) ? t : null;
}

const lewatHari = (user, now, k) => { const fb = waktuMasuk(user); return !!fb && fb <= now + 60000 && now - fb >= k.sesi; };
const konfigDasar = { diam: BATAS_DIAM_MS, sesi: BATAS_SESI_MS, peringatan: PERINGATAN_MS };

/* Dipanggil sekali saat halaman dibuka / status login berubah. Mengembalikan "harian", "diam", atau null. */
export function periksaSesi(user, konfig = {}) {
  const k = { ...konfigDasar, ...konfig };
  const now = Date.now();
  if (lewatHari(user, now, k)) return "harian";
  const tanda = String(waktuMasuk(user) || "");
  if (baca(K_MASUK) !== tanda) { tulis(K_MASUK, tanda); catatAktif(); return null; } // login baru, atau sesi lama sebelum aturan ini ada
  const a = Number(baca(K_AKTIF)) || 0;
  if (!a) { catatAktif(); return null; }
  return now - a >= k.diam ? "diam" : null;
}

/* ---------- peringatan 60 detik sebelum keluar ---------- */
let kotak = null;
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const gayaTombol = "font:600 14px Inter,system-ui,sans-serif;padding:10px 16px;border-radius:10px;cursor:pointer;border:1.5px solid ";

function tampilPeringatan(sisa, keluar) {
  if (!kotak) {
    kotak = document.createElement("div");
    kotak.id = "sesi-peringatan";
    kotak.setAttribute("role", "alertdialog");
    kotak.setAttribute("aria-labelledby", "sesi-judul");
    kotak.style.cssText = "position:fixed;inset:0;z-index:99999;display:none;place-items:center;padding:16px;background:rgba(8,20,36,.62);font-family:Inter,system-ui,sans-serif";
    kotak.innerHTML = `<div style="width:100%;max-width:380px;background:var(--surface,#fff);color:var(--text,#13283D);border-radius:14px;padding:24px;box-shadow:0 18px 48px rgba(0,0,0,.35);border-top:5px solid #F7941D">
      <h2 id="sesi-judul" style="margin:0 0 8px;font:800 18px 'Plus Jakarta Sans',Inter,sans-serif;color:var(--head,#0A3D66)">Masih di sini?</h2>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.5">Tidak ada aktivitas. Demi keamanan, Anda akan keluar otomatis dalam <b id="sesi-hitung" style="font-variant-numeric:tabular-nums"></b>.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" id="sesi-tetap" style="${gayaTombol}#0A3D66;background:#0A3D66;color:#fff">Tetap masuk</button>
        <button type="button" id="sesi-keluar" style="${gayaTombol}var(--border,#DCE5EF);background:transparent;color:var(--text,#13283D)">Keluar sekarang</button>
      </div></div>`;
    document.body.appendChild(kotak);
    kotak.querySelector("#sesi-tetap").addEventListener("click", () => { catatAktif(); sembunyiPeringatan(); });
    kotak.querySelector("#sesi-keluar").addEventListener("click", () => keluar("manual"));
  }
  kotak.querySelector("#sesi-hitung").textContent = mmss(sisa);
  if (kotak.style.display !== "grid") { kotak.style.display = "grid"; kotak.querySelector("#sesi-tetap").focus(); }
}
export function sembunyiPeringatan() { if (kotak) kotak.style.display = "none"; }

/* ---------- pemantau: gerakan, jam diam, batas 24 jam ---------- */
let berjalan = false;
export function mulaiPemantauSesi(user, keluar, konfig = {}) {
  if (berjalan) return;
  berjalan = true;
  const k = { ...konfigDasar, ...konfig };
  let sudahKeluar = false;
  const keluarSekali = (alasan) => { if (sudahKeluar) return; sudahKeluar = true; keluar(alasan); };
  let terakhir = 0;
  const gerak = () => {
    const n = Date.now();
    if (n - terakhir < 3000) return;
    terakhir = n; catatAktif(); sembunyiPeringatan();
  };
  ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll", "click"].forEach((e) => window.addEventListener(e, gerak, { passive: true, capture: true }));
  const cek = () => {
    const n = Date.now();
    if (lewatHari(user, n, k)) return keluarSekali("harian");
    const a = Number(baca(K_AKTIF)) || n;
    const sisa = k.diam - (n - a);
    if (sisa <= 0) return keluarSekali("diam");
    if (sisa <= k.peringatan) tampilPeringatan(sisa, keluarSekali); else sembunyiPeringatan();
  };
  setInterval(cek, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) cek(); });
  window.addEventListener("focus", cek);
  cek();
}
