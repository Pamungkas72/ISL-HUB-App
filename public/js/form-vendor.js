// ===========================================================
// FORM VENDOR — identitas lengkap vendor: identitas, kontak PIC,
// legalitas/izin (dengan file), kontrak (file), dan rekening.
// Kontrak dan rekening hanya terlihat dan bisa diubah akun master;
// disimpan di dokumen terpisah (vendor_rahasia) dengan aturan
// keamanan yang lebih ketat. Semua isian opsional kecuali nama.
// ===========================================================
import { e, $, $$, toast, bukaLayer, tutupLayer, konfirmasiKetik } from "./ui.js";
import { ikon } from "./ikon.js";
import { ketIkon } from "./keterangan.js";
import { slug } from "./kunci.js";
import { PALET_HUE, hueVendor, inisial } from "./warna.js";
import { perkecilGambar } from "./gambar.js";
import { tarifPerluVerifikasi, acuanVerifikasi } from "./pengingat.js";

const BADAN = ["PT", "CV", "Koperasi", "Perorangan", "Lainnya"];

// Dokumen legal wajib setiap vendor. Dipakai form vendor dan daftar vendor (belum lengkap).
export const DOK_WAJIB = [
  { jenis: "NPWP", nama: "NPWP", ket: "Nomor Pokok Wajib Pajak perusahaan" },
  { jenis: "NIB", nama: "NIB", ket: "Nomor Induk Berusaha" },
  { jenis: "Akta pendirian", nama: "Akta pendirian", ket: "Akta atau bukti pendirian perusahaan" },
];

// Kategori T&C vendor. Sama dengan kategori di tnc_library (T&C customer) supaya bisa
// dipadankan berdampingan saat membuat penawaran. Tambah kategori baru cukup di sini.
export const KATEGORI_TNC = [
  ["pembayaran", "Pembayaran / termin"], ["order", "Order / batas waktu"], ["pembatalan", "Pembatalan"], ["overtime", "Overtime"],
  ["jam_kerja", "Jam kerja"], ["toleransi", "Toleransi waktu"], ["masa_berlaku", "Masa berlaku harga"], ["pajak", "Pajak dan materai"],
  ["asuransi", "Asuransi dan klaim"], ["operasional", "Operasional / kapasitas"], ["biaya_tambahan", "Biaya tambahan"],
  ["biaya_tidak_termasuk", "Biaya tidak termasuk"], ["fasilitas", "Fasilitas termasuk"], ["pengecualian", "Pengecualian"], ["lainnya", "Lainnya"],
];
// Daftar tetap 15 syarat per lini: kritis (TOP, minimum, maksimum, batas order) dan tidak kritis.
// Isi hanya yang dipunyai vendor; baris yang tidak relevan dibiarkan kosong.
export const TNC_DAFTAR = [
  "Termin pembayaran (TOP)", "Minimum order / minimum biaya", "Maksimum kapasitas / volume", "Batas waktu order (cut-off)",
  "Masa berlaku harga", "Harga dan pajak (PPN/PPh)", "Biaya tambahan (overtime, waiting, dll.)", "Biaya yang tidak termasuk",
  "Fasilitas yang termasuk", "Jam kerja operasional", "Toleransi waktu / keterlambatan", "Pembatalan",
  "Asuransi dan klaim kerusakan / kehilangan", "Dokumen yang dibutuhkan", "Pengecualian dan lainnya",
];
export const labelKategoriTnc = (k) => (KATEGORI_TNC.find(([v]) => v === k) || [k, String(k).replace(/_/g, " ")])[1];

// Gabung klausul baru ke daftar lama: klausul dengan kategori + judul sama DIPERBARUI, lainnya ditambah.
export function gabungTnc(lama = [], baru = []) {
  const hasil = lama.map((x) => ({ ...x }));
  for (const b of baru) {
    const i = hasil.findIndex((x) => x.kategori === b.kategori && String(x.judul).trim().toLowerCase() === String(b.judul).trim().toLowerCase());
    if (i >= 0) hasil[i] = { ...hasil[i], ...b, id: hasil[i].id };
    else hasil.push({ ...b, id: b.id || `tnc_${Date.now()}_${hasil.length}` });
  }
  return hasil;
}
const JENIS_IZIN = ["NIB", "NPWP", "Akta pendirian", "SIUP / izin usaha", "Izin PLB", "Izin pengangkutan", "Izin lainnya"];

export function statusBerlaku(tanggal) {
  if (!tanggal) return null;
  const sisa = Math.ceil((new Date(tanggal).getTime() - Date.now()) / 86400000);
  if (isNaN(sisa)) return null;
  if (sisa < 0) return { kelas: "mati", teks: "Berakhir" };
  if (sisa <= 60) return { kelas: "warn", teks: `Segera berakhir (${sisa} hari)` };
  return { kelas: "ok", teks: "Berlaku" };
}
const lencana = (tgl) => {
  const s = statusBerlaku(tgl);
  return s ? `<span class="mr-status mr-status--${s.kelas}">${e(s.teks)}</span>` : "";
};

export async function bukaVendor({ S, DB, id, namaLini, render }) {
  const lama = id ? S.vendor.find((v) => v.id === id) : null;
  const master = S.kelola; // edit data vendor umum: pemilik dan admin
  const rahasia = S.master; // kontrak dan rekening: hanya pemilik
  const d = lama
    ? JSON.parse(JSON.stringify(lama))
    : { nama: "", alias: "", namaLengkap: "", jenisBadanUsaha: "", npwp: "", alamatKantor: "", alamatTagih: "", mapsUrl: "", emailUmum: "", terminBayar: "", warnaHue: null, liniBisnis: [], aktif: true, catatan: "", status: "terverifikasi", tnc: [] };
  d.pic = d.pic || [];
  d.legalitas = d.legalitas || [];
  d.penawaran = d.penawaran || [];
  d.tnc = d.tnc || [];
  d.topPerLini = d.topPerLini || {};
  d.status = d.status || "terverifikasi";
  let rhs = { rekening: [], kontrak: [] };
  // formulir dibagi per langkah: hanya satu bagian yang tampil, lalu Lanjut/Kembali
  let tahapAktif = "identitas";
  const idsLini = () => [...new Set([...(d.liniBisnis || []), ...d.tnc.map((k) => k.liniBisnisId).filter((x) => x && x !== "semua")])];
  const daftarTahap = () => [
    { k: "identitas", j: "Identitas" },
    { k: "pic", j: "Kontak PIC" },
    { k: "legal", j: "Legalitas" },
    { k: "penawaran", j: "Penawaran" },
    ...idsLini().map((l) => ({ k: `lini:${l}`, j: namaLini(l) })),
    { k: "umum", j: "Berlaku semua lini" },
    ...(master ? [{ k: "kontrak", j: "Kontrak" }, { k: "rekening", j: "Rekening" }] : [{ k: "kontrak", j: "Kontrak & rekening" }]),
  ];
  const hid = (k) => (k === tahapAktif ? "" : "hidden");

  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>${lama ? (master ? "Edit vendor" : "Detail vendor") : "Tambah vendor"}</h2><p class="mr-sub">${lama ? `ID: ${e(lama.id)}` : "ID dibuat otomatis dari nama."}</p></div><div class="vf-kepala__aksi">${master ? '<button type="button" class="mr-btn mr-btn--utama vf-kepala__simpan" id="v-simpan">Simpan</button>' : ""}<button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></div></header>
    <div class="mr-panel__isi" id="v-isi"><div class="mr-kosong">${ikon("riwayat", 24)}<p>Memuat…</p></div></div>
    <footer class="mr-panel__kaki vf-kaki" id="v-kaki"></footer>`,
    { lebar: "lebar" }
  );

  if (master && lama) {
    try {
      const r = await DB.muatVendorRahasia(lama.id);
      if (r) rhs = { rekening: r.rekening || [], kontrak: r.kontrak || [] };
    } catch (err) {
      toast(`<b>Data kontrak dan rekening gagal dimuat.</b><br>${e(err.message)}`, "bahaya");
    }
  }

  // ---------- unggah berkas (dikecilkan otomatis ke maksimal 4 MB) ----------
  const unggahBerkas = async (file0, folder) => {
    const vid = lama ? lama.id : slug(d.nama);
    const file = await perkecilGambar(file0);
    const path = `${folder}/${vid}/${Date.now()}_${String(file.name).replace(/[^A-Za-z0-9._-]/g, "_")}`;
    return DB.unggahFile(path, file, { oleh: S.user.email });
  };

  // ---------- util baris berulang ----------
  const baca = (wadah) =>
    $$(`[data-r="${wadah}"] .mr-rbaris`, panel).map((b, i) => {
      const o = {};
      $$("[data-f]", b).forEach((x) => (o[x.dataset.f] = x.value.trim()));
      return { ...(wadah === "legalitas" ? d.legalitas[i] : wadah === "penawaran" ? d.penawaran[i] : wadah === "kontrak" ? rhs.kontrak[i] : {}), ...o };
    });
  const TOP_PILIHAN = [3, 7, 14, 30, 45];
  // Kalimat syarat dibaca dari baris di form: setiap baris = satu kalimat dengan kategori dan tanda kritis.
  const kritisDari = (k) => (k.kritis !== undefined ? !!k.kritis : Number(k.urutan) >= 1 && Number(k.urutan) <= 4 && !!k.liniBisnisId && k.liniBisnisId !== "semua");
  const bacaTnc = () => {
    const hasil = [];
    $$('[data-r="tnc"] [data-tnc-baris]', panel).forEach((el) => {
      const teks = el.querySelector("[data-tnc-teks]").value.trim();
      if (!teks) return;
      const lini = el.dataset.lini;
      const lama = d.tnc.find((k) => k.id === el.dataset.id) || {};
      hasil.push({
        ...lama,
        id: el.dataset.id || `tnc_${Date.now()}_${hasil.length}`,
        liniBisnisId: lini,
        kategori: el.querySelector("[data-tnc-kat]").value,
        kritis: el.querySelector("[data-tnc-kritis]").checked,
        urutan: hasil.filter((x) => x.liniBisnisId === lini).length + 1,
        isi: teks,
        terjemahan: teks,
        judul: lama.judul || "",
        nilai: lama.nilai || "",
        selaraskan: lama.selaraskan || "",
        tipeCek: lama.tipeCek || "info",
      });
    });
    return hasil;
  };
  const tarifLini = (lini) => (lama ? S.tarif.filter((t) => t.vendorId === lama.id && t.liniBisnisId === lini) : []);
  // status verifikasi tarif vendor ini per lini (pengingat 1 tahun, lihat pengingat.js)
  function pillBerlaku(lini) {
    const rows = tarifLini(lini).filter((t) => t.aktif !== false);
    if (!rows.length) return "";
    const perlu = tarifPerluVerifikasi(rows).length;
    if (perlu) return `<span class="mr-status mr-status--warn">${perlu} tarif perlu verifikasi ulang</span>`;
    const tg = rows.map(acuanVerifikasi).filter(Boolean).sort()[0];
    return tg ? `<span class="mr-status mr-status--ok">Terverifikasi (paling lama ${e(tg)})</span>` : "";
  }
  /* pola pengenalan S&K: global (semua vendor) atau khusus vendor ini */
  let polaKhusus = Array.isArray(d.skPola) && d.skPola.length > 0;
  const polaGlobal = () => (window.__islSkPola && window.__islSkPola.length ? window.__islSkPola : (window.ISLSK ? window.ISLSK.POLA_AWAL : []));
  let polaEdit = (polaKhusus ? d.skPola : polaGlobal()).map((x) => ({ ...x }));
  const polaAktif = () => (window.ISLSK ? window.ISLSK.gabungPola(polaGlobal(), polaKhusus ? polaEdit : []) : []);
  const bacaPola = () => { const r = $$('[data-r="pola"] .vt-pola__r', panel); if (!r.length) return; polaEdit = r.map((row) => { const o = {}; $$("[data-p]", row).forEach((x) => (o[x.dataset.p] = x.value.trim())); return o; }).filter((x) => x.key && x.pola); };
  function htmlPola() {
    if (!window.ISLSK) return "";
    const S2 = window.ISLSK;
    return `<details class="vt-lini vt-pola" data-r="pola"><summary class="vt-lini__h"><b>Pola pengenalan S&amp;K</b><small class="mr-sub">${polaKhusus ? "khusus vendor ini" : "pola global semua vendor"} · ${polaEdit.length} pola</small></summary><div class="vt-lini__b">
      <p class="mr-sub" style="margin:0">Pola dipakai untuk menebak jenis cek dan nilai saat S&amp;K ditempel. Kolom pola memakai regex sederhana; nilai diambil dari bagian dalam tanda kurung pertama.</p>
      ${master ? `<label class="qt-cek"><span><input type="checkbox" data-polakhusus ${polaKhusus ? "checked" : ""}> Pakai penyesuaian khusus vendor ini (pola global tetap berlaku untuk parameter lain)</span></label>` : ""}
      ${polaEdit.map((x, i) => `<div class="vt-pola__r" data-i="${i}"><input data-p="label" value="${e(x.label || "")}" placeholder="Label" ${dis}><input data-p="key" value="${e(x.key || "")}" placeholder="kode_parameter" ${dis}><input data-p="pola" value="${e(x.pola || "")}" placeholder="Pola, mis. PPN\s*([\d.,]+)\s*%" ${dis}><select data-p="tipe" ${dis}>${Object.entries(S2.TIPE).map(([v, t]) => `<option value="${v}" ${x.tipe === v ? "selected" : ""}>${t}</option>`).join("")}</select><select data-p="ambil" ${dis}>${Object.entries(S2.AMBIL).map(([v, t]) => `<option value="${v}" ${x.ambil === v ? "selected" : ""}>${t}</option>`).join("")}</select><input data-p="syarat" value="${e(x.syarat || "")}" placeholder="Syarat kata (opsional)" ${dis}><input type="hidden" data-p="kategori" value="${e(x.kategori || "lainnya")}">${master ? `<button type="button" class="mr-ikonbtn mr-ikonbtn--bahaya" data-polahapus="${i}" aria-label="Hapus pola" title="Hapus pola">${ikon("tong", 14)}</button>` : ""}</div>`).join("")}
      ${master ? `<div class="vt-tempel__a"><button type="button" class="mr-btn mr-btn--kecil" data-polatambah>${ikon("plus", 14)}Tambah pola</button>${polaKhusus ? "" : `<button type="button" class="mr-btn mr-btn--kecil mr-btn--utama" data-polasimpan>Simpan sebagai pola global</button>`}<small class="mr-sub">${polaKhusus ? "Penyesuaian disimpan bersama data vendor saat tombol Simpan vendor ditekan." : "Pola global berlaku untuk semua vendor."}</small></div>` : ""}</div></details>`;
  }
  const KET_SYARAT = "Kalimat bertanda Kritis selalu tampil di quotation untuk lini itu, dan tetap bisa diedit di quotation. Kalimat lain bisa ditambahkan atau dibiarkan.";
  // Satu baris = satu kalimat syarat: kategori, tanda Kritis, dan teks yang bisa diedit langsung.
  function syaratBaris(k) {
    const kat = KATEGORI_TNC.some(([v]) => v === k.kategori) ? k.kategori : "lainnya";
    return `<div class="vt-sy ${kritisDari(k) ? "is-kritis" : ""}" data-tnc-baris data-id="${e(k.id)}" data-lini="${e(k.liniBisnisId || "semua")}">
      <div class="vt-sy__atas">
        <select class="vt-sy__kat" data-tnc-kat ${dis} aria-label="Kategori syarat">${KATEGORI_TNC.map(([v, t]) => `<option value="${v}" ${kat === v ? "selected" : ""}>${e(t)}</option>`).join("")}</select>
        <label class="vt-sy__kritis"><input type="checkbox" data-tnc-kritis ${kritisDari(k) ? "checked" : ""} ${dis}><span>Kritis</span></label>
        ${master ? `<button type="button" class="mr-ikonbtn vt-sy__hapus" data-hapus-tnc="${e(k.id)}" aria-label="Hapus syarat">${ikon("tong", 16)}</button>` : ""}
      </div>
      <textarea class="vt-sy__teks" data-tnc-teks rows="2" ${dis} placeholder="Tulis satu kalimat syarat">${e(String(k.terjemahan || k.isi || ""))}</textarea>
      ${k.perluCek ? '<span class="mr-status mr-status--warn">Perlu dicek</span>' : ""}
    </div>`;
  }
  function htmlTnc() {
    const ids = idsLini();
    const daftarDi = (lini) => d.tnc.filter((k) => (lini === "semua" ? !k.liniBisnisId || k.liniBisnisId === "semua" : k.liniBisnisId === lini));
    const salinPilih = (lini) => {
      const opsi = ids.filter((x) => x !== lini);
      return opsi.length ? `<label class="vt-sy-salin"><small>Salin ke</small><select data-salin="${e(lini)}" aria-label="Salin syarat ke lini lain"><option value="">Pilih lini…</option>${opsi.map((x) => `<option value="${e(x)}">${e(namaLini(x))}</option>`).join("")}</select></label>` : "";
    };
    const blok = (lini, judul, kepala, isiAtas) => {
      const daftar = daftarDi(lini);
      const kritis = daftar.filter(kritisDari).length;
      const kunci = lini === "semua" ? "umum" : `lini:${lini}`;
      return `<div class="vf-tahap" data-tahap="${e(kunci)}" ${hid(kunci)}><div class="vt-lini" data-lini-blok="${e(lini)}">
        <div class="vt-lini__h"><b>${e(judul)}</b><span class="vt-lini__ring">${daftar.length} syarat · ${kritis} kritis</span>${kepala}${ketIkon(KET_SYARAT)}</div>
        <div class="vt-lini__b">${isiAtas}
          <div class="vt-sy-daftar">${daftar.map(syaratBaris).join("") || '<p class="mr-sub vt-sy-kosong">Belum ada syarat. Tempel S&amp;K atau tambah satu per satu.</p>'}</div>
          ${master ? `<div class="vt-sy-aksi"><button type="button" class="mr-btn mr-btn--kecil" data-tambah="tnc:${e(lini)}">${ikon("plus", 14)}Tambah syarat</button>${lini !== "semua" ? salinPilih(lini) : ""}</div>
          <details class="vt-tempel"><summary>${ikon("file", 14)} Tempel S&amp;K (dipecah otomatis)</summary><textarea data-tempel="${e(lini)}" rows="5" placeholder="Tempel teks S&amp;K dari penawaran vendor. Sistem memecahnya per kalimat."></textarea><div class="vt-tempel__a"><button type="button" class="mr-btn mr-btn--kecil mr-btn--utama" data-pecah="${e(lini)}">Pecah S&amp;K</button><small class="mr-sub">Hasil bisa diedit. Centang Kritis untuk kalimat yang harus tampil di quotation.</small></div></details>` : ""}
        </div></div></div>`;
    };
    const blokLini = ids.map((lini) => {
      const top = d.topPerLini[lini];
      const nTarif = tarifLini(lini).length;
      const kepala = lama ? `<span class="qt-pill">${nTarif} tarif</span>${pillBerlaku(lini)}` : "";
      const atas = `<div class="mr-f"><span>TOP untuk lini ini</span><div class="qt-tpf">${TOP_PILIHAN.map((h) => `<button type="button" class="qt-chip ${top === h ? "qt-chip--on" : ""}" data-top="${e(lini)}:${h}" ${dis}>${h} hari</button>`).join("")}</div><small class="mr-sub">${top ? "" : `Belum dipilih${d.terminBayar ? `; memakai termin bawaan (${e(d.terminBayar)})` : ""}.`}</small></div>`;
      return blok(lini, namaLini(lini), kepala, atas);
    }).join("");
    const umum = blok("semua", "Berlaku semua lini vendor ini", "", `<p class="mr-sub vt-sy-kosong">Syarat di sini ikut untuk semua lini vendor ini.</p>`);
    return `<div data-r="tnc">
      ${ids.length ? "" : '<div class="vf-tahap" data-tahap="umum" ' + hid("umum") + '><p class="mr-banner mr-banner--peringatan" style="margin:0 0 10px">' + ikon("peringatan") + '<span>Centang <b>lini bisnis</b> yang dilayani di bagian Identitas dulu, lalu syarat dan TOP diisi per lini.</span></p></div>'}
      ${blokLini}
      ${umum}
    </div>`;
  }
  const sinkron = () => {
    bacaPola();
    if ($('[data-r="tnc"]', panel)) d.tnc = bacaTnc().map((k) => ({ ...k, perluCek: k.perluCek === true || k.perluCek === "1" }));
    if ($('[data-r="pic"]', panel)) d.pic = baca("pic");
    if ($('[data-r="legalitas"]', panel)) d.legalitas = baca("legalitas");
    if ($('[data-r="penawaran"]', panel)) d.penawaran = baca("penawaran");
    if ($('[data-r="kontrak"]', panel)) rhs.kontrak = baca("kontrak");
    if ($('[data-r="rekening"]', panel)) rhs.rekening = baca("rekening");
  };
  const dis = master ? "" : "disabled";
  const berkas = (b) => (b && b.file ? `<span class="mr-berkas"><a href="${e(b.file.url)}" target="_blank" rel="noopener">${ikon("file", 14)}${e(b.file.nama || "Lihat file")}</a>${master ? `<button type="button" class="mr-ikonbtn" data-hapusfile aria-label="Hapus file">${ikon("tutup", 14)}</button>` : ""}</span>` : "");
  // kartu dokumen wajib: status, nomor, dan tombol unggah langsung
  const kartuWajib = (w) => {
    const item = d.legalitas.find((l) => l.jenis === w.jenis && l.file) || d.legalitas.find((l) => l.jenis === w.jenis);
    const ada = !!(item && item.file);
    return `<div class="vd-wj ${ada ? "is-ada" : ""}">
      <div class="vd-wj__atas"><span class="vd-wj__ikon">${ikon(ada ? "cek" : "file", 16)}</span><span class="vd-wj__st">${ada ? "Sudah ada" : "Belum diunggah"}</span></div>
      <div class="vd-wj__teks"><b>${e(w.nama)}</b><small>${e(w.ket)}</small>${item && item.nomor ? `<small class="vd-wj__no">No. ${e(item.nomor)}</small>` : ""}</div>
      <div class="vd-wj__aksi">${ada ? `<a class="vd-wj__file" href="${e(item.file.url)}" target="_blank" rel="noopener">${ikon("file", 14)}Lihat</a>` : ""}${master ? `<label class="vd-wj__unggah">${ikon("upload", 14)}${ada ? "Ganti" : "Unggah"}<input type="file" data-wajib="${e(w.jenis)}" accept=".pdf,image/*" hidden></label>` : ""}</div>
    </div>`;
  };
  const unggah = (b) => (master ? `<label class="mr-btn mr-btn--kecil mr-unggah">${ikon("upload", 14)}${b && b.file ? "Ganti file" : "Unggah file"}<input type="file" data-file accept=".pdf,image/*" hidden></label>` : "");

  function navTahap() {
    const t = daftarTahap(), i = t.findIndex((x) => x.k === tahapAktif);
    return `<nav class="vf-nav" aria-label="Bagian formulir">
      <div class="vf-nav__progres">Langkah ${i + 1} dari ${t.length}<b>${e(t[i].j)}</b></div>
      <div class="vf-nav__daftar">${t.map((x, n) => `<button type="button" class="vf-nav__t ${x.k === tahapAktif ? "is-aktif" : ""}" data-vtahap="${e(x.k)}"${x.k === tahapAktif ? ' aria-current="step"' : ""}><span>${n + 1}</span>${e(x.j)}</button>`).join("")}</div>
    </nav>`;
  }
  // pindah langkah: isian yang sudah diketik disimpan dulu ke data, lalu bagian berikutnya ditampilkan
  function pindahTahap(arah, kunci = null) {
    bacaIdentitas();
    sinkron();
    const t = daftarTahap();
    if (kunci) tahapAktif = kunci;
    else { const i = t.findIndex((x) => x.k === tahapAktif); const n = Math.min(t.length - 1, Math.max(0, i + arah)); tahapAktif = t[n].k; }
    gambar();
    const isi = $("#v-isi", panel);
    if (isi) isi.scrollTop = 0;
    // bilah langkah hanya digeser seperlunya agar langkah yang dipilih terlihat
    const nav = $(".vf-nav__daftar", panel), aktif = $(".vf-nav__t.is-aktif", panel);
    if (nav && aktif) {
      const kiri = aktif.offsetLeft, kanan = kiri + aktif.offsetWidth;
      if (kiri < nav.scrollLeft) nav.scrollLeft = kiri - 12;
      else if (kanan > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = kanan - nav.clientWidth + 12;
    }
  }

  function gambar() {
    if (!daftarTahap().some((x) => x.k === tahapAktif)) tahapAktif = "identitas";
    // posisi gulir formulir dan bilah langkah dijaga supaya tidak melompat setiap kali bagian dirender ulang
    const isiLama = $("#v-isi", panel), navLama = $(".vf-nav__daftar", panel);
    const gulir = { isi: isiLama ? isiLama.scrollTop : 0, nav: navLama ? navLama.scrollLeft : 0 };
    const isi = $("#v-isi", panel);
    const hue = hueVendor({ ...d, id: lama ? lama.id : slug(d.nama || "x") });
    const sw = [`<button type="button" class="mr-swatch ${d.warnaHue == null ? "is-aktif" : ""}" data-hue="" title="Otomatis">A</button>`, ...PALET_HUE.map((h) => `<button type="button" class="mr-swatch ${d.warnaHue === h ? "is-aktif" : ""}" style="--vh:${h}" data-hue="${h}" aria-label="Warna ${h}"></button>`)].join("");
    isi.innerHTML = `
      ${navTahap()}
      <section class="mr-sec vf-tahap" data-tahap="identitas" ${hid("identitas")}><h3 class="vf-tahap__judul">Identitas</h3>
        <div class="mr-form">
          <label class="mr-f"><span>Nama singkat *</span><input id="v-nama" value="${e(d.nama)}" ${dis}></label>
          <label class="mr-f"><span>Nama panggilan</span><input id="v-alias" value="${e(d.alias)}" placeholder="Dipakai di daftar dan pencarian" ${dis}></label>
          <label class="mr-f"><span>Nama badan usaha lengkap</span><input id="v-lengkap" value="${e(d.namaLengkap)}" ${dis}></label>
          <label class="mr-f"><span>Jenis badan usaha</span><select id="v-badan" ${dis}><option value="">-</option>${BADAN.map((b) => `<option ${d.jenisBadanUsaha === b ? "selected" : ""}>${b}</option>`).join("")}</select></label>
          <label class="mr-f"><span>NPWP</span><input id="v-npwp" value="${e(d.npwp)}" ${dis}></label>
          <label class="mr-f mr-f--lebar"><span>Alamat kantor</span><textarea id="v-alamat" rows="2" ${dis}>${e(d.alamatKantor)}</textarea></label>
          <label class="mr-f mr-f--lebar"><span>Alamat penagihan</span><textarea id="v-tagih" rows="2" placeholder="Kosongkan kalau sama dengan alamat kantor" ${dis}>${e(d.alamatTagih)}</textarea></label>
          <label class="mr-f"><span>Link Google Maps kantor</span><input id="v-maps" value="${e(d.mapsUrl)}" placeholder="https://www.google.com/maps/..." ${dis}></label>
          <label class="mr-f"><span>Email umum</span><input id="v-email" type="email" value="${e(d.emailUmum)}" ${dis}></label>
          <label class="mr-f"><span>Termin bayar bawaan</span><input id="v-termin" value="${e(d.terminBayar)}" placeholder="Mis. 14 hari (TOP per lini diatur di bagian Syarat dan TOP)" ${dis}></label>
          ${d.status === "draf" ? `<div class="mr-banner mr-banner--peringatan mr-f--lebar">${ikon("peringatan")}<div><b>Vendor ini masih Draf.</b> Dibuat otomatis dari impor penawaran vendor. Periksa identitas, T&amp;C, dan tarifnya, lalu ubah <b>Status data</b> menjadi Terverifikasi.</div></div>` : ""}
          <label class="mr-f"><span>Status data</span><select id="v-status" ${dis}><option value="terverifikasi" ${d.status !== "draf" ? "selected" : ""}>Terverifikasi</option><option value="draf" ${d.status === "draf" ? "selected" : ""}>Draf (belum diperiksa)</option></select></label>
          <label class="mr-f"><span>Status</span><select id="v-aktif" ${dis}><option value="1" ${d.aktif !== false && !d.mitra ? "selected" : ""}>Aktif (tarif muncul di pencarian Quotation)</option><option value="0" ${d.aktif === false ? "selected" : ""}>Nonaktif (tidak muncul di Quotation)</option><option value="m" ${d.aktif !== false && d.mitra ? "selected" : ""}>Mitra (catatan pengetahuan saja, bukan dasar quotation)</option></select></label>
          <div class="mr-f mr-f--lebar"><span>Melayani lini bisnis</span><div class="mr-cekgrup" id="v-lini">${S.lini.map((l) => `<label class="mr-cek"><input type="checkbox" value="${e(l.id)}" ${(d.liniBisnis || []).includes(l.id) ? "checked" : ""} ${dis}><span>${e(namaLini(l.id))}</span></label>`).join("")}</div></div>
          <div class="mr-f mr-f--lebar"><span>Warna di tabel</span><div class="mr-swatches" id="v-warna">${sw}</div><small>Dipakai untuk membedakan baris vendor ini. Contoh tampilan: <span class="mr-vbadge" style="--vh:${hue}"><i>${e(inisial(d.nama))}</i>${e(d.nama || "Nama vendor")}</span></small></div>
          <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="v-catatan" rows="2" ${dis}>${e(d.catatan)}</textarea></label>
        </div>
      </section>
      <section class="mr-sec vf-tahap" data-tahap="pic" ${hid("pic")}><h3 class="vf-tahap__judul">Kontak PIC <span class="mr-sec__jml">${d.pic.length}</span></h3>
        <div data-r="pic">${d.pic.map((p, i) => `<div class="mr-rbaris" data-i="${i}"><input data-f="nama" placeholder="Nama PIC" value="${e(p.nama)}" ${dis}><input data-f="jabatan" placeholder="Jabatan" value="${e(p.jabatan)}" ${dis}><input data-f="telepon" placeholder="Telepon" value="${e(p.telepon)}" ${dis}><input data-f="email" placeholder="Email" value="${e(p.email)}" ${dis}>${master ? `<button type="button" class="mr-ikonbtn" data-hapus="pic:${i}" aria-label="Hapus">${ikon("tong", 16)}</button>` : ""}</div>`).join("") || '<p class="mr-sub">Belum ada kontak.</p>'}</div>
        ${master ? `<button type="button" class="mr-btn mr-btn--kecil" data-tambah="pic">${ikon("plus", 14)}Tambah kontak</button>` : ""}
      </section>
      <section class="mr-sec vf-tahap" data-tahap="legal" ${hid("legal")}><h3 class="vf-tahap__judul">Legalitas dan izin <span class="mr-sec__jml">${DOK_WAJIB.filter((w) => d.legalitas.some((l) => l.jenis === w.jenis && l.file)).length}/${DOK_WAJIB.length} wajib</span></h3>
        <div class="vd-wajib">${DOK_WAJIB.map((w) => kartuWajib(w)).join("")}</div>
        <p class="mr-sub vd-sub">Lainnya (SIUP, izin PLB, izin pengangkutan, dan sejenisnya) ditambah di daftar berikut.</p>
        <div data-r="legalitas">${d.legalitas.map((l, i) => `<div class="mr-rbaris mr-rbaris--izin" data-i="${i}"><select data-f="jenis" ${dis}>${JENIS_IZIN.map((j) => `<option ${l.jenis === j ? "selected" : ""}>${j}</option>`).join("")}</select><input data-f="nomor" placeholder="Nomor" value="${e(l.nomor)}" ${dis}><label class="mr-mini"><small>Berlaku sampai</small><input data-f="berlakuSampai" type="date" value="${e(l.berlakuSampai)}" ${dis}></label><span class="mr-rstat">${lencana(l.berlakuSampai)}</span><span class="mr-rfile">${berkas(l)}${unggah(l)}</span>${master ? `<button type="button" class="mr-ikonbtn" data-hapus="legalitas:${i}" aria-label="Hapus">${ikon("tong", 16)}</button>` : ""}</div>`).join("") || '<p class="mr-sub">Belum ada dokumen legalitas lain.</p>'}</div>
        ${master ? `<button type="button" class="mr-btn mr-btn--kecil" data-tambah="legalitas">${ikon("plus", 14)}Tambah dokumen</button>` : ""}
      </section>
      <section class="mr-sec vf-tahap" data-tahap="penawaran" ${hid("penawaran")}><h3 class="vf-tahap__judul">Penawaran dan lampiran harga vendor <span class="mr-sec__jml">${d.penawaran.length}</span></h3>
        <p class="mr-sub">Unggah PDF quotation atau lampiran harga dari vendor sebagai dasar tarif. Riwayat penawaran tersimpan di sini.</p>
        <div data-r="penawaran">${d.penawaran.slice().map((l, i) => `<div class="mr-rbaris mr-rbaris--izin" data-i="${i}"><input data-f="judul" placeholder="Judul / nomor penawaran vendor" value="${e(l.judul)}" ${dis}><label class="mr-mini"><small>Tanggal</small><input data-f="tanggal" type="date" value="${e(l.tanggal)}" ${dis}></label><label class="mr-mini"><small>Berlaku sampai</small><input data-f="berlakuSampai" type="date" value="${e(l.berlakuSampai)}" ${dis}></label><span class="mr-rstat">${lencana(l.berlakuSampai)}</span><input data-f="catatan" placeholder="Catatan (tarif apa saja)" value="${e(l.catatan)}" ${dis}><span class="mr-rfile">${berkas(l)}${unggah(l)}</span>${master ? `<button type="button" class="mr-ikonbtn" data-hapus="penawaran:${i}" aria-label="Hapus">${ikon("tong", 16)}</button>` : ""}</div>`).join("") || '<p class="mr-sub">Belum ada penawaran vendor.</p>'}</div>
        ${master ? `<button type="button" class="mr-btn mr-btn--kecil" data-tambah="penawaran">${ikon("plus", 14)}Tambah penawaran</button>` : ""}
      </section>
        ${htmlTnc()}
      ${
        rahasia
          ? `<section class="mr-sec vf-tahap mr-sec--rahasia" data-tahap="kontrak" ${hid("kontrak")}><h3 class="vf-tahap__judul">Kontrak <span class="mr-sec__jml">${rhs.kontrak.length}</span><span class="mr-sec__kunci">${ikon("peringatan", 13)}Hanya akun master</span></h3>
        <div data-r="kontrak">${rhs.kontrak.map((k, i) => `<div class="mr-rbaris mr-rbaris--izin" data-i="${i}"><input data-f="nomor" placeholder="Nomor kontrak" value="${e(k.nomor)}"><label class="mr-mini"><small>Mulai</small><input data-f="mulai" type="date" value="${e(k.mulai)}"></label><label class="mr-mini"><small>Berakhir</small><input data-f="berakhir" type="date" value="${e(k.berakhir)}"></label><span class="mr-rstat">${lencana(k.berakhir)}</span><span class="mr-rfile">${berkas(k)}${unggah(k)}</span><button type="button" class="mr-ikonbtn" data-hapus="kontrak:${i}" aria-label="Hapus">${ikon("tong", 16)}</button></div>`).join("") || '<p class="mr-sub">Belum ada kontrak.</p>'}</div>
        <button type="button" class="mr-btn mr-btn--kecil" data-tambah="kontrak">${ikon("plus", 14)}Tambah kontrak</button>
      </section>
      <section class="mr-sec vf-tahap mr-sec--rahasia" data-tahap="rekening" ${hid("rekening")}><h3 class="vf-tahap__judul">Rekening <span class="mr-sec__jml">${rhs.rekening.length}</span><span class="mr-sec__kunci">${ikon("peringatan", 13)}Hanya akun master</span></h3>
        <div data-r="rekening">${rhs.rekening.map((r, i) => `<div class="mr-rbaris" data-i="${i}"><input data-f="bank" placeholder="Bank" value="${e(r.bank)}"><input data-f="namaPemilik" placeholder="Nama pemilik rekening" value="${e(r.namaPemilik)}"><input data-f="noRekening" placeholder="Nomor rekening" inputmode="numeric" value="${e(r.noRekening)}"><input data-f="cabang" placeholder="Cabang" value="${e(r.cabang)}"><button type="button" class="mr-ikonbtn" data-hapus="rekening:${i}" aria-label="Hapus">${ikon("tong", 16)}</button></div>`).join("") || '<p class="mr-sub">Belum ada rekening.</p>'}</div>
        <button type="button" class="mr-btn mr-btn--kecil" data-tambah="rekening">${ikon("plus", 14)}Tambah rekening</button>
      </section>`
          : `<div class="vf-tahap" data-tahap="kontrak" ${hid("kontrak")}><p class="mr-banner">${ikon("info")}<span>Kontrak dan rekening vendor hanya bisa dilihat dan diubah pemilik.</span></p></div>`
      }
      <p class="mr-galat" id="v-galat" hidden></p>`;
    const adaTarif = lama && S.tarif.some((t) => t.vendorId === lama.id);
    const langkahUtama = (() => { const t = daftarTahap(), i = t.findIndex((x) => x.k === tahapAktif); return { kembali: i > 0, lanjut: i < t.length - 1 }; })();
    if (isiLama) { const isiBaru = $("#v-isi", panel); if (isiBaru) isiBaru.scrollTop = gulir.isi; }
    const navBaru = $(".vf-nav__daftar", panel);
    if (navBaru) navBaru.scrollLeft = gulir.nav;
    $("#v-kaki", panel).innerHTML = master
      ? `${lama && S.master ? `<button class="mr-btn mr-btn--hapus vf-kaki__hapus" id="v-hapus" ${adaTarif ? "disabled title=\"Masih punya tarif. Hapus tarifnya dulu.\"" : ""}>${ikon("tong", 16)}Hapus vendor</button>` : ""}<span class="mr-ruang"></span>${langkahUtama.kembali ? `<button class="mr-btn vf-kaki__mundur" id="v-mundur">${ikon("kembali", 16)}Kembali</button>` : ""}${langkahUtama.lanjut ? `<button class="mr-btn mr-btn--utama vf-kaki__maju" id="v-maju">Lanjut${ikon("maju", 16)}</button>` : ""}`
      : `<button class="mr-btn" data-aksi="tutup-layer">Tutup</button>`;
    if (master) {
      $("#v-simpan", panel).onclick = simpan;
      const mundur = $("#v-mundur", panel), maju = $("#v-maju", panel);
      if (mundur) mundur.onclick = () => pindahTahap(-1);
      if (maju) maju.onclick = () => pindahTahap(1);
      const h = $("#v-hapus", panel);
      if (h) h.onclick = hapus;
    }
  }

  function bacaIdentitas() {
    d.nama = $("#v-nama", panel).value.trim();
    d.namaLengkap = $("#v-lengkap", panel).value.trim();
    d.jenisBadanUsaha = $("#v-badan", panel).value;
    d.npwp = $("#v-npwp", panel).value.trim();
    d.alias = $("#v-alias", panel).value.trim();
    d.alamatKantor = $("#v-alamat", panel).value.trim();
    d.alamatTagih = $("#v-tagih", panel).value.trim();
    d.mapsUrl = $("#v-maps", panel).value.trim();
    d.emailUmum = $("#v-email", panel).value.trim();
    d.terminBayar = $("#v-termin", panel).value.trim();
    { const sv = $("#v-aktif", panel).value; d.aktif = sv !== "0"; d.mitra = sv === "m"; }
    d.status = $("#v-status", panel).value;
    d.liniBisnis = $$("#v-lini input:checked", panel).map((c) => c.value);
    d.catatan = $("#v-catatan", panel).value.trim();
  }

  async function simpan() {
    const g = $("#v-galat", panel);
    bacaIdentitas();
    sinkron();
    if (!d.nama) {
      g.textContent = "Nama vendor wajib diisi.";
      g.hidden = false;
      return;
    }
    const vid = lama ? lama.id : slug(d.nama);
    const data = {
      nama: d.nama, alias: d.alias || "", namaLengkap: d.namaLengkap, jenisBadanUsaha: d.jenisBadanUsaha, npwp: d.npwp, alamatKantor: d.alamatKantor, alamatTagih: d.alamatTagih || "", mapsUrl: d.mapsUrl, emailUmum: d.emailUmum,
      terminBayar: d.terminBayar, topPerLini: d.topPerLini, warnaHue: d.warnaHue ?? null, liniBisnis: d.liniBisnis, aktif: d.aktif, mitra: !!d.mitra, catatan: d.catatan,
      kontak: d.kontak || (d.pic[0] && d.pic[0].telepon) || "", pic: d.pic, legalitas: d.legalitas, penawaran: d.penawaran, tnc: d.tnc, status: d.status, website: d.website || "",
      skPola: polaKhusus ? polaEdit : [],
    };
    const tombol = $("#v-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    try {
      const t = await DB.simpanVendor(vid, data, { baru: !lama, oleh: S.user.email });
      const i = S.vendor.findIndex((v) => v.id === vid);
      if (i >= 0) S.vendor[i] = { ...S.vendor[i], ...t };
      else S.vendor.push(t);
      if (rhs.rekening.length || rhs.kontrak.length || (lama && rahasia)) await DB.simpanVendorRahasia(vid, { rekening: rhs.rekening, kontrak: rhs.kontrak }, { oleh: S.user.email });
      toast(`<b>Vendor tersimpan dan terverifikasi.</b> ${e(d.nama)}`, "ok");
      tutupLayer();
      render();
    } catch (err) {
      toast(`<b>GAGAL menyimpan vendor.</b><br>${e(err.message)}`, "bahaya");
      g.textContent = err.message;
      g.hidden = false;
      tombol.disabled = false;
      tombol.textContent = "Simpan vendor";
    }
  }

  async function hapus() {
    const ok = await konfirmasiKetik("Hapus vendor permanen?", `Vendor <b>${e(lama.nama)}</b> akan dihapus beserta data kontrak dan rekeningnya. File yang pernah diunggah tidak ikut terhapus dari penyimpanan. Tidak bisa dibatalkan.`, "HAPUS");
    if (!ok) return;
    try {
      await DB.hapusDokumen("vendor", lama.id);
      try {
        await DB.hapusDokumen("vendor_rahasia", lama.id);
      } catch {
        /* dokumen rahasia mungkin belum ada */
      }
      S.vendor.splice(S.vendor.findIndex((v) => v.id === lama.id), 1);
      toast(`<b>Vendor dihapus.</b> ${e(lama.nama)}`, "ok");
      tutupLayer();
      render();
    } catch (err) {
      toast(`<b>GAGAL menghapus vendor.</b><br>${e(err.message)}`, "bahaya");
    }
  }

  // ---------- event ----------
  panel.addEventListener("click", async (ev) => {
    const pecah = ev.target.closest("[data-pecah]"), polaT = ev.target.closest("[data-polatambah]"), polaH = ev.target.closest("[data-polahapus]"), polaS = ev.target.closest("[data-polasimpan]");
    if (pecah || polaT || polaH || polaS) {
      bacaIdentitas(); sinkron();
      if (pecah) {
        const lini = pecah.dataset.pecah, ta = $(`[data-tempel="${CSS.escape(lini)}"]`, panel), teks = ta ? ta.value : "";
        if (!teks.trim()) { toast("Tempel teks S&K vendor dulu.", "bahaya"); return; }
        const hasil = window.ISLSK.pecahBlok(teks, polaAktif());
        hasil.forEach((c, i) => d.tnc.push({ id: `tnc_${Date.now()}_${i}`, kategori: c.kategori || "lainnya", kritis: !!c.key, judul: c.label || "", liniBisnisId: lini, isi: c.teks, terjemahan: c.teks, nilai: c.nilai || "", selaraskan: "", tipeCek: c.tipe, kunciCek: c.key || "", perluCek: !!c.cek }));
        const n = hasil.length, nc = hasil.filter((c) => c.cek).length, nk = hasil.filter((c) => c.key).length;
        toast(`${n} klausul ditambahkan (${nk} dikenali untuk dicek${nc ? `, ${nc} perlu dicek` : ""}). Periksa lalu tekan Simpan vendor.`, "ok");
      }
      if (polaT) polaEdit.push({ key: "", label: "", pola: "", tipe: "angka", ambil: "angka", kategori: "lainnya" });
      if (polaH) polaEdit.splice(Number(polaH.dataset.polahapus), 1);
      if (polaS) {
        polaS.disabled = true;
        try { await DB.simpanPolaSk(polaEdit, { oleh: S.user.email }); window.__islSkPola = polaEdit.map((x) => ({ ...x })); toast("Pola global S&K tersimpan dan terverifikasi.", "ok"); }
        catch (er) { toast("Gagal menyimpan pola: " + er.message, "bahaya"); polaS.disabled = false; return; }
      }
      gambar(); return;
    }
    const langkah = ev.target.closest("[data-vtahap]");
    if (langkah) { pindahTahap(0, langkah.dataset.vtahap); return; }
    const hapusSyarat = ev.target.closest("[data-hapus-tnc]");
    if (hapusSyarat) {
      bacaIdentitas(); sinkron();
      d.tnc = d.tnc.filter((k) => k.id !== hapusSyarat.dataset.hapusTnc);
      gambar(); return;
    }
    const tambah = ev.target.closest("[data-tambah]");
    const hps = ev.target.closest("[data-hapus]");
    const hue = ev.target.closest("[data-hue]");
    const hf = ev.target.closest("[data-hapusfile]");
    const top = ev.target.closest("[data-top]");
    if (top) {
      bacaIdentitas();
      sinkron();
      const [lini, hari] = top.dataset.top.split(":");
      d.topPerLini[lini] = Number(hari);
      gambar();
    } else if (hue) {
      bacaIdentitas();
      sinkron();
      d.warnaHue = hue.dataset.hue === "" ? null : Number(hue.dataset.hue);
      gambar();
    } else if (tambah) {
      bacaIdentitas();
      sinkron();
      const w = tambah.dataset.tambah;
      if (w === "pic") d.pic.push({ nama: "", jabatan: "", telepon: "", email: "" });
      if (w.startsWith("tnc")) {
        d.tnc.push({ id: `tnc_${Date.now()}`, judul: "", liniBisnisId: w.split(":")[1] || "semua", kategori: "lainnya", kritis: false, isi: "", terjemahan: "", nilai: "", selaraskan: "", tipeCek: "info" });
      }
      if (w === "legalitas") d.legalitas.push({ jenis: "NIB", nomor: "", berlakuSampai: "" });
      if (w === "penawaran") d.penawaran.push({ judul: "", tanggal: new Date().toISOString().slice(0, 10), berlakuSampai: "", catatan: "" });
      if (w === "kontrak") rhs.kontrak.push({ nomor: "", mulai: "", berakhir: "" });
      if (w === "rekening") rhs.rekening.push({ bank: "", namaPemilik: "", noRekening: "", cabang: "" });
      gambar();
    } else if (hps) {
      bacaIdentitas();
      sinkron();
      const [w, i] = hps.dataset.hapus.split(":");
      const daftar = w === "pic" ? d.pic : w === "legalitas" ? d.legalitas : w === "penawaran" ? d.penawaran : w === "tnc" ? d.tnc : w === "kontrak" ? rhs.kontrak : rhs.rekening;
      const item = daftar[Number(i)];
      if (item && item.file && item.file.path) DB.hapusFile(item.file.path).catch(() => {});
      daftar.splice(Number(i), 1);
      gambar();
    } else if (hf) {
      bacaIdentitas();
      sinkron();
      const baris = hf.closest(".mr-rbaris");
      const w = baris.parentElement.dataset.r;
      const item = (w === "legalitas" ? d.legalitas : w === "penawaran" ? d.penawaran : rhs.kontrak)[Number(baris.dataset.i)];
      if (item && item.file) {
        DB.hapusFile(item.file.path).catch(() => {});
        delete item.file;
      }
      gambar();
    }
  });

  panel.addEventListener("change", async (ev) => {
    if (ev.target.matches("[data-salin]")) {
      const dari = ev.target.dataset.salin, ke = ev.target.value;
      ev.target.value = "";
      if (!ke) return;
      bacaIdentitas(); sinkron();
      const sudah = new Set(d.tnc.filter((k) => k.liniBisnisId === ke).map((k) => String(k.terjemahan || k.isi || "").trim()));
      let n = 0;
      d.tnc.filter((k) => k.liniBisnisId === dari).forEach((k, i) => {
        const teks = String(k.terjemahan || k.isi || "").trim();
        if (!teks || sudah.has(teks)) return;
        d.tnc.push({ ...k, id: `tnc_${Date.now()}_${i}`, liniBisnisId: ke });
        n++;
      });
      toast(`${n} syarat disalin ke ${e(namaLini(ke))}. Periksa lalu tekan Simpan vendor.`, "ok");
      gambar(); return;
    }
    if (ev.target.matches("[data-polakhusus]")) { bacaIdentitas(); sinkron(); polaKhusus = ev.target.checked; if (polaKhusus && !(Array.isArray(d.skPola) && d.skPola.length)) polaEdit = polaGlobal().map((x) => ({ ...x })); if (!polaKhusus) polaEdit = polaGlobal().map((x) => ({ ...x })); gambar(); return; }
    if (ev.target.matches("[data-wajib]")) {
      const input = ev.target;
      const file0 = input.files[0];
      if (!file0) return;
      bacaIdentitas();
      sinkron();
      if (!d.nama) { toast("Isi nama vendor dulu sebelum mengunggah file.", "bahaya"); return; }
      const jenis = input.dataset.wajib;
      let item = d.legalitas.find((l) => l.jenis === jenis);
      if (!item) { item = { jenis, nomor: "", berlakuSampai: "" }; d.legalitas.push(item); }
      const kartu = input.closest(".vd-wj");
      kartu && kartu.classList.add("is-simpan");
      try {
        const hasil = await unggahBerkas(file0, "vendor_dokumen");
        item.file = { url: hasil.url, path: hasil.path, nama: hasil.nama };
        toast(`<b>${e(jenis)} terunggah.</b> Klik <b>Simpan vendor</b> untuk menyimpan perubahan.`, "ok");
      } catch (err) {
        toast(`<b>GAGAL mengunggah file.</b><br>${e(err.message)}`, "bahaya");
      }
      gambar();
      return;
    }
    if (!ev.target.matches("[data-file]")) return;
    const baris = ev.target.closest(".mr-rbaris");
    const w = baris.parentElement.dataset.r;
    const file0 = ev.target.files[0];
    if (!file0) return;
    bacaIdentitas();
    sinkron();
    if (!d.nama) {
      toast("Isi nama vendor dulu sebelum mengunggah file.", "bahaya");
      return;
    }
    const item = (w === "legalitas" ? d.legalitas : w === "penawaran" ? d.penawaran : rhs.kontrak)[Number(baris.dataset.i)];
    const label = $(".mr-unggah", baris);
    label.classList.add("is-simpan");
    try {
      const hasil = await unggahBerkas(file0, w === "kontrak" ? "vendor_rahasia" : "vendor_dokumen");
      item.file = { url: hasil.url, path: hasil.path, nama: hasil.nama };
      toast(`<b>File terunggah.</b> ${e(hasil.nama)}. Klik <b>Simpan vendor</b> untuk menyimpan perubahan.`, "ok");
    } catch (err) {
      toast(`<b>GAGAL mengunggah file.</b><br>${e(err.message)}`, "bahaya");
    }
    gambar();
  });

  gambar();
}

// Hal yang masih kurang dari data vendor (kosong = lengkap). Vendor Internal dan yang nonaktif tidak dihitung.
export function kurangVendor(v) {
  if (v.aktif === false || v.id === "internal") return [];
  const k = [];
  if (v.status === "draf") k.push("Draf");
  if (!(v.pic || []).some((p) => p.telepon || p.email)) k.push("Kontak PIC");
  const kurangDok = DOK_WAJIB.filter((w) => !(v.legalitas || []).some((l) => l.jenis === w.jenis && l.file)).map((w) => w.nama);
  if (kurangDok.length) k.push(`Dokumen ${kurangDok.join(", ")}`);
  const izin = (v.legalitas || []).map((l) => statusBerlaku(l.berlakuSampai)).filter(Boolean);
  if (izin.some((x) => x.kelas === "mati")) k.push("Legalitas berakhir");
  else if (izin.some((x) => x.kelas === "warn")) k.push("Legalitas segera berakhir");
  return k;
}
