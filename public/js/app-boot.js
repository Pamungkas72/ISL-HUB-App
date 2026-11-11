// ===========================================================
// APP-BOOT — halaman app.html: Customer, Lembar Rekap, Laporan Order dan Laba, Quotation.
// Urutan: login -> data Master Rate -> data Fase 2 -> pasang tampilan (app-core.js) -> rute.
// Data Master Rate dibaca lewat db.js yang sama dengan halaman Master Rate.
// ===========================================================
import * as SatuanKelola from "./satuan-kelola.js";
window.ISLSatuanKelola = SatuanKelola;
import { watchAuthState, logoutUser } from "./auth.js";
import { auth, db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
/* Penyimpanan menu Uang Jalan (master dan admin): rute, driver, slip, dan pengaturan umum. Aturan: firestore.rules (uj_*). */
window.__islUJ = {
  muat: async () => {
    const ambil = async (k) => (await getDocs(collection(db, k))).docs.map((d) => ({ ...d.data(), id: d.id }));
    const [rute, driver, slip, peng] = await Promise.all([ambil("uj_rute"), ambil("uj_driver"), ambil("uj_slip"), getDoc(doc(db, "uj_pengaturan", "umum")).then((d) => (d.exists() ? d.data() : null))]);
    return { rute, driver, slip, peng };
  },
  simpan: (kol, id, data) => setDoc(doc(db, kol, id), { ...data, diubah: serverTimestamp() }),
  hapus: (kol, id) => deleteDoc(doc(db, kol, id)),
};
import { renderNav } from "./nav.js";
import { adalahMaster, emailMasterBelumDiisi, labelAkun } from "./config-akses.js";
import * as MRDB from "./db.js";
import { buatKunci } from "./kunci.js";
import { URUTAN_LINI } from "./standar.js";
import * as store from "./app-store.js";
import { ambilSalinan, simpanSalinan, bannerSinkron } from "./cache-lokal.js";
import { hapusLatarGambar, kecilkanBerkas, BATAS_BERKAS, BATAS_MENTAH, fmtUkuran, muatPdfjs } from "./gambar.js";
window.__islFile = { kecilkan: kecilkanBerkas, BATAS: BATAS_BERKAS, MENTAH: BATAS_MENTAH, fmt: fmtUkuran, pdfjs: muatPdfjs }; // pemampat unggahan, dipakai app-core.js
window.__islHapusLatar = hapusLatarGambar; // dipakai app-core.js dan sales.js untuk tanda tangan dan cap
import { toast } from "./ui.js";
import "./riwayat.js";

/* Halaman yang dipulihkan dari riwayat (tombol kembali) bisa tampil dari memori tanpa memeriksa login lagi.
   Karena itu halaman dimuat ulang, supaya gerbang login berjalan lagi dan akun yang sudah keluar diarahkan ke halaman masuk. */
window.addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });
const RUTE = ["customer", "rekap", "laporan", "quotation", "performa"];
const hariIni = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function tampilGalat(pesan) {
  const r = document.querySelector(".app-main");
  r.innerHTML = `<div style="padding:40px;max-width:640px"><h2 style="margin:0 0 8px">Halaman belum bisa dimuat</h2><p style="color:#5b6977;line-height:1.6">${pesan}</p><p><button class="mr-btn mr-btn--utama" onclick="location.reload()">Muat ulang</button> <a class="mr-btn" href="dashboard.html">Ke Beranda</a></p></div>`;
}
function pasangSkrip(src) { return new Promise((ok, gagal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => gagal(new Error("Gagal memuat " + src)); document.body.appendChild(s); }); }


/* Data Master Rate untuk modul quotation (window.__islMR). */
function bangunMR({ mr, ref }, user) {
  const urut = new Map(URUTAN_LINI.map((id, i) => [id, i]));
  return {
    tarif: mr.tarif.map((t) => ({ ...t, kunci: t.kunci || t.id })), vendor: mr.vendor,
    lini: mr.lini.slice().sort((a, b) => (urut.get(a.id) ?? 99) - (urut.get(b.id) ?? 99) || String(a.nama || a.id).localeCompare(String(b.nama || b.id), "id")),
    satuan: mr.satuan, ref: { zona: [], lokasiDistribusi: [], depo: [], warehouse: [], openYard: [], ...ref, gagal: !!ref.gagal }, user: { email: user.email },
  };
}
/* Setelah salinan lokal dipakai: ambil data terbaru dari server, lalu ganti isi layar dan buka simpan. */
async function segarkanDiBelakang(kunci, ambilServer, user) {
  try {
    const d = await ambilServer();
    window.__islMR = bangunMR(d, user);
    window.__ISL_DATA = d.fase2;
    window.__islMuatCU(d.fase2);
    window.__islMuatQT(d.fase2);
    simpanSalinan(kunci, d);
    window.__islSegar = true;
    if (window.__islSeedJikaPerlu) window.__islSeedJikaPerlu();
    const rapi = window.__islSegarkan ? window.__islSegarkan() : false;
    if (rapi) { bannerSinkron("Data terbaru dimuat", "ok"); setTimeout(() => { const el = document.getElementById("sinkron-banner"); if (el) el.hidden = true; }, 2500); }
    else bannerSinkron("Ada data terbaru. Selesaikan draf, lalu muat ulang halaman.", "info");
  } catch (e) {
    console.error("Gagal memperbarui data dari server:", e);
    bannerSinkron("Gagal memperbarui dari server. Simpan diblokir sampai muat ulang halaman.", "gagal");
  }
}

let mulai = false;
watchAuthState(
  async (user, profil) => {
    if (mulai) return; mulai = true;
    document.getElementById("user-email").textContent = labelAkun(user.email, user.displayName);
    try {
      const master = adalahMaster(user.email);
      if (emailMasterBelumDiisi()) console.warn("EMAIL_MASTER belum diisi di config-akses.js: semua akun hanya bisa melihat.");
      const sales = !!profil && profil.peran === "sales" && profil.status === "aktif";
      const admin = !!profil && profil.peran === "admin" && profil.status === "aktif";
      const kelola = master || admin; // pemilik atau admin: boleh mengurus Master Rate dan modal tarif
      window.__ISL_KELOLA = kelola;
      /* Layanan dari halaman Template per lini bisnis masuk ke Master Rate sebagai tarif baru tanpa vendor (belum_ditentukan). */
      const tarifTambah = async ({ lini, layanan, nama, satuanKode, ref, modal }) => {
        const kunci = buatKunci(lini, "belum_ditentukan", null, layanan, {}, satuanKode, null);
        const baris = { liniBisnisId: lini, vendorId: "belum_ditentukan", lokasiId: null, layanan, layananNama: nama, dimensi: {}, satuanKode, mataUang: "IDR", nilaiAsing: null, modal, hargaJualSaran: null, metodeHarga: null, hargaJualReferensi: ref, referensiSumber: ref != null ? "Template per lini bisnis" : null, customerId: null, berlakuDari: null, berlakuSampai: null, aktif: true, catatan: "Ditambahkan dari Template per lini bisnis." };
        const h = await MRDB.terapkanBanyak([{ jenis: "baru", kunci, baris }], { oleh: user.email, sumber: "template_tambah" });
        if (h.gagal.length) throw new Error(h.gagal[0].alasan);
        return { ...baris, kunci, id: kunci };
      };
      window.__ISL = {
        email: user.email, master, kelola, admin, hariIni, uid: user.uid, sales, peran: (profil && profil.peran) || (master ? "master" : "lihat"), nama: (profil && profil.nama) || user.displayName || "", telepon: (profil && profil.telepon) || "", ttdSales: (profil && profil.ttd) || "", kodeSales: (profil && profil.kodeSales) || "",
        tulis: store.tulis, unggahBlob: store.unggahBlob, diagnosa: store.diagnosa, buatLini: MRDB.buatJikaBelumAda, simpanMarkupLini: MRDB.simpanMarkupLini,
        tarifTambah,
        navAktif: (id) => renderNav(id === "quotation" || id === "customer" || id === "rekap" || id === "laporan" || id === "performa" ? id : "customer"),
      };
      renderNav(RUTE.includes(location.hash.slice(1)) ? location.hash.slice(1) : "customer");
      // Data dibaca dari server (Master Rate dan Fase 2 bersamaan). Kalau ada salinan lokal dari kunjungan sebelumnya,
      // halaman tampil dari salinan dulu; server dibaca di belakang layar dan simpan diblokir sampai data itu tiba.
      const kunci = "app:" + user.uid + ":" + (master ? "m" : admin ? "a" : sales ? "s" : "l");
      const ambilServer = async () => {
        const [[mr, ref], fase2] = await Promise.all([
          Promise.all([MRDB.muatSemua(), MRDB.muatReferensi().catch(() => ({ zona: [], lokasiDistribusi: [], depo: [], warehouse: [], openYard: [], gagal: true }))]),
          store.muatSemua({ master, sales, admin, uid: user.uid }),
        ]);
        return { mr, ref, fase2 };
      };
      const pasangData = (d) => { window.__islMR = bangunMR(d, user); window.__ISL_DATA = d.fase2; };
      /* Koleksi yang ditolak aturan untuk akun ini: sebutkan namanya, halaman lain tetap berjalan. */
      const tampilkanTidakTerbaca = () => { const t = window.__islTidakTerbaca; if (t && t.size) bannerSinkron("Sebagian data tidak bisa dibaca akun ini: " + [...t].join(", ") + ". Beri tahu pemilik untuk memeriksa aturan Firestore.", "gagal"); };
      const salinan = await ambilSalinan(kunci);
      if (salinan) { pasangData(salinan); window.__islSegar = false; bannerSinkron("Menampilkan data tersimpan. Memperbarui dari server…", "info"); }
      else { const d = await ambilServer(); pasangData(d); simpanSalinan(kunci, d); }
      tampilkanTidakTerbaca();
      MRDB.muatPolaSk().then((p) => { window.__islSkPola = p; }).catch(() => {});
      // 3. tampilan
      if (window.ISLCadangan && master) window.ISLCadangan.daftarSumber("fase2", () => (window.__ISL_REG ? window.__ISL_REG.ambil() : null));
      await pasangSkrip("js/logo.js");
      await pasangSkrip("js/formulir-lini.js");
      await pasangSkrip("js/pembuat-format.js");
      await pasangSkrip("js/sales.js");
      await pasangSkrip("js/app-core.js");
      if (salinan) segarkanDiBelakang(kunci, ambilServer, user);
      /* Halaman yang dulu berdiri sendiri (Beranda, Master Rate, Pengaturan) sekarang rute di dalam shell ini.
         Pindah menu tidak lagi memuat ulang halaman, sehingga tidak ada layar kosong dan jeda besar. */
      const MODUL = {
        beranda: { kontainer: "bd-root", muat: () => import("./dashboard.js"), mulai: "mulaiBeranda", judul: "Beranda" },
        "master-rate": { kontainer: "mr-kontainer", muat: () => import("./master-rate.js"), mulai: "mulaiMR", judul: "Master Rate" },
        "uang-jalan": { kontainer: "uj-root", muat: () => (window.ISLUJ ? Promise.resolve(window.ISLUJ) : pasangSkrip("js/uang-jalan.js").then(() => window.ISLUJ)), mulai: "mulai", judul: "Uang Jalan" },
        pengaturan: { kontainer: "st-root", muat: () => import("./pengaturan.js"), mulai: "mulaiPengaturan", judul: "Pengaturan" },
      };
      const KONTAINER_CUSTOMER = ["cu-root", "qt-root", "lp-root", "lr-root", "pf-root"];
      const tampilModul = (id) => {
        const m = MODUL[id];
        window.__rute = id;
        KONTAINER_CUSTOMER.forEach((k) => document.getElementById(k)?.classList.add("hidden"));
        Object.values(MODUL).forEach((x) => document.getElementById(x.kontainer)?.classList.toggle("hidden", x.kontainer !== m.kontainer));
        const h = document.querySelector(".app-topbar h1"); if (h) h.textContent = m.judul;
        document.title = m.judul + " — ISL HUB";
        renderNav(id);
        m.muat().then((mod) => mod[m.mulai](user, profil)).catch((err) => { console.error(err); toast("Halaman belum bisa dibuka. Muat ulang aplikasi.", "bahaya"); });
      };
      const rute = () => {
        const id = location.hash.slice(1);
        if (MODUL[id]) {
          if (sales && id !== "beranda") { location.hash = "#quotation"; return; } // akun sales tidak punya menu ini
          if (id === "uang-jalan" && !kelola) { location.hash = "#customer"; return; } // biaya internal: hanya master dan admin
          return tampilModul(id);
        }
        Object.values(MODUL).forEach((x) => document.getElementById(x.kontainer)?.classList.add("hidden"));
        /* Rekap untuk pemilik dan admin. Laporan Order & Laba hanya pemilik (memuat laba). Dashboard Performa untuk pemilik, admin, dan sales. */
        const ok = RUTE.includes(id) && !(!kelola && (id === "rekap" || id === "laporan")) && !(!master && id === "laporan") && !(!kelola && !sales && id === "performa");
        window.__rute = ok ? id : "customer";
        window.__pindahHalaman(ok ? id : "customer");
      };
      window.addEventListener("hashchange", rute); rute();
    } catch (e) {
      console.error(e);
      /* Akun yang belum diizinkan aturan server (mis. aturan admin belum di-deploy) dijelaskan dengan bahasa biasa. */
      const izin = e && (e.code === "permission-denied" || /permission|insufficient|false for '(list|get)'/i.test(String(e.message || "")));
      /* Aturan server menolak token yang login-nya lebih dari 24 jam 10 menit lalu. Kalau begitu, cukup masuk ulang. */
      if (izin && auth.currentUser) {
        try {
          const tok = await auth.currentUser.getIdTokenResult();
          if (Date.now() - Date.parse(tok.authTime) > 24 * 60 * 60 * 1000 + 10 * 60 * 1000) { await logoutUser(); location.href = "index.html"; return; }
        } catch (_) { /* abaikan: tampilkan pesan biasa */ }
      }
      tampilGalat(izin
        ? "Akun ini belum diizinkan membaca sebagian data di server. Pemilik perlu memasang aturan Firestore dan Storage terbaru: <code>firebase deploy --only firestore:rules,storage</code>, lalu muat ulang."
        : "Terjadi kendala saat memuat data: " + String(e.message || e).replace(/</g, "&lt;") + "<br>Cek koneksi internet dan pastikan aturan Firestore dan Storage sudah dipasang.");
    }
  },
  () => { window.location.href = "index.html"; }
);
