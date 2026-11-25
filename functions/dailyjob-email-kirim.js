// Pemicu pengirim antrean `dj_email` (kunci Resend: secret RESEND_API_KEY, bukan di repo). Antrean diisi dailyjob-email.js.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { kirim } = require("./dailyjob-email-kirim-isi");

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

exports.kirimEmailCustomer = onDocumentCreated({ document: "dj_email/{id}", region: "asia-southeast2", secrets: [RESEND_API_KEY] }, async (ev) => {
  const hasil = await kirim(ev.data.data(), RESEND_API_KEY.value());
  if (hasil) await ev.data.ref.update(hasil);
});
