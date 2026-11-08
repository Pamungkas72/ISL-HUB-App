// ===========================================================
// LAPORAN UI — dialog "Ekspor laporan". Susunan isi laporan ada di
// laporan-model.js, pembuat file ada di laporan-pdf.js; file ini
// hanya tampilan pilihan, pratinjau halaman, dan tombol unduh.
// ===========================================================
import { e, $, $$, toast, bukaLayer } from "./ui.js";
import { ikon } from "./ikon.js";
import { susunKomparasi, susunSatuVendor, susunMentah, susunMaster } from "./laporan-model.js";
import { buatPdfKomparasi, buatPdfSatuVendor, buatPdfMaster, buatExcelKomparasi, buatExcelSatuVendor, buatExcelMentah, simpanExcel, angkaId, tglPendek, tglPanjang } from "./laporan-pdf.js";
import { hueVendor, inisial } from "./warna.js";
import { vendorUntukLini } from "./tampilan-data.js";

const adaModal = (r) => r.aktif !== false && typeof r.modal === "number";
const hariLalu = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const NAMA_PT = "PT Indo Sukses Logistik";

// ---------- pratinjau halaman (HTML) ----------
function htmlKomparasi(m, meta) {
  const kol = m.kolom;
  return `
    <div class="lp">
      ${kopHtml(m.judul, [`Data per ${tglPanjang()}`, `Vendor: ${kol.map((k) => k.nama).join(", ") || "-"}`, m.sejak ? `Perubahan sejak ${tglPanjang(m.sejak)}` : ""].filter(Boolean).join(" · "), meta)}
      <div class="lp-ring"><div><small>Item tarif</small><b>${m.ringkasan.item}</b></div><div><small>Vendor</small><b>${m.ringkasan.vendor}</b></div><div class="lp-ring--w"><small>Berubah</small><b>${m.ringkasan.berubah}</b></div></div>
      ${
        m.perubahan.length
          ? `<h4>1. Perubahan terbaru</h4><div class="lp-scroll"><table class="lp-tbl"><thead><tr><th>Layanan</th><th>Vendor</th><th class="r">Lama</th><th class="r">Baru</th><th class="r">Selisih</th><th class="r">Tanggal</th></tr></thead><tbody>${m.perubahan
              .slice(0, 12)
              .map((p) => `<tr><td>${e(p.layanan)}</td><td><span class="lp-v" style="--vh:${hueVendor(vendorDari(m, p.vendorId))}">${e(p.vendorNama)}</span></td><td class="r">${angkaId(p.lama)}</td><td class="r"><b>${angkaId(p.baru)}</b></td><td class="r ${p.pct > 0 ? "lp-naik" : "lp-turun"}">${p.pct === null ? "baru" : `${p.pct > 0 ? "▲" : "▼"} ${Math.abs(p.pct)}%`}</td><td class="r">${tglPendek(p.tanggal)}</td></tr>`)
              .join("")}</tbody></table></div>${m.perubahan.length > 12 ? `<p class="lp-cat">Menampilkan 12 dari ${m.perubahan.length} perubahan. File PDF memuat semuanya.</p>` : ""}`
          : ""
      }
      <h4>${m.perubahan.length ? "2" : "1"}. Perbandingan harga modal per vendor</h4>
      ${
        m.baris.length
          ? `<div class="lp-scroll"><table class="lp-tbl"><thead><tr><th>Layanan</th><th>Satuan</th>${kol.map((k) => `<th class="r lp-vh" style="--vh:${hueVendor(k.vendor || { id: k.id })}">${e(k.nama)}</th>`).join("")}</tr></thead><tbody>${m.baris
              .slice(0, 25)
              .map((b) => `<tr><td>${e(b.label)}</td><td class="lp-sat">${e(String(b.satuan || "").replace(/_/g, " "))}</td>${kol.map((k) => `<td class="r ${b.terendah.includes(k.id) ? "lp-min" : typeof b.sel[k.id] !== "number" ? "lp-kosong" : ""}">${typeof b.sel[k.id] === "number" ? angkaId(b.sel[k.id]) : "-"}</td>`).join("")}</tr>`)
              .join("")}</tbody></table></div>${m.baris.length > 25 ? `<p class="lp-cat">Menampilkan 25 dari ${m.baris.length} baris. File PDF dan Excel memuat semuanya.</p>` : ""}<p class="lp-cat">Sel hijau = modal terendah di antara vendor. Tanda - = vendor tidak memiliki tarif tersebut. Tarif yang belum diisi tidak dicantumkan.</p>`
          : `<p class="lp-cat">Tidak ada tarif terisi yang cocok dengan pilihan ini.</p>`
      }
      ${footHtml(meta)}
    </div>`;
}

function vendorDari(m, id) {
  const k = m.kolom.find((x) => x.id === id);
  return (k && k.vendor) || { id };
}

function htmlSatuVendor(m, meta) {
  const v = m.vendor || {};
  const h = hueVendor(v.id ? v : { id: m.vendorId });
  return `
    <div class="lp" style="--vh:${h}">
      ${kopHtml(m.judul, [v.namaLengkap, `Data per ${tglPanjang()}`, m.sejak ? `Perubahan sejak ${tglPanjang(m.sejak)}` : "Semua lini bisnis"].filter(Boolean).join(" · "), meta, true)}
      <div class="lp-ring"><div class="lp-ring--v"><small>Termin bayar</small><b>${e(v.terminBayar || "-")}</b></div><div><small>Lini bisnis</small><b>${m.ringkasan.lini}</b></div><div><small>Layanan terisi</small><b>${m.ringkasan.layanan}</b></div><div class="lp-ring--w"><small>Berubah 30 hari</small><b>${m.ringkasan.berubah30}</b></div></div>
      ${m.kelompok
        .map(
          (k) => `<div class="lp-lini"><span class="lp-v lp-v--b" style="--vh:${h}">${e(k.nama)}</span><small>${k.item.length} layanan</small></div>
          <div class="lp-scroll"><table class="lp-tbl"><thead><tr><th>Layanan</th><th>Satuan</th><th class="r">Modal (Rp)</th><th class="r">Diperbarui</th></tr></thead><tbody>${k.item
            .slice(0, 8)
            .map((i) => `<tr><td>${e(i.layanan)}</td><td class="lp-sat">${e(String(i.satuan || "").replace(/_/g, " "))}</td><td class="r"><b>${angkaId(i.modal)}</b> ${i.arah ? `<span class="${i.arah === "naik" ? "lp-naik" : "lp-turun"}">${i.arah === "naik" ? "▲" : "▼"}</span>` : ""}</td><td class="r">${tglPendek(i.diperbarui)}</td></tr>`)
            .join("")}</tbody></table></div>${k.item.length > 8 ? `<p class="lp-cat">Menampilkan 8 dari ${k.item.length} layanan. File PDF dan Excel memuat semuanya.</p>` : ""}`
        )
        .join("")}
      ${m.kelompok.length ? "" : `<p class="lp-cat">Vendor ini belum punya tarif terisi.</p>`}
      <p class="lp-cat">Tarif yang belum diisi tidak dicantumkan. ▲ ▼ = perubahan dari harga sebelumnya.</p>
      ${footHtml(meta)}
    </div>`;
}

function kopHtml(judul, sub, meta, berwarna) {
  return `<div class="lp-kop ${berwarna ? "lp-kop--v" : ""}"><div><div class="lp-prs">${e(NAMA_PT)} · Marketing dan Business Development</div><div class="lp-jdl">${e(judul)}</div><div class="lp-sub">${e(sub)}</div></div><div class="lp-rhs"><span>Rahasia · hanya internal</span><small>Angka dalam rupiah (harga modal)</small></div></div>`;
}
const footHtml = (meta) => `<div class="lp-foot"><span>Dicetak ${tglPanjang()} oleh ${e(meta.oleh || "-")} · ISL HUB Marketing dan BD</span><span>Halaman 1</span></div>`;

// ---------- dialog ----------
export function bukaLaporan({ S, DB, namaLini, namaVendor, namaSatuan, awalLini }) {
  const demo = DB.MODE === "demo";
  const meta = { perusahaan: NAMA_PT, unit: "Marketing dan Business Development", oleh: S.user.email };
  const st = { jenis: "komparasi", format: "pdf", lini: awalLini && awalLini !== "semua" ? awalLini : "", vendorId: "", sejak: hariLalu(30), model: null };
  const liniAda = S.lini.filter((l) => S.tarif.some((t) => t.liniBisnisId === l.id && adaModal(t)));

  const panel = bukaLayer(
    `<header class="mr-panel__kepala"><div><h2>Ekspor laporan</h2><p class="mr-sub">Pilih jenis laporan, lalu lihat pratinjau sebelum diunduh.</p></div><button class="mr-ikonbtn" data-aksi="tutup-layer" aria-label="Tutup">${ikon("tutup")}</button></header>
    <div class="mr-panel__isi" id="lp-isi"></div>
    <footer class="mr-panel__kaki"><button class="mr-btn" data-aksi="tutup-layer">Tutup</button><button class="mr-btn" id="lp-pratinjau">${ikon("file", 16)}Pratinjau</button><button class="mr-btn mr-btn--utama" id="lp-unduh">${ikon("download", 16)}<span id="lp-unduh-label">Unduh PDF</span></button></footer>`,
    { lebar: "lebar" }
  );

  function vendorKomparasi() {
    if (!st.lini) return [];
    const ids = [...new Set(S.tarif.filter((t) => t.liniBisnisId === st.lini && adaModal(t)).map((t) => t.vendorId))];
    return ids.map((id) => S.vendor.find((v) => v.id === id) || { id, nama: namaVendor(id) });
  }
  function gambar() {
    const isi = $("#lp-isi", panel);
    const vk = vendorKomparasi();
    const vendorSemua = S.vendor.filter((v) => S.tarif.some((t) => t.vendorId === v.id && adaModal(t)));
    isi.innerHTML = `
      <div class="lp-pilih">
        ${[["master", "Master tarif", "Semua lini dan vendor, per lini lalu per vendor, dengan ringkasan"], ["komparasi", "Komparasi vendor", "Beberapa vendor berdampingan dalam satu lini bisnis"], ["satu_vendor", "Satu vendor", "Semua layanan dan harga satu vendor"], ["mentah", "Data mentah (Excel)", "Satu baris per tarif, tanpa format"]]
          .map(([id, t, d]) => `<button class="lp-kartu ${st.jenis === id ? "is-aktif" : ""}" data-jenis="${id}"><b>${t}</b><span>${d}</span></button>`)
          .join("")}
      </div>
      <div class="mr-form" style="margin-top:14px">
        ${
          st.jenis === "master"
            ? `<div class="mr-f mr-f--lebar"><small>Berisi semua tarif, termasuk yang belum diisi atau belum punya lini bisnis. PDF memuat ringkasan dan identitas vendor di halaman pertama, lalu tarif per lini dan per vendor.</small></div>`
            : st.jenis === "komparasi"
            ? `<label class="mr-f mr-f--lebar"><span>Lini bisnis *</span><select id="lp-lini"><option value="">Pilih lini bisnis…</option>${liniAda.map((l) => `<option value="${e(l.id)}" ${l.id === st.lini ? "selected" : ""}>${e(namaLini(l.id))}</option>`).join("")}</select></label>
               ${
                 st.lini
                   ? `<div class="mr-f mr-f--lebar"><span>Vendor yang dibandingkan</span><div class="mr-cekgrup" id="lp-vendor">${vk.map((v) => `<label class="mr-cek lp-cekv" style="--vh:${hueVendor(v)}"><input type="checkbox" value="${e(v.id)}" checked><span>${e(v.nama || v.id)}</span></label>`).join("")}</div></div>
                      <label class="mr-f"><span>Perubahan sejak</span><input type="date" id="lp-sejak" value="${st.sejak}"><small>Kosongkan untuk menampilkan semua perubahan.</small></label>`
                   : ""
               }`
            : st.jenis === "satu_vendor"
            ? `<label class="mr-f mr-f--lebar"><span>Vendor *</span><select id="lp-vendorsatu"><option value="">Pilih vendor…</option>${vendorSemua.map((v) => `<option value="${e(v.id)}" ${v.id === st.vendorId ? "selected" : ""}>${e(v.nama || v.id)}</option>`).join("")}</select></label>
               <label class="mr-f"><span>Perubahan sejak</span><input type="date" id="lp-sejak" value="${st.sejak}"></label>`
            : `<div class="mr-f mr-f--lebar"><small>Berisi semua tarif yang sudah terisi (yang belum diisi tidak ikut). Cocok untuk pihak yang meminta file mentah. Bisa dibatasi dengan filter lini dan vendor di tabel sebelum membuka dialog ini.</small></div>`
        }
        <div class="mr-f"><span>Format</span><div class="mr-seg" id="lp-format">${[["pdf", "PDF"], ["excel", "Excel"]].map(([f, t]) => `<button type="button" class="mr-seg__btn ${st.format === f ? "is-aktif" : ""}" data-fmt="${f}" ${st.jenis === "mentah" && f === "pdf" ? "disabled" : ""}>${t}</button>`).join("")}</div></div>
      </div>
      <div id="lp-hasil"></div>`;
    $("#lp-unduh-label", panel).textContent = `Unduh ${st.format === "pdf" ? "PDF" : "Excel"}`;
  }

  function ambilPilihan() {
    return { vendorIds: $$("#lp-vendor input:checked", panel).map((c) => c.value), sejak: ($("#lp-sejak", panel) || {}).value || "" };
  }

  async function bangunModel() {
    const { vendorIds, sejak } = ambilPilihan();
    if (st.jenis === "komparasi") {
      if (!st.lini) throw new Error("Pilih lini bisnis dulu.");
      if (!vendorIds.length) throw new Error("Pilih minimal satu vendor.");
      const riwayat = await DB.muatRiwayatLini(st.lini);
      return susunKomparasi({ rows: S.tarif, riwayat, liniId: st.lini, vendorIds, sejak, namaVendor, namaLini, vendorList: S.vendor });
    }
    if (st.jenis === "satu_vendor") {
      if (!st.vendorId) throw new Error("Pilih vendor dulu.");
      const liniVendor = [...new Set(S.tarif.filter((t) => t.vendorId === st.vendorId && adaModal(t)).map((t) => t.liniBisnisId))];
      const riwayat = (await Promise.all(liniVendor.map((l) => DB.muatRiwayatLini(l)))).flat();
      return susunSatuVendor({ rows: S.tarif, riwayat, vendorId: st.vendorId, sejak, namaVendor, namaLini, vendorList: S.vendor });
    }
    if (st.jenis === "master") return susunMaster({ rows: S.tarif, vendorList: S.vendor, namaVendor, namaLini, namaSatuan });
    return { jenis: "mentah", baris: susunMentah({ rows: S.tarif, namaVendor, namaLini, satuanNama: namaSatuan }) };
  }

  async function pratinjau() {
    const hasil = $("#lp-hasil", panel);
    hasil.innerHTML = `<div class="mr-kosong">${ikon("riwayat", 24)}<p>Menyusun laporan…</p></div>`;
    try {
      st.model = await bangunModel();
      const m = st.model;
      if (m.jenis === "mentah") hasil.innerHTML = `<div class="mr-banner">${ikon("info")}<div><b>${m.baris.length} baris</b> tarif terisi akan masuk ke file Excel.</div></div>`;
      else if (m.jenis === "master") hasil.innerHTML = `<div class="mr-banner">${ikon("info")}<div><b>${angkaId(m.ringkasan.tarif)} tarif</b> dari ${angkaId(m.ringkasan.vendor)} vendor dan ${angkaId(m.ringkasan.lini)} lini bisnis. ${angkaId(m.ringkasan.belumModal)} belum ada modal, ${angkaId(m.ringkasan.belumLini)} belum ada lini. Unduh untuk melihat isi lengkapnya.</div></div>`;
      else hasil.innerHTML = `<div class="lp-bingkai">${m.jenis === "komparasi" ? htmlKomparasi(m, meta) : htmlSatuVendor(m, meta)}</div>`;
      return m;
    } catch (err) {
      st.model = null;
      hasil.innerHTML = `<p class="mr-galat">${e(err.message)}</p>`;
      return null;
    }
  }

  async function unduh() {
    const m = st.model || (await pratinjau());
    if (!m) return;
    if (demo) {
      toast(`Di versi online, tombol ini mengunduh file <b>${st.format === "pdf" ? "PDF" : "Excel"}</b>. Unduhan dimatikan di mode demo; pratinjau di layar menunjukkan isinya.`, "ok");
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (m.jenis === "master") {
        if (!m.baris.length) throw new Error("Belum ada tarif untuk dilaporkan.");
        if (st.format === "pdf") buatPdfMaster(m, meta).save(`laporan-master_${stamp}.pdf`);
        else simpanExcel(buatExcelMentah(m.baris), `laporan-master_${stamp}.xlsx`);
      } else if (m.jenis === "mentah") {
        if (!m.baris.length) throw new Error("Tidak ada tarif terisi untuk diekspor.");
        simpanExcel(buatExcelMentah(m.baris), `tarif-mentah_${stamp}.xlsx`);
      } else if (m.jenis === "komparasi") {
        if (!m.baris.length) throw new Error("Tidak ada tarif terisi yang cocok, jadi tidak ada yang bisa dilaporkan.");
        if (st.format === "pdf") buatPdfKomparasi(m, meta).save(`laporan-komparasi_${st.lini}_${stamp}.pdf`);
        else simpanExcel(buatExcelKomparasi(m), `laporan-komparasi_${st.lini}_${stamp}.xlsx`);
      } else {
        if (!m.kelompok.length) throw new Error("Vendor ini belum punya tarif terisi.");
        if (st.format === "pdf") buatPdfSatuVendor(m, meta).save(`laporan-vendor_${m.vendorId}_${stamp}.pdf`);
        else simpanExcel(buatExcelSatuVendor(m), `laporan-vendor_${m.vendorId}_${stamp}.xlsx`);
      }
      toast("Laporan diunduh.", "ok");
    } catch (err) {
      toast(`<b>Laporan gagal dibuat.</b><br>${e(err.message)}`, "bahaya");
    }
  }

  panel.addEventListener("click", (ev) => {
    const j = ev.target.closest("[data-jenis]");
    if (j) {
      st.jenis = j.dataset.jenis;
      if (st.jenis === "mentah") st.format = "excel";
      st.model = null;
      gambar();
    }
    const f = ev.target.closest("[data-fmt]");
    if (f && !f.disabled) {
      st.format = f.dataset.fmt;
      $$("#lp-format .mr-seg__btn", panel).forEach((b) => b.classList.toggle("is-aktif", b.dataset.fmt === st.format));
      $("#lp-unduh-label", panel).textContent = `Unduh ${st.format === "pdf" ? "PDF" : "Excel"}`;
    }
  });
  panel.addEventListener("change", (ev) => {
    if (ev.target.id === "lp-lini") {
      st.lini = ev.target.value;
      st.model = null;
      gambar();
    } else if (ev.target.id === "lp-vendorsatu") st.vendorId = ev.target.value;
    st.model = null;
  });
  $("#lp-pratinjau", panel).onclick = pratinjau;
  $("#lp-unduh", panel).onclick = unduh;
  gambar();
}
