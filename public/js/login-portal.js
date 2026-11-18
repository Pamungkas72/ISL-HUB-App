// ===========================================================
// LOGIN — portal pelabuhan.
// Foto pelabuhan 2,5D (js/portal-parallax.js, WebGL) menjadi latar di desktop dan HP.
// Panel kaca berisi tab modul + form login (js/login.js), tampil langsung di desktop maupun HP.
// ISL HUB = form di panel; modul lain menampilkan keterangan singkat. Desktop: latar bergerak mengikuti kursor; HP: kemiringan atau sentuhan.
// ===========================================================
const hp = matchMedia("(max-width: 760px)");
const portal = document.getElementById("portal");

if (portal) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let parallax = null;
  const muatLatar = async () => {
    const kanvas = document.getElementById("portal-kanvas");
    try {
      const { mulaiParallax } = await import("./portal-parallax.js");
      const ponsel = hp.matches;
      // foto asli (truk diam di posisi aslinya) dengan efek kedalaman; tanpa adegan hidup
      const P = "assets/portal/";
      parallax = await mulaiParallax(kanvas, { foto: P + "foto-hd.jpg", depth: P + "depth-hd.png", kurangiGerak: reduce,
        ringan: ponsel, fokus: ponsel ? 0.42 : 0.5, amp: ponsel ? 0.02 : 0.035, giro: ponsel });
    } catch (err) {
      // tanpa WebGL: foto diam sebagai latar biasa
      console.warn("Latar WebGL tidak tersedia, memakai foto diam:", err && err.message);
      portal.style.background = "#0b1a30 url(assets/portal/foto-hd.jpg) center / cover no-repeat";
      kanvas.style.display = "none";
    }
    portal.classList.add("siap");
    if (location.search.includes("uji-portal")) window.__portalParallax = parallax; // hanya untuk pengujian/rekaman
  };
  muatLatar();

  // tab modul: ISL HUB = fokus ke form; modul lain menampilkan keterangan singkat
  const mobInfo = document.getElementById("mob-info"); let mobTimer = 0;
  document.querySelectorAll(".mob-chip").forEach((c) => c.addEventListener("click", () => {
    if (c.dataset.aktif === "1") { const e1 = document.getElementById("email"), e2 = document.getElementById("df-nama"); const f = [e1, e2].find((x) => x && x.offsetParent); if (f) f.focus(); return; }
    mobInfo.textContent = c.dataset.nama + " belum aktif. Login-nya muncul di sini saat modul dirilis.";
    mobInfo.classList.add("on"); clearTimeout(mobTimer); mobTimer = setTimeout(() => mobInfo.classList.remove("on"), 3200);
  }));

  // #masuk (tautan dari halaman lain): langsung fokus ke kolom isian
  if (location.hash === "#masuk") setTimeout(() => document.getElementById("email")?.focus(), 400);
}
