// Jalankan: node tests/unit/daily-job-email-kirim.test.js
const { kirim } = require("../../functions/dailyjob-email-kirim-isi.js");
let gagal = 0; const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) gagal++; console.log(ok ? "LULUS" : "GAGAL", n, ok ? "" : `dapat ${JSON.stringify(a)}, harus ${JSON.stringify(b)}`); };
(async () => {
  const d = { jobId: "j1", tahap: "terkirim", ke: "a@b.co", subjek: "S", isi: "I", status: "antre" }; let req;
  const ok = async (u, o) => { req = { u, o }; return { ok: true }; }, bad = async () => ({ ok: false, status: 422, text: async () => "domain belum terverifikasi" });
  const h = await kirim(d, "KUNCI", ok);
  eq("terkirim", h.status, "terkirim");
  eq("alamat, kunci, idempotensi", [req.u, req.o.headers.Authorization, req.o.headers["Idempotency-Key"]], ["https://api.resend.com/emails", "Bearer KUNCI", "dj_email-j1-terkirim"]);
  const b = JSON.parse(req.o.body); eq("isi dikirim", [b.to, b.subject, b.text], [["a@b.co"], "S", "I"]);
  eq("gagal dicatat", (await kirim(d, "K", bad)).status, "gagal");
  eq("tanpa-email dilewati", await kirim({ ...d, status: "tanpa-email", ke: "" }, "K", ok), null);
  eq("sudah terkirim dilewati", await kirim({ ...d, status: "terkirim" }, "K", ok), null);
  const banyak = await kirim({ ...d, kepada: ["a@x.id", "b@x.id"] }, "K", ok); eq("banyak penerima dikirim dalam satu email", [banyak.status, JSON.parse(req.o.body).to], ["terkirim", ["a@x.id", "b@x.id"]]);
  const lamp = { ...d, tahap: "laporan", lampiran: { x: 1 } }; await kirim(lamp, "K", ok, async () => ({ nama: "r.xlsx", base64: "QQ==" }));
  eq("lampiran ikut sebagai attachment", JSON.parse(req.o.body).attachments, [{ filename: "r.xlsx", content: "QQ==" }]);
  eq("lampiran kosong: dilewati, tidak dikirim", [(await kirim(lamp, "K", async () => { throw new Error("jangan kirim"); }, async () => null)).status], ["dilewati"]);
  eq("lampiran tanpa pembuat: gagal", (await kirim(lamp, "K", ok)).status, "gagal");
  process.exit(gagal ? 1 : 0);
})();
