// Template email bawaan (sama persis dengan public/js/notif-bawaan.js; dijaga tests/unit/notif-pengaturan.test.js).
// Variabel: {nama} {referensi} {rute} {tglKirim}. Baris yang semua variabelnya kosong dibuang.
module.exports = {
  diterima: {
    id: { subjek: "Order diterima · {referensi}", isi: "Yth. {nama},\n\nOrder pengiriman Anda telah kami terima.\n\nReferensi: {referensi}\nRute: {rute}\nTanggal kirim: {tglKirim}\n\nKami akan mengabari kembali setelah pengiriman selesai.\n\nSalam,\nISL Tracking" },
    en: { subjek: "Order received · {referensi}", isi: "Dear {nama},\n\nWe have received your shipment order.\n\nReference: {referensi}\nRoute: {rute}\nShipping date: {tglKirim}\n\nWe will keep you updated once the shipment is completed.\n\nBest regards,\nISL Tracking" },
  },
  terkirim: {
    id: { subjek: "Pengiriman selesai · {referensi}", isi: "Yth. {nama},\n\nPengiriman Anda telah selesai.\n\nReferensi: {referensi}\nRute: {rute}\n\nPOD dan tagihan akan segera kami kirimkan.\n\nSalam,\nISL Tracking" },
    en: { subjek: "Shipment completed · {referensi}", isi: "Dear {nama},\n\nYour shipment has been completed.\n\nReference: {referensi}\nRoute: {rute}\n\nThe proof of delivery (POD) and invoice will be sent to you shortly.\n\nBest regards,\nISL Tracking" },
  },
};
