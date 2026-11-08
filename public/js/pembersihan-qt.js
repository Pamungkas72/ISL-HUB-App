// ===========================================================
// PEMBERSIHAN QUOTATION — untuk pemilik dan admin (Pengaturan).
// Mencari quotation yang diabaikan:
//  - terbit yang sudah lewat, atau hampir lewat, masa berlakunya: ingatkan sales, atau tandai tidak dipakai
//  - draf yang lama tidak diselesaikan: ingatkan sales, atau hapus
//  - ditolak dan tidak dipakai: hapus
// Aturan Firestore: admin hanya bisa menandai quotation terkirim (mengubah status). MENGHAPUS hanya akun master (kesepakatan 3 Nov 2026):
// untuk admin, tombol Hapus tidak tampil dan quotation yang siap dihapus menunggu master.
// ===========================================================
import { auth, db } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { e, toast, konfirmasi } from "./ui.js";

const HARI_DRAF_LAMA = 14; // draf yang belum berubah selama ini dianggap terlantar
const HARI_SEGERA = 7; // terbit yang berakhir dalam jangka ini ditandai "segera"

const hariIni = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD menurut zona waktu perangkat
const tanggal = (v) => (v && typeof v.toDate === "function" ? v.toDate().toLocaleDateString("sv-SE") : v ? String(v).slice(0, 10) : "");
const geserHari = (tgl, n) => { const d = new Date(tgl + "T00:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("sv-SE"); };
const tampilTgl = (v) => { const t = tanggal(v); if (!t) return "-"; const d = new Date(t + "T00:00:00"); return isNaN(d) ? t : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); };
const nomorWa = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.startsWith("0") ? "62" + d.slice(1) : d; };

const S = { daftar: [], muat: false, galat: "", sibuk: false, master: false };
const telepon = new Map(); // cache nomor WhatsApp sales (uid -> nomor)

/* Kelompokkan quotation yang perlu dibersihkan. Mengembalikan null untuk yang masih aktif dan tidak perlu tindakan. */
function kelompok(q, hi) {
  const berlaku = tanggal(q.berlakuSampai), dibuat = tanggal(q.dibuat);
  if (q.status === "terkirim" && !q.digantikanOleh && berlaku) {
    if (berlaku < hi) return "lewat";
    if (berlaku <= geserHari(hi, HARI_SEGERA)) return "segera";
    return null;
  }
  if (q.status === "draf" && dibuat && dibuat < geserHari(hi, -HARI_DRAF_LAMA)) return "draf";
  if (q.status === "ditolak" || q.status === "tidak_dipakai") return "tutup";
  return null;
}

function pesanPengingat(q, kel) {
  const nama = q.pemilikNama || "Kak";
  if (kel === "draf") return `Halo ${nama}, draf quotation ${q.nomor || q.labelDraf || ""} untuk ${q.customerNama || "customer"} sudah lama belum diselesaikan. Mohon dilanjutkan atau dibatalkan. Terima kasih.`;
  const kapan = kel === "lewat" ? "sudah lewat masa berlakunya" : `berlaku sampai ${tampilTgl(q.berlakuSampai)}`;
  return `Halo ${nama}, quotation ${q.nomor || ""} untuk ${q.customerNama || "customer"} ${kapan}. Mohon segera diperbarui, atau tandai tidak dipakai jika sudah tidak berlaku. Terima kasih.`;
}

async function muatDaftar() {
  S.galat = "";
  try {
    const snap = await getDocs(collection(db, "qt_quotations"));
    S.daftar = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    S.muat = true;
  } catch (er) {
    S.galat = er.code || er.message;
    S.muat = true;
  }
}

function baris(q, kel) {
  const aksi = [];
  if (kel === "lewat" || kel === "segera") {
    aksi.push(`<button class="mr-btn mr-btn--kecil" data-bersih="ingatkan" data-id="${e(q.id)}">Ingatkan sales</button>`);
    aksi.push(`<button class="mr-btn mr-btn--kecil" data-bersih="tandai" data-id="${e(q.id)}">Tandai tidak dipakai</button>`);
  } else if (kel === "draf") {
    aksi.push(`<button class="mr-btn mr-btn--kecil" data-bersih="ingatkan" data-id="${e(q.id)}">Ingatkan sales</button>`);
    aksi.push(S.master ? `<button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-bersih="hapus" data-id="${e(q.id)}">Hapus</button>` : `<span class="mr-sub">Penghapusan oleh akun master</span>`);
  } else {
    aksi.push(S.master ? `<button class="mr-btn mr-btn--kecil mr-btn--bahaya" data-bersih="hapus" data-id="${e(q.id)}">Hapus</button>` : `<span class="mr-sub">Menunggu akun master menghapus</span>`);
  }
  const tgl = kel === "lewat" || kel === "segera" ? `Berlaku s/d ${tampilTgl(q.berlakuSampai)}` : `Dibuat ${tampilTgl(q.dibuat)}`;
  const label = { lewat: "Lewat masa berlaku", segera: "Segera berakhir", draf: "Draf terlantar", tutup: q.status === "ditolak" ? "Ditolak" : "Tidak dipakai" }[kel];
  return `<tr><td><b>${e(q.nomor || q.labelDraf || "(belum bernomor)")}</b><div class="mr-sub">${e(q.customerNama || "-")}</div></td>
    <td>${e(q.pemilikNama || q.pemilikEmail || "-")}</td><td class="mr-sub">${e(tgl)}</td>
    <td><span class="st-badge">${e(label)}</span></td><td class="st-aksi">${aksi.join("")}</td></tr>`;
}

function isi(el) {
  if (!S.muat) { el.innerHTML = `<div class="st-stat">Memuat daftar quotation…</div>`; return; }
  if (S.galat) { el.innerHTML = `<div class="mr-banner mr-banner--peringatan"><div><b>Daftar quotation gagal dimuat.</b> ${e(S.galat)}</div></div>`; return; }
  const hi = hariIni(), kelompokList = { lewat: [], segera: [], draf: [], tutup: [] };
  for (const q of S.daftar) { const k = kelompok(q, hi); if (k) kelompokList[k].push(q); }
  const urut = (a, b) => (tanggal(a.berlakuSampai) || tanggal(a.dibuat)).localeCompare(tanggal(b.berlakuSampai) || tanggal(b.dibuat));
  const grup = [
    ["lewat", "Terbit yang sudah lewat masa berlaku", "Ingatkan sales untuk memperbarui, atau tandai tidak dipakai."],
    ["segera", "Terbit yang segera berakhir", "Masa berlakunya tinggal beberapa hari. Ingatkan sales sebelum lewat."],
    ["draf", "Draf yang terlantar", `Draf yang belum berubah lebih dari ${HARI_DRAF_LAMA} hari.`],
    ["tutup", "Ditolak dan tidak dipakai", S.master ? "Boleh dihapus permanen." : "Penghapusan permanen hanya bisa dilakukan akun master."],
  ];
  const jumlah = Object.values(kelompokList).reduce((a, x) => a + x.length, 0);
  el.innerHTML = `<p class="mr-sub" style="margin:0 0 6px">${jumlah ? `${jumlah} quotation perlu dibersihkan.` : "Tidak ada quotation yang perlu dibersihkan."} Perubahan di sini hanya mengubah status atau menghapus; isi quotation yang sudah terbit tidak diubah.</p>` +
    grup.filter(([k]) => kelompokList[k].length).map(([k, judul, ket]) => `
      <h4 style="margin:12px 0 2px">${e(judul)} (${kelompokList[k].length})</h4><p class="mr-sub" style="margin:0 0 4px">${e(ket)}</p>
      <table class="st-tabel"><thead><tr><th>Quotation</th><th>Sales</th><th>Tanggal</th><th>Keterangan</th><th></th></tr></thead>
      <tbody>${kelompokList[k].sort(urut).map((q) => baris(q, k)).join("")}</tbody></table>`).join("");
  if (S.sibuk) el.querySelectorAll("button").forEach((b) => { b.disabled = true; });
}

/* Dipanggil setiap kali Pengaturan dibangun ulang: daftar diambil sekali, lalu dipakai ulang dari memori. */
export async function pasangPembersihan(el, { master = false } = {}) {
  if (!el) return;
  S.master = !!master;
  if (!S.muat) { isi(el); await muatDaftar(); }
  isi(el);
}

async function ulang() {
  S.muat = false; const el = document.getElementById("st-bersih");
  if (el) isi(el);
  await muatDaftar();
  const el2 = document.getElementById("st-bersih");
  if (el2) isi(el2);
}

document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-bersih]"); if (!t) return;
  const q = S.daftar.find((x) => x.id === t.dataset.id); if (!q) return;
  const aksi = t.dataset.bersih;
  const kel = kelompok(q, hariIni()) || "tutup";
  try {
    if (aksi === "ingatkan") {
      if (!q.pemilikUid) return toast("Quotation ini tidak punya pemilik yang tercatat.", "bahaya");
      let no = telepon.get(q.pemilikUid);
      if (no === undefined) { const p = await getDoc(doc(db, "pengguna", q.pemilikUid)); no = nomorWa(p.exists() ? p.data().telepon : ""); telepon.set(q.pemilikUid, no); }
      if (!no) return toast(`<b>${e(q.pemilikNama || "Sales")}</b> belum mengisi nomor WhatsApp di profilnya.`, "bahaya");
      window.open(`https://wa.me/${no}?text=${encodeURIComponent(pesanPengingat(q, kel))}`, "_blank", "noopener");
      return;
    }
    if (aksi === "tandai") {
      if (!(await konfirmasi("Tandai tidak dipakai?", `<b>${e(q.nomor)}</b> tidak lagi dipakai. Isi dan nomornya tetap sama dan tetap tersimpan di riwayat.`, "Tandai"))) return;
      S.sibuk = true;
      await updateDoc(doc(db, "qt_quotations", q.id), { status: "tidak_dipakai", ditandaiPada: serverTimestamp(), ditandaiOleh: auth.currentUser ? auth.currentUser.email : "" });
      toast(`<b>${e(q.nomor)}</b> ditandai tidak dipakai.`);
    } else if (aksi === "hapus") {
      if (!S.master) return toast("Penghapusan hanya bisa dilakukan akun master.", "bahaya");
      if (!(await konfirmasi("Hapus quotation?", `<b>${e(q.nomor || q.labelDraf || "quotation ini")}</b> dihapus permanen. Tidak bisa dibatalkan.`, "Hapus"))) return;
      S.sibuk = true;
      await deleteDoc(doc(db, "qt_quotations", q.id));
      toast("Quotation dihapus.");
    }
  } catch (er) {
    toast(`<b>Gagal.</b> ${e(er.code || er.message)}`, "bahaya");
  } finally {
    S.sibuk = false;
  }
  if (aksi === "tandai" || aksi === "hapus") await ulang();
});
