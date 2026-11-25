// Data divisi non-Daily Job (Finance, Legal, CS, dll.). Satu akun satu divisi; izin anggota ikut peran siap pakai divisi (bisa diubah per akun).
// Tampilan ada di akun-divisi.js. Penulisan lewat klien master/admin (aturan Firestore: divisi, pengguna.divisiId).
import { db } from "./firebase-config.js";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { semuaPreset } from "./peran-akses.js";
import { aksesPreset, kodeUnit, catatLogAkun } from "./akses.js";

export const AKSES_KOSONG = { mr: 0, qt: 0, cu: 0, dj: 0, lg: 0 };
export const presetById = (id) => semuaPreset().find((p) => p.id === id) || null;
const urut = (l) => l.sort((a, b) => String(a.nama).localeCompare(String(b.nama), "id"));
/* Divisi awal; Marketing/BD dan Tracking sudah ada sebagai kelompok Daily Job. presetId kosong = hak akun tidak diubah (mis. Sales). */
const DIVISI_AWAL = [["Sales", ""], ["Finance", "finance"], ["Legal", "legal"], ["Operasional / CS", "ops"]];

export async function muatDivisi() { return urut((await getDocs(collection(db, "divisi"))).docs.map((d) => ({ id: d.id, ...d.data() }))); }
/** Isi divisi bawaan sekali saja (penanda sistem/divisi_awal), supaya divisi yang sengaja dihapus tidak muncul lagi. */
export async function isiDivisiAwal() {
  const p = doc(db, "sistem", "divisi_awal"); if ((await getDoc(p)).exists()) return false;
  await Promise.all(DIVISI_AWAL.map(([nama, presetId]) => setDoc(doc(collection(db, "divisi")), { nama, presetId, kepala: [], bawaan: true, dibuat: new Date().toISOString().slice(0, 10) })));
  await setDoc(p, { selesai: true }); return true;
}
export async function simpanDivisi(id, { nama, presetId }) {
  if (id) return updateDoc(doc(db, "divisi", id), { nama, presetId });
  return setDoc(doc(collection(db, "divisi")), { nama, presetId, kepala: [], dibuat: new Date().toISOString().slice(0, 10) });
}
export const arsipkanDivisi = (id, arsip) => updateDoc(doc(db, "divisi", id), { arsip });
export const hapusDivisi = (id) => deleteDoc(doc(db, "divisi", id));

const lepasKepala = async (divisiList, uid, kecuali) => { for (const d of divisiList) if (d.id !== kecuali && (d.kepala || []).includes(uid)) { await updateDoc(doc(db, "divisi", d.id), { kepala: d.kepala.filter((x) => x !== uid) }); d.kepala = d.kepala.filter((x) => x !== uid); } };
/* Peran Sales butuh kode dan daftar sales_publik; peran lain tidak. */
async function selaraskanSales(akun, peran, kodeTerpakai) {
  if (peran === "sales") { const kode = akun.kodeSales || kodeUnit("sales", kodeTerpakai); await setDoc(doc(db, "sales_publik", akun.id), { uid: akun.id, nama: akun.nama || akun.email, kode, targetBulanan: null }); return { kodeSales: kode }; }
  await deleteDoc(doc(db, "sales_publik", akun.id)).catch(() => {}); return {};
}
/** Masukkan akun ke divisi: izin mengikuti peran siap pakai divisi. jabatan: "kepala" atau "anggota". */
export async function masukkanKeDivisi(akun, divisi, jabatan, semuaDivisi, kodeTerpakai) {
  const pr = divisi.presetId ? presetById(divisi.presetId) : null; if (divisi.presetId && !pr) throw new Error("Peran siap pakai divisi ini tidak ditemukan. Ubah divisinya dulu.");
  const data = pr ? { divisiId: divisi.id, peran: pr.peran, akses: aksesPreset(pr), ...(await selaraskanSales(akun, pr.peran, kodeTerpakai)) } : { divisiId: divisi.id }; // tanpa peran siap pakai: hak akun tetap
  await updateDoc(doc(db, "pengguna", akun.id), data);
  await lepasKepala(semuaDivisi, akun.id, jabatan === "kepala" ? divisi.id : "");
  if (jabatan === "kepala") await updateDoc(doc(db, "divisi", divisi.id), { kepala: [akun.id] }), divisi.kepala = [akun.id];
  const lama = semuaDivisi.find((d) => d.id === akun.divisiId);
  await catatLogAkun({ uid: akun.id, email: akun.email }, "pindah-divisi", { divisi: lama ? lama.nama : null }, { divisi: divisi.nama, jabatan, peran: pr ? pr.nama : "hak akun tetap" });
}
/** Keluarkan dari divisi: kembali ke Belum diatur (hanya Beranda). */
export async function keluarkanDariDivisi(akun, semuaDivisi) {
  const dari = semuaDivisi.find((d) => d.id === akun.divisiId);
  if (dari && !dari.presetId) await updateDoc(doc(db, "pengguna", akun.id), { divisiId: deleteField() }); // divisi tanpa peran siap pakai (mis. Sales): hak akun tetap
  else { await updateDoc(doc(db, "pengguna", akun.id), { divisiId: deleteField(), peran: "lihat", akses: AKSES_KOSONG }); await deleteDoc(doc(db, "sales_publik", akun.id)).catch(() => {}); }
  await lepasKepala(semuaDivisi, akun.id, "");
  const lama = semuaDivisi.find((d) => d.id === akun.divisiId);
  await catatLogAkun({ uid: akun.id, email: akun.email }, "pindah-divisi", { divisi: lama ? lama.nama : null }, { divisi: null });
}
/** Peran siap pakai divisi berubah: terapkan ke semua anggotanya (izin per akun yang diubah manual ikut ditimpa; dikonfirmasi di layar). */
export async function terapkanPresetKeAnggota(divisi, anggota, kodeTerpakai) {
  const pr = presetById(divisi.presetId); if (!pr) return 0; // tanpa peran siap pakai: hak akun tidak diubah
  for (const a of anggota) await updateDoc(doc(db, "pengguna", a.id), { peran: pr.peran, akses: aksesPreset(pr), ...(await selaraskanSales(a, pr.peran, kodeTerpakai)) });
  return anggota.length;
}
