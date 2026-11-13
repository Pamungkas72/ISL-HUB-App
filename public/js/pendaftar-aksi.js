// ===========================================================
// PENDAFTAR SALES — tindak lanjut langsung oleh master: setujui atau tolak.
// Dibuka dari lonceng dan dari pop-up saat master login. Aturan yang sama dengan Pengaturan > Akun:
//  - Setujui hanya bisa setelah modal dipisah (sistem/modal), karena sales tidak boleh melihat modal.
//  - Sales wajib punya kode 2-6 huruf. Target bulanan diatur nanti di Pengaturan.
//  - Tolak = Nonaktif (akun tetap ada di daftar dan bisa diaktifkan lagi).
// ===========================================================
import { auth, db } from "./firebase-config.js";
import { collection, doc, getDocs, query, where, updateDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { hitungModalBelumDipisah } from "./db-firebase.js";
import { hitungModalFase2 } from "./app-store.js";
import { konfirmasi, e } from "./ui.js";
import { adalahMaster } from "./config-akses.js";
import { catatLogAkun, kodeSalesOtomatis } from "./akses.js";
import { linkWa, pesanAkunAktif } from "./kontak-admin.js";

const KODE_VALID = /^[A-Z]{2,6}$/;
const IKON_ORANG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8v6M14 11h6"/></svg>';
/* Admin hanya bisa diangkat pemilik (aturan Firestore juga menolak yang lain). */
const pemilik = () => { const u = auth.currentUser; return !!u && adalahMaster(u.email); };
const inisial = (t) => String(t || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();

export async function muatPendaftar() {
  const snap = await getDocs(query(collection(db, "pengguna"), where("status", "==", "menunggu")));
  return snap.docs.map((d) => ({ uid: d.id, nama: d.data().nama || "", email: d.data().email || "", telepon: d.data().telepon || "", peranDiminta: d.data().peranDiminta || "sales" }));
}
/* Kode yang sudah dipakai sales aktif (sales_publik bisa dibaca semua akun aktif). */
const kodeTerpakai = async () => { try { return (await getDocs(collection(db, "sales_publik"))).docs.map((d) => d.data().kode).filter(Boolean); } catch (_) { return []; } };

async function modalSudahDipisah() {
  const t = await hitungModalBelumDipisah();
  const f = await hitungModalFase2();
  return !t.inline && !f.total && f.tandai && !f.gagal.length;
}

/* Buka daftar pendaftar sebagai lembar aksi. onSelesai dipanggil setelah ada perubahan (untuk memperbarui lonceng). */
export function bukaPendaftarAksi({ onSelesai } = {}) {
  const lapis = document.createElement("div");
  lapis.className = "ip-lapis"; lapis.setAttribute("role", "dialog"); lapis.setAttribute("aria-modal", "true"); lapis.setAttribute("aria-label", "Pendaftar akun");
  lapis.innerHTML = `<div class="ip-kartu"><div class="ip-grip"></div><div class="ip-head"><span class="ip-ikon" aria-hidden="true">${IKON_ORANG}</span><div class="ip-head-teks"><div class="ip-judul">Pendaftar akun</div><div class="ip-sub" data-jml>Memuat daftar…</div></div><button type="button" class="ip-x" aria-label="Tutup">×</button></div><div class="ip-isi"></div></div>`;
  document.body.appendChild(lapis);
  const tutup = () => { lapis.remove(); document.removeEventListener("keydown", kunciEsc); };
  const kunciEsc = (ev) => { if (ev.key === "Escape") tutup(); };
  document.addEventListener("keydown", kunciEsc);
  lapis.addEventListener("click", (ev) => { if (ev.target === lapis) tutup(); });
  lapis.querySelector(".ip-x").addEventListener("click", tutup);
  const isi = lapis.querySelector(".ip-isi");
  const jml = lapis.querySelector("[data-jml]");

  let baru = []; // akun yang baru disetujui di lembar ini: tombol kabari via WhatsApp
  const gambar = async () => {
    try {
      const daftar = await muatPendaftar();
      const pakai = await kodeTerpakai();
      const blokBaru = baru.map((b) => `<div class="ip-item"><div class="ip-orang"><span class="ip-avatar" aria-hidden="true">${e(inisial(b.nama))}</span><div style="min-width:0"><div class="ip-nama">${e(b.nama)} aktif${b.kode ? ` · kode <b>${e(b.kode)}</b>` : ""}</div><div class="ip-mail">${e(b.email)}</div></div></div>${b.telepon ? `<div class="ip-aksi"><a class="ip-btn ip-btn--wa" href="${e(linkWa(b.telepon, pesanAkunAktif(b)))}" target="_blank" rel="noopener">Kabari via WhatsApp</a></div>` : ""}</div>`).join("");
      if (!daftar.length) { jml.textContent = "Semua sudah ditindaklanjuti"; isi.innerHTML = blokBaru + `<div class="ip-kosong">Tidak ada pendaftar yang menunggu.</div>`; return; }
      jml.textContent = `${daftar.length} akun menunggu keputusan Anda`;
      isi.innerHTML = blokBaru + daftar.map((x) => { const kodeAuto = x.peranDiminta === "sales" ? kodeSalesOtomatis(x.nama, pakai) : ""; if (kodeAuto) pakai.push(kodeAuto); return `
          <div class="ip-item" data-uid="${e(x.uid)}" data-tel="${e(x.telepon)}" data-sales="${x.peranDiminta === "sales" ? "1" : "0"}">
            <div class="ip-orang"><span class="ip-avatar" aria-hidden="true">${e(inisial(x.nama || x.email))}</span><div style="min-width:0"><div class="ip-nama">${e(x.nama || "(tanpa nama)")}</div><div class="ip-mail">${e(x.email)}${x.telepon ? ` · ${e(x.telepon)}` : ""}</div></div></div>
            <div class="ip-grid">
              <label class="ip-field">Peran<select class="ip-select" data-f="peran"><option value="sales" ${x.peranDiminta !== "admin" ? "selected" : ""}>Sales</option><option value="lihat" ${x.peranDiminta === "admin" ? "selected" : ""}>Lihat saja</option>${pemilik() ? `<option value="admin">Admin</option>` : ""}</select></label>
              <label class="ip-field">Kode sales<input class="ip-input" data-f="kode" value="${e(kodeAuto)}" maxlength="6" placeholder="BD" autocomplete="off" style="text-transform:uppercase"></label>
            </div>
            <div class="ip-aksi ip-aksi--baris"><button type="button" class="ip-btn ip-btn--utama" data-a="setujui">Setujui</button><button type="button" class="ip-btn ip-btn--bahaya" data-a="tolak">Tolak</button></div>
            <div class="ip-status" role="status" aria-live="polite"></div>
          </div>`; }).join("") +
        `<a class="ip-catatan" href="app.html#pengaturan">Target bulanan dan detail lain: Pengaturan &rsaquo; Akun</a>`;
    } catch (err) {
      jml.textContent = ""; isi.innerHTML = `<div class="ip-kosong">Daftar tidak bisa dimuat (${e(err.code || err.message)}). Coba lagi.</div>`;
    }
  };

  // Umpan balik ditulis di dalam kartu, supaya selalu terlihat (tidak tertutup lapisan atau notifikasi).
  const statusKartu = (kartu, jenis, html) => {
    const el = kartu.querySelector(".ip-status");
    el.className = "ip-status is-on is-" + jenis; el.innerHTML = html;
  };
  const kunciKartu = (kartu, kunci) => kartu.querySelectorAll("button").forEach((x) => (x.disabled = kunci));

  isi.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button[data-a]"); if (!b) return;
    const kartu = b.closest(".ip-item"), uid = kartu.dataset.uid;
    const nama = kartu.querySelector(".ip-nama").textContent, email = kartu.querySelector(".ip-mail").textContent.split(" · ")[0], telepon = kartu.dataset.tel || "";
    const peran = kartu.querySelector('[data-f="peran"]').value;
    const kode = kartu.querySelector('[data-f="kode"]').value.trim().toUpperCase();
    if (b.dataset.a === "setujui") {
      const peranFinal = peran === "sales" || (peran === "admin" && pemilik()) ? peran : "lihat";
      if (peranFinal === "sales" && !KODE_VALID.test(kode)) return statusKartu(kartu, "gagal", "Isi kode sales 2-6 huruf (contoh: BD), lalu tekan Setujui lagi.");
      kunciKartu(kartu, true);
      statusKartu(kartu, "info", "Memeriksa modal…");
      let siap = false;
      try { siap = await modalSudahDipisah(); }
      catch (err) { kunciKartu(kartu, false); return statusKartu(kartu, "gagal", `Tidak bisa memeriksa modal (${e(err.code || err.message)}). Coba lagi.`); }
      if (!siap) { kunciKartu(kartu, false); return statusKartu(kartu, "info", `<b>Belum bisa disetujui.</b> Pisahkan modal dulu (sekali saja): <a href="pengaturan.html">Buka Pengaturan &gt; Akun</a>, lalu tekan <b>Pisahkan modal sekarang</b>.`); }
      try {
        await updateDoc(doc(db, "pengguna", uid), { peran: peranFinal, kodeSales: peranFinal === "sales" ? kode : null, targetBulanan: null, status: "aktif", disetujuiPada: serverTimestamp() });
        if (peranFinal === "sales") await setDoc(doc(db, "sales_publik", uid), { uid, nama: nama || email, kode, targetBulanan: null });
        else await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      } catch (err) { kunciKartu(kartu, false); return statusKartu(kartu, "gagal", `<b>Gagal menyetujui.</b> ${e(err.code || err.message)}`); }
      baru.push({ nama, email, telepon, kode: peranFinal === "sales" ? kode : "" });
      await catatLogAkun({ uid, email }, "setujui", { peran: null, status: "menunggu" }, { peran: peranFinal, status: "aktif", kode: peranFinal === "sales" ? kode : null, target: null });
      if (onSelesai) onSelesai();
      gambar();
      return;
    }
    if (b.dataset.a === "tolak") {
      if (!(await konfirmasi("Tolak pendaftaran?", `<b>${e(email)}</b> tidak bisa masuk. Akunnya tetap ada di daftar sebagai Nonaktif dan bisa diaktifkan lagi.`, "Tolak"))) return;
      kunciKartu(kartu, true);
      try {
        await updateDoc(doc(db, "pengguna", uid), { status: "nonaktif", peran: null, ditolakPada: serverTimestamp() });
        await deleteDoc(doc(db, "sales_publik", uid)).catch(() => {});
      } catch (err) { kunciKartu(kartu, false); return statusKartu(kartu, "gagal", `<b>Gagal menolak.</b> ${e(err.code || err.message)}`); }
      await catatLogAkun({ uid, email }, "tolak", { peran: null, status: "menunggu" }, { peran: null, status: "nonaktif" });
      if (onSelesai) onSelesai();
      gambar();
    }
  });

  gambar();
  return { tutup };
}
