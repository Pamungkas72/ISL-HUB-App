// ===========================================================
// LOKASI OPEN YARD — direktori lokasi (tab "Lokasi") dan formnya.
// Lokasi hanya DESKRIPSI (alamat, luas, fasilitas, koordinat, foto).
// Harga hanya ada di Master Rate (tarif), supaya tidak ada dua
// sumber harga. Lokasi berstatus "draf" sampai alamat, luas, dan
// minimal satu foto terisi; draf tidak bisa dipilih di quotation.
// ===========================================================
import { e, $, $$, toast, bukaLayer, tutupLayer, konfirmasiKetik, angka } from "./ui.js";
import { ikon } from "./ikon.js";
import { ketIkon } from "./keterangan.js";
import { slug } from "./kunci.js";
import { parseKoordinat } from "./lokasi-util.js";
import { perkecilGambar } from "./gambar.js";
import { vendorUntukLini } from "./tampilan-data.js";

export const FASILITAS = [
  ["gudangIndoor", "Gudang indoor"], ["officeKecil", "Office"], ["toilet", "Kamar mandi / toilet"], ["listrik", "Listrik"],
  ["sumberAir", "Sumber air"], ["pagar", "Pagar"], ["cctv", "CCTV"], ["security", "Security"],
];
const PERMUKAAN = [["", "-"], ["beton", "Beton"], ["paving_block", "Paving block"], ["aspal", "Aspal"], ["tanah_merah", "Tanah merah"], ["lainnya", "Lainnya"]];
const STATUS = [["draf", "Draf"], ["tersedia", "Tersedia"], ["tidak_tersedia", "Tidak tersedia"]];

const foto = (l) => (Array.isArray(l.fotos) && l.fotos.length ? l.fotos : (l.fotoUrls || []).filter((u) => /^https?:|^blob:/.test(String(u))).map((url) => ({ url })));

export function kelengkapan(l) {
  const kurang = [];
  if (!String(l.alamat || "").trim() || /PLACEHOLDER/i.test(l.alamat)) kurang.push("alamat");
  if (!(Number(l.luasTotalM2) > 0)) kurang.push("luas total");
  if (!foto(l).length) kurang.push("foto");
  return kurang;
}

// ---------- tab Lokasi ----------
export function htmlTabLokasi(S, namaVendor) {
  const daftar = S.ref.openYard;
  const pakai = (id) => S.tarif.filter((t) => t.liniBisnisId === "open_yard" && t.lokasiId === id).length;
  return `
    <div class="mr-toolbar">${ketIkon("Lokasi Open Yard milik mitra yang bisa disewakan. Harga sewanya diatur di tab Tarif (Open Yard). Lokasi tetap berstatus Draf sampai alamat, luas, dan foto lengkap.")}<span class="mr-ruang"></span>${S.master ? `<button class="mr-btn mr-btn--utama" data-aksi="lokasi-tambah">${ikon("plus", 16)}Tambah lokasi</button>` : ""}</div>
    ${
      daftar.length
        ? `<div class="mr-grid mr-grid--lokasi">${daftar
            .map((l) => {
              const f = foto(l);
              const kurang = kelengkapan(l);
              const draf = l.status === "draf" || kurang.length;
              const aktif = FASILITAS.filter(([k]) => (l.fasilitas || {})[k] === true).map(([, t]) => t);
              return `<div class="mr-kartu mr-lok">
                <div class="mr-lok__foto">${f.length ? `<img src="${e(f[0].url)}" alt="Foto ${e(l.nama)}" loading="lazy">${f.length > 1 ? `<span class="mr-lok__jml">${f.length} foto</span>` : ""}` : `<div class="mr-lok__kosong">${ikon("foto", 22)}<span>Belum ada foto</span></div>`}</div>
                <div class="mr-lok__isi">
                  <div class="mr-lok__judul"><h3>${e(l.nama)}</h3><span class="mr-status ${draf ? "mr-status--warn" : "mr-status--ok"}">${draf ? "Draf" : l.status === "tidak_tersedia" ? "Tidak tersedia" : "Tersedia"}</span></div>
                  <p class="mr-sub">${e(l.alamat && !/PLACEHOLDER/i.test(l.alamat) ? l.alamat : "Alamat belum diisi")}</p>
                  <div class="mr-lok__angka"><span><b>${l.luasTotalM2 ? angka(l.luasTotalM2) : "-"}</b> m² total</span><span><b>${pakai(l.id)}</b> tarif</span></div>
                  <div class="mr-lok__fas">${aktif.map((t) => `<span class="mr-tag">${e(t)}</span>`).join("") || '<span class="mr-sub">Fasilitas belum diisi</span>'}</div>
                  ${draf && kurang.length ? `<p class="mr-lok__kurang">${ikon("peringatan", 13)}Belum lengkap: ${e(kurang.join(", "))}</p>` : ""}
                  <div class="mr-lok__aksi">${l.koordinat && l.koordinat.mapsUrl ? `<a class="mr-btn mr-btn--kecil" href="${e(l.koordinat.mapsUrl)}" target="_blank" rel="noopener">${ikon("cari", 14)}Google Maps</a>` : ""}${pakai(l.id) ? `<button class="mr-btn mr-btn--kecil" data-aksi="lihat-lokasi" data-k="${e(l.id)}">Lihat tarif</button>` : ""}${S.master ? `<button class="mr-ikonbtn" title="Edit" data-aksi="lokasi-edit" data-k="${e(l.id)}">${ikon("edit")}</button>` : ""}</div>
                </div></div>`;
            })
            .join("")}</div>`
        : `<div class="mr-kosong">${ikon("pin", 28)}<p>Belum ada lokasi Open Yard.</p></div>`
    }`;
}

// ---------- form lokasi ----------
export function bukaLokasi({ S, DB, id, render }) {
  const lama = id ? S.ref.openYard.find((l) => l.id === id) : null;
  const d = lama ? JSON.parse(JSON.stringify(lama)) : { nama: "", alamat: "", luasTotalM2: "", luasTersedia: "", fasilitas: {}, aksesJalan: "", deskripsiKondisi: "", status: "draf", catatan: "", vendorId: "belum_ditentukan", koordinat: null, fotos: [] };
  d.fasilitas = d.fasilitas || {};
  d.fotos = foto(d);
  const vend = vendorUntukLini(S.vendor, S.tarif, "open_yard");
  const koordTeks = d.koordinat && d.koordinat.lat != null ? `${d.koordinat.lat}, ${d.koordinat.lng}` : "";

  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>${lama ? "Edit lokasi Open Yard" : "Tambah lokasi Open Yard"}</h2><p class="mr-sub">${lama ? `ID: ${e(lama.id)}` : "ID dibuat otomatis dari nama."}</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi">
      <div class="mr-form">
        <label class="mr-f"><span>Nama lokasi *</span><input id="l-nama" value="${e(d.nama)}" ${lama ? "" : ""}></label>
        <label class="mr-f"><span>Mitra pemilik lahan</span><select id="l-vendor">${vend.map((v) => `<option value="${e(v.id)}" ${v.id === d.vendorId ? "selected" : ""}>${e(v.nama)}</option>`).join("")}</select></label>
        <label class="mr-f mr-f--lebar"><span>Alamat detail</span><textarea id="l-alamat" rows="2">${e(/PLACEHOLDER/i.test(d.alamat) ? "" : d.alamat)}</textarea></label>
        <label class="mr-f mr-f--lebar"><span>Link Google Maps atau koordinat</span><input id="l-koord" value="${e(koordTeks || (d.koordinat && d.koordinat.mapsUrl) || "")}" placeholder="Tempel link Google Maps (apa pun), atau angka seperti -6.3269, 107.1370"><small id="l-koord-info"></small></label>
        <label class="mr-f"><span>Luas total area (m²)</span><input id="l-luas" inputmode="decimal" value="${e(d.luasTotalM2 || "")}"></label>
        <label class="mr-f"><span>Luas yang tersedia disewakan (m²)</span><input id="l-tersedia" inputmode="decimal" value="${e(d.luasTersedia || "")}"></label>
        <label class="mr-f"><span>Permukaan lahan</span><select id="l-permukaan">${PERMUKAAN.map(([v, t]) => `<option value="${v}" ${(d.fasilitas.permukaan || "") === v || (v && String(d.fasilitas.permukaan || "").startsWith(v)) ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="mr-f"><span>Status</span><select id="l-status">${STATUS.map(([v, t]) => `<option value="${v}" ${d.status === v ? "selected" : ""}>${t}</option>`).join("")}</select><small>Tersedia hanya bisa dipilih kalau alamat, luas, dan foto sudah ada.</small></label>
        <div class="mr-f mr-f--lebar"><span>Fasilitas</span><div class="mr-cekgrup" id="l-fas">${FASILITAS.map(([k, t]) => `<label class="mr-cek"><input type="checkbox" value="${k}" ${d.fasilitas[k] === true ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></div>
        <label class="mr-f mr-f--lebar"><span>Akses jalan</span><input id="l-akses" value="${e(d.aksesJalan || "")}" placeholder="Mis. Akses kontainer 40ft, lebar jalan 9 meter"></label>
        <label class="mr-f mr-f--lebar"><span>Kondisi lahan</span><textarea id="l-kondisi" rows="2">${e(/PLACEHOLDER/i.test(d.deskripsiKondisi || "") ? "" : d.deskripsiKondisi || "")}</textarea></label>
        <div class="mr-f mr-f--lebar"><span>Galeri foto</span><div class="mr-galeri" id="l-galeri"></div><label class="mr-btn mr-btn--kecil mr-unggah" style="align-self:flex-start">${ikon("upload", 14)}Tambah foto<input type="file" id="l-foto" accept="image/*" multiple hidden></label><small>Foto diperkecil otomatis sebelum diunggah (maks. 1280 px).</small></div>
        <label class="mr-f mr-f--lebar"><span>Catatan</span><textarea id="l-catatan" rows="2">${e(/PLACEHOLDER|Dibuat dari form tarif/i.test(d.catatan || "") && !lama ? "" : d.catatan || "")}</textarea></label>
      </div>
      <p class="mr-galat" id="l-galat" hidden></p>
    </div>
    <footer class="mr-panel__kaki">${lama ? `<button class="mr-btn mr-btn--hapus" id="l-hapus">${ikon("tong", 16)}Hapus lokasi</button>` : ""}<span class="mr-ruang"></span><button class="mr-btn" data-aksi="tutup-layer">Batal</button><button class="mr-btn mr-btn--utama" id="l-simpan">Simpan lokasi</button></footer>`,
    { lebar: "lebar" }
  );

  const idLokasi = () => (lama ? lama.id : slug($("#l-nama", panel).value));

  function galeri() {
    $("#l-galeri", panel).innerHTML = d.fotos.length
      ? d.fotos.map((f, i) => `<figure class="mr-foto"><img src="${e(f.url)}" alt="Foto lokasi ${i + 1}" loading="lazy"><button type="button" class="mr-foto__x" data-fx="${i}" aria-label="Hapus foto">${ikon("tutup", 14)}</button></figure>`).join("")
      : '<p class="mr-sub">Belum ada foto.</p>';
  }
  function infoKoord() {
    const r = parseKoordinat($("#l-koord", panel).value);
    const el = $("#l-koord-info", panel);
    if (r.kosong) el.innerHTML = "";
    else if (r.ok && r.tanpaKoordinat) el.innerHTML = `<span class="mr-hint mr-hint--ok">✓ Link tersimpan</span> · koordinat tidak terbaca otomatis, tapi tombol Google Maps tetap berfungsi · <a href="${e(r.mapsUrl)}" target="_blank" rel="noopener">Uji link</a>`;
    else if (r.ok) el.innerHTML = `<span class="mr-hint mr-hint--ok">✓ ${r.lat}, ${r.lng}</span> · <a href="${e(r.mapsUrl)}" target="_blank" rel="noopener">Buka di Google Maps</a>`;
    else el.innerHTML = `<span class="mr-hint" style="color:var(--mr-bahaya)">${e(r.pesan)}</span>`;
    return r;
  }
  galeri();
  infoKoord();

  panel.addEventListener("input", (ev) => {
    if (ev.target.id === "l-koord") infoKoord();
  });
  panel.addEventListener("click", (ev) => {
    const x = ev.target.closest("[data-fx]");
    if (x) {
      const f = d.fotos.splice(Number(x.dataset.fx), 1)[0];
      if (f && f.path) DB.hapusFile(f.path).catch(() => {});
      galeri();
    }
  });
  panel.addEventListener("change", async (ev) => {
    if (ev.target.id !== "l-foto") return;
    const berkas = [...ev.target.files];
    ev.target.value = "";
    if (!$("#l-nama", panel).value.trim()) {
      toast("Isi nama lokasi dulu sebelum mengunggah foto.", "bahaya");
      return;
    }
    const lid = idLokasi();
    const label = ev.target.closest(".mr-unggah");
    label.classList.add("is-simpan");
    let gagal = 0;
    for (const f0 of berkas) {
      try {
        const f = await perkecilGambar(f0);
        const path = `open_yard/${lid}/${Date.now()}_${d.fotos.length}.jpg`;
        const h = await DB.unggahFile(path, f, { oleh: S.user.email });
        d.fotos.push({ url: h.url, path: h.path, nama: h.nama });
        galeri();
      } catch (err) {
        gagal++;
        toast(`<b>GAGAL mengunggah ${e(f0.name)}.</b><br>${e(err.message)}`, "bahaya");
      }
    }
    label.classList.remove("is-simpan");
    if (!gagal && berkas.length) toast(`<b>${berkas.length} foto terunggah.</b> Klik <b>Simpan lokasi</b> untuk menyimpan perubahan.`, "ok");
  });

  $("#l-simpan", panel).onclick = async () => {
    const g = $("#l-galat", panel);
    g.hidden = true;
    const nama = $("#l-nama", panel).value.trim();
    const kor = infoKoord();
    const salah = [];
    if (!nama) salah.push("nama lokasi wajib diisi");
    if (!kor.ok) salah.push("koordinat tidak terbaca");
    const luas = Number(String($("#l-luas", panel).value).replace(",", ".")) || 0;
    const tersedia = Number(String($("#l-tersedia", panel).value).replace(",", ".")) || 0;
    const alamat = $("#l-alamat", panel).value.trim();
    let status = $("#l-status", panel).value;
    if (status === "tersedia") {
      const kurang = [];
      if (!alamat) kurang.push("alamat");
      if (!(luas > 0)) kurang.push("luas total");
      if (!d.fotos.length) kurang.push("minimal satu foto");
      if (kurang.length) salah.push(`status Tersedia butuh ${kurang.join(", ")}`);
    }
    if (salah.length) {
      g.textContent = `Belum bisa disimpan: ${salah.join("; ")}.`;
      g.hidden = false;
      return;
    }
    const fasilitas = { ...d.fasilitas, permukaan: $("#l-permukaan", panel).value };
    FASILITAS.forEach(([k]) => (fasilitas[k] = $(`#l-fas input[value="${k}"]`, panel).checked));
    const data = {
      namaLokasi: nama, alamat, luasTotalM2: luas || null, luasTersedia: tersedia, fasilitas, aksesJalan: $("#l-akses", panel).value.trim(),
      deskripsiKondisi: $("#l-kondisi", panel).value.trim(), status, catatan: $("#l-catatan", panel).value.trim(), vendorId: $("#l-vendor", panel).value || "belum_ditentukan",
      koordinat: kor.kosong ? null : { lat: kor.lat ?? null, lng: kor.lng ?? null, mapsUrl: kor.mapsUrl }, fotos: d.fotos, fotoUrls: d.fotos.map((f) => f.url), fotoWajibDiisi: true,
    };
    const tombol = $("#l-simpan", panel);
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";
    try {
      const lid = idLokasi();
      const t = await DB.simpanLokasiOpenYard(lid, data, { baru: !lama, oleh: S.user.email });
      const entri = { ...t, id: lid, nama, provinsi: "" };
      const i = S.ref.openYard.findIndex((x) => x.id === lid);
      if (i >= 0) S.ref.openYard[i] = entri;
      else S.ref.openYard.push(entri);
      toast(`<b>Lokasi tersimpan dan terverifikasi.</b> ${e(nama)}`, "ok");
      tutupLayer();
      render();
    } catch (err) {
      toast(`<b>GAGAL menyimpan lokasi.</b><br>${e(err.message)}`, "bahaya");
      g.textContent = err.message;
      g.hidden = false;
      tombol.disabled = false;
      tombol.textContent = "Simpan lokasi";
    }
  };

  const hapus = $("#l-hapus", panel);
  if (hapus) {
    const dipakai = S.tarif.filter((t) => t.liniBisnisId === "open_yard" && t.lokasiId === lama.id).length;
    if (dipakai) {
      hapus.disabled = true;
      hapus.title = `Masih dipakai ${dipakai} tarif. Hapus tarifnya dulu.`;
    }
    hapus.onclick = async () => {
      const ok = await konfirmasiKetik("Hapus lokasi permanen?", `Lokasi <b>${e(lama.nama)}</b> akan dihapus. Foto yang pernah diunggah tidak ikut terhapus dari penyimpanan. Tidak bisa dibatalkan.`, "HAPUS");
      if (!ok) return;
      try {
        await DB.hapusDokumen("open_yard_lokasi", lama.id);
        S.ref.openYard.splice(S.ref.openYard.findIndex((x) => x.id === lama.id), 1);
        toast(`<b>Lokasi dihapus.</b> ${e(lama.nama)}`, "ok");
        tutupLayer();
        render();
      } catch (err) {
        toast(`<b>GAGAL menghapus lokasi.</b><br>${e(err.message)}`, "bahaya");
      }
    };
  }
}
