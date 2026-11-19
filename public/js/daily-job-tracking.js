// Profil Tracking Daily Job: formulir pengiriman (desktop satu form berbagian, HP tiga langkah). Tampilan murni; logika di daily-job.js.
import { e } from "./ui.js";
import { SUBDIVISI, TAGIHAN, BAYAR, subdivisiDari, rinci } from "./daily-job-tracking-hitung.js";

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
    ${f("No. DO / surat jalan *", inp("djt-do", r.noDo, "mis. DO-2026-1187"))}${f("Kategori armada *", `<select id="djf-kat">${opsiKat(st.sub, d.kategori)}</select>`)}
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
    <div class="mr-f dj-lebar"><span>Tagihan vendor</span>${chipPil("tagihan", st.tagihan, Object.entries(TAGIHAN))}</div>
    ${c.status}${c.tunda}
    ${f("Catatan", `<textarea id="djf-desk" rows="2">${e(d.deskripsi || "")}</textarea>`, "dj-lebar")}${c.berkas}${c.lain}</div>`;
}
