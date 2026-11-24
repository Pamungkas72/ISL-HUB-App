// Profil Tracking Daily Job: formulir pengiriman (desktop satu form berbagian, HP tiga langkah). Tampilan murni; logika di daily-job.js.
import { e } from "./ui.js";
import { SUBDIVISI, TAGIHAN, BAYAR, subdivisiDari, rinci } from "./daily-job-tracking-hitung.js";
import * as TL from "./daily-job-trailer-hitung.js";

const f = (lab, isi, kelas = "") => `<label class="mr-f ${kelas}"><span>${lab}</span>${isi}</label>`;
const inp = (id, v, ph = "", ekstra = "") => `<input id="${id}" value="${e(v ?? "")}" placeholder="${e(ph)}" ${ekstra}>`;
/** Chip pilihan tunggal; nilainya disimpan di data-<k> pada #dj-form (lihat aksi t-set). */
export const chipPil = (k, nilai, items) => `<div class="mr-seg dj-seg" role="group">${items.map(([v, l]) => `<button type="button" class="mr-chip${v === nilai ? " is-aktif" : ""}" data-dj="t-set" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</div>`;
const opsiKat = (sub, pilih) => (SUBDIVISI[sub] || SUBDIVISI.kecil).kategori.map((k) => `<option${k === pilih ? " selected" : ""}>${e(k)}</option>`).join("");
const rp = (n) => (n ? Number(n).toLocaleString("id-ID") : "");
export const dataFormTracking = (d) => { const r = rinci(d), sub = r.sub || subdivisiDari(d.kategori) || "kecil"; return { sub, bayar: r.bayar || "cash", pod: r.pod || "belum", tagihan: r.tagihan || "belum" }; };

/** Isi formulir Tracking. c: { picList, vendorList, berkas, lain, tunda } = potongan bersama dengan formulir lain. */
export function htmlFormTracking(d, c) {
  const r = rinci(d), st = dataFormTracking(d);
  return `<div class="dj-lng" data-lng="1"><h4 class="dj-lng__h">1. Pengiriman</h4>
    ${f("Customer *", inp("djt-cust", d.customer, "Nama customer"), "dj-lebar")}
    <div class="mr-f dj-lebar"><span>Subdivisi</span>${chipPil("sub", st.sub, Object.entries(SUBDIVISI).map(([k, s]) => [k, s.nama]))}</div>
    ${f("Asal *", inp("djt-asal", r.asal, "mis. Cikarang"))}${f("Tujuan *", inp("djt-tujuan", r.tujuan, "mis. Surabaya"))}
    ${f("No. DO / surat jalan *", inp("djt-do", r.noDo, "mis. DO-2026-1187"))}${f("Kategori armada / jenis shipment *", `<select id="djf-kat">${opsiKat(st.sub, d.kategori)}</select>`)}
    <div class="dj-besar dj-lebar${st.sub === "besar" ? "" : " dj-sembunyi"}"><div class="dj-lng__sub">Kontainer</div><div class="dj-g2">${f("No. kontainer", inp("djt-kont", r.kontainer, "mis. ABCU 1234567"))}${f("Ukuran", `<select id="djt-ukuran"><option value="">–</option>${TL.UKURAN.map((u) => `<option${u === r.ukuran ? " selected" : ""} value="${u}">${u === "40HC" ? "40 HC" : u + "\u2032"}</option>`).join("")}</select>`)}${f("Pelayaran", inp("djt-pelayaran", r.pelayaran))}${f("Depo MT (nama depo)", inp("djt-depo", r.depo))}</div></div>
    ${f("Tanggal kirim", `<input type="date" id="djt-kirim" value="${e(r.tglKirim || d.tglMasuk || "")}">`)}${f(c.targetLabel, `<input type="date" id="djf-target" value="${e(d.tglTarget || "")}"${c.targetKunci ? " disabled" : ""}>`)}
    ${f("PIC", `<input id="djf-pic" list="djf-piclist" value="${e(d.pic || "")}"><datalist id="djf-piclist">${c.picList.map((p) => `<option value="${e(p)}">`).join("")}</datalist>`)}</div>
  <div class="dj-lng" data-lng="2"><h4 class="dj-lng__h">2. Armada dan vendor</h4>
    ${f("Vendor <small>kosongkan atau isi \"Internal\" bila armada sendiri</small>", `<input id="djt-vendor" list="djt-vendorlist" value="${e(r.vendor || "")}" placeholder="Nama vendor"><datalist id="djt-vendorlist">${c.vendorList.map((p) => `<option value="${e(p)}">`).join("")}</datalist>`, "dj-lebar")}
    ${f("Nama driver", inp("djt-driver", r.driver))}${f("Telepon driver", inp("djt-telp", r.telp, "", 'inputmode="tel"'))}${f("Plat nomor", inp("djt-plat", r.plat, "mis. B 1234 XYZ"))}</div>
  <div class="dj-lng" data-lng="3"><h4 class="dj-lng__h">3. Biaya dan status</h4>
    <div class="mr-f dj-lebar"><span>Pembayaran vendor</span>${chipPil("bayar", st.bayar, Object.entries(BAYAR))}</div>
    ${f("Cost (Rp) <small id=\"djt-costinfo\">uang jalan bila armada internal</small>", inp("djt-cost", rp(r.cost), "mis. 2.500.000", 'inputmode="numeric"'))}
    <div class="mr-f dj-lebar"><span>POD</span>${chipPil("pod", st.pod, [["belum", "Belum kembali"], ["kembali", "Sudah kembali"]])}</div>
    ${f("Tanggal POD kembali", `<input type="date" id="djt-tglpod" value="${e(r.tglPod || "")}">`, "dj-tglpod" + (st.pod === "kembali" ? "" : " dj-sembunyi"))}
    <div class="mr-f dj-lebar dj-kecil${st.sub === "besar" ? " dj-sembunyi" : ""}"><span>Tagihan vendor</span>${chipPil("tagihan", st.tagihan, Object.entries(TAGIHAN))}</div>
    <div class="dj-besar${st.sub === "besar" ? "" : " dj-sembunyi"}">${f("Tanggal bayar vendor <small>kosongkan bila belum dibayar</small>", `<input type="date" id="djt-tglbayar" value="${e(r.tglBayar || "")}">`)}${f("Janji POD kembali <small>wajib bila sudah dibayar sebelum POD kembali</small>", `<input type="date" id="djt-janji" value="${e(r.janjiPod || "")}">`)}</div>
    ${c.status}${c.tunda}
    ${f("Catatan", `<textarea id="djf-desk" rows="2">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}${c.berkas}${c.lain}</div>`;
}

const fmtW = (w) => { const d = new Date(String(w).length === 16 ? w + ":00+07:00" : w); return isNaN(d) ? "" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":"); };
/** Panel detail Trailer: stepper tahap bertanda waktu, tombol tahap berikut, risiko POD, dan daftar dokumen. ubah = boleh mengubah job. */
export function htmlTrailerDetail(j, ubah, now) {
  const r = rinci(j), jn = TL.jenisTrailer(j); if (!jn) return "";
  const t = TL.tahapJenis(jn), n = TL.kemajuan(j), b = TL.tahapBerikut(j), id = e(j.id), umur = TL.umurPod(j, now);
  const stp = t.map(([k, l], i) => `<li class="${i < n ? "is-ok" : i === n ? "is-now" : ""}"><i></i><div><b>${l}</b><small>${r.tahap && r.tahap[k] ? fmtW(r.tahap[k]) : i === n ? "Berikutnya" : "–"}</small></div></li>`).join("");
  const risiko = TL.dibayarTanpaPod(j) ? `<p class="dj-risiko dj-risiko--bahaya"><b>Berisiko:</b> sudah dibayar ${e(r.tglBayar)}, POD belum kembali${umur ? ` (${umur} hari sejak selesai operasional)` : ""}.${r.janjiPod ? ` Janji POD: ${e(r.janjiPod)}.` : " Isi janji POD kembali."}</p>` : TL.operasionalSelesai(j) && !TL.podKembali(j) ? `<p class="dj-risiko">POD belum kembali${umur ? ` · ${umur} hari` : ""}. Syarat penagihan ke customer.</p>` : "";
  const dok = TL.JENIS[jn].dok.map((x, i) => `<button type="button" class="mr-chip${r.dok && r.dok[i] ? " is-aktif" : ""}" ${ubah ? `data-dj="t-dok" data-id="${id}" data-i="${i}"` : "disabled"} aria-pressed="${!!(r.dok && r.dok[i])}">${r.dok && r.dok[i] ? "✓ " : ""}${e(x)}</button>`).join("");
  return `<div class="mr-kartu dj-kartu dj-trl"><h3>Tahap shipment · ${TL.JENIS[jn].nama}</h3><ol class="dj-stp">${stp}</ol>
    ${ubah ? `<div class="dj-trl__aksi">${b ? `<button type="button" class="mr-btn mr-btn--utama" data-dj="t-tahap" data-id="${id}">Tandai ${e(b[1])} selesai</button>` : ""}${n ? `<button type="button" class="mr-btn" data-dj="t-undo" data-id="${id}">Batalkan tahap terakhir</button>` : ""}</div>` : ""}${risiko}
    <h3>Dokumen</h3><div class="dj-seg mr-seg">${dok}</div></div>`;
}
