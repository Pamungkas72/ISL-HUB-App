// Isi email "pengiriman selesai" untuk customer. Murni (tanpa jaringan) supaya mudah diuji.
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Customer yang namanya sama dengan job; email dari kontak utama, lalu kontak lain yang beralamat. Customer dengan emailSelesai === false dilewati. */
function cariPenerima(customers, nama) {
  const c = customers.find((x) => norm(x.nama) === norm(nama) || (x.alias && norm(x.alias) === norm(nama)));
  if (!c || c.emailSelesai === false) return null;
  const k = [...(c.kontak || [])].sort((a, b) => (b.utama ? 1 : 0) - (a.utama ? 1 : 0)).find((z) => EMAIL.test(String(z.email || "").trim()));
  return k ? { email: k.email.trim(), nama: k.nama || "", bahasa: c.bahasa === "en" ? "en" : "id" } : null;
}

const TEKS = {
  id: { sub: (n) => `Pengiriman selesai${n ? ` – ${n}` : ""}`, hai: (n) => `Yth. ${n || "Bapak/Ibu"},`, isi: "Pengiriman berikut telah selesai:", cust: "Customer", rute: "Rute", doc: "No. DO", tgl: "Tanggal selesai", tutup: "Terima kasih telah mempercayakan pengiriman Anda kepada kami." },
  en: { sub: (n) => `Shipment completed${n ? ` – ${n}` : ""}`, hai: (n) => `Dear ${n || "Sir/Madam"},`, isi: "The following shipment has been completed:", cust: "Customer", rute: "Route", doc: "DO No.", tgl: "Completion date", tutup: "Thank you for trusting us with your shipment." },
};

function susunEmail(job, p) {
  const t = TEKS[p.bahasa] || TEKS.id, r = job.rinci || {};
  const rute = [r.asal, r.tujuan].filter(Boolean).join(" → ");
  const baris = [[t.cust, job.customer], [t.rute, rute], [t.doc, r.noDo], [t.tgl, job.tglSelesai || r.tglPod]].filter(([, v]) => v);
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><p>${esc(t.hai(p.nama))}</p><p>${esc(t.isi)}</p><table style="border-collapse:collapse">${baris.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#666">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table><p>${esc(t.tutup)}</p><p>PT Indo Sukses Logistik</p></div>`;
  const text = [t.hai(p.nama), "", t.isi, ...baris.map(([k, v]) => `${k}: ${v}`), "", t.tutup, "PT Indo Sukses Logistik"].join("\n");
  return { subject: t.sub(r.noDo), html, text };
}
module.exports = { cariPenerima, susunEmail, norm };
